import { api, session } from '../api.js';
import { esc, fcfa, icon, avatar, stars, date, hueFor, empty, lightbox, toast, $, $$ } from '../ui.js';

const AUD = { femme: 'Femmes', homme: 'Hommes', enfant: 'Enfants', mixte: 'Femmes, hommes & enfants' };

export async function render({ app, params }) {
  const { tailor: t } = await api(`/tailors/${encodeURIComponent(params.slug)}`);
  document.title = `${t.shop_name} — Tailleur à ${t.city} | Ñawkat`;
  const m = t.metrics || {};
  const isOwner = session.user?.shop?.id === t.id;

  const crit = [
    ['Qualité de finition', m.avg_quality], ['Respect des délais', m.avg_punctuality],
    ['Communication', m.avg_communication], ['Rapport qualité/prix', m.avg_value],
  ];

  app.innerHTML = `
  <div class="container" style="padding:0">
    <div class="shop-cover cover" style="background-color:${hueFor(t.id)}">${t.cover ? `<img src="${esc(t.cover)}" alt="">` : ''}</div>
  </div>
  <div class="container">
    ${t.status !== 'active' ? `<div class="notice warn" style="margin-top:16px">${icon.info}<div>Votre boutique n’est pas encore visible du public. <a href="#/onboarding">Finaliser l’inscription</a></div></div>` : ''}
    <div class="shop-head">
      ${avatar(t.avatar, t.shop_name, t.id, 'avatar-lg')}
      <div class="info">
        <h1>${esc(t.shop_name)} ${t.verified ? icon.verified : ''}</h1>
        <div class="muted">${esc(t.tagline || '')}</div>
        <div class="row small muted" style="margin-top:6px;gap:16px">
          <span class="row" style="gap:4px">${icon.pin.replace('<svg', '<svg style="width:15px;height:15px"')}${esc(t.district ? `${t.district}, ` : '')}${esc(t.city)}</span>
          <span>${esc(AUD[t.audience])}</span>
          ${t.years_experience ? `<span>${t.years_experience} ans d’expérience</span>` : ''}
          ${t.home_delivery ? '<span class="badge badge-primary">Livraison à domicile</span>' : ''}
          ${t.verified ? '<span class="badge badge-verified">Identité vérifiée</span>' : ''}
        </div>
      </div>
      <div class="shop-cta">
        ${isOwner
          ? '<a class="btn btn-primary" href="#/boutique">Modifier ma boutique</a>'
          : `<button class="btn btn-outline" id="contact">${icon.chat} Contacter</button>
             <a class="btn btn-primary" href="#/commander/${esc(t.slug)}">${icon.scissors} Commander une tenue</a>`}
      </div>
    </div>

    <div class="kpis" style="margin:26px 0">
      <div class="kpi"><strong>${t.score != null ? `${t.score.toFixed(1)}<small style="font-size:.9rem" class="muted">/5</small>` : '—'}</strong><span>${t.review_count} avis</span></div>
      <div class="kpi"><strong>${m.on_time_rate != null ? `${Math.round(m.on_time_rate * 100)} %` : '—'}</strong><span>livrées à temps</span></div>
      <div class="kpi"><strong>${m.response_hours != null ? (m.response_hours < 1 ? '< 1 h' : `${Math.round(m.response_hours)} h`) : '—'}</strong><span>temps de réponse moyen</span></div>
      <div class="kpi"><strong>${t.completed_count}</strong><span>commandes réalisées</span></div>
    </div>

    <div class="tabs" role="tablist">
      <button class="active" data-tab="services">Prestations (${t.services.length})</button>
      <button data-tab="portfolio">Réalisations (${t.portfolio.length})</button>
      <button data-tab="reviews">Avis (${t.review_count})</button>
      <button data-tab="about">À propos</button>
    </div>

    <div data-panel="services">
      ${t.services.length ? `<div class="card">${t.services.map((s) => `
        <div class="service">
          <div class="thumb cover" style="background-color:${hueFor(s.id)}">${s.image ? `<img src="${esc(s.image)}" alt="" loading="lazy">` : ''}</div>
          <div>
            <span class="badge">${esc(s.category)}</span>
            <h3 style="margin:6px 0 2px">${esc(s.title)}</h3>
            <p class="small muted" style="margin:0">${esc(s.description || '')}</p>
            <div class="xs muted" style="margin-top:6px">${icon.clock.replace('<svg', '<svg style="width:13px;height:13px;vertical-align:-2px"')} Délai indicatif : ${s.delay_days} jours</div>
          </div>
          <div style="text-align:right">
            <div class="price" style="font-size:1.1rem"><small>dès</small> ${fcfa(s.price)}</div>
            ${isOwner ? '' : `<a class="btn btn-sm btn-primary" style="margin-top:8px" href="#/commander/${esc(t.slug)}?service=${s.id}">Choisir</a>`}
          </div>
        </div>`).join('')}</div>` : empty('🧵', 'Aucune prestation publiée', 'Contactez le tailleur pour un devis personnalisé.')}
      <div class="notice ok" style="margin-top:16px">${icon.shield}<div><strong>Paiement protégé.</strong> Votre argent est conservé par Ñawkat et versé au tailleur uniquement après réception de votre tenue.</div></div>
    </div>

    <div data-panel="portfolio" class="hidden">
      ${t.portfolio.length ? `<div class="gallery">${t.portfolio.map((p) => `<figure data-src="${esc(p.image)}" data-caption="${esc(p.caption || '')}"><img src="${esc(p.image)}" alt="${esc(p.caption || 'Réalisation')}" loading="lazy">${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}</figure>`).join('')}</div>` : empty('📸', 'Pas encore de photos', '')}
    </div>

    <div data-panel="reviews" class="hidden">
      <div class="card card-body">
        <div class="score-box">
          <div class="score-big"><strong>${t.score != null ? t.score.toFixed(1) : '—'}</strong>${stars(t.score)}<div class="small muted">${t.review_count} avis vérifiés</div></div>
          <div>${crit.map(([label, v]) => `<div class="bar-row"><span>${label}</span><div class="bar"><i style="width:${((v || 0) / 5) * 100}%"></i></div><strong>${v ? v.toFixed(1) : '—'}</strong></div>`).join('')}
            <p class="xs muted" style="margin:8px 0 0">La note globale inclut aussi la ponctualité mesurée, la réactivité et la fiabilité. <a href="#/comment-ca-marche">En savoir plus</a></p>
          </div>
        </div>
      </div>
      <div style="margin-top:10px">
        ${t.reviews.length ? t.reviews.map((r) => {
          const avg = (r.quality + r.punctuality + r.communication + r.value) / 4;
          return `<div class="review">
            <div class="row between"><div class="row">${avatar(null, r.client_name, r.id, 'avatar-sm')}<div><strong>${esc(r.client_name)}</strong><div class="xs muted">${esc(r.order_title)} · ${date(r.created_at)}</div></div></div>${stars(avg)}</div>
            ${r.comment ? `<p style="margin:10px 0 0">${esc(r.comment)}</p>` : ''}
            <div class="row xs muted" style="margin-top:8px;gap:14px"><span>Qualité ${r.quality}/5</span><span>Délais ${r.punctuality}/5</span><span>Communication ${r.communication}/5</span><span>Prix ${r.value}/5</span></div>
            ${r.tailor_reply ? `<div class="reply"><strong>Réponse du tailleur :</strong> ${esc(r.tailor_reply)}</div>` : ''}
          </div>`;
        }).join('') : empty('⭐', 'Pas encore d’avis', 'Les avis sont publiés uniquement par des clients ayant commandé.')}
      </div>
    </div>

    <div data-panel="about" class="hidden">
      <div class="grid grid-2">
        <div class="card card-body"><h3>Présentation</h3><p style="white-space:pre-line">${esc(t.bio || 'Ce tailleur n’a pas encore rédigé sa présentation.')}</p></div>
        <div class="card card-body"><h3>Informations</h3>
          <dl class="dl">
            <dt>Spécialités</dt><dd>${t.specialties.map((s) => `<span class="badge" style="margin:0 4px 4px 0">${esc(s)}</span>`).join('')}</dd>
            <dt>Localisation</dt><dd>${esc(t.district ? `${t.district}, ` : '')}${esc(t.city)}</dd>
            <dt>Clientèle</dt><dd>${esc(AUD[t.audience])}</dd>
            <dt>Remise</dt><dd>${t.home_delivery ? 'Retrait à l’atelier ou livraison' : 'Retrait à l’atelier'}</dd>
            <dt>Membre depuis</dt><dd>${date(t.member_since)}</dd>
          </dl>
        </div>
      </div>
    </div>
    <div style="height:40px"></div>
  </div>`;

  $$('[data-tab]').forEach((b) => (b.onclick = () => {
    $$('[data-tab]').forEach((x) => x.classList.toggle('active', x === b));
    $$('[data-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== b.dataset.tab));
  }));
  $$('.gallery figure').forEach((f) => (f.onclick = () => lightbox(f.dataset.src, f.dataset.caption)));

  const contact = $('#contact');
  if (contact) contact.onclick = async () => {
    if (!session.user) { location.hash = `#/connexion?next=${encodeURIComponent(`/t/${t.slug}`)}`; return; }
    if (session.user.role !== 'client') { toast('Connectez-vous avec un compte client pour contacter un tailleur.', 'err'); return; }
    const { id } = await api('/conversations', { method: 'POST', body: { tailor_id: t.id } });
    location.hash = `#/messages/${id}`;
  };
}
