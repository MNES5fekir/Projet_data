import { Router } from 'express';
import { all, get, registrationFee, commissionRate } from '../db.js';
import { notFound, parseJSON } from '../util.js';
import { requireAuth } from '../auth.js';
import { CITIES, SPECIALTIES, AUDIENCES, MEASUREMENTS, ORDER_STATUS, PAYMENT_METHODS } from '../constants.js';
import { WEIGHTS } from '../scoring.js';
import { config } from '../config.js';

const r = Router();

const CARD_FIELDS = `t.id, t.shop_name, t.slug, t.tagline, t.city, t.district, t.specialties, t.audience, t.avatar, t.cover,
  t.verified, t.score, t.review_count, t.completed_count, t.on_time_rate, t.response_hours, t.years_experience,
  t.home_delivery, t.created_at,
  (SELECT MIN(price) FROM services s WHERE s.tailor_id = t.id AND s.active = 1) AS min_price`;

export function formatCard(t) {
  return {
    ...t,
    specialties: parseJSON(t.specialties, []),
    verified: !!t.verified,
    home_delivery: !!t.home_delivery,
    gallery: all('SELECT image FROM portfolio WHERE tailor_id = ? ORDER BY id DESC LIMIT 3', t.id).map((p) => p.image),
  };
}

r.get('/meta', (_req, res) => {
  res.json({
    cities: CITIES, specialties: SPECIALTIES, audiences: AUDIENCES,
    measurements: MEASUREMENTS, order_status: ORDER_STATUS, payment_methods: PAYMENT_METHODS,
    registration_fee: registrationFee(), commission_rate: commissionRate(),
    payment_provider: config.payment.provider, score_weights: WEIGHTS,
    stats: get(`SELECT (SELECT COUNT(*) FROM tailors WHERE status = 'active') tailors,
                       (SELECT COUNT(*) FROM orders WHERE status = 'completed') orders,
                       (SELECT ROUND(AVG(score), 1) FROM tailors WHERE status = 'active' AND score IS NOT NULL) avg_score`),
  });
});

r.get('/', requireAuth, (req, res) => {
  const q = req.query;
  const where = [`t.status = 'active'`];
  const params = [];
  if (q.q) {
    where.push(`(t.shop_name LIKE ? OR t.tagline LIKE ? OR t.specialties LIKE ? OR t.district LIKE ? OR t.city LIKE ?)`);
    const like = `%${String(q.q).slice(0, 60)}%`;
    params.push(like, like, like, like, like);
  }
  if (q.city) { where.push('t.city = ?'); params.push(String(q.city)); }
  if (q.specialty) { where.push('t.specialties LIKE ?'); params.push(`%"${String(q.specialty).replace(/"/g, '')}"%`); }
  if (q.audience && AUDIENCES.includes(q.audience)) { where.push(`(t.audience = ? OR t.audience = 'mixte')`); params.push(q.audience); }
  if (q.min_rating) { where.push('t.score >= ?'); params.push(Number(q.min_rating) || 0); }
  if (q.verified === '1') where.push('t.verified = 1');
  if (q.home_delivery === '1') where.push('t.home_delivery = 1');
  if (q.max_price) { where.push('(SELECT MIN(price) FROM services s WHERE s.tailor_id = t.id AND s.active = 1) <= ?'); params.push(Number(q.max_price) || 0); }

  const sorts = {
    recommended: 't.rank_score DESC, t.verified DESC, t.id DESC',
    rating: 't.score IS NULL, t.score DESC, t.review_count DESC',
    reviews: 't.review_count DESC',
    price: 'min_price IS NULL, min_price ASC',
    recent: 't.created_at DESC, t.id DESC',
  };
  const order = sorts[q.sort] || sorts.recommended;
  const perPage = Math.min(Number(q.limit) || 12, 48);
  const page = Math.max(Number(q.page) || 1, 1);
  const whereSql = where.join(' AND ');

  const total = get(`SELECT COUNT(*) n FROM tailors t WHERE ${whereSql}`, ...params).n;
  const rows = all(
    `SELECT ${CARD_FIELDS} FROM tailors t WHERE ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`,
    ...params, perPage, (page - 1) * perPage,
  );
  res.json({ total, page, pages: Math.max(1, Math.ceil(total / perPage)), items: rows.map(formatCard) });
});

r.get('/:slug', requireAuth, (req, res) => {
  const t = get(`SELECT ${CARD_FIELDS}, t.bio, t.metrics, t.status, t.user_id FROM tailors t WHERE t.slug = ?`, req.params.slug);
  const isOwner = req.user && t && req.user.id === t.user_id;
  if (!t || (t.status !== 'active' && !isOwner && req.user?.role !== 'admin')) throw notFound('Boutique introuvable.');
  const tailor = formatCard(t);
  tailor.metrics = parseJSON(t.metrics, {});
  delete tailor.user_id;
  tailor.member_since = get('SELECT created_at FROM users WHERE id = ?', t.user_id).created_at;
  tailor.services = all('SELECT * FROM services WHERE tailor_id = ? AND active = 1 ORDER BY price', t.id);
  tailor.portfolio = all('SELECT id, image, caption FROM portfolio WHERE tailor_id = ? ORDER BY id DESC', t.id);
  tailor.reviews = all(
    `SELECT r.id, r.quality, r.punctuality, r.communication, r.value, r.comment, r.tailor_reply, r.created_at,
            u.full_name AS client_name, o.title AS order_title
       FROM reviews r JOIN users u ON u.id = r.client_id JOIN orders o ON o.id = r.order_id
      WHERE r.tailor_id = ? ORDER BY r.created_at DESC LIMIT 30`, t.id,
  ).map((rv) => ({ ...rv, client_name: shortName(rv.client_name) }));
  res.json({ tailor });
});

/** « Awa Ndiaye » -> « Awa N. » (protection de la vie privée) */
function shortName(name) {
  const [first, ...rest] = String(name).split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
}

export default r;
