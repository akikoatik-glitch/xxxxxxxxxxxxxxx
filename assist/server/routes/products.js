const express = require('express');
const { db, audit } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { category, search } = req.query;
  let sql = 'SELECT * FROM products WHERE business_id = ?';
  const params = [req.user.businessId];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (search) { sql += ' AND (name LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY name ASC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/', (req, res) => {
  const { name, description, unit_price, category, stock } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom du produit requis.' });
  const result = db.prepare(
    'INSERT INTO products (business_id, name, description, unit_price, category, stock) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.businessId, name, description || '', unit_price || 0, category || 'general', stock ?? -1);
  audit(req.user.businessId, 'create_product', req.user.email, 'product', result.lastInsertRowid, name);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  res.json(product);
});

router.put('/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND business_id = ?').get(req.params.id, req.user.businessId);
  if (!product) return res.status(404).json({ error: 'Produit non trouvé.' });
  const { name, description, unit_price, category, stock, active } = req.body;
  db.prepare(
    'UPDATE products SET name = ?, description = ?, unit_price = ?, category = ?, stock = ?, active = ? WHERE id = ?'
  ).run(
    name ?? product.name, description ?? product.description, unit_price ?? product.unit_price,
    category ?? product.category, stock ?? product.stock,
    active === undefined ? product.active : (active ? 1 : 0), product.id
  );
  audit(req.user.businessId, 'update_product', req.user.email, 'product', product.id, name || product.name);
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(product.id));
});

router.delete('/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND business_id = ?').get(req.params.id, req.user.businessId);
  if (!product) return res.status(404).json({ error: 'Produit non trouvé.' });
  db.prepare('DELETE FROM products WHERE id = ?').run(product.id);
  audit(req.user.businessId, 'delete_product', req.user.email, 'product', product.id, product.name);
  res.json({ ok: true });
});

module.exports = router;
