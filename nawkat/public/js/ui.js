// Utilitaires d'interface : échappement, formatage, icônes, toasts, modales
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const nf = new Intl.NumberFormat('fr-FR');
export const fcfa = (n) => (n == null ? '—' : `${nf.format(n)} FCFA`);
export const num = (n) => nf.format(n || 0);

/** Les dates SQLite sont en UTC « YYYY-MM-DD HH:MM:SS » */
const toDate = (s) => (s && s.length > 10 ? new Date(`${s.replace(' ', 'T')}Z`) : new Date(`${s}T12:00:00`));
export const date = (s) => (s ? toDate(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const dateTime = (s) => (s ? toDate(s).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
export const time = (s) => (s ? toDate(s).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');
export function ago(s) {
  const d = (Date.now() - toDate(s).getTime()) / 1000;
  if (d < 60) return "à l'instant";
  if (d < 3600) return `il y a ${Math.floor(d / 60)} min`;
  if (d < 86400) return `il y a ${Math.floor(d / 3600)} h`;
  if (d < 86400 * 7) return `il y a ${Math.floor(d / 86400)} j`;
  return date(s);
}
export const isoIn = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

// ---------- Icônes (traits 2px, style Lucide) ----------
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const icon = {
  search: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
  chat: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  bag: svg('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>'),
  user: svg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  home: svg('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>'),
  store: svg('<path d="m2 7 2-4h16l2 4"/><path d="M4 7v13h16V7"/><path d="M2 7h20"/><path d="M9 20v-6h6v6"/>'),
  wallet: svg('<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>'),
  ruler: svg('<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>'),
  pin: svg('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'),
  clock: svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  shield: svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>'),
  verified: `<svg class="verified-ic" viewBox="0 0 24 24" fill="currentColor" aria-label="Vérifié"><path d="M12 1.5 14.6 3.4l3.2-.1 1 3 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3-3.2-.1L12 22.5l-2.6-1.9-3.2.1-1-3-2.6-1.9 1-3.1-1-3.1L5.2 6.3l1-3 3.2.1Z"/><path d="m8.5 12 2.5 2.5 4.5-5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>',
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  trash: svg('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  x: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  send: svg('<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'),
  truck: svg('<path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.3a1 1 0 0 0-.2-.6l-3.4-4.4a1 1 0 0 0-.8-.4H14v8.7"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>'),
  info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
  back: svg('<path d="m15 18-6-6 6-6"/>'),
  chart: svg('<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>'),
  logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>'),
  scissors: svg('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/>'),
  image: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>'),
};

export const LOGO = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#2e2a6b"/><path d="M32 9 55 32 32 55 9 32Z" fill="none" stroke="#e3a01b" stroke-width="3"/><path d="M22 44V22l20 20V20" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 13c3-3 13-3 16 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`;

export function stars(value, { size } = {}) {
  const v = Math.round((value || 0) * 2) / 2;
  let out = '';
  for (let i = 1; i <= 5; i++) out += `<span class="${v >= i - 0.25 ? '' : 'off'}">${icon.star}</span>`;
  return `<span class="stars" ${size ? `style="--s:${size}px"` : ''} aria-label="${(value || 0).toFixed(1)} sur 5">${out}</span>`;
}

export function rating(score, count) {
  if (score == null) return '<span class="badge badge-accent">Nouveau</span>';
  return `<span class="rating">${icon.star.replace('<svg', '<svg style="width:16px;height:16px;color:var(--accent)"')} ${Number(score).toFixed(1)} <span class="count">(${count} avis)</span></span>`;
}

const HUES = ['#2e2a6b', '#c2410c', '#127a57', '#8a3ffc', '#b5179e', '#0e7490', '#a16207'];
export const hueFor = (id) => HUES[Math.abs(Number(id) || 0) % HUES.length];
export const initials = (name) => String(name || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export function avatar(src, name, id, cls = '') {
  if (src) return `<img class="avatar ${cls}" src="${esc(src)}" alt="${esc(name)}" loading="lazy">`;
  return `<span class="avatar ${cls}" style="background:${hueFor(id)}">${esc(initials(name))}</span>`;
}

export function statusBadge(status, labels) {
  return `<span class="status st-${esc(status)}">${esc(labels?.[status] || status)}</span>`;
}

export function empty(emoji, title, text = '', action = '') {
  return `<div class="empty"><div class="ic">${emoji}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
}

export const spinner = () => '<div class="spinner" role="status" aria-label="Chargement"></div>';

export function toast(message, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 4200);
}

export function modal(title, bodyHtml, { onMount, wide } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" ${wide ? 'style="max-width:820px"' : ''}>
    <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Fermer">${icon.x}</button></div>
    <div class="modal-body">${bodyHtml}</div></div>`;
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => e.key === 'Escape' && close();
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(wrap);
  onMount?.(wrap, close);
  return close;
}

export function lightbox(src, caption) {
  const w = document.createElement('div');
  w.className = 'modal-backdrop lightbox';
  w.innerHTML = `<figure style="margin:0;text-align:center"><img src="${esc(src)}" alt=""><figcaption style="color:#fff;margin-top:10px">${esc(caption || '')}</figcaption></figure>`;
  w.onclick = () => w.remove();
  document.body.append(w);
}

/** Soumission de formulaire avec gestion du bouton et des erreurs */
export function onSubmit(form, handler) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    const errBox = form.querySelector('.form-error');
    errBox?.classList.add('hidden');
    if (btn) btn.disabled = true;
    try {
      await handler(new FormData(form), form);
    } catch (err) {
      if (errBox) { errBox.textContent = err.message; errBox.classList.remove('hidden'); } else toast(err.message, 'err');
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

export const options = (list, selected, placeholder) =>
  (placeholder !== undefined ? `<option value="">${esc(placeholder)}</option>` : '') +
  list.map((v) => {
    const [val, label] = Array.isArray(v) ? v : [v, v];
    return `<option value="${esc(val)}" ${String(val) === String(selected ?? '') ? 'selected' : ''}>${esc(label)}</option>`;
  }).join('');

/** Visuel de repli quand un tailleur n'a pas encore de photo */
export function placeholderCover(id) {
  return `<div class="cover" style="background-color:${hueFor(id)};width:100%;height:100%"></div>`;
}

export const CATEGORY_EMOJI = {
  'Grand boubou': '👘', Kaftan: '🧥', 'Taille basse': '👗', Robe: '👗', 'Ensemble wax': '🎨', Costume: '🤵',
  'Tenue de mariage': '💍', 'Tenue de cérémonie': '✨', Broderie: '🪡', 'Tenue enfant': '🧒', Uniformes: '🎓', Retouches: '✂️',
};
