import { api, session, loadMeta } from '../api.js';
import { esc, fcfa, icon, avatar, date, dateTime, isoIn, statusBadge, empty, options, onSubmit, toast, modal, lightbox, hueFor, stars, $, $$ } from '../ui.js';
import { dash } from '../layout.js';

// ---------------- Nouvelle commande ----------------
export async function newOrder({ app, params, query }) {
  if (session.user.role !== 'client') {
    app.innerHTML = `<div class="container">${empty('🧵', 'Compte client requis', 'Les commandes se passent depuis un compte particulier.', '<a class="btn btn-primary" href="#/">Accueil</a>')}</div>`;
    return;
  }
  const [{ tailor: t }, meta] = await Promise.all([api(`/tailors/${encodeURIComponent(params.slug)}`), loadMeta()]);
  document.title = `Commander chez ${t.shop_name} — Ñawkat`;
  const saved = session.user.measurements || {};
  const pre = t.services.find((s) => String(s.id) === query.service);

  app.innerHTML = `<div class="container narrow" style="padding:32px 20px 50px">
    <a href="#/t/${esc(t.slug)}" class="small">${icon.back.replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-3px"')} Retour à la boutique</a>
    <div class="row" style="margin:16px 0 22px">${avatar(t.avatar, t.shop_name, t.id)}<div><h1 style="font-size:1.7rem;margin:0">Votre demande de confection</h1><div class="muted small">chez <strong>${esc(t.shop_name)}</strong> · ${esc(t.city)}</div></div></div>
    <div class="notice" style="margin-bottom:20px">${icon.info}<div>Gratuit et sans engagement : le tailleur vous répond avec un <strong>devis</strong> (prix et date). Vous ne payez que si vous l’acceptez.</div></div>
    <form id="f" class="stack">
      <div class="form-error hidden"></div>
      <div class="card card-body stack">
        <h3>1. Votre modèle</h3>
        ${t.services.length ? `<label class="field"><span>Prestation (facultatif)</span><select class="input" name="service_id">${options(t.services.map((s) => [s.id, `${s.title} — dès ${fcfa(s.price)}`]), pre?.id, 'Modèle personnalisé')}</select></label>` : ''}
        <label class="field"><span>Intitulé</span><input class="input" name="title" required maxlength="100" placeholder="Ex. Grand boubou brodé pour la Tabaski" value="${esc(pre?.title || '')}"></label>
        <label class="field"><span>Décrivez le modèle</span><textarea class="input" name="description" required minlength="10" placeholder="Coupe, couleurs, broderies, longueur, occasion…"></textarea></label>
        <label class="field"><span>Photo du modèle (facultatif)</span>
          <input class="input" type="file" name="model_image" accept="image/jpeg,image/png,image/webp" id="img">
          <small>Une photo trouvée sur Internet, sur Instagram ou prise en boutique. JPG/PNG, 5 Mo max.</small>
          <img id="preview" class="hidden" style="margin-top:10px;max-height:220px;border-radius:12px" alt="">
        </label>
        <div class="field"><span>Tissu</span>
          <div class="choice-cards">
            <label class="choice-card"><input type="radio" name="fabric_provided" value="1" checked><strong>Je fournis le tissu</strong><span class="small muted">Bazin, wax, getzner…</span></label>
            <label class="choice-card"><input type="radio" name="fabric_provided" value="0"><strong>Le tailleur fournit</strong><span class="small muted">Inclus dans le devis</span></label>
          </div></div>
      </div>

      <div class="card card-body stack">
        <h3>2. Vos mensurations <span class="small muted" style="font-weight:400">(en cm, facultatif)</span></h3>
        <p class="small muted" style="margin:0">${Object.keys(saved).length ? 'Pré-remplies depuis votre profil.' : 'Si vous ne les connaissez pas, le tailleur pourra les prendre à l’atelier.'}</p>
        <div class="grid grid-3" style="gap:12px">
          ${meta.measurements.map(([k, label]) => `<label class="field"><span class="small">${esc(label)}</span><input class="input" type="number" min="1" max="299" step="0.5" name="m_${k}" value="${esc(saved[k] ?? '')}"></label>`).join('')}
        </div>
      </div>

      <div class="card card-body stack">
        <h3>3. Date et remise</h3>
        <label class="field"><span>Pour quand ?</span><input class="input" type="date" name="desired_date" min="${isoIn(1)}"><small>Laissez vide si vous n’êtes pas pressé(e).</small></label>
        <div class="field"><span>Remise de la tenue</span>
          <div class="choice-cards">
            <label class="choice-card"><input type="radio" name="delivery_mode" value="retrait" checked><strong>Retrait à l’atelier</strong><span class="small muted">${esc(t.district || t.city)}</span></label>
            <label class="choice-card" ${t.home_delivery ? '' : 'style="opacity:.5;pointer-events:none"'}><input type="radio" name="delivery_mode" value="livraison"><strong>Livraison</strong><span class="small muted">${t.home_delivery ? 'Frais inclus dans le devis' : 'Non proposée'}</span></label>
          </div></div>
        <label class="field hidden" id="addr"><span>Adresse de livraison</span><input class="input" name="delivery_address" placeholder="Quartier, rue, point de repère"></label>
      </div>
      <button class="btn btn-primary btn-lg btn-block" type="submit">${icon.send} Envoyer ma demande</button>
    </form>
  </div>`;

  const form = $('#f');
  $('#img').onchange = (e) => {
    const f = e.target.files[0];
    const p = $('#preview');
    if (f) { p.src = URL.createObjectURL(f); p.classList.remove('hidden'); } else p.classList.add('hidden');
  };
  form.addEventListener('change', () => $('#addr').classList.toggle('hidden', form.delivery_mode.value !== 'livraison'));
  const svc = form.service_id;
  if (svc) svc.onchange = () => { const s = t.services.find((x) => String(x.id) === svc.value); if (s && !form.title.value) form.title.value = s.title; };

  onSubmit(form, async (fd) => {
    const m = {};
    for (const [k, v] of [...fd]) if (k.startsWith('m_')) { if (v) m[k.slice(2)] = v; fd.delete(k); }
    fd.append('measurements', JSON.stringify(m));
    fd.append('tailor_id', t.id);
    if (!fd.get('model_image')?.size) fd.delete('model_image');
    const { order } = await api('/orders', { method: 'POST', form: fd });
    Object.assign(session.user.measurements, m);
    toast('Demande envoyée ! Le tailleur va vous répondre.', 'ok');
    location.hash = `#/commandes/${order.id}`;
  });
}

