import { Router } from 'express';
import { all, get, run, tx, commissionRate } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { str, int, oneOf, bool, isoDate, bad, forbidden, notFound, genRef, parseJSON, now, today, HttpError } from '../util.js';
import { MEASUREMENTS, ORDER_STATUS } from '../constants.js';
import { upload, checkImage } from '../uploads.js';
import { addEvent, systemMessage } from '../orders-service.js';
import { initPayment } from '../payments.js';
import { recomputeTailor } from '../scoring.js';
import { config } from '../config.js';

const r = Router();
r.use(requireAuth);

const money = (n) => `${new Intl.NumberFormat('fr-FR').format(n)} FCFA`;

/** Commandes « prêtes » non confirmées après N jours : clôture automatique (protège le tailleur) */
function autoComplete() {
  const stale = all(
    `SELECT * FROM orders WHERE status = 'ready' AND julianday('now') - julianday(ready_at) > ?`, config.defaults.autoCompleteDays);
  for (const o of stale) {
    tx(() => {
      run(`UPDATE orders SET status = 'completed', completed_at = ? WHERE id = ?`, now(), o.id);
      addEvent(o.id, null, 'completed', `Clôture automatique après ${config.defaults.autoCompleteDays} jours sans réclamation.`);
    });
    recomputeTailor(o.tailor_id);
  }
}

function loadOrder(req) {
  const o = get('SELECT * FROM orders WHERE id = ?', req.params.id);
  if (!o) throw notFound('Commande introuvable.');
  const isClient = o.client_id === req.user.id;
  const isTailor = req.user.tailor_id && o.tailor_id === req.user.tailor_id;
  if (!isClient && !isTailor && req.user.role !== 'admin') throw forbidden();
  return { o, isClient, isTailor };
}

function expectStatus(o, ...allowed) {
  if (!allowed.includes(o.status)) {
    throw new HttpError(409, `Action impossible : la commande est « ${ORDER_STATUS[o.status]} ».`);
  }
}

function detail(id, viewer) {
  const o = get(
    `SELECT o.*, t.shop_name, t.slug, t.avatar AS tailor_avatar, t.city AS tailor_city, t.district AS tailor_district,
            u.full_name AS client_name, s.title AS service_title
       FROM orders o JOIN tailors t ON t.id = o.tailor_id JOIN users u ON u.id = o.client_id
       LEFT JOIN services s ON s.id = o.service_id WHERE o.id = ?`, id);
  o.measurements = parseJSON(o.measurements, {});
  o.fabric_provided = !!o.fabric_provided;
  o.events = all(
    `SELECT e.type, e.note, e.created_at, u.full_name AS actor FROM order_events e
       LEFT JOIN users u ON u.id = e.actor_id WHERE e.order_id = ? ORDER BY e.id`, id);
  o.review = get('SELECT * FROM reviews WHERE order_id = ?', id) || null;
  o.conversation_id = get('SELECT id FROM conversations WHERE client_id = ? AND tailor_id = ?', o.client_id, o.tailor_id)?.id || null;
  // Le téléphone du client n'est visible du tailleur qu'une fois la commande payée
  if (viewer.isTailor && ['paid', 'in_progress', 'ready', 'completed', 'disputed'].includes(o.status)) {
    o.client_phone = get('SELECT phone FROM users WHERE id = ?', o.client_id).phone;
  }
  o.net_amount = o.quote_amount != null && o.commission_amount != null ? o.quote_amount - o.commission_amount : null;
  return o;
}

