const express = require('express');
const { db, audit } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { search, platform } = req.query;
  let sql = 'SELECT * FROM customers WHERE business_id = ?';
  const params = [req.user.businessId];
  if (search) { sql += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (platform) { sql += ' AND platform = ?'; params.push(platform); }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND business_id = ?').get(req.params.id, req.user.businessId);
  if (!customer) return res.status(404).json({ error: 'Client non trouvé.' });
  const conversations = db.prepare('SELECT * FROM conversations WHERE customer_id = ? ORDER BY updated_at DESC').all(customer.id);
  const orders = db.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC').all(customer.id);
  res.json({ ...customer, conversations, orders });
});

router.put('/:id', (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND business_id = ?').get(req.params.id, req.user.businessId);
  if (!customer) return res.status(404).json({ error: 'Client non trouvé.' });
  const { name, phone, email, address, wilaya, commune, notes } = req.body;
  db.prepare(
    'UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, wilaya = ?, commune = ?, notes = ? WHERE id = ?'
  ).run(name ?? customer.name, phone ?? customer.phone, email ?? customer.email, address ?? customer.address, wilaya ?? customer.wilaya, commune ?? customer.commune, notes ?? customer.notes, customer.id);
  res.json(db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id));
});

router.delete('/:id', (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND business_id = ?').get(req.params.id, req.user.businessId);
  if (!customer) return res.status(404).json({ error: 'Client non trouvé.' });
  db.prepare('DELETE FROM customers WHERE id = ?').run(customer.id);
  res.json({ ok: true });
});

module.exports = router;