// ---------------- Liste ----------------
export async function list({ app, query }) {
  const meta = await loadMeta();
  const isTailor = session.user.role === 'tailor';
  const filter = query.status || 'active';
  document.title = 'Commandes — Ñawkat';
  if (isTailor && session.user.shop?.status !== 'active') {
    app.innerHTML = dash(`<div class="notice warn">${icon.info}<div>Votre boutique n’est pas encore en ligne. <a href="#/onboarding">Finaliser mon inscription</a></div></div>`);
    return;
  }
  const { items } = await api(`/orders?status=${filter}`);
  const tabs = [['active', 'En cours'], ['done', 'Terminées'], ['all', 'Toutes']];
  app.innerHTML = dash(`
    <div class="page-title"><h1>${isTailor ? 'Commandes reçues' : 'Mes commandes'}</h1>${isTailor ? '' : '<a class="btn btn-primary" href="#/tailleurs">Nouvelle commande</a>'}</div>
    <div class="tabs">${tabs.map(([k, l]) => `<a href="#/commandes?status=${k}" class="${filter === k ? 'active' : ''}">${l}</a>`).join('')}</div>
    <div class="card">${items.length ? items.map((o) => `
      <a class="order-item" href="#/commandes/${o.id}">
        <div class="thumb cover" style="background-color:${hueFor(o.id)}">${o.model_image ? `<img src="${esc(o.model_image)}" alt="">` : ''}</div>
        <div class="grow"><strong>${esc(o.title)}</strong>
          <div class="small muted">${isTailor ? esc(o.client_name) : esc(o.shop_name)} · ${esc(o.ref)} · ${date(o.created_at)}</div></div>
        <div style="text-align:right">${statusBadge(o.status, meta.order_status)}
          <div class="small" style="margin-top:4px">${o.quote_amount ? fcfa(o.quote_amount) : ''}</div>
          ${!isTailor && o.status === 'completed' && !o.reviewed ? '<div class="xs" style="color:var(--terra);font-weight:600">À noter ★</div>' : ''}
          ${isTailor && o.status === 'requested' ? '<div class="xs" style="color:var(--terra);font-weight:600">Devis à envoyer</div>' : ''}
        </div>
      </a>`).join('') : empty('🧺', 'Aucune commande', isTailor ? 'Les demandes de vos clients apparaîtront ici.' : 'Trouvez un tailleur et envoyez votre premier modèle.', isTailor ? '' : '<a class="btn btn-primary" href="#/tailleurs">Trouver un tailleur</a>')}
    </div>`);
}

