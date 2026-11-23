import crypto from 'node:crypto';
import { config } from './config.js';
import { get, run, tx } from './db.js';
import { HttpError, bad, genRef, now } from './util.js';
import { addEvent, systemMessage } from './orders-service.js';

/**
 * Passerelle de paiement.
 *  - simulation : page de paiement fictive (développement / démo)
 *  - paytech    : PayTech.sn — agrégateur sénégalais (Wave, Orange Money, Free Money, cartes)
 * Ajouter un fournisseur = implémenter `request()` et un webhook qui appelle `markPaid()`.
 */
const providers = {
  simulation: {
    async request(payment) {
      return { redirect_url: `${config.publicUrl}/#/paiement/simulation/${payment.ref}` };
    },
  },
  paytech: {
    async request(payment, { label }) {
      const { apiKey, apiSecret, env } = config.payment.paytech;
      if (!apiKey || !apiSecret) throw new HttpError(500, 'PayTech non configuré (PAYTECH_API_KEY / PAYTECH_API_SECRET).');
      const res = await fetch('https://paytech.sn/api/payment/request-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', API_KEY: apiKey, API_SECRET: apiSecret },
        body: JSON.stringify({
          item_name: label,
          item_price: payment.amount,
          currency: 'XOF',
          ref_command: payment.ref,
          command_name: label,
          env,
          ipn_url: `${config.publicUrl}/api/payments/ipn/paytech`,
          success_url: `${config.publicUrl}/#/paiement/retour/${payment.ref}`,
          cancel_url: `${config.publicUrl}/#/paiement/retour/${payment.ref}?annule=1`,
          custom_field: JSON.stringify({ ref: payment.ref }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success !== 1) throw new HttpError(502, 'Le service de paiement est indisponible. Réessayez dans un instant.');
      return { redirect_url: data.redirect_url || data.redirectUrl, token: data.token };
    },
  },
};

export function provider() {
  const p = providers[config.payment.provider];
  if (!p) throw new Error(`Fournisseur de paiement inconnu : ${config.payment.provider}`);
  return p;
}

export async function initPayment({ userId, kind, amount, orderId = null, tailorId = null, label }) {
  if (!Number.isInteger(amount) || amount <= 0) throw bad('Montant invalide.');
  const ref = genRef(kind === 'registration' ? 'INS' : 'PAY');
  run(
    `INSERT INTO payments(ref, user_id, kind, order_id, tailor_id, amount, provider) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ref, userId, kind, orderId, tailorId, amount, config.payment.provider,
  );
  const payment = get('SELECT * FROM payments WHERE ref = ?', ref);
  const { redirect_url, token } = await provider().request(payment, { label });
  if (token) run('UPDATE payments SET provider_token = ? WHERE id = ?', token, payment.id);
  return { ref, redirect_url, amount };
}

/** Confirme un paiement (idempotent). Appelé par le webhook du fournisseur. */
export function markPaid(ref, { method = null, meta = {} } = {}) {
  return tx(() => {
    const p = get('SELECT * FROM payments WHERE ref = ?', ref);
    if (!p) throw new HttpError(404, 'Paiement introuvable.');
    if (p.status === 'paid') return p;
    if (p.status !== 'pending') throw bad('Ce paiement ne peut plus être confirmé.');

    run(`UPDATE payments SET status = 'paid', method = ?, paid_at = ?, meta = ? WHERE id = ?`,
      method, now(), JSON.stringify(meta), p.id);

    if (p.kind === 'registration') {
      run(`UPDATE tailors SET status = 'active', registration_paid_at = ? WHERE id = ? AND status = 'pending_payment'`, now(), p.tailor_id);
    } else if (p.kind === 'order') {
      const order = get('SELECT * FROM orders WHERE id = ?', p.order_id);
      if (order && order.status === 'quoted' && order.quote_amount === p.amount) {
        run(`UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ?`, now(), order.id);
        addEvent(order.id, p.user_id, 'paid', `Paiement de ${p.amount} FCFA reçu — fonds sécurisés par Ñawkat.`);
        systemMessage(order, `💳 Commande ${order.ref} payée. Les fonds sont sécurisés jusqu'à la réception de la tenue.`);
      } else {
        // Commande modifiée entre-temps : à rembourser manuellement
        run(`UPDATE payments SET meta = json_set(meta, '$.needs_refund', 1) WHERE id = ?`, p.id);
      }
    }
    return get('SELECT * FROM payments WHERE id = ?', p.id);
  });
}

export function markFailed(ref) {
  run(`UPDATE payments SET status = 'failed' WHERE ref = ? AND status = 'pending'`, ref);
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** Vérification de la notification IPN PayTech */
export function verifyPaytechIpn(body) {
  const { apiKey, apiSecret } = config.payment.paytech;
  if (!apiKey || !apiSecret) return false;
  return body.api_key_sha256 === sha256(apiKey) && body.api_secret_sha256 === sha256(apiSecret);
}
