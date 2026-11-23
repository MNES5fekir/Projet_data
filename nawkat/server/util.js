import crypto from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const bad = (msg, details) => new HttpError(400, msg, details);
export const forbidden = (msg = 'Action non autorisée.') => new HttpError(403, msg);
export const notFound = (msg = 'Ressource introuvable.') => new HttpError(404, msg);

/** Validation de chaîne */
export function str(value, label, { min = 0, max = 2000, required = true } = {}) {
  const v = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
  if (!v) {
    if (required) throw bad(`Le champ « ${label} » est requis.`);
    return null;
  }
  if (v.length < min) throw bad(`« ${label} » doit contenir au moins ${min} caractères.`);
  if (v.length > max) throw bad(`« ${label} » ne doit pas dépasser ${max} caractères.`);
  return v;
}

/** Validation d'entier */
export function int(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER, required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw bad(`Le champ « ${label} » est requis.`);
    return null;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`« ${label} » doit être un nombre entre ${min} et ${max}.`);
  return n;
}

export function oneOf(value, label, allowed, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw bad(`Le champ « ${label} » est requis.`);
    return null;
  }
  if (!allowed.includes(value)) throw bad(`Valeur invalide pour « ${label} ».`);
  return value;
}

export function isoDate(value, label, { required = true } = {}) {
  if (!value) {
    if (required) throw bad(`Le champ « ${label} » est requis.`);
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) throw bad(`Date invalide pour « ${label} ».`);
  return value;
}

export const bool = (v) => (v === true || v === 1 || v === '1' || v === 'true' || v === 'on' ? 1 : 0);

/**
 * Normalise un numéro sénégalais : accepte 77 123 45 67, +221771234567, 00221...
 * Retourne +221XXXXXXXXX ou lève une erreur.
 */
export function phoneSN(value) {
  let p = String(value || '').replace(/[\s.\-()]/g, '');
  if (p.startsWith('00221')) p = p.slice(5);
  else if (p.startsWith('+221')) p = p.slice(4);
  else if (p.startsWith('221') && p.length === 12) p = p.slice(3);
  if (!/^(7[05678]|3[03])\d{7}$/.test(p)) throw bad('Numéro de téléphone sénégalais invalide (ex : 77 123 45 67).');
  return `+221${p}`;
}

export function slugify(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'boutique';
}

export function genRef(prefix) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${prefix}-${ymd}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export function parseJSON(text, fallback) {
  if (text == null || text === '') return fallback;
  if (typeof text === 'object') return text;
  try { return JSON.parse(text); } catch { return fallback; }
}

/** Masque les numéros de téléphone dans les messages pour garder les échanges et paiements sur la plateforme */
export function maskContacts(text) {
  return text
    .replace(/(\+?221[\s.-]?)?(7[05678]|3[03])([\s.-]?\d){7}/g, '[numéro masqué]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email masqué]');
}

/** Limiteur de débit en mémoire (suffisant pour une instance unique) */
export function rateLimit({ windowMs, max, message = 'Trop de tentatives, réessayez plus tard.' }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, windowMs).unref();
  return (req, _res, next) => {
    const key = req.ip;
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < now) hits.set(key, { count: 1, reset: now + windowMs });
    else if (++h.count > max) return next(new HttpError(429, message));
    next();
  };
}

export const today = () => new Date().toISOString().slice(0, 10);
export const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