// ---------------- Détail ----------------
const FLOW = ['requested', 'quoted', 'paid', 'in_progress', 'ready', 'completed'];
const FLOW_LABELS = ['Demande', 'Devis', 'Paiement', 'Confection', 'Prête', 'Terminée'];

export async function detail({ app, params }) {
  const meta = await loadMeta();
  const { order: o } = await api(`/orders/${params.id}`);
  document.title = `${o.ref} — Ñawkat`;
  const isTailor = session.user.role === 'tailor';
  const isClient = !isTailor && session.user.role !== 'admin';
  const idx = FLOW.indexOf(o.status === 'disputed' ? 'ready' : o.status);
  const mEntries = meta.measurements.filter(([k]) => o.measurements[k]);

  const progress = idx >= 0
    ? `<div class="progress-steps">${FLOW_LABELS.map((l, i) => `<div class="ps ${i < idx || o.status === 'completed' ? 'done' : ''} ${i === idx && o.status !== 'completed' ? 'current' : ''}">${l}</div>`).join('')}</div>`
    : '';

  app.innerHTML = dash(`
    <a href="#/commandes" class="small">${icon.back.replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-3px"')} Toutes les commandes</a>
    <div class="page-title" style="margin-top:10px">
      <div><h1>${esc(o.title)}</h1><div class="muted small">${esc(o.ref)} · créée le ${date(o.created_at)}</div></div>
      ${statusBadge(o.status, meta.order_status)}
    </div>
    <div class="card card-body" style="margin-bottom:18px">${progress}</div>
    <div class="grid" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);align-items:start" id="cols">
      <div class="stack">
        <div id="action"></div>
        <div class="card card-body">
          <h3>Détails du modèle</h3>
          ${o.model_image ? `<img src="${esc(o.model_image)}" alt="Modèle" id="model-img" style="max-height:320px;border-radius:12px;margin-bottom:14px;cursor:zoom-in">` : ''}
          <p style="white-space:pre-line">${esc(o.description)}</p>
          <dl class="dl">
            ${o.service_title ? `<dt>Prestation</dt><dd>${esc(o.service_title)}</dd>` : ''}
            <dt>Tissu</dt><dd>${o.fabric_provided ? 'Fourni par le client' : 'Fourni par le tailleur'}</dd>
            <dt>Date souhaitée</dt><dd>${o.desired_date ? date(o.desired_date) : 'Pas de date imposée'}</dd>
            <dt>Remise</dt><dd>${o.delivery_mode === 'livraison' ? `Livraison — ${esc(o.delivery_address)}` : 'Retrait à l’atelier'}</dd>
            ${o.promised_date ? `<dt>Livraison promise</dt><dd><strong>${date(o.promised_date)}</strong></dd>` : ''}
          </dl>
          ${mEntries.length ? `<h3 style="margin-top:18px">Mensurations (cm)</h3><dl class="dl" style="grid-template-columns:1fr auto 1fr auto">${mEntries.map(([k, l]) => `<dt>${esc(l)}</dt><dd>${esc(o.measurements[k])}</dd>`).join('')}</dl>` : ''}
        </div>
      </div>
      <div class="stack">
        <div class="card card-body">
          <div class="row">${isTailor ? avatar(null, o.client_name, o.client_id) : avatar(o.tailor_avatar, o.shop_name, o.tailor_id)}
            <div style="flex:1"><div class="xs muted">${isTailor ? 'Client' : 'Tailleur'}</div><strong>${esc(isTailor ? o.client_name : o.shop_name)}</strong>
            ${o.client_phone ? `<div class="small">${esc(o.client_phone)}</div>` : ''}
            ${!isTailor ? `<div class="small muted">${esc(o.tailor_district ? `${o.tailor_district}, ` : '')}${esc(o.tailor_city)}</div>` : ''}</div></div>
          <div class="row" style="margin-top:14px">
            ${o.conversation_id ? `<a class="btn btn-outline btn-sm" href="#/messages/${o.conversation_id}">${icon.chat} Messages</a>` : ''}
            ${!isTailor ? `<a class="btn btn-ghost btn-sm" href="#/t/${esc(o.slug)}">Voir la boutique</a>` : ''}
          </div>
        </div>
        ${o.quote_amount ? `<div class="card card-body"><h3>Montant</h3><dl class="dl">
          <dt>Prix convenu</dt><dd>${fcfa(o.quote_amount)}</dd>
          ${isTailor ? `<dt>Commission Ñawkat (${Math.round(o.commission_rate * 100)} %)</dt><dd>− ${fcfa(o.commission_amount)}</dd><dt>Vous recevez</dt><dd><strong>${fcfa(o.net_amount)}</strong></dd>` : ''}
        </dl></div>` : ''}
        <div class="card card-body"><h3>Historique</h3><ul class="timeline">
          ${o.events.map((e) => `<li><div>${esc(e.note || e.type)}</div><div class="xs muted">${dateTime(e.created_at)}</div></li>`).join('')}
        </ul></div>
      </div>
    </div>`);

  if (window.matchMedia('(max-width: 900px)').matches) $('#cols').style.gridTemplateColumns = '1fr';
  $('#model-img')?.addEventListener('click', () => lightbox(o.model_image));
  renderAction(o, { isTailor, isClient });
}

