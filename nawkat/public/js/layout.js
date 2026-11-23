import { session, logout } from './api.js';
import { $, esc, icon, LOGO, avatar } from './ui.js';

const current = () => location.hash.slice(1).split('?')[0] || '/';

export function renderHeader() {
  const u = session.user;
  const path = current();
  const active = (p) => (path === p || (p !== '/' && path.startsWith(p)) ? 'active' : '');
  const badge = u?.unread ? `<span class="dot-badge">${u.unread > 9 ? '9+' : u.unread}</span>` : '';

  let right;
  if (!u) {
    right = `<a class="btn btn-ghost btn-sm" href="#/connexion">Se connecter</a>
             <a class="btn btn-primary btn-sm" href="#/inscription">Créer un compte</a>`;
  } else {
    const links = menuLinks(u).map(([href, label, ic]) => `<a href="${href}">${ic} ${esc(label)}</a>`).join('');
    right = `<a class="icon-btn" href="#/messages" aria-label="Messages">${icon.chat}${badge}</a>
      <div class="menu" id="user-menu">
        <button class="btn btn-outline btn-sm" aria-haspopup="true" style="padding:5px 12px 5px 5px">
          ${avatar(u.shop?.avatar, u.full_name, u.id, 'avatar-sm')} <span class="hide-sm">${esc(u.full_name.split(' ')[0])}</span>
        </button>
        <div class="menu-panel">
          <div style="padding:10px 12px"><strong>${esc(u.full_name)}</strong><div class="xs muted">${esc(u.phone)}</div></div>
          <div class="sep"></div>${links}<div class="sep"></div>
          <button data-logout>${icon.logout} Se déconnecter</button>
        </div>
      </div>`;
  }

  $('#header').innerHTML = `<div class="container">
    <a class="brand" href="#/">${LOGO}<span>Ñawkat</span></a>
    <nav class="nav">
      <a href="#/tailleurs" class="${active('/tailleurs')}">Trouver un tailleur</a>
      <a href="#/comment-ca-marche" class="${active('/comment-ca-marche')}">Comment ça marche</a>
      ${u?.role === 'tailor' ? `<a href="#/boutique" class="${active('/boutique')}">Ma boutique</a>` : u ? '' : `<a href="#/devenir-tailleur" class="${active('/devenir-tailleur')}">Vous êtes tailleur ?</a>`}
    </nav>
    <div class="header-actions">${right}</div>
  </div>`;

  const menu = $('#user-menu');
  if (menu) {
    menu.querySelector('button').onclick = (e) => { e.stopPropagation(); menu.classList.toggle('open'); };
    document.addEventListener('click', () => menu.classList.remove('open'), { once: true });
    menu.querySelector('[data-logout]').onclick = () => logout();
  }
  renderTabbar(badge);
}

export function menuLinks(u) {
  if (u.role === 'admin') {
    return [['#/admin', 'Administration', icon.chart], ['#/messages', 'Messages', icon.chat], ['#/compte', 'Mon compte', icon.user]];
  }
  if (u.role === 'tailor') {
    return [
      ['#/commandes', 'Commandes', icon.bag], ['#/messages', 'Messages', icon.chat], ['#/boutique', 'Ma boutique', icon.store],
      ['#/revenus', 'Revenus', icon.wallet], ['#/compte', 'Mon compte', icon.user],
    ];
  }
  return [
    ['#/tailleurs', 'Trouver un tailleur', icon.search],
    ['#/commandes', 'Mes commandes', icon.bag], ['#/messages', 'Messages', icon.chat],
    ['#/compte', 'Profil & mensurations', icon.ruler],
  ];
}

function renderTabbar(badge) {
  const u = session.user;
  const path = current();
  const items = u?.role === 'tailor'
    ? [['#/commandes', 'Commandes', icon.bag], ['#/messages', 'Messages', icon.chat], ['#/boutique', 'Boutique', icon.store], ['#/revenus', 'Revenus', icon.wallet], ['#/compte', 'Compte', icon.user]]
    : [['#/', 'Accueil', icon.home], ['#/tailleurs', 'Tailleurs', icon.search], ['#/commandes', 'Commandes', icon.bag], ['#/messages', 'Messages', icon.chat], [u ? '#/compte' : '#/connexion', 'Compte', icon.user]];
  $('#tabbar').innerHTML = items.map(([href, label, ic]) => {
    const p = href.slice(1);
    const on = p === '/' ? path === '/' : path.startsWith(p);
    return `<a href="${href}" class="${on ? 'active' : ''}">${ic}${label === 'Messages' ? badge : ''}<span>${label}</span></a>`;
  }).join('');
}

export function renderFooter() {
  $('#footer').innerHTML = `<div class="container">
    <div class="grid grid-4">
      <div>
        <a class="brand" href="#/" style="color:#fff">${LOGO}<span>Ñawkat</span></a>
        <p class="small" style="margin-top:12px">« Ñawkat » signifie <em>couturier</em> en wolof. La plateforme qui relie les meilleurs tailleurs du Sénégal à leurs clients.</p>
      </div>
      <div><h4>Clients</h4><ul>
        <li><a href="#/tailleurs">Trouver un tailleur</a></li>
        <li><a href="#/comment-ca-marche">Comment ça marche</a></li>
        <li><a href="#/comment-ca-marche">Paiement sécurisé</a></li></ul></div>
      ${session.user?.role === 'client' ? '<div></div>' : `<div><h4>Tailleurs</h4><ul>
        <li><a href="#/devenir-tailleur">Ouvrir ma boutique</a></li>
        <li><a href="#/comment-ca-marche">Comment sont calculées les notes</a></li></ul></div>`}
      <div><h4>Contact</h4><ul>
        <li>Dakar, Sénégal</li><li>Service client : 7j/7, 8h – 21h</li></ul></div>
    </div>
    <div class="bottom">
      <span>© ${new Date().getFullYear()} Ñawkat. Tous droits réservés.</span>
      <div class="pay-strip"><span>Wave</span><span>Orange Money</span><span>Free Money</span><span>Carte bancaire</span></div>
    </div>
  </div>`;
}

/** Mise en page tableau de bord (menu latéral) */
export function dash(content) {
  const path = current();
  const links = session.user ? menuLinks(session.user) : [];
  return `<div class="container dash">
    <nav class="sidenav">${links.map(([href, label, ic]) => `<a href="${href}" class="${path.startsWith(href.slice(1)) ? 'active' : ''}">${ic}${esc(label)}</a>`).join('')}</nav>
    <section>${content}</section>
  </div>`;
}
