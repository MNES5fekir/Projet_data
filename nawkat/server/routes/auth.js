import { Router } from 'express';
import { get, run } from '../db.js';
import { hashPassword, verifyPassword, signToken, requireAuth } from '../auth.js';
import { str, oneOf, phoneSN, bad, rateLimit, HttpError, parseJSON } from '../util.js';
import { CITIES, MEASUREMENTS } from '../constants.js';

const r = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

function publicUser(u) {
  const user = get('SELECT id, role, full_name, phone, email, city, measurements, created_at FROM users WHERE id = ?', u.id);
  user.measurements = parseJSON(user.measurements, {});
  if (user.role === 'tailor') {
    user.shop = get('SELECT id, shop_name, slug, status, verified, avatar FROM tailors WHERE user_id = ?', user.id) || null;
  }
  user.unread = get(
    `SELECT COUNT(*) n FROM messages m JOIN conversations c ON c.id = m.conversation_id
      LEFT JOIN tailors t ON t.id = c.tailor_id
     WHERE m.read_at IS NULL AND (m.sender_id IS NULL OR m.sender_id <> ?)
       AND (c.client_id = ? OR t.user_id = ?)`, user.id, user.id, user.id).n;
  return user;
}

r.post('/register', limiter, (req, res) => {
  const b = req.body || {};
  const full_name = str(b.full_name, 'Nom complet', { min: 2, max: 80 });
  const phone = phoneSN(b.phone);
  const password = str(b.password, 'Mot de passe', { min: 6, max: 128 });
  const role = oneOf(b.role || 'client', 'Type de compte', ['client', 'tailor']);
  const city = b.city ? oneOf(b.city, 'Ville', CITIES) : null;
  if (get('SELECT 1 FROM users WHERE phone = ?', phone)) throw new HttpError(409, 'Un compte existe déjà avec ce numéro.');
  const { lastInsertRowid } = run(
    'INSERT INTO users(role, full_name, phone, password_hash, city) VALUES (?, ?, ?, ?, ?)',
    role, full_name, phone, hashPassword(password), city,
  );
  const user = publicUser({ id: Number(lastInsertRowid) });
  res.status(201).json({ token: signToken({ sub: user.id }), user });
});

r.post('/login', limiter, (req, res) => {
  const b = req.body || {};
  let phone;
  try { phone = phoneSN(b.phone); } catch { throw new HttpError(401, 'Numéro ou mot de passe incorrect.'); }
  const u = get('SELECT * FROM users WHERE phone = ?', phone);
  if (!u || !verifyPassword(String(b.password || ''), u.password_hash)) throw new HttpError(401, 'Numéro ou mot de passe incorrect.');
  res.json({ token: signToken({ sub: u.id }), user: publicUser(u) });
});

r.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

r.patch('/me', requireAuth, (req, res) => {
  const b = req.body || {};
  const fields = {};
  if (b.full_name !== undefined) fields.full_name = str(b.full_name, 'Nom complet', { min: 2, max: 80 });
  if (b.email !== undefined) {
    const email = str(b.email, 'Email', { required: false, max: 120 });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('Adresse email invalide.');
    fields.email = email;
  }
  if (b.city !== undefined) fields.city = b.city ? oneOf(b.city, 'Ville', CITIES) : null;
  if (b.measurements !== undefined) {
    const allowed = new Set(MEASUREMENTS.map(([k]) => k));
    const m = {};
    for (const [k, v] of Object.entries(b.measurements || {})) {
      if (!allowed.has(k) || v === '' || v == null) continue;
      const n = Number(v);
      if (!(n > 0 && n < 300)) throw bad('Mensuration invalide (en cm).');
      m[k] = n;
    }
    fields.measurements = JSON.stringify(m);
  }
  if (b.new_password) {
    const u = get('SELECT password_hash FROM users WHERE id = ?', req.user.id);
    if (!verifyPassword(String(b.current_password || ''), u.password_hash)) throw bad('Mot de passe actuel incorrect.');
    fields.password_hash = hashPassword(str(b.new_password, 'Nouveau mot de passe', { min: 6, max: 128 }));
  }
  const keys = Object.keys(fields);
  if (keys.length) run(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...keys.map((k) => fields[k]), req.user.id);
  res.json({ user: publicUser(req.user) });
});

export default r;
