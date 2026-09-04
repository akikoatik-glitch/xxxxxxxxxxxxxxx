const express = require('express');
const { db, audit } = require('../db');
const { requireUser, loadBusiness } = require('../auth');
const { canCreate } = require('../services/pricing');

const router = express.Router();
router.use(requireUser, loadBusiness);

router.get('/', (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  let rows = db.prepare('SELECT * FROM customers WHERE business_id=? ORDER BY id DESC').all(req.business.id);
  if (q) {
    rows = rows.filter((c) =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  }
  // Attach stats per customer
  const withStats = rows.map((c) => {
    const devis = db.prepare('SELECT COUNT(*) c FROM devis WHERE customer_id=?').get(c.id);
    const inv = db.prepare('SELECT COUNT(*) c FROM invoices WHERE customer_id=?').get(c.id);
    const unpaid = db.prepare("SELECT COUNT(*) c FROM invoices WHERE customer_id=? AND status IN ('unpaid','overdue')").get(c.id);
    const convs = db.prepare('SELECT COUNT(*) c FROM conversations WHERE customer_id=?').get(c.id);
    return { ...c, stats: { devis: devis.c, invoices: inv.c, unpaid: unpaid.c, conversations: convs.c } };
  });
  res.json(withStats);
});

router.get('/search', (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const rows = db.prepare('SELECT * FROM customers WHERE business_id=? ORDER BY id DESC').all(req.business.id)
    .filter((c) => !q || (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q));
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id=? AND business_id=?').get(req.params.id, req.business.id);
  if (!c) return res.status(404).json({ error: 'Client introuvable.' });
  const convs = db.prepare('SELECT * FROM conversations WHERE customer_id=? ORDER BY id DESC').all(c.id);
  const withMsgs = convs.map((cv) => {
    const messages = db.prepare('SELECT id, sender, body, created_at FROM messages WHERE conversation_id=? ORDER BY id ASC').all(cv.id);
    return { ...cv, messages: messages.slice(-50) };
  });
  const devis = db.prepare('SELECT * FROM devis WHERE customer_id=? ORDER BY id DESC').all(c.id);
  const invoices = db.prepare('SELECT * FROM invoices WHERE customer_id=? ORDER BY id DESC').all(c.id);
  res.json({ ...c, conversations: withMsgs, devis, invoices });
});

router.post('/', (req, res) => {
  const check = canCreate(req.business.id, 'customers');
  if (!check.ok) return res.status(403).json({ error: check.reason });
  const { name, phone = '', email = '', address = '', notes = '' } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nom du client requis.' });
  const info = db.prepare(
    'INSERT INTO customers (business_id, name, phone, email, address, notes) VALUES (?,?,?,?,?,?)'
  ).run(req.business.id, String(name).trim(), String(phone), String(email), String(address), String(notes));
  audit(req.business.id, 'add_customer', req.user.email, 'customer', info.lastInsertRowid, name);
  res.status(201).json(db.prepare('SELECT * FROM customers WHERE id=?').get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id=? AND business_id=?').get(req.params.id, req.business.id);
  if (!c) return res.status(404).json({ error: 'Client introuvable.' });
  const { name, phone, email, address, notes } = req.body || {};
  db.prepare('UPDATE customers SET name=?, phone=?, email=?, address=?, notes=? WHERE id=?')
    .run(
      name !== undefined ? String(name) : c.name,
      phone !== undefined ? String(phone) : c.phone,
      email !== undefined ? String(email) : c.email,
      address !== undefined ? String(address) : c.address,
      notes !== undefined ? String(notes) : c.notes,
      c.id
    );
  res.json(db.prepare('SELECT * FROM customers WHERE id=?').get(c.id));
});

router.delete('/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id=? AND business_id=?').get(req.params.id, req.business.id);
  if (!c) return res.status(404).json({ error: 'Client introuvable.' });
  db.prepare('DELETE FROM customers WHERE id=?').run(c.id);
  audit(req.business.id, 'delete_customer', req.user.email, 'customer', c.id, c.name);
  res.json({ ok: true });
});

module.exports = router;