function renderAction(o, { isTailor, isClient }) {
  const box = $('#action');
  const reload = () => detail({ app: $('#app'), params: { id: o.id } });
  const act = async (path, body = {}) => {
    try {
      await api(`/orders/${o.id}/${path}`, { method: 'POST', body });
      reload();
    } catch (e) { toast(e.message, 'err'); }
  };
  const card = (inner, cls = '') => `<div class="card card-body ${cls}" style="border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-50)">${inner}</div>`;
  let html = '';

  if (isTailor) {
    if (['requested', 'quoted'].includes(o.status)) {
      html = card(`<h3>${o.status === 'quoted' ? 'Modifier le devis' : 'Envoyer un devis'}</h3>
        <p class="small muted">Le client paiera ce montant via la plateforme. Commission Ñawkat déduite à la livraison.</p>
        <form id="quote" class="stack"><div class="form-error hidden"></div>
          <div class="grid grid-2" style="gap:12px">
            <label class="field"><span>Prix total (FCFA)</span><input class="input" type="number" name="amount" min="1000" step="500" required value="${esc(o.quote_amount || '')}"></label>
            <label class="field"><span>Prête le</span><input class="input" type="date" name="promised_date" required min="${isoIn(1)}" value="${esc(o.promised_date || o.desired_date || isoIn(7))}"></label>
          </div>
          <label class="field"><span>Message au client (facultatif)</span><textarea class="input" name="note" style="min-height:70px" placeholder="Détails, conditions, essayage…">${esc(o.quote_note || '')}</textarea></label>
          <div class="row"><button class="btn btn-primary" type="submit">${o.status === 'quoted' ? 'Mettre à jour' : 'Envoyer le devis'}</button><button type="button" class="btn btn-danger" id="decline">Décliner</button></div>
        </form>`);
    } else if (o.status === 'paid') {
      html = card(`<div class="notice ok">${icon.shield}<div><strong>Commande payée.</strong> Les fonds sont sécurisés. Vous pouvez commencer la confection.</div></div>
        <div class="row" style="margin-top:14px"><button class="btn btn-primary" data-act="start">${icon.scissors} Commencer la confection</button><button class="btn btn-outline" data-act="ready">Marquer comme prête</button></div>`);
    } else if (o.status === 'in_progress') {
      html = card(`<h3>Confection en cours</h3><p class="small muted">À livrer avant le <strong>${date(o.promised_date)}</strong>. Votre ponctualité compte dans votre note.</p>
        <button class="btn btn-success" data-act="ready">${icon.check} La tenue est prête / livrée</button>`);
    } else if (o.status === 'ready') {
      html = card(`<div class="notice">${icon.clock}<div>En attente de la confirmation du client. Sans réclamation sous 7 jours, le paiement vous est versé automatiquement.</div></div>`);
    } else if (o.status === 'disputed') {
      html = card(`<div class="notice err">${icon.info}<div>Un litige est en cours. L’équipe Ñawkat vous contactera.</div></div>`);
    } else if (o.review && !o.review.tailor_reply) {
      html = card(`<h3>Avis du client</h3>${reviewHtml(o.review)}
        <form id="reply" class="stack" style="margin-top:12px"><div class="form-error hidden"></div>
          <label class="field"><span>Répondre publiquement</span><textarea class="input" name="reply" style="min-height:70px" required></textarea></label>
          <button class="btn btn-primary btn-sm" type="submit">Publier la réponse</button></form>`);
    } else if (o.review) {
      html = `<div class="card card-body"><h3>Avis du client</h3>${reviewHtml(o.review)}</div>`;
    }
  }

  if (isClient) {
    if (o.status === 'requested') {
      html = card(`<div class="notice">${icon.clock}<div>Demande envoyée. Le tailleur prépare votre devis — vous serez notifié dans vos messages.</div></div>
        <button class="btn btn-ghost btn-sm" data-act="cancel" style="margin-top:10px">Annuler la demande</button>`);
    } else if (o.status === 'quoted') {
      html = card(`<span class="eyebrow">Devis reçu</span>
        <div class="row between"><div><div style="font-family:var(--display);font-size:2.2rem;font-weight:600">${fcfa(o.quote_amount)}</div>
        <div class="muted">Tenue prête le <strong>${date(o.promised_date)}</strong></div></div></div>
        ${o.quote_note ? `<p style="margin-top:12px;padding:12px;background:var(--bg);border-radius:10px">« ${esc(o.quote_note)} »</p>` : ''}
        <div class="row" style="margin-top:16px"><button class="btn btn-primary btn-lg" id="pay">Accepter et payer ${fcfa(o.quote_amount)}</button><button class="btn btn-ghost" data-act="cancel">Refuser</button></div>
        <p class="xs muted" style="margin:12px 0 0">${icon.shield.replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px;color:var(--green)"')} Wave · Orange Money · Free Money · Carte. L’argent est conservé par Ñawkat jusqu’à la réception de votre tenue.</p>`);
    } else if (['paid', 'in_progress'].includes(o.status)) {
      html = card(`<div class="notice ok">${icon.shield}<div><strong>Paiement sécurisé.</strong> ${o.status === 'paid' ? 'Le tailleur va démarrer la confection.' : 'Votre tenue est en cours de confection.'} Livraison prévue le <strong>${date(o.promised_date)}</strong>.</div></div>
        <button class="btn btn-ghost btn-sm" id="dispute" style="margin-top:10px">Signaler un problème</button>`);
    } else if (o.status === 'ready') {
      html = card(`<h3>Votre tenue est prête 🎉</h3><p class="small muted">Une fois la tenue récupérée et vérifiée, confirmez la réception : le tailleur sera payé.</p>
        <div class="row"><button class="btn btn-success btn-lg" id="confirm">${icon.check} J’ai reçu ma tenue</button><button class="btn btn-ghost" id="dispute">Signaler un problème</button></div>`);
    } else if (o.status === 'disputed') {
      html = card(`<div class="notice err">${icon.info}<div>Litige ouvert. Notre équipe revient vers vous sous 48 h. Vos fonds restent bloqués en attendant.</div></div>`);
    } else if (o.status === 'completed' && !o.review) {
      html = card(`<h3>Notez votre tailleur</h3><p class="small muted">Votre avis aide les autres clients et récompense les bons tailleurs.</p>
        <form id="review" class="stack"><div class="form-error hidden"></div>
          ${[['quality', 'Qualité de la finition'], ['punctuality', 'Respect des délais'], ['communication', 'Communication'], ['value', 'Rapport qualité / prix']].map(([k, l]) => `
            <div class="row between"><span>${l}</span><span class="star-input">${[5, 4, 3, 2, 1].map((n) => `<input type="radio" id="${k}${n}" name="${k}" value="${n}"><label for="${k}${n}" title="${n}/5">★</label>`).join('')}</span></div>`).join('')}
          <label class="field"><span>Votre commentaire</span><textarea class="input" name="comment" placeholder="Qu’avez-vous pensé du résultat ?"></textarea></label>
          <button class="btn btn-primary" type="submit">Publier mon avis</button></form>`);
    } else if (o.review) {
      html = `<div class="card card-body"><h3>Votre avis</h3>${reviewHtml(o.review)}</div>`;
    } else if (o.status === 'declined') {
      html = card(`<div class="notice warn">${icon.info}<div>Le tailleur ne peut pas prendre cette commande. <a href="#/tailleurs">Trouver un autre tailleur</a></div></div>`);
    }
  }

  box.innerHTML = html;
  $$('[data-act]', box).forEach((b) => (b.onclick = () => {
    if (b.dataset.act === 'cancel' && !confirm('Annuler cette demande ?')) return;
    b.disabled = true;
    act(b.dataset.act);
  }));
  const q = $('#quote', box);
  if (q) {
    onSubmit(q, async (fd) => { await api(`/orders/${o.id}/quote`, { method: 'POST', body: Object.fromEntries(fd) }); toast('Devis envoyé.', 'ok'); reload(); });
    $('#decline', box).onclick = () => {
      const note = prompt('Motif (facultatif) :');
      if (note !== null) act('decline', { note });
    };
  }
  const pay = $('#pay', box);
  if (pay) pay.onclick = async () => {
    pay.disabled = true;
    try {
      const { redirect_url } = await api(`/orders/${o.id}/pay`, { method: 'POST' });
      location.href = redirect_url;
    } catch (e) { toast(e.message, 'err'); pay.disabled = false; }
  };
  const conf = $('#confirm', box);
  if (conf) conf.onclick = () => { if (confirm('Confirmez-vous avoir reçu votre tenue en bon état ? Le tailleur sera payé.')) act('confirm'); };
  const disp = $('#dispute', box);
  if (disp) disp.onclick = () => modal('Signaler un problème', `<form id="dform" class="stack"><div class="form-error hidden"></div>
      <p class="small muted">Décrivez le problème (retard, tenue non conforme, absence de réponse…). Les fonds restent bloqués pendant l’examen.</p>
      <textarea class="input" name="note" required minlength="10"></textarea>
      <button class="btn btn-danger" type="submit">Ouvrir un litige</button></form>`, {
    onMount: (w, close) => onSubmit($('#dform', w), async (fd) => { await api(`/orders/${o.id}/dispute`, { method: 'POST', body: Object.fromEntries(fd) }); close(); reload(); }),
  });
  const rv = $('#review', box);
  if (rv) onSubmit(rv, async (fd) => { await api(`/orders/${o.id}/review`, { method: 'POST', body: Object.fromEntries(fd) }); toast('Merci pour votre avis !', 'ok'); reload(); });
  const rp = $('#reply', box);
  if (rp) onSubmit(rp, async (fd) => { await api(`/orders/${o.id}/review/reply`, { method: 'POST', body: Object.fromEntries(fd) }); reload(); });
}

function reviewHtml(r) {
  const avg = (r.quality + r.punctuality + r.communication + r.value) / 4;
  return `${stars(avg)} <strong>${avg.toFixed(1)}</strong>
    <div class="row xs muted" style="margin:6px 0;gap:14px"><span>Qualité ${r.quality}/5</span><span>Délais ${r.punctuality}/5</span><span>Communication ${r.communication}/5</span><span>Prix ${r.value}/5</span></div>
    ${r.comment ? `<p style="margin:0">${esc(r.comment)}</p>` : ''}
    ${r.tailor_reply ? `<div class="review"><div class="reply"><strong>Réponse :</strong> ${esc(r.tailor_reply)}</div></div>` : ''}`;
}
