import { api, session, loadMeta, refreshUser } from '../api.js';
import { esc, fcfa, icon, options, onSubmit, toast, modal, empty, hueFor, date, num, $, $$ } from '../ui.js';
import { dash } from '../layout.js';

function shopFormHtml(s = {}, meta) {
  const spec = s.specialties || [];
  return `
    <div class="grid grid-2" style="gap:14px">
      <label class="field"><span>Nom de la boutique</span><input class="input" name="shop_name" required minlength="3" maxlength="60" value="${esc(s.shop_name || '')}" placeholder="Atelier Ndèye Couture"></label>
      <label class="field"><span>Slogan</span><input class="input" name="tagline" maxlength="120" value="${esc(s.tagline || '')}" placeholder="Le bazin brodé dans les règles de l’art"></label>
      <label class="field"><span>Ville</span><select class="input" name="city" required>${options(meta.cities, s.city || session.user.city || 'Dakar')}</select></label>
      <label class="field"><span>Quartier</span><input class="input" name="district" maxlength="60" value="${esc(s.district || '')}" placeholder="Médina, Parcelles, HLM…"></label>
      <label class="field"><span>Clientèle</span><select class="input" name="audience">${options([['mixte', 'Femmes, hommes & enfants'], ['femme', 'Femmes'], ['homme', 'Hommes'], ['enfant', 'Enfants']], s.audience)}</select></label>
      <label class="field"><span>Années d’expérience</span><input class="input" type="number" name="years_experience" min="0" max="70" value="${esc(s.years_experience ?? '')}"></label>
    </div>
    <div class="field"><span>Spécialités</span><div class="chips">
      ${meta.specialties.map((sp) => `<label class="chip"><input type="checkbox" name="specialties" value="${esc(sp)}" ${spec.includes(sp) ? 'checked' : ''}>${esc(sp)}</label>`).join('')}
    </div></div>
    <label class="field"><span>Présentation de l’atelier</span><textarea class="input" name="bio" maxlength="1500" placeholder="Votre parcours, votre savoir-faire, ce qui vous distingue…">${esc(s.bio || '')}</textarea></label>
    <label class="check"><input type="checkbox" name="home_delivery" value="1" ${s.home_delivery ? 'checked' : ''}> Je propose la livraison à domicile</label>`;
}

const shopBody = (fd) => ({ ...Object.fromEntries(fd), specialties: fd.getAll('specialties'), home_delivery: fd.get('home_delivery') === '1' });

// ---------------- Inscription tailleur ----------------
export async function onboarding({ app }) {
  const meta = await loadMeta();
  const { shop, registration_fee } = await api('/shop');
  document.title = 'Ouvrir ma boutique — Ñawkat';
  if (shop?.status === 'active') { location.hash = '#/boutique'; return; }
  const step = shop ? 2 : 1;

  app.innerHTML = `<div class="container narrow" style="padding:32px 20px 60px">
    <span class="eyebrow">Étape ${step} sur 2</span>
    <h1 style="font-size:2rem">${step === 1 ? 'Présentez votre boutique' : 'Activez votre boutique'}</h1>
    <div class="progress-steps" style="margin:18px 0 26px"><div class="ps ${step > 1 ? 'done' : 'current'}">Boutique</div><div class="ps ${step === 2 ? 'current' : ''}">Paiement</div><div class="ps">En ligne</div></div>
    ${step === 1 ? `<form id="f" class="card card-body stack"><div class="form-error hidden"></div>${shopFormHtml({}, meta)}
        <button class="btn btn-primary btn-lg" type="submit">Continuer</button></form>`
      : `<div class="card card-body stack">
        <div class="row">${icon.store}<div><strong>${esc(shop.shop_name)}</strong><div class="small muted">${esc(shop.city)} · ${shop.specialties.map(esc).join(', ')}</div></div><a class="btn btn-ghost btn-sm" style="margin-left:auto" href="#/boutique">Modifier</a></div>
        <hr style="margin:6px 0">
        <div class="row between"><div><strong>Frais d’inscription</strong><div class="small muted">Paiement unique · boutique visible immédiatement</div></div><div style="font-family:var(--display);font-size:1.8rem;font-weight:600">${fcfa(registration_fee)}</div></div>
        <ul class="small" style="margin:0;padding-left:18px"><li>Vitrine en ligne avec prestations et photos</li><li>Commandes et paiements sécurisés</li><li>Commission de ${Math.round(meta.commission_rate * 100)} % seulement sur les commandes payées</li></ul>
        <button class="btn btn-primary btn-lg" id="pay">Payer ${fcfa(registration_fee)} par Wave / Orange Money</button>
        <p class="xs muted center" style="margin:0">Vous pouvez déjà ajouter vos prestations et photos depuis <a href="#/boutique">Ma boutique</a> avant de payer.</p>
      </div>`}
  </div>`;

  if (step === 1) {
    onSubmit($('#f'), async (fd) => {
      await api('/shop', { method: 'PUT', body: shopBody(fd) });
      await refreshUser();
      onboarding({ app });
    });
  } else {
    $('#pay').onclick = async (e) => {
      e.target.disabled = true;
      try {
        const { redirect_url } = await api('/shop/registration-payment', { method: 'POST' });
        location.href = redirect_url;
      } catch (err) { toast(err.message, 'err'); e.target.disabled = false; }
    };
  }
}

