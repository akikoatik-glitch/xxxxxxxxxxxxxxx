const express = require('express');
const { db, audit, nextNumber } = require('../db');
const { requireUser, loadBusiness } = require('../auth');
const { canCreate } = require('../services/pricing');
const pdf = require('../services/pdf');
const path = require('path');
const fs = require('fs');

const router = express.Router();
router.use(requireUser, loadBusiness);

function docRef(kind, number) {
  return `${kind.toLowerCase()}-${number.replace(/[\\/:*?"<>|]/g, '_')}`;
}

function getDevis(req, id) {
  return db.prepare('SELECT * FROM devis WHERE id=? AND business_id=?').get(id, req.business.id);
}

router.get('/', (req, res) => {
  const status = req.query.status;
  const rows = status
    ? db.prepare('SELECT * FROM devis WHERE business_id=? AND status=? ORDER BY id DESC').all(req.business.id, status)
    : db.prepare('SELECT * FROM devis WHERE business_id=? ORDER BY id DESC').all(req.business.id);
  const withItems = rows.map((d) => ({
    ...d,
    items: db.prepare('SELECT * FROM devis_items WHERE devis_id=?').all(d.id),
    customer: d.customer_id ? db.prepare('SELECT id,name,phone FROM customers WHERE id=?').get(d.customer_id) : null,
  }));
  res.json(withItems);
});

router.get('/:id', (req, res) => {
  const d = getDevis(req, req.params.id);
  if (!d) return res.status(404).json({ error: 'Devis introuvable.' });
  res.json({
    ...d,
    items: db.prepare('SELECT * FROM devis_items WHERE devis_id=?').all(d.id),
    customer: d.customer_id ? db.prepare('SELECT * FROM customers WHERE id=?').get(d.customer_id) : null,
  });
});

function recomputeDevis(id) {
  const d = db.prepare('SELECT * FROM devis WHERE id=?').get(id);
  const items = db.prepare('SELECT * FROM devis_items WHERE devis_id=?').all(id);
  const comp = pdf.computation(items, d.discount, d.tax_rate);
  db.prepare('UPDATE devis SET subtotal=?, discount=?, tax=?, total=? WHERE id=?')
    .run(comp.subtotal, comp.discount, comp.tax, comp.total, id);
  return { ...d, items, ...comp };
}

