import { api, session, refreshUser } from '../api.js';
import { esc, icon, avatar, ago, time, date, empty, toast, $ } from '../ui.js';

export async function render({ app, params, isCurrent }) {
  document.title = 'Messages — Ñawkat';
  const { items } = await api('/conversations');
  const activeId = params.id ? Number(params.id) : null;

  app.innerHTML = `<div class="container" style="padding:0 0 0">
    <div class="card chat ${activeId ? 'has-active' : ''}" style="border-radius:0 0 var(--radius) var(--radius);border-top:0">
      <aside class="chat-list">
        <div style="padding:16px"><h2 style="font-size:1.3rem;margin:0">Messages</h2></div>
        ${items.length ? items.map((c) => `<a href="#/messages/${c.id}" class="${c.id === activeId ? 'active' : ''}">
          ${avatar(c.is_client ? c.avatar : null, c.title, c.id, 'avatar-sm')}
          <div class="grow"><span><strong>${esc(c.title)}</strong></span><span class="small muted">${esc(c.last_body || 'Nouvelle conversation')}</span></div>
          <div style="text-align:right"><div class="xs muted">${ago(c.last_message_at)}</div>${c.unread ? `<span class="badge badge-terra">${c.unread}</span>` : ''}</div>
        </a>`).join('') : empty('💬', 'Aucune conversation', session.user.role === 'client' ? 'Contactez un tailleur depuis sa boutique.' : 'Vos clients vous écriront ici.')}
      </aside>
      <section class="chat-main" id="chat-main">
        ${activeId ? '' : `<div class="empty" style="margin:auto">${icon.chat.replace('<svg', '<svg style="width:48px;height:48px;opacity:.4"')}<p>Sélectionnez une conversation</p></div>`}
      </section>
    </div></div>`;

  if (!activeId) return;
  await openConversation(activeId, isCurrent);
}

async function openConversation(id, isCurrent) {
  const main = $('#chat-main');
  const data = await api(`/conversations/${id}`);
  const c = data.conversation;
  let lastId = 0;
  let lastDay = '';

  main.innerHTML = `
    <div class="chat-head">
      <a href="#/messages" class="icon-btn" aria-label="Retour">${icon.back}</a>
      ${avatar(c.is_client ? c.avatar : null, c.title, c.id, 'avatar-sm')}
      <div style="flex:1"><strong>${esc(c.title)}</strong></div>
      ${c.is_client ? `<a class="btn btn-sm btn-outline" href="#/t/${esc(c.slug)}">Boutique</a><a class="btn btn-sm btn-primary" href="#/commander/${esc(c.slug)}">Commander</a>` : ''}
    </div>
    <div class="chat-msgs" id="msgs"></div>
    <div class="xs muted center" style="padding:4px 12px;background:var(--bg)">🔒 Pour votre sécurité, les numéros et emails sont masqués. Payez toujours via Ñawkat.</div>
    <form class="chat-form" id="send"><input class="input" name="body" placeholder="Écrire un message…" autocomplete="off" maxlength="2000" required><button class="btn btn-primary" type="submit" aria-label="Envoyer">${icon.send}</button></form>`;

  const box = $('#msgs');
  const append = (list) => {
    if (!list.length) return;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    const html = list.map((m) => {
      const day = date(m.created_at);
      const sep = day !== lastDay ? `<div class="xs muted center" style="margin:8px 0">${day}</div>` : '';
      lastDay = day;
      lastId = Math.max(lastId, m.id);
      const link = m.order_id ? ` <a href="#/commandes/${m.order_id}" style="font-weight:600">Voir la commande →</a>` : '';
      if (m.kind === 'system') return `${sep}<div class="msg system">${esc(m.body)}${link}</div>`;
      return `${sep}<div class="msg ${m.mine ? 'mine' : ''}">${esc(m.body)}<time>${time(m.created_at)}</time></div>`;
    }).join('');
    box.insertAdjacentHTML('beforeend', html);
    if (nearBottom || list.some((m) => m.mine)) box.scrollTop = box.scrollHeight;
  };
  append(data.messages);
  box.scrollTop = box.scrollHeight;
  if (!data.messages.length) box.innerHTML = '<div class="empty small">Présentez votre projet au tailleur : type de tenue, occasion, délai…</div>';
  refreshUser();

  const form = $('#send');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = form.body.value.trim();
    if (!body) return;
    form.body.value = '';
    try {
      if (!lastId) box.innerHTML = '';
      const { message } = await api(`/conversations/${id}/messages`, { method: 'POST', body: { body } });
      append([message]);
    } catch (err) { toast(err.message, 'err'); form.body.value = body; }
  });
  form.body.focus();

  // Actualisation (polling léger) tant que la conversation est affichée
  const poll = setInterval(async () => {
    if (!isCurrent() || !document.body.contains(box)) return clearInterval(poll);
    if (document.visibilityState !== 'visible') return;
    try {
      const { messages } = await api(`/conversations/${id}?after=${lastId}`);
      if (messages.length && !lastId) box.innerHTML = '';
      append(messages.filter((m) => m.id > lastId));
    } catch { /* réseau instable : on réessaie au prochain tour */ }
  }, 4000);
}
