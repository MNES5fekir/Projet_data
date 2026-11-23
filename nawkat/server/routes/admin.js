import { Router } from 'express';
import { all, get, run, tx, setSetting, registrationFee, commissionRate } from '../db.js';
import { requireRole } from '../auth.js';
import { int, oneOf, notFound, bad, now, str } from '../util.js';
import { addEvent, systemMessage } from '../orders-service.js';
import { recomputeTailor } from '../scoring.js';

const r = Router();
r.use(requireRole('admin'));

r.get('/stats', (_req, res) => {
  res.json({
    totals: get(`SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'client') clients,
        (SELECT COUNT(*) FROM tailors WHERE status = 'active') tailors_active,
        (SELECT COUNT(*) FROM tailors WHERE status = 'pending_payment') tailors_pending,
        (SELECT COUNT(*) FROM orders) orders,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'paid' AND kind = 'order') gmv,
        (SELECT COALESCE(SUM(commission_amount), 0) FROM orders WHERE status = 'completed') commissions,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'paid' AND kind = 'registration') registration_revenue,
        (SELECT COUNT(*) FROM orders WHERE status = 'disputed') disputes,
        (SELECT COUNT(*) FROM payouts WHERE status = 'requested') payouts_pending`),
    by_status: all('SELECT status, COUNT(*) n FROM orders GROUP BY status'),
    settings: { registration_fee: registrationFee(), commission_rate: commissionRate() },
  });
});

r.get('/tailors', (_req, res) => {
  res.json({
    items: all(`SELECT t.id, t.shop_name, t.slug, t.city, t.status, t.verified, t.score, t.review_count, t.completed_count,
                       t.created_at, u.full_name, u.phone
                  FROM tailors t JOIN users u ON u.id = t.user_id ORDER BY t.created_at DESC`),
  });
});

r.patch('/tailors/:id', (req, res) => {
  const t = get('SELECT * FROM tailors WHERE id = ?', req.params.id);
  if (!t) throw notFound();
  if (req.body.verified !== undefined) run('UPDATE tailors SET verified = ? WHERE id = ?', req.body.verified ? 1 : 0, t.id);
  if (req.body.status !== undefined) {
    run('UPDATE tailors SET status = ? WHERE id = ?', oneOf(req.body.status, 'Statut', ['active', 'suspended', 'pending_payment']), t.id);
  }
  res.json({ ok: true });
});

r.get('/payments', (_req, res) => {
  res.json({
    items: all(`SELECT p.ref, p.kind, p.amount, p.status, p.method, p.provider, p.created_at, p.paid_at, u.full_name
                  FROM payments p JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT 200`),
  });
});

r.get('/payouts', (_req, res) => {
  res.json({
    items: all(`SELECT po.*, t.shop_name FROM payouts po JOIN tailors t ON t.id = po.tailor_id
                 ORDER BY po.status = 'requested' DESC, po.id DESC LIMIT 200`),
  });
});

r.post('/payouts/:id', (req, res) => {
  const status = oneOf(req.body.status, 'Statut', ['paid', 'rejected']);
  const { changes } = run(`UPDATE payouts SET status = ?, processed_at = ? WHERE id = ? AND status = 'requested'`, status, now(), req.params.id);
  if (!changes) throw bad('Demande déjà traitée.');
  res.json({ ok: true });
});

r.get('/disputes', (_req, res) => {
  res.json({
    items: all(`SELECT o.id, o.ref, o.title, o.quote_amount, o.created_at, t.shop_name, u.full_name AS client_name,
                       (SELECT note FROM order_events e WHERE e.order_id = o.id AND e.type = 'disputed' ORDER BY e.id DESC LIMIT 1) AS reason
                  FROM orders o JOIN tailors t ON t.id = o.tailor_id JOIN users u ON u.id = o.client_id
                 WHERE o.status = 'disputed' ORDER BY o.id`),
  });
});

/** Arbitrage d'un litige : versement au tailleur ou remboursement du client */
r.post('/orders/:id/resolve', (req, res) => {
  const o = get(`SELECT * FROM orders WHERE id = ? AND status = 'disputed'`, req.params.id);
  if (!o) throw notFound('Litige introuvable.');
  const outcome = oneOf(req.body.outcome, 'Décision', ['release', 'refund']);
  const note = str(req.body.note, 'Note', { required: false, max: 500 });
  tx(() => {
    if (outcome === 'release') {
      run(`UPDATE orders SET status = 'completed', completed_at = ? WHERE id = ?`, now(), o.id);
      addEvent(o.id, req.user.id, 'completed', `Litige clos en faveur du tailleur.${note ? ` ${note}` : ''}`);
      systemMessage(o, `Litige ${o.ref} clos : paiement versé au tailleur.`);
    } else {
      run(`UPDATE orders SET status = 'refunded', closed_at = ? WHERE id = ?`, now(), o.id);
      run(`UPDATE payments SET status = 'refunded' WHERE order_id = ? AND status = 'paid'`, o.id);
      addEvent(o.id, req.user.id, 'refunded', `Client remboursé.${note ? ` ${note}` : ''}`);
      systemMessage(o, `Litige ${o.ref} clos : le client est remboursé.`);
    }
  });
  recomputeTailor(o.tailor_id);
  res.json({ ok: true });
});

r.put('/settings', (req, res) => {
  if (req.body.registration_fee !== undefined) setSetting('registration_fee', int(req.body.registration_fee, "Frais d'inscription", { min: 0, max: 1_000_000 }));
  if (req.body.commission_rate !== undefined) {
    const rate = Number(req.body.commission_rate);
    if (!(rate >= 0 && rate <= 0.5)) throw bad('Commission entre 0 et 50 %.');
    setSetting('commission_rate', rate);
  }
  res.json({ registration_fee: registrationFee(), commission_rate: commissionRate() });
});

export default r;
