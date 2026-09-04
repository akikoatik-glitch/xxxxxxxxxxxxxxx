const express = require('express');
const { db, nextNumber, audit } = require('../db');
const { generateOrderPDF } = require('../services/pdf');

const router = express.Router();

router.get('/', (req, res) => {
  const { status, search } = req.query;
  let sql = `SELECT o.*, cu.name AS cust_name FROM orders o LEFT JOIN customers cu ON o.customer_id = cu.id WHERE o.business_id = ?`;
  const params = [req.user.businessId];
  if (status) { sql += ' AND o.status = ?'; params.push(status); }
  if (search) {
    sql += " AND (o.customer_name LIKE ? OR o.number LIKE ? OR o.customer_phone LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY o.created_at DESC LIMIT 200';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND business_id = ?').get(req.params.id, req.user.businessId);
  if (!order) return res.status(404).json({ error: 'Commande non trouvée.' });
  res.json(order);
});

router.post('/', (req, res) => {
  const { customer_name, customer_phone, customer_address, customer_wilaya, customer_commune, products, payment_method, delivery_method, notes } = req.body;
  if (!customer_name || !products?.length) {
    return res.status(400).json({ error: 'Nom du client et produits requis.' });
  }
  const number = nextNumber('ORD', 'orders', req.user.businessId);
  let subtotal = 0;
  const enrichedProducts = products.map(p => {
    const total = (p.price || 0) * (p.qty || 1);
    subtotal += total;
    return { ...p, total };
  });
  const deliveryCost = delivery_method === 'relay' ? 350 : 500;
  const total = subtotal + deliveryCost;

  const result = db.prepare(
    `INSERT INTO orders (business_id, number, status, customer_name, customer_phone, customer_address, customer_wilaya, customer_commune, products_json, subtotal, delivery_cost, total, payment_method, delivery_method, notes)
     VALUES (?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.user.businessId, number, customer_name, customer_phone || '',
    customer_address || '', customer_wilaya || '', customer_commune || '',
    JSON.stringify(enrichedProducts), subtotal, deliveryCost, total,
    payment_method || '', delivery_method || 'home', notes || ''
  );

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
  audit(req.user.businessId, 'create_order', req.user.email, 'order', result.lastInsertRowid, number);
  res.json(order);
});

router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  const allowed = ['new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Statut invalide.' });
  db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?')
    .run(status, req.params.id, req.user.businessId);
  audit(req.user.businessId, 'update_order_status', req.user.email, 'order', req.params.id, status);
  res.json({ ok: true, status });
});

router.post('/:id/pdf', async (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND business_id = ?').get(req.params.id, req.user.businessId);
    if (!order) return res.status(404).json({ error: 'Commande non trouvée.' });
    const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.user.businessId);
    const { pdfPath, filename } = await generateOrderPDF(order, biz);
    db.prepare('UPDATE orders SET pdf_path = ? WHERE id = ?').run(`pdfs/${filename}`, order.id);
    res.json({ pdf_path: `pdfs/${filename}` });
  } catch (e) {
    console.error('[pdf]', e);
    res.status(500).json({ error: 'Erreur lors de la génération du PDF.' });
  }
});

router.delete('/:id', (req, res) => {
  const order = db.prepare('SELECT id, number FROM orders WHERE id = ? AND business_id = ?').get(req.params.id, req.user.businessId);
  if (!order) return res.status(404).json({ error: 'Commande non trouvée.' });
  db.prepare('DELETE FROM orders WHERE id = ?').run(order.id);
  audit(req.user.businessId, 'delete_order', req.user.email, 'order', order.id, order.number);
  res.json({ ok: true });
});

module.exports = router;