// ---------------- Gestion de la boutique ----------------
export async function shop({ app, query }) {
  const meta = await loadMeta();
  const { shop: s } = await api('/shop');
  if (!s) { location.hash = '#/onboarding'; return; }
  document.title = 'Ma boutique — Ñawkat';
  const tab = query.tab || 'services';
  const tabs = [['services', `Prestations (${s.services.length})`], ['portfolio', `Réalisations (${s.portfolio.length})`], ['infos', 'Informations']];

  let content = '';
  if (tab === 'infos') {
    content = `<div class="card card-body stack">
      <div class="row">
        <div class="cover" style="width:100%;height:150px;border-radius:12px;overflow:hidden;background-color:${hueFor(s.id)}">${s.cover ? `<img src="${esc(s.cover)}" alt="">` : ''}</div>
      </div>
      <div class="row">
        <label class="btn btn-outline btn-sm">${icon.image} Photo de profil<input type="file" accept="image/jpeg,image/png,image/webp" data-upload="avatar" hidden></label>
        <label class="btn btn-outline btn-sm">${icon.image} Image de couverture<input type="file" accept="image/jpeg,image/png,image/webp" data-upload="cover" hidden></label>
      </div>
      <form id="f" class="stack"><div class="form-error hidden"></div>${shopFormHtml(s, meta)}<button class="btn btn-primary" type="submit">Enregistrer</button></form>
    </div>`;
  } else if (tab === 'services') {
    content = `<div class="row between" style="margin-bottom:14px"><p class="muted small" style="margin:0">Vos prestations avec un prix « à partir de ». Le prix final est fixé dans le devis.</p><button class="btn btn-primary btn-sm" id="add-svc">${icon.plus} Ajouter</button></div>
      <div class="card">${s.services.length ? s.services.map((v) => `<div class="service">
        <div class="thumb cover" style="background-color:${hueFor(v.id)}">${v.image ? `<img src="${esc(v.image)}" alt="">` : ''}</div>
        <div><span class="badge">${esc(v.category)}</span> ${v.active ? '' : '<span class="badge badge-red">Masquée</span>'}<h3 style="margin:6px 0 2px">${esc(v.title)}</h3><div class="small muted">${fcfa(v.price)} · ${v.delay_days} jours</div></div>
        <div class="row"><button class="btn btn-sm btn-outline" data-edit="${v.id}">${icon.edit}</button><button class="btn btn-sm btn-danger" data-del="${v.id}">${icon.trash}</button></div>
      </div>`).join('') : empty('🧵', 'Aucune prestation', 'Ajoutez vos modèles phares avec un prix indicatif.')}</div>`;
  } else {
    content = `<form id="pf" class="card card-body row" style="margin-bottom:16px;align-items:end"><div class="form-error hidden" style="width:100%"></div>
        <label class="field" style="flex:1;min-width:200px"><span>Photo</span><input class="input" type="file" name="image" accept="image/jpeg,image/png,image/webp" required></label>
        <label class="field" style="flex:1;min-width:200px"><span>Légende</span><input class="input" name="caption" maxlength="120" placeholder="Grand boubou bazin riche"></label>
        <button class="btn btn-primary" type="submit">${icon.plus} Ajouter</button></form>
      ${s.portfolio.length ? `<div class="gallery">${s.portfolio.map((p) => `<figure><img src="${esc(p.image)}" alt="">${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}<button class="btn btn-sm btn-danger del" data-pdel="${p.id}" aria-label="Supprimer">${icon.trash}</button></figure>`).join('')}</div>` : empty('📸', 'Aucune réalisation', 'Les photos de vos créations sont votre meilleure vitrine.')}`;
  }

  app.innerHTML = dash(`
    ${s.status !== 'active' ? `<div class="notice warn" style="margin-bottom:16px">${icon.info}<div>Votre boutique n’est pas encore visible. <a href="#/onboarding"><strong>Régler les frais d’inscription</strong></a></div></div>` : ''}
    <div class="page-title"><div><h1>${esc(s.shop_name)}</h1><div class="small muted">${s.verified ? 'Boutique vérifiée ✓' : 'Vérification d’identité en attente'} · Note ${s.score != null ? `${s.score.toFixed(1)}/5` : '—'}</div></div>
      <a class="btn btn-outline" href="#/t/${esc(s.slug)}">Voir ma boutique publique</a></div>
    <div class="tabs">${tabs.map(([k, l]) => `<a href="#/boutique?tab=${k}" class="${tab === k ? 'active' : ''}">${l}</a>`).join('')}</div>
    ${content}`);

  const reload = () => shop({ app, query: { tab } });

  if (tab === 'infos') {
    onSubmit($('#f'), async (fd) => { await api('/shop', { method: 'PUT', body: shopBody(fd) }); toast('Boutique mise à jour.', 'ok'); refreshUser(); });
    $$('[data-upload]').forEach((inp) => (inp.onchange = async () => {
      const fd = new FormData();
      fd.append('image', inp.files[0]);
      try { await api(`/shop/${inp.dataset.upload}`, { method: 'POST', form: fd }); toast('Image mise à jour.', 'ok'); refreshUser(); reload(); } catch (e) { toast(e.message, 'err'); }
    }));
  }
  if (tab === 'services') {
    $('#add-svc').onclick = () => serviceModal(null, meta, reload);
    $$('[data-edit]').forEach((b) => (b.onclick = () => serviceModal(s.services.find((v) => v.id === Number(b.dataset.edit)), meta, reload)));
    $$('[data-del]').forEach((b) => (b.onclick = async () => {
      if (!confirm('Supprimer cette prestation ?')) return;
      await api(`/shop/services/${b.dataset.del}`, { method: 'DELETE' }); reload();
    }));
  }
  if (tab === 'portfolio') {
    onSubmit($('#pf'), async (fd) => { await api('/shop/portfolio', { method: 'POST', form: fd }); toast('Photo ajoutée.', 'ok'); reload(); });
    $$('[data-pdel]').forEach((b) => (b.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('Supprimer cette photo ?')) return;
      await api(`/shop/portfolio/${b.dataset.pdel}`, { method: 'DELETE' }); reload();
    }));
  }
}

