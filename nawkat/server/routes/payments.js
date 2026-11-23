import express, { Router } from 'express';
import { get } from '../db.js';
import { requireAuth } from '../auth.js';
import { config } from '../config.js';
import { markPaid, markFailed, verifyPaytechIpn } from '../payments.js';
import { forbidden, notFound, oneOf, HttpError } from '../util.js';
import { PAYMENT_METHODS } from '../constants.js';

const r = Router();

// Webhook PayTech (form-urlencoded). Seule source de vérité pour valider un paiement réel.
r.post('/ipn/paytech', express.urlencoded({ extended: false }), (req, res) => {
  const b = req.body || {};
  if (!verifyPaytechIpn(b)) return res.status(403).send('invalid signature');
  const p = get('SELECT * FROM payments WHERE ref = ?', b.ref_command);
  if (!p) return res.status(404).send('unknown');
  if (b.type_event === 'sale_complete') {
    if (Number(b.item_price) !== p.amount) return res.status(400).send('amount mismatch');
    markPaid(p.ref, { method: b.payment_method || null, meta: { provider_ref: b.token || null } });
  } else if (b.type_event === 'sale_canceled') {
    markFailed(p.ref);
  }
  res.send('OK');
});

function loadPayment(req) {
  const p = get(
    `SELECT p.ref, p.kind, p.amount, p.currency, p.status, p.method, p.order_id, p.user_id, p.created_at, p.paid_at,
            t.shop_name, o.title AS order_title, o.ref AS order_ref
       FROM payments p LEFT JOIN tailors t ON t.id = p.tailor_id LEFT JOIN orders o ON o.id = p.order_id
      WHERE p.ref = ?`, req.params.ref);
  if (!p) throw notFound('Paiement introuvable.');
  if (p.user_id !== req.user.id && req.user.role !== 'admin') throw forbidden();
  delete p.user_id;
  return p;
}

r.get('/:ref', requireAuth, (req, res) => res.json({ payment: loadPayment(req), provider: config.payment.provider }));

// Mode simulation uniquement : confirme ou refuse le paiement depuis la page de démo
r.post('/:ref/simulate', requireAuth, (req, res) => {
  if (config.payment.provider !== 'simulation') throw new HttpError(404, 'Introuvable.');
  const p = loadPayment(req);
  const method = oneOf(req.body.method, 'Moyen de paiement', Object.keys(PAYMENT_METHODS));
  if (req.body.outcome === 'fail') markFailed(p.ref);
  else markPaid(p.ref, { method, meta: { simulated: true } });
  res.json({ payment: loadPayment(req) });
});

export default r;
