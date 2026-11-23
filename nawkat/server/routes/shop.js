import { Router } from 'express';
import { all, get, run, registrationFee } from '../db.js';
import { requireRole, requireShop } from '../auth.js';
import { str, int, oneOf, bool, bad, notFound, slugify, parseJSON, phoneSN, HttpError } from '../util.js';
import { CITIES, SPECIALTIES, AUDIENCES } from '../constants.js';
import { upload, checkImage, removeUpload } from '../uploads.js';
import { initPayment } from '../payments.js';
import { tailorBalance } from '../orders-service.js';

const r = Router();

function myShop(req) {
  return get('SELECT * FROM tailors WHERE user_id = ?', req.user.id);
}

function formatShop(t) {
  if (!t) return null;
  return {
    ...t, specialties: parseJSON(t.specialties, []), metrics: parseJSON(t.metrics, {}),
    verified: !!t.verified, home_delivery: !!t.home_delivery,
    services: all('SELECT * FROM services WHERE tailor_id = ? ORDER BY active DESC, price', t.id),
    portfolio: all('SELECT * FROM portfolio WHERE tailor_id = ? ORDER BY id DESC', t.id),
  };
}

function readShopFields(b) {
  const specialties = Array.isArray(b.specialties) ? b.specialties : parseJSON(b.specialties, []);
  if (!specialties.length) throw bad('Choisissez au moins une spécialité.');
  if (specialties.some((s) => !SPECIALTIES.includes(s))) throw bad('Spécialité inconnue.');
  return {
    shop_name: str(b.shop_name, 'Nom de la boutique', { min: 3, max: 60 }),
    tagline: str(b.tagline, 'Slogan', { required: false, max: 120 }),
    bio: str(b.bio, 'Présentation', { required: false, max: 1500 }),
    city: oneOf(b.city, 'Ville', CITIES),
    district: str(b.district, 'Quartier', { required: false, max: 60 }),
    specialties: JSON.stringify(specialties),
    audience: oneOf(b.audience || 'mixte', 'Clientèle', AUDIENCES),
    years_experience: int(b.years_experience || 0, "Années d'expérience", { max: 70 }),
    home_delivery: bool(b.home_delivery),
  };
}

r.get('/', requireRole('tailor'), (req, res) => {
  const t = myShop(req);
  res.json({ shop: formatShop(t), registration_fee: registrationFee() });
});

r.put('/', requireRole('tailor'), (req, res) => {
  const f = readShopFields(req.body || {});
  const existing = myShop(req);
  if (existing) {
    const keys = Object.keys(f);
    run(`UPDATE tailors SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...keys.map((k) => f[k]), existing.id);
  } else {
    let slug = slugify(f.shop_name);
    for (let i = 2; get('SELECT 1 FROM tailors WHERE slug = ?', slug); i++) slug = `${slugify(f.shop_name)}-${i}`;
    run(
      `INSERT INTO tailors(user_id, slug, shop_name, tagline, bio, city, district, specialties, audience, years_experience, home_delivery)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      req.user.id, slug, f.shop_name, f.tagline, f.bio, f.city, f.district, f.specialties, f.audience, f.years_experience, f.home_delivery,
    );
  }
  res.json({ shop: formatShop(myShop(req)) });
});

for (const field of ['avatar', 'cover']) {
  r.post(`/${field}`, requireShop, upload.single('image'), (req, res) => {
    const url = checkImage(req.file);
    if (!url) throw bad('Image requise.');
    const t = myShop(req);
    removeUpload(t[field]);
    run(`UPDATE tailors SET ${field} = ? WHERE id = ?`, url, t.id);
    res.json({ url });
  });
}

// ----- Frais d'inscription -----
r.post('/registration-payment', requireShop, async (req, res) => {
  const t = myShop(req);
  if (t.status !== 'pending_payment') throw new HttpError(409, "Les frais d'inscription sont déjà réglés.");
  const pay = await initPayment({
    userId: req.user.id, kind: 'registration', amount: registrationFee(), tailorId: t.id,
    label: `Inscription Ñawkat — ${t.shop_name}`,
  });
  res.json(pay);
});

// ----- Prestations -----
function readService(b) {
  return {
    title: str(b.title, 'Intitulé', { min: 3, max: 80 }),
    description: str(b.description, 'Description', { required: false, max: 800 }),
    category: oneOf(b.category, 'Catégorie', SPECIALTIES),
    price: int(b.price, 'Prix', { min: 500, max: 5_000_000 }),
    delay_days: int(b.delay_days || 7, 'Délai', { min: 1, max: 120 }),
    active: b.active === undefined ? 1 : bool(b.active),
  };
}

