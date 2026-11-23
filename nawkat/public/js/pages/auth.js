import { api, setSession, session, loadMeta } from '../api.js';
import { esc, icon, options, onSubmit, fcfa } from '../ui.js';

const sideHtml = (title, text) => `<div class="auth-side"><h2>${title}</h2><p style="color:rgba(255,255,255,.8);max-width:420px">${text}</p></div>`;

function afterAuth(user, next) {
  if (next) location.hash = `#${next}`;
  else if (user.role === 'tailor') location.hash = user.shop?.status === 'active' ? '#/commandes' : '#/onboarding';
  else if (user.role === 'admin') location.hash = '#/admin';
  else location.hash = '#/tailleurs';
}

export async function login({ app, query }) {
  document.title = 'Connexion — Ñawkat';
  if (session.user) return afterAuth(session.user, query.next);
  app.innerHTML = `<div class="auth-wrap">
    ${sideHtml('Bon retour parmi nous.', 'Retrouvez vos commandes, vos échanges avec les tailleurs et le suivi de vos tenues.')}
    <div class="auth-form"><form class="stack" id="f">
      <h1 style="font-size:2rem">Connexion</h1>
      <div class="form-error hidden"></div>
      <label class="field"><span>Numéro de téléphone</span>
        <div class="input-group"><span class="prefix">+221</span><input class="input" name="phone" inputmode="tel" autocomplete="tel" placeholder="77 123 45 67" required></div></label>
      <label class="field"><span>Mot de passe</span><input class="input" type="password" name="password" autocomplete="current-password" required></label>
      <button class="btn btn-primary btn-block btn-lg" type="submit">Se connecter</button>
      <p class="center small muted">Pas encore de compte ? <a href="#/inscription${query.next ? `?next=${encodeURIComponent(query.next)}` : ''}">Inscrivez-vous en 30 secondes</a></p>
    </form></div></div>`;
  onSubmit(app.querySelector('#f'), async (fd) => {
    const { token, user } = await api('/auth/login', { method: 'POST', body: Object.fromEntries(fd) });
    setSession(token, user);
    afterAuth(user, query.next);
  });
}

export async function register({ app, query }) {
  document.title = 'Créer un compte — Ñawkat';
  const meta = await loadMeta();
  const role = query.role === 'tailor' ? 'tailor' : 'client';
  app.innerHTML = `<div class="auth-wrap">
    ${role === 'tailor'
      ? sideHtml('Développez votre atelier.', `Créez votre boutique, exposez vos réalisations et recevez des commandes payées d’avance. Inscription : ${fcfa(meta.registration_fee)}.`)
      : sideHtml('Votre tailleur idéal vous attend.', 'Inscription gratuite. Envoyez votre modèle, recevez un devis et payez en toute sécurité.')}
    <div class="auth-form"><form class="stack" id="f">
      <h1 style="font-size:2rem">Créer un compte</h1>
      ${query.next ? `<div class="notice">${icon.info}<div>Inscription gratuite et obligatoire pour consulter les tailleurs et passer commande.</div></div>` : ''}
      <div class="choice-cards">
        <label class="choice-card"><input type="radio" name="role" value="client" ${role === 'client' ? 'checked' : ''}><strong>Je suis un particulier</strong><span class="small muted">Je veux faire coudre une tenue</span></label>
        <label class="choice-card"><input type="radio" name="role" value="tailor" ${role === 'tailor' ? 'checked' : ''}><strong>Je suis tailleur</strong><span class="small muted">Je veux ouvrir ma boutique</span></label>
      </div>
      <div class="form-error hidden"></div>
      <label class="field"><span>Prénom et nom</span><input class="input" name="full_name" autocomplete="name" placeholder="Awa Ndiaye" required></label>
      <label class="field"><span>Numéro de téléphone</span>
        <div class="input-group"><span class="prefix">+221</span><input class="input" name="phone" inputmode="tel" autocomplete="tel" placeholder="77 123 45 67" required></div>
        <small>Wave / Orange Money de préférence — il sert aussi d’identifiant.</small></label>
      <label class="field"><span>Ville</span><select class="input" name="city">${options(meta.cities, 'Dakar')}</select></label>
      <label class="field"><span>Mot de passe</span><input class="input" type="password" name="password" minlength="6" autocomplete="new-password" required><small>6 caractères minimum.</small></label>
      <button class="btn btn-primary btn-block btn-lg" type="submit">Créer mon compte</button>
      <p class="xs muted center">En créant un compte, vous acceptez les conditions d’utilisation de Ñawkat.</p>
      <p class="center small muted">Déjà inscrit ? <a href="#/connexion${query.next ? `?next=${encodeURIComponent(query.next)}` : ''}">Se connecter</a></p>
    </form></div></div>`;
  onSubmit(app.querySelector('#f'), async (fd) => {
    const { token, user } = await api('/auth/register', { method: 'POST', body: Object.fromEntries(fd) });
    setSession(token, user);
    afterAuth(user, user.role === 'client' ? query.next : null);
  });
}

