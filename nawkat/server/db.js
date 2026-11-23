import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  role          TEXT NOT NULL CHECK (role IN ('client','tailor','admin')),
  full_name     TEXT NOT NULL,
  phone         TEXT NOT NULL UNIQUE,
  email         TEXT,
  password_hash TEXT NOT NULL,
  city          TEXT,
  measurements  TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tailors (
  id                   INTEGER PRIMARY KEY,
  user_id              INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  shop_name            TEXT NOT NULL,
  slug                 TEXT NOT NULL UNIQUE,
  tagline              TEXT,
  bio                  TEXT,
  city                 TEXT NOT NULL,
  district             TEXT,
  specialties          TEXT NOT NULL DEFAULT '[]',
  audience             TEXT NOT NULL DEFAULT 'mixte' CHECK (audience IN ('femme','homme','enfant','mixte')),
  years_experience     INTEGER NOT NULL DEFAULT 0,
  home_delivery        INTEGER NOT NULL DEFAULT 0,
  avatar               TEXT,
  cover                TEXT,
  status               TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment','active','suspended')),
  verified             INTEGER NOT NULL DEFAULT 0,
  registration_paid_at TEXT,
  score                REAL,
  rank_score           REAL NOT NULL DEFAULT 0,
  review_count         INTEGER NOT NULL DEFAULT 0,
  completed_count      INTEGER NOT NULL DEFAULT 0,
  on_time_rate         REAL,
  response_hours       REAL,
  metrics              TEXT NOT NULL DEFAULT '{}',
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tailors_status ON tailors(status, rank_score DESC);

CREATE TABLE IF NOT EXISTS services (
  id          INTEGER PRIMARY KEY,
  tailor_id   INTEGER NOT NULL REFERENCES tailors(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL,
  price       INTEGER NOT NULL CHECK (price >= 0),
  delay_days  INTEGER NOT NULL DEFAULT 7,
  image       TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_services_tailor ON services(tailor_id);

CREATE TABLE IF NOT EXISTS portfolio (
  id         INTEGER PRIMARY KEY,
  tailor_id  INTEGER NOT NULL REFERENCES tailors(id) ON DELETE CASCADE,
  image      TEXT NOT NULL,
  caption    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id              INTEGER PRIMARY KEY,
  client_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tailor_id       INTEGER NOT NULL REFERENCES tailors(id) ON DELETE CASCADE,
  last_message_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (client_id, tailor_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       INTEGER REFERENCES users(id),
  body            TEXT NOT NULL,
  attachment      TEXT,
  order_id        INTEGER,
  kind            TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','system')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  read_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, id);

CREATE TABLE IF NOT EXISTS orders (
  id                INTEGER PRIMARY KEY,
  ref               TEXT NOT NULL UNIQUE,
  client_id         INTEGER NOT NULL REFERENCES users(id),
  tailor_id         INTEGER NOT NULL REFERENCES tailors(id),
  service_id        INTEGER REFERENCES services(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  model_image       TEXT,
  measurements      TEXT NOT NULL DEFAULT '{}',
  fabric_provided   INTEGER NOT NULL DEFAULT 1,
  desired_date      TEXT,
  delivery_mode     TEXT NOT NULL DEFAULT 'retrait' CHECK (delivery_mode IN ('retrait','livraison')),
  delivery_address  TEXT,
  quote_amount      INTEGER,
  quote_note        TEXT,
  promised_date     TEXT,
  commission_rate   REAL,
  commission_amount INTEGER,
  status            TEXT NOT NULL DEFAULT 'requested' CHECK (status IN
                    ('requested','quoted','paid','in_progress','ready','completed','declined','cancelled','disputed','refunded')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  quoted_at         TEXT,
  paid_at           TEXT,
  started_at        TEXT,
  ready_at          TEXT,
  completed_at      TEXT,
  closed_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tailor ON orders(tailor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_events (
  id         INTEGER PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  actor_id   INTEGER REFERENCES users(id),
  type       TEXT NOT NULL,
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id             INTEGER PRIMARY KEY,
  ref            TEXT NOT NULL UNIQUE,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  kind           TEXT NOT NULL CHECK (kind IN ('registration','order')),
  order_id       INTEGER REFERENCES orders(id),
  tailor_id      INTEGER REFERENCES tailors(id),
  amount         INTEGER NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'XOF',
  provider       TEXT NOT NULL,
  method         TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  provider_token TEXT,
  meta           TEXT NOT NULL DEFAULT '{}',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at        TEXT
);

CREATE TABLE IF NOT EXISTS reviews (
  id            INTEGER PRIMARY KEY,
  order_id      INTEGER NOT NULL UNIQUE REFERENCES orders(id),
  tailor_id     INTEGER NOT NULL REFERENCES tailors(id),
  client_id     INTEGER NOT NULL REFERENCES users(id),
  quality       INTEGER NOT NULL CHECK (quality BETWEEN 1 AND 5),
  punctuality   INTEGER NOT NULL CHECK (punctuality BETWEEN 1 AND 5),
  communication INTEGER NOT NULL CHECK (communication BETWEEN 1 AND 5),
  value         INTEGER NOT NULL CHECK (value BETWEEN 1 AND 5),
  comment       TEXT,
  tailor_reply  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_tailor ON reviews(tailor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payouts (
  id           INTEGER PRIMARY KEY,
  tailor_id    INTEGER NOT NULL REFERENCES tailors(id),
  amount       INTEGER NOT NULL CHECK (amount > 0),
  method       TEXT NOT NULL CHECK (method IN ('wave','orange_money','free_money')),
  phone        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','paid','rejected')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

export const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA journal_mode = WAL;');
db.exec(SCHEMA);

/** node:sqlite refuse undefined et les booléens : on normalise */
const norm = (params) => params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));

export const get = (sql, ...params) => db.prepare(sql).get(...norm(params));
export const all = (sql, ...params) => db.prepare(sql).all(...norm(params));
export const run = (sql, ...params) => db.prepare(sql).run(...norm(params));

let depth = 0;
/** Transaction (réentrante) */
export function tx(fn) {
  if (depth > 0) return fn();
  depth++;
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    depth--;
  }
}

// Paramètres par défaut
const defaults = {
  registration_fee: String(config.defaults.registrationFee),
  commission_rate: String(config.defaults.commissionRate),
};
for (const [k, v] of Object.entries(defaults)) run('INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)', k, v);

export function getSetting(key) {
  const row = get('SELECT value FROM settings WHERE key = ?', key);
  return row ? row.value : null;
}
export function setSetting(key, value) {
  run('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, String(value));
}
export const registrationFee = () => Number(getSetting('registration_fee'));
export const commissionRate = () => Number(getSetting('commission_rate'));
