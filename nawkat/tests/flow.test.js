// Test de bout en bout du parcours : inscription tailleur + paiement, commande client, devis, paiement, livraison, avis.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nawkat-'));
process.env.DB_FILE = path.join(tmp, 'test.db');
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.PAYMENT_PROVIDER = 'simulation';

const { createApp } = await import('../server/app.js');
let server;
let base;

before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  server.close();
  (await import('../server/db.js')).db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function call(method, url, body, token) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

test('parcours complet tailleur ↔ client', async () => {
  // Tailleur
  const t = await call('POST', '/auth/register', { full_name: 'Ndèye Test', phone: '77 500 00 01', password: 'secret1', role: 'tailor', city: 'Dakar' });
  assert.equal(t.status, 201);
  const tt = t.data.token;
  const shop = await call('PUT', '/shop', { shop_name: 'Atelier Test', city: 'Dakar', specialties: ['Grand boubou'] }, tt);
  assert.equal(shop.data.shop.status, 'pending_payment');

  // Boutique invisible tant que l'inscription n'est pas payée
  assert.equal((await call('GET', '/tailors')).status, 401); // compte obligatoire
  assert.equal((await call('GET', '/tailors', null, tt)).data.total, 0);
  const reg = await call('POST', '/shop/registration-payment', null, tt);
  assert.match(reg.data.redirect_url, /paiement\/simulation/);
  await call('POST', `/payments/${reg.data.ref}/simulate`, { method: 'wave' }, tt);
  const list = await call('GET', '/tailors', null, tt);
  assert.equal(list.data.total, 1);
  const tailorId = list.data.items[0].id;

  // Client
  const c = await call('POST', '/auth/register', { full_name: 'Awa Client', phone: '+221 76 500 00 02', password: 'secret1' });
  const ct = c.data.token;
  const fd = new FormData();
  fd.append('tailor_id', tailorId);
  fd.append('title', 'Grand boubou');
  fd.append('description', 'Bazin bleu avec broderie dorée');
  fd.append('measurements', JSON.stringify({ poitrine: 90 }));
  const created = await (await fetch(`${base}/orders`, { method: 'POST', headers: { Authorization: `Bearer ${ct}` }, body: fd })).json();
  const id = created.order.id;
  assert.equal(created.order.status, 'requested');

  // Le client ne peut pas payer avant le devis
  assert.equal((await call('POST', `/orders/${id}/pay`, null, ct)).status, 409);

  const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  const q = await call('POST', `/orders/${id}/quote`, { amount: 40000, promised_date: future }, tt);
  assert.equal(q.data.order.commission_amount, 4000);

  const pay = await call('POST', `/orders/${id}/pay`, null, ct);
  await call('POST', `/payments/${pay.data.ref}/simulate`, { method: 'orange_money' }, ct);
  assert.equal((await call('GET', `/orders/${id}`, null, ct)).data.order.status, 'paid');

  // Fonds en séquestre
  let fin = await call('GET', '/shop/finances', null, tt);
  assert.equal(fin.data.balance.escrow, 36000);
  assert.equal(fin.data.balance.available, 0);

  await call('POST', `/orders/${id}/start`, null, tt);
  await call('POST', `/orders/${id}/ready`, null, tt);
  await call('POST', `/orders/${id}/confirm`, null, ct);
  fin = await call('GET', '/shop/finances', null, tt);
  assert.equal(fin.data.balance.available, 36000);

  const rv = await call('POST', `/orders/${id}/review`, { quality: 5, punctuality: 5, communication: 4, value: 4, comment: 'Top' }, ct);
  assert.equal(rv.status, 201);
  assert.equal((await call('POST', `/orders/${id}/review`, { quality: 1, punctuality: 1, communication: 1, value: 1 }, ct)).status, 409);

  const card = (await call('GET', '/tailors', null, ct)).data.items[0];
  assert.equal(card.review_count, 1);
  assert.equal(card.on_time_rate, 1);
  assert.ok(card.score > 4.5);

  // Retrait
  assert.equal((await call('POST', '/shop/payouts', { amount: 50000, method: 'wave', phone: '775000001' }, tt)).status, 400);
  assert.equal((await call('POST', '/shop/payouts', { amount: 36000, method: 'wave', phone: '775000001' }, tt)).status, 201);
});

test('sécurité : accès et masquage', async () => {
  const a = await call('POST', '/auth/register', { full_name: 'Intrus', phone: '70 500 00 09', password: 'secret1' });
  assert.equal((await call('GET', '/orders/1', null, a.data.token)).status, 403);
  assert.equal((await call('GET', '/admin/stats', null, a.data.token)).status, 403);
  // Un particulier n'a pas accès à l'espace boutique
  assert.equal((await call('GET', '/shop', null, a.data.token)).status, 403);
  assert.equal((await call('GET', '/tailors/atelier-test')).status, 401);
  assert.equal((await call('POST', '/auth/login', { phone: '705000009', password: 'mauvais' })).status, 401);
  assert.equal((await call('POST', '/auth/register', { full_name: 'X Y', phone: '12345', password: 'secret1' })).status, 400);

  const conv = await call('GET', '/conversations', null, a.data.token);
  assert.deepEqual(conv.data.items, []);
  const { maskContacts } = await import('../server/util.js');
  assert.equal(maskContacts('Appelle-moi au 77 123 45 67'), 'Appelle-moi au [numéro masqué]');
});
