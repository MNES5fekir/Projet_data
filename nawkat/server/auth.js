import crypto from 'node:crypto';
import { config } from './config.js';
import { get } from './db.js';
import { HttpError, forbidden } from './util.js';

// ---------- Mots de passe (scrypt) ----------
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [algo, saltHex, hashHex] = String(stored).split('$');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// ---------- Jetons (JWT HS256) ----------
const b64url = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', config.jwtSecret).update(data).digest('base64url');

export function signToken(payload, ttlSeconds = 60 * 60 * 24 * 30) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }));
  return `${header}.${body}.${sign(`${header}.${body}`)}`;
}

export function verifyToken(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = sign(`${header}.${body}`);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- Middlewares ----------
export function loadUser(req, _res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = get('SELECT id, role, full_name, phone, email, city FROM users WHERE id = ?', payload.sub);
      if (user) {
        if (user.role === 'tailor') {
          const t = get('SELECT id, status FROM tailors WHERE user_id = ?', user.id);
          user.tailor_id = t ? t.id : null;
          user.tailor_status = t ? t.status : null;
        }
        req.user = user;
      }
    }
  }
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Veuillez vous connecter.'));
  next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Veuillez vous connecter.'));
  if (!roles.includes(req.user.role)) return next(forbidden());
  next();
};

/** Tailleur ayant déjà créé sa boutique */
export function requireShop(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Veuillez vous connecter.'));
  if (req.user.role !== 'tailor') return next(forbidden('Réservé aux tailleurs.'));
  if (!req.user.tailor_id) return next(new HttpError(409, "Créez d'abord votre boutique."));
  next();
}