export async function becomeTailor({ app }) {
  document.title = 'Ouvrir ma boutique de couture — Ñawkat';
  if (session.user?.role === 'client') { location.replace('#/tailleurs'); return; }
  const meta = await loadMeta();
  const cta = session.user?.role === 'tailor' ? '#/onboarding' : '#/inscription?role=tailor';
  const perks = [
    ['🏪', 'Votre boutique en ligne', 'Présentez votre atelier, vos prestations, vos prix et vos plus belles réalisations.'],
    ['📲', 'Des clients de tout le Sénégal', 'Les particuliers vous trouvent par ville, spécialité et note, et vous envoient leur modèle.'],
    ['💳', 'Paiements garantis', 'Le client paie avant que vous commenciez. Vous êtes payé dès la livraison confirmée.'],
    ['⭐', 'Une réputation qui compte', 'Votre note valorise votre qualité, votre ponctualité et votre réactivité.'],
    ['💬', 'Messagerie intégrée', 'Échangez avec vos clients, envoyez vos devis et suivez chaque commande.'],
    ['💸', 'Retraits mobiles', 'Retirez vos gains sur Wave, Orange Money ou Free Money.'],
  ];
  app.innerHTML = `
  <section class="hero"><div class="container">
    <span class="eyebrow" style="color:var(--accent)">Espace tailleurs & couturières</span>
    <h1>Faites grandir votre atelier avec <em>Ñawkat</em>.</h1>
    <p class="lead">Rejoignez la première plateforme sénégalaise dédiée à la couture sur mesure. Inscription unique de <strong>${fcfa(meta.registration_fee)}</strong>, puis ${Math.round(meta.commission_rate * 100)} % de commission seulement sur les commandes réalisées.</p>
    <a class="btn btn-accent btn-lg" href="${cta}" style="margin-top:12px">Ouvrir ma boutique</a>
  </div></section>
  <section class="section"><div class="container">
    <div class="grid grid-3">${perks.map(([e, t, d]) => `<div class="card card-body"><div style="font-size:2rem">${e}</div><h3 style="margin-top:8px">${t}</h3><p class="muted small" style="margin:0">${d}</p></div>`).join('')}</div>
    <div class="card card-body" style="margin-top:28px">
      <h2>En 3 étapes</h2>
      <ol class="stack" style="padding-left:20px;margin:0">
        <li><strong>Créez votre compte</strong> avec votre numéro de téléphone.</li>
        <li><strong>Décrivez votre boutique</strong> : nom, quartier, spécialités, prestations et photos.</li>
        <li><strong>Réglez les frais d’inscription</strong> (${fcfa(meta.registration_fee)}) par Wave, Orange Money, Free Money ou carte : votre boutique est en ligne immédiatement.</li>
      </ol>
      <a class="btn btn-primary" href="${cta}" style="margin-top:18px">Commencer ${icon.back.replace('<svg', '<svg style="transform:rotate(180deg)"')}</a>
    </div>
  </div></section>`;
}

