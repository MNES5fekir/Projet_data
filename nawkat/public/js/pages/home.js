import { api, loadMeta, session } from '../api.js';
import { esc, icon, num, options, CATEGORY_EMOJI, fcfa } from '../ui.js';
import { tailorCard } from './tailors.js';

const TINTS = ['#fdf4e1', '#eeedf8', '#fdeee6', '#e5f5ee', '#f3e8ff', '#e0f2fe'];

export async function render({ app }) {
  const meta = await loadMeta();
  document.title = 'Ñawkat — Les meilleurs tailleurs du Sénégal';
  const u = session.user;
  const { items } = u ? await api('/tailors?sort=recommended&limit=6') : { items: [] };
  const s = meta.stats;

  app.innerHTML = `
  <section class="hero">
    <div class="container">
      <span class="eyebrow" style="color:var(--accent)">Couture sur mesure · Sénégal</span>
      <h1>Votre tenue sur mesure, par un tailleur <em>de confiance</em>.</h1>
      <p class="lead">Parcourez les boutiques, envoyez la photo de votre modèle et payez en toute sécurité par Wave ou Orange Money. Le tailleur n'est payé que lorsque vous recevez votre tenue.</p>
      <form class="search-box" id="hero-search">
        <input class="input" name="q" placeholder="Grand boubou, kaftan, taille basse…" aria-label="Que cherchez-vous ?">
        <select class="input" name="city" aria-label="Ville">${options(meta.cities, session.user?.city, 'Toutes les villes')}</select>
        <select class="input" name="specialty" aria-label="Spécialité">${options(meta.specialties, '', 'Toutes spécialités')}</select>
        <button class="btn btn-accent" type="submit">${icon.search} Rechercher</button>
      </form>
      <div class="hero-stats">
        <div><strong>${num(s.tailors)}</strong><span>tailleurs actifs</span></div>
        <div><strong>${num(s.orders)}</strong><span>tenues livrées</span></div>
        <div><strong>${s.avg_score ? `${String(s.avg_score).replace('.', ',')}/5` : '—'}</strong><span>note moyenne</span></div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head"><div><span class="eyebrow">Spécialités</span><h2>Que souhaitez-vous faire coudre ?</h2></div></div>
      <div class="cat-grid">
        ${meta.specialties.map((sp, i) => `<a class="cat" href="#/tailleurs?specialty=${encodeURIComponent(sp)}"><i style="background:${TINTS[i % TINTS.length]}">${CATEGORY_EMOJI[sp] || '🧵'}</i>${esc(sp)}</a>`).join('')}
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="container">
      <div class="section-head">
        <div><span class="eyebrow">Les mieux notés</span><h2>Tailleurs recommandés</h2><p class="muted">Classés selon la qualité, la ponctualité réelle et l’avis des clients.</p></div>
        <a class="btn btn-outline" href="#/tailleurs">Voir tous les tailleurs →</a>
      </div>
      ${u ? `<div class="grid grid-3">${items.map(tailorCard).join('')}</div>`
        : `<div class="card card-body center" style="padding:40px 24px">
            <div style="font-size:2.4rem">🔒</div>
            <h3 style="font-size:1.35rem">${num(s.tailors)} tailleurs vous attendent</h3>
            <p class="muted" style="max-width:520px;margin:0 auto 18px">Créez votre compte gratuit en 30 secondes pour découvrir les boutiques, leurs prix, leurs réalisations et les avis des clients.</p>
            <div class="row" style="justify-content:center"><a class="btn btn-primary btn-lg" href="#/inscription">Créer mon compte gratuit</a><a class="btn btn-ghost" href="#/connexion">J’ai déjà un compte</a></div>
          </div>`}
    </div>
  </section>

  <section class="section" style="background:var(--surface);border-top:1px solid var(--line);border-bottom:1px solid var(--line)">
    <div class="container">
      <div class="section-head"><div><span class="eyebrow">Simple comme bonjour</span><h2>Comment ça marche ?</h2></div></div>
      ${stepsHtml()}
    </div>
  </section>

  ${u?.role === 'client' ? '' : `<section class="section">
    <div class="container">
      <div class="band">
        <div class="grid grid-2" style="align-items:center">
          <div>
            <span class="eyebrow" style="color:var(--accent)">Vous êtes tailleur ou couturière ?</span>
            <h2>Ouvrez votre boutique en ligne et trouvez de nouveaux clients.</h2>
            <p>Exposez vos réalisations, recevez des commandes de tout le Sénégal et soyez payé en toute sécurité sur Wave ou Orange Money.</p>
            <a class="btn btn-accent btn-lg" href="#/devenir-tailleur">Ouvrir ma boutique — ${fcfa(meta.registration_fee)}</a>
          </div>
          <ul class="stack" style="list-style:none;padding:0;margin:0">
            ${['Une vitrine professionnelle avec vos prestations et photos', 'Des clients qui paient d’avance, fonds sécurisés', 'Une note qui valorise votre sérieux et votre ponctualité', 'Retrait de vos gains sur Wave, Orange Money ou Free Money']
              .map((t) => `<li class="row" style="flex-wrap:nowrap;align-items:flex-start"><span style="color:var(--accent)">${icon.check}</span><span>${t}</span></li>`).join('')}
          </ul>
        </div>
      </div>
    </div>
  </section>`}`;

  document.getElementById('hero-search').onsubmit = (e) => {
    e.preventDefault();
    const qs = new URLSearchParams([...new FormData(e.target)].filter(([, v]) => v)).toString();
    location.hash = `#/tailleurs${qs ? `?${qs}` : ''}`;
  };
}

