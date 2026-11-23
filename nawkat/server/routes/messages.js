import { Router } from 'express';
import { all, get, run } from '../db.js';
import { requireAuth } from '../auth.js';
import { str, int, forbidden, notFound, maskContacts, bad } from '../util.js';
import { getOrCreateConversation } from '../orders-service.js';

const r = Router();
r.use(requireAuth);

function loadConversation(req) {
  const c = get(
    `SELECT c.*, t.user_id AS tailor_user_id, t.shop_name, t.slug, t.avatar, u.full_name AS client_name
       FROM conversations c JOIN tailors t ON t.id = c.tailor_id JOIN users u ON u.id = c.client_id WHERE c.id = ?`, req.params.id);
  if (!c) throw notFound('Conversation introuvable.');
  if (c.client_id !== req.user.id && c.tailor_user_id !== req.user.id && req.user.role !== 'admin') throw forbidden();
  return c;
}

r.get('/', (req, res) => {
  const items = all(
    `SELECT c.id, c.last_message_at, t.shop_name, t.slug, t.avatar, u.full_name AS client_name, c.client_id,
            (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_body,
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.read_at IS NULL
               AND (m.sender_id IS NULL OR m.sender_id <> ?)) AS unread
       FROM conversations c JOIN tailors t ON t.id = c.tailor_id JOIN users u ON u.id = c.client_id
      WHERE c.client_id = ? OR t.user_id = ?
      ORDER BY c.last_message_at DESC`, req.user.id, req.user.id, req.user.id);
  res.json({
    items: items.map((c) => ({
      ...c,
      title: c.client_id === req.user.id ? c.shop_name : c.client_name,
      is_client: c.client_id === req.user.id,
    })),
  });
});

/** Le client ouvre (ou retrouve) une conversation avec un tailleur */
r.post('/', (req, res) => {
  if (req.user.role !== 'client') throw bad('Seuls les clients peuvent contacter un tailleur.');
  const tailor = get(`SELECT id FROM tailors WHERE id = ? AND status = 'active'`, int(req.body.tailor_id, 'Tailleur', { min: 1 }));
  if (!tailor) throw notFound('Tailleur introuvable.');
  const c = getOrCreateConversation(req.user.id, tailor.id);
  res.status(201).json({ id: c.id });
});

r.get('/:id', (req, res) => {
  const c = loadConversation(req);
  const after = Number(req.query.after) || 0;
  const messages = all(
    `SELECT id, sender_id, body, kind, order_id, created_at, read_at FROM messages
      WHERE conversation_id = ? AND id > ? ORDER BY id LIMIT 500`, c.id, after);
  run(`UPDATE messages SET read_at = datetime('now') WHERE conversation_id = ? AND read_at IS NULL
         AND (sender_id IS NULL OR sender_id <> ?)`, c.id, req.user.id);
  const isClient = c.client_id === req.user.id;
  res.json({
    conversation: {
      id: c.id, is_client: isClient, title: isClient ? c.shop_name : c.client_name,
      slug: c.slug, avatar: c.avatar, tailor_id: c.tailor_id,
    },
    messages: messages.map((m) => ({ ...m, mine: m.sender_id === req.user.id })),
  });
});

r.post('/:id/messages', (req, res) => {
  const c = loadConversation(req);
  const body = maskContacts(str(req.body.body, 'Message', { min: 1, max: 2000 }));
  const { lastInsertRowid } = run('INSERT INTO messages(conversation_id, sender_id, body) VALUES (?, ?, ?)', c.id, req.user.id, body);
  run(`UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?`, c.id);
  const m = get('SELECT id, sender_id, body, kind, order_id, created_at, read_at FROM messages WHERE id = ?', lastInsertRowid);
  res.status(201).json({ message: { ...m, mine: true } });
});

export default r;