// ---------- Création (client) ----------
r.post('/', requireRole('client'), upload.single('model_image'), (req, res) => {
  const b = req.body || {};
  const tailor = get(`SELECT * FROM tailors WHERE id = ? AND status = 'active'`, int(b.tailor_id, 'Tailleur', { min: 1 }));
  if (!tailor) throw notFound('Tailleur introuvable.');
  let service = null;
  if (b.service_id) {
    service = get('SELECT * FROM services WHERE id = ? AND tailor_id = ? AND active = 1', b.service_id, tailor.id);
    if (!service) throw bad('Prestation introuvable.');
  }
  const title = str(b.title || service?.title, 'Modèle souhaité', { min: 3, max: 100 });
  const description = str(b.description, 'Description du modèle', { min: 10, max: 2000 });
  const desired_date = isoDate(b.desired_date, 'Date souhaitée', { required: false });
  if (desired_date && desired_date < today()) throw bad('La date souhaitée doit être dans le futur.');
  const delivery_mode = oneOf(b.delivery_mode || 'retrait', 'Mode de remise', ['retrait', 'livraison']);
  const delivery_address = delivery_mode === 'livraison' ? str(b.delivery_address, 'Adresse de livraison', { max: 200 }) : null;
  const allowed = new Set(MEASUREMENTS.map(([k]) => k));
  const m = {};
  for (const [k, v] of Object.entries(parseJSON(b.measurements, {}))) {
    if (allowed.has(k) && Number(v) > 0 && Number(v) < 300) m[k] = Number(v);
  }
  const model_image = checkImage(req.file);

  const order = tx(() => {
    const ref = genRef('CMD');
    const { lastInsertRowid } = run(
      `INSERT INTO orders(ref, client_id, tailor_id, service_id, title, description, model_image, measurements,
         fabric_provided, desired_date, delivery_mode, delivery_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ref, req.user.id, tailor.id, service?.id, title, description, model_image, JSON.stringify(m),
      bool(b.fabric_provided ?? '1'), desired_date, delivery_mode, delivery_address,
    );
    const o = get('SELECT * FROM orders WHERE id = ?', lastInsertRowid);
    addEvent(o.id, req.user.id, 'requested', 'Demande de confection envoyée.');
    systemMessage(o, `🧵 Nouvelle demande ${o.ref} : « ${title} ». Le tailleur va vous envoyer un devis.`);
    // Mémorise les mensurations dans le profil du client
    if (Object.keys(m).length) run('UPDATE users SET measurements = ? WHERE id = ?', JSON.stringify(m), req.user.id);
    return o;
  });
  res.status(201).json({ order: detail(order.id, { isClient: true }) });
});

// ---------- Liste ----------
r.get('/', (req, res) => {
  autoComplete();
  const as = req.user.role === 'tailor' ? 'tailor' : 'client';
  const where = as === 'tailor' ? 'o.tailor_id = ?' : 'o.client_id = ?';
  const id = as === 'tailor' ? req.user.tailor_id : req.user.id;
  const params = [id];
  let filter = '';
  if (req.query.status === 'active') filter = ` AND o.status IN ('requested','quoted','paid','in_progress','ready','disputed')`;
  else if (req.query.status === 'done') filter = ` AND o.status IN ('completed','declined','cancelled','refunded')`;
  const items = all(
    `SELECT o.id, o.ref, o.title, o.status, o.quote_amount, o.promised_date, o.desired_date, o.created_at, o.model_image,
            t.shop_name, t.slug, t.avatar AS tailor_avatar, u.full_name AS client_name,
            (SELECT 1 FROM reviews r WHERE r.order_id = o.id) AS reviewed
       FROM orders o JOIN tailors t ON t.id = o.tailor_id JOIN users u ON u.id = o.client_id
      WHERE ${where}${filter} ORDER BY o.created_at DESC, o.id DESC LIMIT 200`, ...params);
  res.json({ items });
});

r.get('/:id', (req, res) => {
  autoComplete();
  const v = loadOrder(req);
  res.json({ order: detail(v.o.id, v) });
});

// ---------- Actions du tailleur ----------
r.post('/:id/quote', (req, res) => {
  const { o, isTailor } = loadOrder(req);
  if (!isTailor) throw forbidden();
  expectStatus(o, 'requested', 'quoted');
  const amount = int(req.body.amount, 'Montant', { min: 1000, max: 5_000_000 });
  const promised_date = isoDate(req.body.promised_date, 'Date de livraison promise');
  if (promised_date < today()) throw bad('La date de livraison doit être dans le futur.');
  const note = str(req.body.note, 'Note', { required: false, max: 600 });
  const rate = commissionRate();
  tx(() => {
    run(`UPDATE orders SET status = 'quoted', quote_amount = ?, promised_date = ?, quote_note = ?, commission_rate = ?,
           commission_amount = ?, quoted_at = COALESCE(quoted_at, ?) WHERE id = ?`,
      amount, promised_date, note, rate, Math.round(amount * rate), now(), o.id);
    addEvent(o.id, req.user.id, 'quoted', `Devis : ${money(amount)}, livraison prévue le ${promised_date}.${note ? ` ${note}` : ''}`);
    systemMessage(o, `📋 Devis envoyé pour ${o.ref} : ${money(amount)} — prêt le ${new Date(promised_date).toLocaleDateString('fr-FR')}.`);
  });
  recomputeTailor(o.tailor_id);
  res.json({ order: detail(o.id, { isTailor }) });
});

r.post('/:id/decline', (req, res) => {
  const { o, isTailor } = loadOrder(req);
  if (!isTailor) throw forbidden();
  expectStatus(o, 'requested', 'quoted');
  const note = str(req.body.note, 'Motif', { required: false, max: 400 });
  tx(() => {
    run(`UPDATE orders SET status = 'declined', closed_at = ?, quoted_at = COALESCE(quoted_at, ?) WHERE id = ?`, now(), now(), o.id);
    addEvent(o.id, req.user.id, 'declined', note || 'Le tailleur a décliné la demande.');
    systemMessage(o, `Le tailleur a décliné la demande ${o.ref}.${note ? ` Motif : ${note}` : ''}`);
  });
  res.json({ order: detail(o.id, { isTailor }) });
});

const tailorStep = (path, from, to, ts, text) => r.post(`/:id/${path}`, (req, res) => {
  const { o, isTailor } = loadOrder(req);
  if (!isTailor) throw forbidden();
  expectStatus(o, ...from);
  tx(() => {
    run(`UPDATE orders SET status = ?, ${ts} = ? WHERE id = ?`, to, now(), o.id);
    addEvent(o.id, req.user.id, to, text);
    systemMessage(o, `${text} (${o.ref})`);
  });
  res.json({ order: detail(o.id, { isTailor }) });
});
tailorStep('start', ['paid'], 'in_progress', 'started_at', '✂️ La confection a commencé.');
tailorStep('ready', ['paid', 'in_progress'], 'ready', 'ready_at', '✅ Votre tenue est prête / livrée. Confirmez la réception pour clôturer.');

// ---------- Actions du client ----------
r.post('/:id/cancel', (req, res) => {
  const { o, isClient } = loadOrder(req);
  if (!isClient) throw forbidden();
  expectStatus(o, 'requested', 'quoted');
  tx(() => {
    run(`UPDATE orders SET status = 'cancelled', closed_at = ? WHERE id = ?`, now(), o.id);
    addEvent(o.id, req.user.id, 'cancelled', 'Demande annulée par le client.');
    systemMessage(o, `La demande ${o.ref} a été annulée par le client.`);
  });
  res.json({ order: detail(o.id, { isClient }) });
});

r.post('/:id/pay', async (req, res) => {
  const { o, isClient } = loadOrder(req);
  if (!isClient) throw forbidden();
  expectStatus(o, 'quoted');
  const pay = await initPayment({
    userId: req.user.id, kind: 'order', amount: o.quote_amount, orderId: o.id, tailorId: o.tailor_id,
    label: `Commande ${o.ref} — ${o.title}`,
  });
  res.json(pay);
});

r.post('/:id/confirm', (req, res) => {
  const { o, isClient } = loadOrder(req);
  if (!isClient) throw forbidden();
  expectStatus(o, 'ready');
  tx(() => {
    run(`UPDATE orders SET status = 'completed', completed_at = ? WHERE id = ?`, now(), o.id);
    addEvent(o.id, req.user.id, 'completed', 'Réception confirmée par le client. Paiement versé au tailleur.');
    systemMessage(o, `🎉 Réception confirmée pour ${o.ref}. Merci ! Le paiement est versé au tailleur.`);
  });
  recomputeTailor(o.tailor_id);
  res.json({ order: detail(o.id, { isClient }) });
});

r.post('/:id/dispute', (req, res) => {
  const { o, isClient } = loadOrder(req);
  if (!isClient) throw forbidden();
  expectStatus(o, 'paid', 'in_progress', 'ready');
  const note = str(req.body.note, 'Description du problème', { min: 10, max: 1000 });
  tx(() => {
    run(`UPDATE orders SET status = 'disputed' WHERE id = ?`, o.id);
    addEvent(o.id, req.user.id, 'disputed', note);
    systemMessage(o, `⚠️ Un litige a été ouvert sur ${o.ref}. L'équipe Ñawkat va intervenir sous 48 h.`);
  });
  res.json({ order: detail(o.id, { isClient }) });
});

r.post('/:id/review', (req, res) => {
  const { o, isClient } = loadOrder(req);
  if (!isClient) throw forbidden();
  expectStatus(o, 'completed');
  if (get('SELECT 1 FROM reviews WHERE order_id = ?', o.id)) throw new HttpError(409, 'Vous avez déjà noté cette commande.');
  const b = req.body || {};
  const note = (k, label) => int(b[k], label, { min: 1, max: 5 });
  run(
    `INSERT INTO reviews(order_id, tailor_id, client_id, quality, punctuality, communication, value, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    o.id, o.tailor_id, req.user.id, note('quality', 'Qualité'), note('punctuality', 'Respect des délais'),
    note('communication', 'Communication'), note('value', 'Rapport qualité/prix'),
    str(b.comment, 'Commentaire', { required: false, max: 1000 }),
  );
  addEvent(o.id, req.user.id, 'reviewed', 'Avis publié.');
  recomputeTailor(o.tailor_id);
  res.status(201).json({ order: detail(o.id, { isClient }) });
});

r.post('/:id/review/reply', (req, res) => {
  const { o, isTailor } = loadOrder(req);
  if (!isTailor) throw forbidden();
  const reply = str(req.body.reply, 'Réponse', { min: 2, max: 600 });
  const { changes } = run('UPDATE reviews SET tailor_reply = ? WHERE order_id = ?', reply, o.id);
  if (!changes) throw notFound('Aucun avis à répondre.');
  res.json({ order: detail(o.id, { isTailor }) });
});

export default r;
