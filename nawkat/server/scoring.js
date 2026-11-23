import { get, run } from './db.js';

/**
 * Note globale d'un tailleur (sur 5), combinant :
 *  - les avis clients (qualité, respect des délais, communication, rapport qualité/prix)
 *  - des indicateurs objectifs mesurés par la plateforme :
 *      ponctualité réelle (commande prête avant la date promise),
 *      réactivité (délai de réponse aux demandes),
 *      fiabilité (commandes menées à terme vs annulées/litiges).
 *
 * Le classement utilise une moyenne bayésienne pour ne pas favoriser
 * un tailleur avec un seul avis à 5/5 face à un tailleur avec 80 avis à 4,8.
 */
export const WEIGHTS = {
  quality: 0.30,
  punctuality: 0.15,
  communication: 0.10,
  value: 0.10,
  on_time: 0.15,
  responsiveness: 0.10,
  reliability: 0.10,
};

const PRIOR_MEAN = 3.8;  // note a priori
const PRIOR_WEIGHT = 3;  // équivaut à 3 commandes « moyennes »

export function responsivenessScore(hours) {
  if (hours == null) return null;
  if (hours <= 3) return 5;
  if (hours <= 12) return 4.5;
  if (hours <= 24) return 4;
  if (hours <= 48) return 3;
  if (hours <= 72) return 2;
  return 1;
}

export function computeScore(m) {
  const parts = {
    quality: m.avg_quality,
    punctuality: m.avg_punctuality,
    communication: m.avg_communication,
    value: m.avg_value,
    on_time: m.on_time_rate == null ? null : 1 + 4 * m.on_time_rate,
    responsiveness: responsivenessScore(m.response_hours),
    reliability: m.reliability_rate == null ? null : 1 + 4 * m.reliability_rate,
  };
  let sum = 0;
  let weight = 0;
  for (const [k, v] of Object.entries(parts)) {
    if (v == null) continue;
    sum += v * WEIGHTS[k];
    weight += WEIGHTS[k];
  }
  const score = weight > 0 ? sum / weight : null;
  const n = m.completed_count || 0;
  const rank = score == null ? PRIOR_MEAN * 0.9 : (PRIOR_WEIGHT * PRIOR_MEAN + n * score) / (PRIOR_WEIGHT + n);
  return { score: score == null ? null : Math.round(score * 100) / 100, rank: Math.round(rank * 1000) / 1000, parts };
}

export function recomputeTailor(tailorId) {
  const r = get(
    `SELECT COUNT(*) n, AVG(quality) q, AVG(punctuality) p, AVG(communication) c, AVG(value) v
       FROM reviews WHERE tailor_id = ?`, tailorId);

  const o = get(
    `SELECT
       SUM(status = 'completed') completed,
       SUM(status = 'completed' AND promised_date IS NOT NULL) with_promise,
       SUM(status = 'completed' AND promised_date IS NOT NULL AND date(ready_at) <= promised_date) on_time,
       SUM(status IN ('refunded') OR (status = 'cancelled' AND paid_at IS NOT NULL)) failed,
       AVG(CASE WHEN quoted_at IS NOT NULL THEN (julianday(quoted_at) - julianday(created_at)) * 24 END) resp
     FROM orders WHERE tailor_id = ?`, tailorId);

  const completed = o.completed || 0;
  const metrics = {
    avg_quality: r.q, avg_punctuality: r.p, avg_communication: r.c, avg_value: r.v,
    review_count: r.n,
    completed_count: completed,
    on_time_rate: o.with_promise ? o.on_time / o.with_promise : null,
    response_hours: o.resp == null ? null : Math.round(o.resp * 10) / 10,
    reliability_rate: completed + (o.failed || 0) > 0 ? completed / (completed + (o.failed || 0)) : null,
  };
  const { score, rank, parts } = computeScore(metrics);
  run(
    `UPDATE tailors SET score = ?, rank_score = ?, review_count = ?, completed_count = ?, on_time_rate = ?,
       response_hours = ?, metrics = ? WHERE id = ?`,
    score, rank, r.n, completed, metrics.on_time_rate, metrics.response_hours,
    JSON.stringify({ ...metrics, parts }), tailorId,
  );
  return { score, rank, metrics };
}