function serviceModal(v, meta, done) {
  modal(v ? 'Modifier la prestation' : 'Nouvelle prestation', `<form id="sf" class="stack"><div class="form-error hidden"></div>
    <label class="field"><span>Intitulé</span><input class="input" name="title" required minlength="3" maxlength="80" value="${esc(v?.title || '')}" placeholder="Grand boubou bazin brodé"></label>
    <label class="field"><span>Catégorie</span><select class="input" name="category">${options(meta.specialties, v?.category)}</select></label>
    <div class="grid grid-2" style="gap:12px">
      <label class="field"><span>Prix à partir de (FCFA)</span><input class="input" type="number" name="price" min="500" step="500" required value="${esc(v?.price || '')}"></label>
      <label class="field"><span>Délai (jours)</span><input class="input" type="number" name="delay_days" min="1" max="120" required value="${esc(v?.delay_days || 7)}"></label>
    </div>
    <label class="field"><span>Description</span><textarea class="input" name="description" maxlength="800">${esc(v?.description || '')}</textarea></label>
    <label class="field"><span>Photo ${v?.image ? '(laisser vide pour conserver)' : ''}</span><input class="input" type="file" name="image" accept="image/jpeg,image/png,image/webp"></label>
    <label class="check"><input type="checkbox" name="active" value="1" ${v?.active === 0 ? '' : 'checked'}> Visible dans ma boutique</label>
    <button class="btn btn-primary" type="submit">Enregistrer</button></form>`, {
    onMount: (w, close) => onSubmit($('#sf', w), async (fd) => {
      if (!fd.get('image')?.size) fd.delete('image');
      if (!fd.get('active')) fd.set('active', '0');
      await api(v ? `/shop/services/${v.id}` : '/shop/services', { method: v ? 'PUT' : 'POST', form: fd });
      close(); toast('Prestation enregistrée.', 'ok'); done();
    }),
  });
}

