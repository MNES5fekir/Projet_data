import { session, onSession, refreshUser, loadMeta } from './api.js';
import { $, empty, spinner, toast } from './ui.js';
import { renderHeader, renderFooter } from './layout.js';
import * as home from './pages/home.js';
import * as tailors from './pages/tailors.js';
import * as shop from './pages/shop.js';
import * as auth from './pages/auth.js';
import * as orders from './pages/orders.js';
import * as messages from './pages/messages.js';
import * as manage from './pages/manage.js';
import * as account from './pages/account.js';
import * as payment from './pages/payment.js';
import * as admin from './pages/admin.js';

const routes = [
  ['/', home.render],
  ['/comment-ca-marche', home.howItWorks],
  ['/tailleurs', tailors.render, { auth: true, signup: true }],
  ['/t/:slug', shop.render, { auth: true, signup: true }],
  ['/connexion', auth.login],
  ['/inscription', auth.register],
  ['/devenir-tailleur', auth.becomeTailor],
  ['/onboarding', manage.onboarding, { role: 'tailor' }],
  ['/commander/:slug', orders.newOrder, { role: 'client', signup: true }],
  ['/commandes', orders.list, { auth: true }],
  ['/commandes/:id', orders.detail, { auth: true }],
  ['/messages', messages.render, { auth: true }],
  ['/messages/:id', messages.render, { auth: true }],
  ['/boutique', manage.shop, { role: 'tailor' }],
  ['/revenus', manage.finances, { role: 'tailor' }],
  ['/compte', account.render, { auth: true }],
  ['/paiement/simulation/:ref', payment.simulation, { auth: true }],
  ['/paiement/retour/:ref', payment.result, { auth: true }],
  ['/admin', admin.render, { role: 'admin' }],
].map(([pattern, handler, opts = {}]) => {
  const keys = [];
  const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}/?$`);
  return { re, keys, handler, ...opts };
});

let navId = 0;

async function router() {
  const id = ++navId;
  const [path, qs = ''] = location.hash.slice(1).split('?');
  const query = Object.fromEntries(new URLSearchParams(qs));
  const app = $('#app');
  renderHeader();

  const route = routes.find((r) => r.re.test(path || '/'));
  if (!route) {
    app.innerHTML = `<div class="container">${empty('🧭', 'Page introuvable', "Cette page n'existe pas ou a été déplacée.", '<a class="btn btn-primary" href="#/">Retour à l’accueil</a>')}</div>`;
    return;
  }
  if ((route.auth || route.role) && !session.user) {
    location.replace(`#/${route.signup ? 'inscription' : 'connexion'}?next=${encodeURIComponent(location.hash.slice(1))}`);
    return;
  }
  if (route.role && session.user.role !== route.role) {
    app.innerHTML = `<div class="container">${empty('🔒', 'Accès réservé', 'Cette page n’est pas disponible pour votre type de compte.', '<a class="btn btn-primary" href="#/">Accueil</a>')}</div>`;
    return;
  }
  const params = {};
  const m = (path || '/').match(route.re);
  route.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });

  app.innerHTML = spinner();
  if (!query.keepScroll) window.scrollTo({ top: 0 });
  try {
    await route.handler({ params, query, app, isCurrent: () => id === navId });
  } catch (err) {
    if (id !== navId) return;
    console.error(err);
    app.innerHTML = `<div class="container">${empty('⚠️', 'Oups…', err.message, '<a class="btn btn-outline" href="#/">Retour à l’accueil</a>')}</div>`;
  }
  document.title = document.title || 'Ñawkat';
}

onSession(() => { renderHeader(); renderFooter(); });
window.addEventListener('hashchange', router);

// Rafraîchit le compteur de messages non lus toutes les 30 s
setInterval(() => { if (session.user && document.visibilityState === 'visible') refreshUser(); }, 30000);

(async function start() {
  renderFooter();
  await Promise.all([refreshUser(), loadMeta().catch(() => toast('Serveur injoignable.', 'err'))]);
  router();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