function stepsHtml() {
  const steps = [
    ['Choisissez votre tailleur', 'Comparez les boutiques, les photos de réalisations, les prix et les notes des autres clients.'],
    ['Envoyez votre modèle', 'Une photo, une description et vos mensurations. Le tailleur vous répond avec un devis et une date.'],
    ['Payez en sécurité', 'Wave, Orange Money, Free Money ou carte. L’argent est bloqué par Ñawkat, pas versé directement.'],
    ['Recevez et notez', 'Vous confirmez la réception : le tailleur est payé. Vous notez la qualité et le respect des délais.'],
  ];
  return `<div class="grid grid-4 steps">${steps.map(([t, d]) => `<div class="card step"><h3>${t}</h3><p class="muted small" style="margin:0">${d}</p></div>`).join('')}</div>`;
}

export async function howItWorks({ app }) {
  const meta = await loadMeta();
  document.title = 'Comment ça marche — Ñawkat';
  const w = meta.score_weights;
  const pct = (k) => `${Math.round(w[k] * 100)} %`;
  app.innerHTML = `<div class="container narrow" style="padding:40px 20px">
    <span class="eyebrow">Guide</span>
    <h1>Comment ça marche ?</h1>
    <p class="muted" style="font-size:1.08rem">Ñawkat met en relation les particuliers et les tailleurs du Sénégal, et sécurise chaque commande du devis à la livraison.</p>
    ${stepsHtml().replace('grid-4', 'grid-2')}

    <hr>
    <h2>${icon.shield.replace('<svg', '<svg style="width:28px;height:28px;vertical-align:-5px;color:var(--green)"')} Paiement sécurisé (séquestre)</h2>
    <p>Lorsque vous payez une commande, l’argent n’est pas versé immédiatement au tailleur : il est conservé par Ñawkat. Le tailleur est payé uniquement quand vous confirmez avoir reçu votre tenue.</p>
    <ul>
      <li>En cas de problème (retard important, tenue non conforme), ouvrez un <strong>litige</strong> depuis la commande. Notre équipe arbitre sous 48 h et peut vous rembourser.</li>
      <li>Sans réclamation ${7} jours après que la tenue est marquée « prête », la commande est clôturée automatiquement.</li>
      <li>Les numéros de téléphone sont masqués dans la messagerie jusqu’au paiement, pour vous protéger des arnaques.</li>
    </ul>

    <hr>
    <h2>Comment est calculée la note d’un tailleur ?</h2>
    <p>La note sur 5 combine l’avis des clients et des indicateurs mesurés automatiquement par la plateforme :</p>
    <div class="card card-body">
      ${[
        ['Qualité de la finition (avis)', 'quality'], ['Respect des délais (avis)', 'punctuality'], ['Communication (avis)', 'communication'],
        ['Rapport qualité / prix (avis)', 'value'], ['Ponctualité mesurée (tenue prête avant la date promise)', 'on_time'],
        ['Réactivité (délai de réponse aux demandes)', 'responsiveness'], ['Fiabilité (commandes menées à terme)', 'reliability'],
      ].map(([label, k]) => `<div class="bar-row" style="grid-template-columns:1fr 120px 44px"><span>${label}</span><div class="bar"><i style="width:${w[k] * 100 / 0.3}%"></i></div><strong>${pct(k)}</strong></div>`).join('')}
    </div>
    <p class="small muted" style="margin-top:12px">Le classement « Recommandés » utilise une moyenne pondérée par le nombre de commandes : un tailleur avec 80 commandes notées 4,8 passe devant un nouveau avec un seul avis à 5.</p>

    ${session.user?.role === 'client' ? '' : `<hr>
    <h2>Pour les tailleurs</h2>
    <p>L’inscription coûte <strong>${fcfa(meta.registration_fee)}</strong> (paiement unique). Une commission de <strong>${Math.round(meta.commission_rate * 100)} %</strong> est prélevée sur chaque commande payée via la plateforme. Vos gains sont retirables sur Wave, Orange Money ou Free Money.</p>
    <a class="btn btn-primary" href="#/devenir-tailleur">Ouvrir ma boutique</a>`}
  </div>`;
}
