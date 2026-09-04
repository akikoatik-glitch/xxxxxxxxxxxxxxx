const express = require('express');
const { db, audit, nextNumber } = require('../db');
const { requireUser, loadBusiness } = require('../auth');
const { canCreate } = require('../services/pricing');
const pdf = require('../services/pdf');
const fs = require('fs');

const router = express.Router();
router.use(requireUser, loadBusiness);

function docRef(kind, number) {
  return `${kind.toLowerCase()}-${number.replace(/[\\/:*?"<>|]/g, '_')}`;
}

function getInvoice(req, id) {
  return db.prepare('SELECT * FROM invoices WHERE id=? AND business_id=?').get(id, req.business.id);
}

// Compute payment totals and derive status
function reconcile(invId) {
  const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(invId);
  const sum = db.prepare('SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE invoice_id=?').get(invId);
  db.prepare('UPDATE invoices SET paid_amount=? WHERE id=?').run(sum.paid, invId);
  return { ...inv, paid: sum.paid, remaining: (inv.total || 0) - sum.paid };
}

router.get('/', (req, res) => {
  const status = req.query.status;
  const rows = status
    ? db.prepare('SELECT * FROM invoices WHERE business_id=? AND status=? ORDER BY id DESC').all(req.business.id, status)
    : db.prepare('SELECT * FROM invoices WHERE business_id=? ORDER BY id DESC').all(req.business.id);
  const withItems = rows.map((i) => ({
    ...i,
    items: db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(i.id),
    customer: i.customer_id ? db.prepare('SELECT id,name,phone FROM customers WHERE id=?').get(i.customer_id) : null,
    payments: db.prepare('SELECT * FROM payments WHERE invoice_id=? ORDER BY id').all(i.id),
  }));
  res.json(withItems);
});

router.get('/:id', (req, res) => {
  const inv = getInvoice(req, req.params.id);
  if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
  const rec = reconcile(inv.id);
  res.json({
    ...rec,
    items: db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(inv.id),
    customer: inv.customer_id ? db.prepare('SELECT * FROM customers WHERE id=?').get(inv.customer_id) : null,
    payments: db.prepare('SELECT * FROM payments WHERE invoice_id=? ORDER BY id').all(inv.id),
  });
});

// Update invoice status / due date / reminders
router.put('/:id', (req, res) => {
  const inv = getInvoice(req, req.params.id);
  if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
  const allowed = ['status', 'due_date', 'notes', 'customer_name', 'customer_phone', 'reminders_enabled', 'payment_method', 'payment_date'];
  const sets = [];
  const vals = [];
  for (const k of allowed) {
    if (req.body[k] !== undefined) {
      sets.push(`${k}=?`);
      vals.push(req.body[k]);
    }
  }
  if (sets.length) {
    vals.push(inv.id);
    db.prepare(`UPDATE invoices SET ${sets.join(', ')}, updated_at=datetime('now') WHERE id=?`).run(...vals);
  }
  const updated = db.prepare('SELECT * FROM invoices WHERE id=?').get(inv.id);
  audit(req.business.id, 'update_invoice', req.user.email, 'invoice', inv.id, updated.status);
  res.json(reconcile(inv.id));
});

router.post('/:id/pdf', async (req, res) => {
  const inv = getInvoice(req, req.params.id);
  if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(inv.id);
  const customer = inv.customer_id ? db.prepare('SELECT * FROM customers WHERE id=?').get(inv.customer_id) : null;
  const ref = docRef('facture', inv.number);
  try {
    const file = await pdf.build({
      business: req.business,
      customer: customer || { customer_name: inv.customer_name, customer_phone: inv.customer_phone },
      docRef: ref,
      items,
      discount: inv.discount,
      taxRate: inv.tax_rate,
      notes: inv.notes,
      validity: null,
      kind: 'facture',
      number: inv.number,
      date: inv.created_at.slice(0, 10),
      status: inv.status,
    });
    db.prepare('UPDATE invoices SET pdf_path=? WHERE id=?').run(file, inv.id);
    res.json({ ok: true, url: `/api/invoices/${inv.id}/pdf/download` });
  } catch (e) {
    res.status(500).json({ error: 'Erreur génération PDF: ' + e.message });
  }
});

router.get('/:id/pdf/download', (req, res) => {
  const inv = getInvoice(req, req.params.id);
  if (!inv || !inv.pdf_path) return res.status(404).json({ error: 'PDF non généré.' });
  if (!fs.existsSync(inv.pdf_path)) return res.status(404).json({ error: 'Fichier introuvable.' });
  res.download(inv.pdf_path, `${inv.number}.pdf`);
});

