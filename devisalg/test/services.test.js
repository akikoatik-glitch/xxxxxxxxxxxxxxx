'use strict';

require('./helpers/setup');
const { test } = require('node:test');
const assert = require('node:assert');
const { db, audit, nextNumber } = require('../server/db');
const { hashPassword, verifyPassword } = require('../server/auth');
const conv = require('../server/services/conversation');
const { limits, canCreate } = require('../server/services/pricing');

function makeUser(email) {
  const u = db.prepare('INSERT INTO users (email, password_hash) VALUES (?,?)')
    .run(email, hashPassword('secret'));
  return u.lastInsertRowid;
}
function makeBiz(userId, plan = 'free', name = 'Test Biz') {
  const b = db.prepare('INSERT INTO businesses (user_id, name, plan) VALUES (?,?,?)')
    .run(userId, name, plan);
  return b.lastInsertRowid;
}
function addProduct(bizId, name, price) {
  return db.prepare('INSERT INTO products (business_id, name, unit_price) VALUES (?,?,?)')
    .run(bizId, name, price).lastInsertRowid;
}
function addCustomer(bizId, name, phone) {
  return db.prepare('INSERT INTO customers (business_id, name, phone) VALUES (?,?,?)')
    .run(bizId, name, phone).lastInsertRowid;
}
function enableAi(bizId) {
  db.prepare('INSERT OR IGNORE INTO ai_settings (business_id, enabled) VALUES (?,1)').run(bizId);
}

test('schema: users/businesses tables exist and seed', () => {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
  assert.ok(row);
});

test('auth: password hashing round trip', () => {
  assert.strictEqual(verifyPassword('secret', hashPassword('secret')), true);
  assert.strictEqual(verifyPassword('wrong', hashPassword('secret')), false);
});

test('ai engine: replies with the exact configured price and extracts entity', async () => {
  const u = makeUser('a@test.dz');
  const biz = makeBiz(u);
  addProduct(biz, 'Installation climatisation', 55000);
  const cust = addCustomer(biz, 'Salim', '0550123456');
  enableAi(biz);
  const res = await conv.processIncoming({
    businessId: biz, customerId: cust, text: 'بقداش سعر installation climatisation؟', channel: 'app',
  });
  assert.strictEqual(res.replied, true);
  assert.ok(res.reply.includes('55'));
  assert.ok(res.reply.includes('DA'));
  assert.strictEqual(res.extracted.item, 'Installation climatisation');
  assert.strictEqual(res.extracted.unit_price, 55000);
});

test('ai engine: off-catalog request escalates, never invents a price', async () => {
  const u = makeUser('b@test.dz');
  const biz = makeBiz(u);
  addProduct(biz, 'Nettoyage conduit', 2000);
  const cust = addCustomer(biz, 'Amine', '0550999999');
  enableAi(biz);
  const res = await conv.processIncoming({
    businessId: biz, customerId: cust, text: 'كم تكلفة مولد كهرباء 5 كيلو؟', channel: 'app',
  });
  assert.strictEqual(res.escalated, true);
  assert.strictEqual(res.reason, 'unknown_price');
  assert.ok(!res.reply); // never a made-up price
});

test('multi-tenant isolation: business B never sees business A products', async () => {
  const u1 = makeUser('c@test.dz'); const b1 = makeBiz(u1);
  const u2 = makeUser('d@test.dz'); const b2 = makeBiz(u2);
  addProduct(b1, 'Secret product A', 100);
  const rowsA = db.prepare('SELECT * FROM products WHERE business_id=?').all(b1);
  const rowsB = db.prepare('SELECT * FROM products WHERE business_id=?').all(b2);
  assert.strictEqual(rowsA.length, 1);
  assert.strictEqual(rowsB.length, 0);
});

test('pricing: free plan has finite limits, pro is unlimited', () => {
  const free = limits({ plan: 'free' });
  const pro = limits({ plan: 'pro' });
  assert.ok(free.max_devis >= 0);
  assert.strictEqual(free.whatsapp, false);
  assert.strictEqual(pro.max_devis, -1);
  assert.strictEqual(pro.whatsapp, true);
});

test('pricing canCreate: free plan blocks products over limit', () => {
  const u = makeUser('e@test.dz');
  const biz = makeBiz(u);
  assert.strictEqual(canCreate(biz, 'products').ok, true);
  const lim = limits({ plan: 'free' });
  for (let i = 0; i < lim.max_products; i++) {
    addProduct(biz, 'Produit ' + i, 1000);
  }
  const res = canCreate(biz, 'products');
  assert.strictEqual(res.ok, false);
  assert.ok(res.limit === lim.max_products);
});

test('nextNumber increments per business', () => {
  const u = makeUser('f@test.dz');
  const b1 = makeBiz(u, 'free', 'N1');
  const b2 = makeBiz(u, 'free', 'N2');
  assert.strictEqual(nextNumber('DEV', 'devis', b1), 'DEV-2026-0001');
  assert.strictEqual(nextNumber('DEV', 'devis', b2), 'DEV-2026-0001');
});

test('audit() records an entry', () => {
  const u = makeUser('g@test.dz');
  const b = makeBiz(u);
  audit(b, 'test', 'system', 'business', b, 'hello');
  const row = db.prepare('SELECT * FROM audit_logs WHERE business_id=?').get(b);
  assert.ok(row);
  assert.strictEqual(row.action, 'test');
});