// ---------------- Revenus ----------------
export async function finances({ app }) {
  if (!session.user.shop) { location.hash = '#/onboarding'; return; }
  const f = await api('/shop/finances');
  document.title = 'Revenus — Ñawkat';
  const b = f.balance;
  const c = f.counts || {};
  const METHODS = { wave: 'Wave', orange_money: 'Orange Money', free_money: 'Free Money' };
  const ST = { requested: ['En traitement', 'badge-accent'], paid: ['Versé', 'badge-verified'], rejected: ['Refusé', 'badge-red'] };

  app.innerHTML = dash(`
    <div class="page-title"><h1>Revenus</h1><button class="btn btn-primary" id="withdraw" ${b.available < 1000 ? 'disabled' : ''}>${icon.wallet} Retirer mes gains</button></div>
    <div class="kpis" style="margin-bottom:22px">
      <div class="kpi" style="background:var(--primary);color:#fff;border-color:var(--primary)"><strong>${fcfa(b.available)}</strong><span style="color:rgba(255,255,255,.75)">Disponible au retrait</span></div>
      <div class="kpi"><strong>${fcfa(b.escrow)}</strong><span>En séquestre (commandes en cours)</span></div>
      <div class="kpi"><strong>${fcfa(b.earned)}</strong><span>Gains totaux (net)</span></div>
      <div class="kpi"><strong>${fcfa(b.pending_payout)}</strong><span>Retraits en traitement</span></div>
    </div>
    <div class="grid grid-2">
      <div class="card card-body"><h3>Activité</h3><dl class="dl">
        <dt>Demandes à traiter</dt><dd>${num(c.requested)}</dd><dt>Devis en attente</dt><dd>${num(c.quoted)}</dd>
        <dt>En confection</dt><dd>${num(c.in_progress)}</dd><dt>Prêtes (à confirmer)</dt><dd>${num(c.ready)}</dd><dt>Terminées</dt><dd>${num(c.completed)}</dd></dl></div>
      <div class="card card-body"><h3>Par mois</h3>${f.monthly.length ? `<table class="table"><tbody>${f.monthly.map((m) => `<tr><td>${new Date(`${m.month}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</td><td>${m.orders} cmd</td><td style="text-align:right"><strong>${fcfa(m.net)}</strong></td></tr>`).join('')}</tbody></table>` : '<p class="muted small">Pas encore de commande terminée.</p>'}</div>
    </div>
    <div class="card" style="margin-top:20px"><div class="card-body" style="padding-bottom:0"><h3>Historique des retraits</h3></div>
      ${f.payouts.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Montant</th><th>Vers</th><th>Statut</th></tr></thead><tbody>
        ${f.payouts.map((p) => `<tr><td>${date(p.created_at)}</td><td>${fcfa(p.amount)}</td><td>${METHODS[p.method]} · ${esc(p.phone)}</td><td><span class="badge ${ST[p.status][1]}">${ST[p.status][0]}</span></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted small" style="padding:0 22px 22px">Aucun retrait pour le moment.</p>'}
    </div>`);

  $('#withdraw').onclick = () => modal('Retirer mes gains', `<form id="wf" class="stack"><div class="form-error hidden"></div>
    <p class="small muted">Disponible : <strong>${fcfa(b.available)}</strong>. Versement sous 24 h ouvrées.</p>
    <label class="field"><span>Montant (FCFA)</span><input class="input" type="number" name="amount" min="1000" max="${b.available}" value="${b.available}" required></label>
    <div class="pay-methods">${Object.entries(METHODS).map(([k, l], i) => `<label class="pay-method"><input type="radio" name="method" value="${k}" ${i === 0 ? 'checked' : ''}>${l}</label>`).join('')}</div>
    <label class="field"><span>Numéro de réception</span><div class="input-group"><span class="prefix">+221</span><input class="input" name="phone" value="${esc(session.user.phone.replace('+221', ''))}" required></div></label>
    <button class="btn btn-primary" type="submit">Demander le retrait</button></form>`, {
    onMount: (w, close) => onSubmit($('#wf', w), async (fd) => {
      await api('/shop/payouts', { method: 'POST', body: Object.fromEntries(fd) });
      close(); toast('Demande de retrait enregistrée.', 'ok'); finances({ app });
    }),
  });
}
