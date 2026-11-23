import { get, run } from './db.js';

export function addEvent(orderId, actorId, type, note = null) {
  run('INSERT INTO order_events(order_id, actor_id, type, note) VALUES (?, ?, ?, ?)', orderId, actorId, type, note);
}

export function getOrCreateConversation(clientId, tailorId) {
  run('INSERT OR IGNORE INTO conversations(client_id, tailor_id) VALUES (?, ?)', clientId, tailorId);
  return get('SELECT * FROM conversations WHERE client_id = ? AND tailor_id = ?', clientId, tailorId);
}

/** Message automatique dans la conversation liée à la commande */
export function systemMessage(order, body) {
  const conv = getOrCreateConversation(order.client_id, order.tailor_id);
  run(`INSERT INTO messages(conversation_id, sender_id, body, order_id, kind) VALUES (?, NULL, ?, ?, 'system')`, conv.id, body, order.id);
  run(`UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?`, conv.id);
}

/** Solde d'un tailleur */
export function tailorBalance(tailorId) {
  const earned = get(
    `SELECT COALESCE(SUM(quote_amount - commission_amount), 0) v FROM orders WHERE tailor_id = ? AND status = 'completed'`, tailorId).v;
  const escrow = get(
    `SELECT COALESCE(SUM(quote_amount - commission_amount), 0) v FROM orders
      WHERE tailor_id = ? AND status IN ('paid','in_progress','ready','disputed')`, tailorId).v;
  const withdrawn = get(
    `SELECT COALESCE(SUM(amount), 0) v FROM payouts WHERE tailor_id = ? AND status IN ('requested','paid')`, tailorId).v;
  const pending = get(`SELECT COALESCE(SUM(amount), 0) v FROM payouts WHERE tailor_id = ? AND status = 'requested'`, tailorId).v;
  return { earned, escrow, withdrawn, pending_payout: pending, available: earned - withdrawn };
}