router.post('/', (req, res) => {
  const check = canCreate(req.business.id, 'devis');
  if (!check.ok) return res.status(403).json({ error: check.reason, limit: check.limit });
  const {
    customer_id, conversation_id, customer_name = '', customer_phone = '',
    items = [], discount = 0, tax_rate = 0, notes = '', validity_days = 14,
    status = 'draft',
  } = req.body || {};

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Ajoutez au moins un produit/service.' });
  }

  const number = nextNumber('DEV', 'devis', req.business.id);

  // Resolve customer
  let cid = customer_id || null;
  if (!cid && (customer_name || customer_phone)) {
    let cust;
    if (customer_phone) {
      cust = db.prepare('SELECT * FROM customers WHERE business_id=? AND phone=?').get(req.business.id, customer_phone);
    }
    if (!cust && customer_name) {
      cust = db.prepare('SELECT * FROM customers WHERE business_id=? AND lower(name)=lower(?)').get(req.business.id, String(customer_name).trim());
    }
    if (!cust) {
      const info = db.prepare('INSERT INTO customers (business_id, name, phone) VALUES (?,?,?)')
        .run(req.business.id, String(customer_name || 'Client').trim(), String(customer_phone || ''));
      cust = db.prepare('SELECT * FROM customers WHERE id=?').get(info.lastInsertRowid);
    }
    cid = cust.id;
  }

  const info = db.prepare(
    `INSERT INTO devis (business_id, customer_id, conversation_id, number, status, customer_name, customer_phone, discount, tax_rate, notes, validity_days)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(req.business.id, cid, conversation_id || null, number, status, String(customer_name), String(customer_phone), Number(discount) || 0, Number(tax_rate) || 0, String(notes), Number(validity_days) || 14);

  const devisId = info.lastInsertRowid;
  const ins = db.prepare('INSERT INTO devis_items (devis_id, name, description, quantity, unit_price, total) VALUES (?,?,?,?,?,?)');
  for (const it of items) {
    const qty = Number(it.quantity) || 1;
    const unit = Number(it.unit_price) || 0;
    ins.run(devisId, String(it.name || ''), String(it.description || ''), qty, unit, qty * unit);
  }

  recomputeDevis(devisId);
  audit(req.business.id, 'create_devis', req.user.email, 'devis', devisId, number);
  const created = db.prepare('SELECT * FROM devis WHERE id=?').get(devisId);
  res.status(201).json({
    ...created,
    items: db.prepare('SELECT * FROM devis_items WHERE devis_id=?').all(devisId),
  });
});

router.put('/:id', (req, res) => {
  const d = getDevis(req, req.params.id);
  if (!d) return res.status(404).json({ error: 'Devis introuvable.' });
  const allowed = ['status', 'customer_name', 'customer_phone', 'discount', 'tax_rate', 'notes', 'validity_days'];
  const sets = [];
  const vals = [];
  for (const k of allowed) {
    if (req.body[k] !== undefined) {
      sets.push(`${k}=?`);
      vals.push(req.body[k]);
    }
  }
  // Replace items if provided
  if (Array.isArray(req.body.items)) {
    db.prepare('DELETE FROM devis_items WHERE devis_id=?').run(d.id);
    const ins = db.prepare('INSERT INTO devis_items (devis_id, name, description, quantity, unit_price, total) VALUES (?,?,?,?,?,?)');
    for (const it of req.body.items) {
      const qty = Number(it.quantity) || 1;
      const unit = Number(it.unit_price) || 0;
      ins.run(d.id, String(it.name || ''), String(it.description || ''), qty, unit, qty * unit);
    }
  }
  if (sets.length) {
    vals.push(d.id);
    db.prepare(`UPDATE devis SET ${sets.join(', ')} WHERE id=?`).run(...vals);
  }
  recomputeDevis(d.id);
  audit(req.business.id, 'update_devis', req.user.email, 'devis', d.id, '');
  res.json(db.prepare('SELECT * FROM devis WHERE id=?').get(d.id));
});

router.post('/:id/pdf', async (req, res) => {
  const d = getDevis(req, req.params.id);
  if (!d) return res.status(404).json({ error: 'Devis introuvable.' });
  const items = db.prepare('SELECT * FROM devis_items WHERE devis_id=?').all(d.id);
  const business = req.business;
  const customer = d.customer_id ? db.prepare('SELECT * FROM customers WHERE id=?').get(d.customer_id) : null;
  const ref = docRef('devis', d.number);
  try {
    const file = await pdf.build({
      business,
      customer: customer || { customer_name: d.customer_name, customer_phone: d.customer_phone },
      docRef: ref,
      items,
      discount: d.discount,
      taxRate: d.tax_rate,
      notes: d.notes,
      validity: d.validity_days,
      kind: 'devis',
      number: d.number,
      date: d.created_at.slice(0, 10),
      status: d.status,
    });
    db.prepare('UPDATE devis SET pdf_path=? WHERE id=?').run(file, d.id);
    res.json({ ok: true, path: file, url: `/api/devis/${d.id}/pdf/download` });
  } catch (e) {
    res.status(500).json({ error: 'Erreur génération PDF: ' + e.message });
  }
});

router.get('/:id/pdf/download', (req, res) => {
  const d = getDevis(req, req.params.id);
  if (!d || !d.pdf_path) return res.status(404).json({ error: 'PDF non généré.' });
  if (!fs.existsSync(d.pdf_path)) return res.status(404).json({ error: 'Fichier introuvable.' });
  res.download(d.pdf_path, `${d.number}.pdf`);
});

// Mark as accepted/declined/sent
router.post('/:id/status', (req, res) => {
  const d = getDevis(req, req.params.id);
  if (!d) return res.status(404).json({ error: 'Devis introuvable.' });
  const status = String(req.body.status || '');
  if (!['draft', 'sent', 'accepted', 'declined', 'converted'].includes(status)) {
    return res.status(400).json({ error: 'Statut invalide.' });
  }
  db.prepare('UPDATE devis SET status=? WHERE id=?').run(status, d.id);
  audit(req.business.id, `devis_${status}`, req.user.email, 'devis', d.id, d.number);
  res.json(db.prepare('SELECT * FROM devis WHERE id=?').get(d.id));
});

// Convert Devis -> Facture
router.post('/:id/convert', (req, res) => {
  const d = getDevis(req, req.params.id);
  if (!d) return res.status(404).json({ error: 'Devis introuvable.' });
  const check = canCreate(req.business.id, 'invoices');
  if (!check.ok) return res.status(403).json({ error: check.reason, limit: check.limit });

  const items = db.prepare('SELECT * FROM devis_items WHERE devis_id=?').all(d.id);
  if (!items.length) return res.status(400).json({ error: 'Devis sans articles.' });

  const number = nextNumber('FAC', 'invoices', req.business.id);
  const invInfo = db.prepare(
    `INSERT INTO invoices (business_id, devis_id, customer_id, number, customer_name, customer_phone,
       status, subtotal, discount, tax, tax_rate, total, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    req.business.id, d.id, d.customer_id, number, d.customer_name, d.customer_phone,
    'draft', d.subtotal, d.discount, d.tax, d.tax_rate, d.total, d.notes
  );
  const invId = invInfo.lastInsertRowid;
  const ins = db.prepare('INSERT INTO invoice_items (invoice_id, name, description, quantity, unit_price, total) VALUES (?,?,?,?,?,?)');
  for (const it of items) {
    ins.run(invId, it.name, it.description, it.quantity, it.unit_price, it.total);
  }
  // Generate PDF asynchronously in background
  const jobs = require('../services/jobs');
  jobs.addJob('invoice_pdf', {
    businessId: req.business.id,
    invoiceId: invId,
    number,
  }, { idempotencyKey: `invoicepdf:${invId}` });

  db.prepare("UPDATE devis SET status='converted' WHERE id=?").run(d.id);
  audit(req.business.id, 'convert_devis_to_facture', req.user.email, 'invoice', invId, `${d.number} -> ${number}`);

  const created = db.prepare('SELECT * FROM invoices WHERE id=?').get(invId);
  res.status(201).json({ ...created, items: db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(invId) });
});

router.delete('/:id', (req, res) => {
  const d = getDevis(req, req.params.id);
  if (!d) return res.status(404).json({ error: 'Devis introuvable.' });
  db.prepare('DELETE FROM devis WHERE id=?').run(d.id);
  audit(req.business.id, 'delete_devis', req.user.email, 'devis', d.id, d.number);
  res.json({ ok: true });
});

module.exports = router;