r.post('/services', requireShop, upload.single('image'), (req, res) => {
  const s = readService(req.body);
  const image = checkImage(req.file);
  const { lastInsertRowid } = run(
    'INSERT INTO services(tailor_id, title, description, category, price, delay_days, image, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    req.user.tailor_id, s.title, s.description, s.category, s.price, s.delay_days, image, s.active,
  );
  res.status(201).json({ service: get('SELECT * FROM services WHERE id = ?', lastInsertRowid) });
});

r.put('/services/:id', requireShop, upload.single('image'), (req, res) => {
  const cur = get('SELECT * FROM services WHERE id = ? AND tailor_id = ?', req.params.id, req.user.tailor_id);
  if (!cur) throw notFound();
  const s = readService(req.body);
  let image = cur.image;
  if (req.file) { image = checkImage(req.file); removeUpload(cur.image); }
  run('UPDATE services SET title = ?, description = ?, category = ?, price = ?, delay_days = ?, image = ?, active = ? WHERE id = ?',
    s.title, s.description, s.category, s.price, s.delay_days, image, s.active, cur.id);
  res.json({ service: get('SELECT * FROM services WHERE id = ?', cur.id) });
});

r.delete('/services/:id', requireShop, (req, res) => {
  const cur = get('SELECT * FROM services WHERE id = ? AND tailor_id = ?', req.params.id, req.user.tailor_id);
  if (!cur) throw notFound();
  run('DELETE FROM services WHERE id = ?', cur.id);
  removeUpload(cur.image);
  res.json({ ok: true });
});

// ----- Réalisations (portfolio) -----
r.post('/portfolio', requireShop, upload.single('image'), (req, res) => {
  const image = checkImage(req.file);
  if (!image) throw bad('Image requise.');
  const count = get('SELECT COUNT(*) n FROM portfolio WHERE tailor_id = ?', req.user.tailor_id).n;
  if (count >= 40) throw bad('Maximum 40 réalisations.');
  const caption = str(req.body.caption, 'Légende', { required: false, max: 120 });
  const { lastInsertRowid } = run('INSERT INTO portfolio(tailor_id, image, caption) VALUES (?, ?, ?)', req.user.tailor_id, image, caption);
  res.status(201).json({ item: get('SELECT * FROM portfolio WHERE id = ?', lastInsertRowid) });
});

r.delete('/portfolio/:id', requireShop, (req, res) => {
  const cur = get('SELECT * FROM portfolio WHERE id = ? AND tailor_id = ?', req.params.id, req.user.tailor_id);
  if (!cur) throw notFound();
  run('DELETE FROM portfolio WHERE id = ?', cur.id);
  removeUpload(cur.image);
  res.json({ ok: true });
});

// ----- Finances -----
r.get('/finances', requireShop, (req, res) => {
  const id = req.user.tailor_id;
  res.json({
    balance: tailorBalance(id),
    payouts: all('SELECT * FROM payouts WHERE tailor_id = ? ORDER BY id DESC', id),
    monthly: all(
      `SELECT strftime('%Y-%m', completed_at) month, SUM(quote_amount - commission_amount) net, COUNT(*) orders
         FROM orders WHERE tailor_id = ? AND status = 'completed' GROUP BY month ORDER BY month DESC LIMIT 12`, id),
    counts: get(
      `SELECT SUM(status = 'requested') requested, SUM(status = 'quoted') quoted,
              SUM(status IN ('paid','in_progress')) in_progress, SUM(status = 'ready') ready,
              SUM(status = 'completed') completed FROM orders WHERE tailor_id = ?`, id),
  });
});

r.post('/payouts', requireShop, (req, res) => {
  const b = req.body || {};
  const amount = int(b.amount, 'Montant', { min: 1000 });
  const method = oneOf(b.method, 'Moyen de retrait', ['wave', 'orange_money', 'free_money']);
  const phone = phoneSN(b.phone);
  const { available } = tailorBalance(req.user.tailor_id);
  if (amount > available) throw bad(`Solde disponible insuffisant (${available} FCFA).`);
  run('INSERT INTO payouts(tailor_id, amount, method, phone) VALUES (?, ?, ?, ?)', req.user.tailor_id, amount, method, phone);
  res.status(201).json({ balance: tailorBalance(req.user.tailor_id) });
});

export default r;