router.post('/:id/status', (req, res) => {
  const inv = getInvoice(req, req.params.id);
  if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
  const status = String(req.body.status || '');
  if (!['draft', 'sent', 'paid', 'unpaid', 'overdue', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Statut invalide.' });
  }
  db.prepare(`UPDATE invoices SET status=?, updated_at=datetime('now') WHERE id=?`).run(status, inv.id);
  audit(req.business.id, `invoice_${status}`, req.user.email, 'invoice', inv.id, inv.number);
  res.json(reconcile(inv.id));
});

// Record a payment (mark paid partially or fully)
router.post('/:id/pay', (req, res) => {
  const inv = getInvoice(req, req.params.id);
  if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
  const amount = Number(req.body.amount);
  const method = String(req.body.method || 'espèces').slice(0, 100);
  const notes = String(req.body.notes || '').slice(0, 300);
  if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'Montant invalide.' });
  const remaining = (inv.total || 0) - (inv.paid_amount || 0);
  const pay = Math.min(amount, remaining);
  const info = db.prepare('INSERT INTO payments (invoice_id, business_id, amount, method, notes) VALUES (?,?,?,?,?)')
    .run(inv.id, inv.business_id, pay, method, notes);

  const rec = reconcile(inv.id);
  let newStatus = inv.status;
  if (rec.remaining <= 0.001) newStatus = 'paid';
  else if (inv.status === 'paid') newStatus = 'unpaid'; // repaying/split
  db.prepare(`UPDATE invoices SET status=?, payment_method=?, payment_date=datetime('now'), updated_at=datetime('now') WHERE id=?`)
    .run(newStatus, method, inv.id);
  audit(req.business.id, 'record_payment', req.user.email, 'payment', info.lastInsertRowid, `${pay} DA`);
  res.json(reconcile(inv.id));
});

// Manually create an invoice (standalone, not from devis)
router.post('/', (req, res) => {
  const check = canCreate(req.business.id, 'invoices');
  if (!check.ok) return res.status(403).json({ error: check.reason, limit: check.limit });
  const {
    customer_id, customer_name = '', customer_phone = '', items = [],
    discount = 0, tax_rate = 0, notes = '', status = 'draft', due_date = null, reminders_enabled = 0,
  } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Ajoutez au moins un article.' });
  const number = nextNumber('FAC', 'invoices', req.business.id);

  let cid = customer_id || null;
  if (!cid && (customer_name || customer_phone)) {
    let cust;
    if (customer_phone) cust = db.prepare('SELECT * FROM customers WHERE business_id=? AND phone=?').get(req.business.id, customer_phone);
    if (!cust && customer_name) cust = db.prepare('SELECT * FROM customers WHERE business_id=? AND lower(name)=lower(?)').get(req.business.id, String(customer_name).trim());
    if (!cust) {
      const info = db.prepare('INSERT INTO customers (business_id, name, phone) VALUES (?,?,?)')
        .run(req.business.id, String(customer_name || 'Client').trim(), String(customer_phone || ''));
      cust = db.prepare('SELECT * FROM customers WHERE id=?').get(info.lastInsertRowid);
    }
    cid = cust.id;
  }

  const subtotal = items.reduce((s, it) => s + (Number(it.quantity) || 1) * (Number(it.unit_price) || 0), 0);
  const discountVal = Math.min(Number(discount) || 0, subtotal);
  const tax = (subtotal - discountVal) * (Number(tax_rate) || 0) / 100;
  const total = subtotal - discountVal + tax;

  const info = db.prepare(
    `INSERT INTO invoices (business_id, customer_id, number, customer_name, customer_phone, status,
      subtotal, discount, tax, tax_rate, total, notes, due_date, reminders_enabled)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(req.business.id, cid, number, String(customer_name), String(customer_phone), status,
    subtotal, discountVal, tax, Number(tax_rate) || 0, total, String(notes), due_date || null, reminders_enabled ? 1 : 0);

  const invId = info.lastInsertRowid;
  const ins = db.prepare('INSERT INTO invoice_items (invoice_id, name, description, quantity, unit_price, total) VALUES (?,?,?,?,?,?)');
  for (const it of items) {
    ins.run(invId, String(it.name || ''), String(it.description || ''), Number(it.quantity) || 1, Number(it.unit_price) || 0, (Number(it.quantity) || 1) * (Number(it.unit_price) || 0));
  }
  audit(req.business.id, 'create_invoice', req.user.email, 'invoice', invId, number);
  const created = db.prepare('SELECT * FROM invoices WHERE id=?').get(invId);
  res.status(201).json({
    ...created,
    items: db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(invId),
  });
});

router.delete('/:id', (req, res) => {
  const inv = getInvoice(req, req.params.id);
  if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
  db.prepare('DELETE FROM invoices WHERE id=?').run(inv.id);
  audit(req.business.id, 'delete_invoice', req.user.email, 'invoice', inv.id, inv.number);
  res.json({ ok: true });
});

module.exports = router;
