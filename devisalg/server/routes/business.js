const express = require('express');
const { db, audit } = require('../db');
const { requireUser, loadBusiness } = require('../auth');
const { canCreate } = require('../services/pricing');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
router.use(requireUser, loadBusiness);

// ---- Business profile & settings ----
router.get('/profile', (req, res) => {
  const b = db.prepare('SELECT * FROM businesses WHERE id=?').get(req.business.id);
  res.json(b);
});

router.put('/profile', (req, res) => {
  const allowed = ['name', 'description', 'address', 'phone', 'email', 'opening_hours', 'delivery_info', 'payment_methods', 'currency'];
  const sets = [];
  const vals = [];
  for (const k of allowed) {
    if (req.body[k] !== undefined) {
      sets.push(`${k} = ?`);
      vals.push(String(req.body[k]).slice(0, 500));
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'Rien à mettre à jour.' });
  vals.push(req.business.id);
  db.prepare(`UPDATE businesses SET ${sets.join(', ')} WHERE id=?`).run(...vals);
  audit(req.business.id, 'update_profile', req.user.email, 'business', req.business.id, '');
  const b = db.prepare('SELECT * FROM businesses WHERE id=?').get(req.business.id);
  res.json(b);
});

// Logo upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.resolve(__dirname, '..', '..', 'data', 'logos');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `biz-${req.business.id}-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(png|jpe?g|webp|gif)/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Image uniquement (png/jpg/webp/gif).'));
  },
});

router.post('/logo', upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier.' });
  db.prepare('UPDATE businesses SET logo_path=? WHERE id=?').run(req.file.path, req.business.id);
  audit(req.business.id, 'upload_logo', req.user.email, 'business', req.business.id, '');
  res.json({ ok: true, path: req.file.path });
});

// ---- Products ----
router.get('/products', (req, res) => {
  res.json(db.prepare('SELECT * FROM products WHERE business_id=? ORDER BY id DESC').all(req.business.id));
});

router.post('/products', (req, res) => {
  const check = canCreate(req.business.id, 'products');
  if (!check.ok) return res.status(403).json({ error: check.reason });
  const { name, description = '', unit_price = 0, category = 'product' } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nom du produit requis.' });
  const info = db.prepare(
    'INSERT INTO products (business_id, name, description, unit_price, category) VALUES (?,?,?,?,?)'
  ).run(req.business.id, String(name).trim(), String(description), Number(unit_price) || 0, String(category));
  audit(req.business.id, 'add_product', req.user.email, 'product', info.lastInsertRowid, name);
  res.status(201).json(db.prepare('SELECT * FROM products WHERE id=?').get(info.lastInsertRowid));
});

router.put('/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id=? AND business_id=?').get(req.params.id, req.business.id);
  if (!p) return res.status(404).json({ error: 'Produit introuvable.' });
  const { name, description, unit_price, category, active } = req.body || {};
  db.prepare('UPDATE products SET name=?, description=?, unit_price=?, category=?, active=? WHERE id=?')
    .run(
      name !== undefined ? String(name) : p.name,
      description !== undefined ? String(description) : p.description,
      unit_price !== undefined ? Number(unit_price) : p.unit_price,
      category !== undefined ? String(category) : p.category,
      active !== undefined ? Number(!!active) : p.active,
      p.id
    );
  res.json(db.prepare('SELECT * FROM products WHERE id=?').get(p.id));
});

router.delete('/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id=? AND business_id=?').get(req.params.id, req.business.id);
  if (!p) return res.status(404).json({ error: 'Produit introuvable.' });
  db.prepare('DELETE FROM products WHERE id=?').run(p.id);
  audit(req.business.id, 'delete_product', req.user.email, 'product', p.id, p.name);
  res.json({ ok: true });
});

// ---- Services ----
router.get('/services', (req, res) => {
  res.json(db.prepare('SELECT * FROM services WHERE business_id=? ORDER BY id DESC').all(req.business.id));
});

router.post('/services', (req, res) => {
  const { name, description = '', unit_price = 0, active = 1 } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nom du service requis.' });
  const info = db.prepare(
    'INSERT INTO services (business_id, name, description, unit_price, active) VALUES (?,?,?,?,?)'
  ).run(req.business.id, String(name).trim(), String(description), Number(unit_price) || 0, active);
  audit(req.business.id, 'add_service', req.user.email, 'service', info.lastInsertRowid, name);
  res.status(201).json(db.prepare('SELECT * FROM services WHERE id=?').get(info.lastInsertRowid));
});

router.put('/services/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM services WHERE id=? AND business_id=?').get(req.params.id, req.business.id);
  if (!s) return res.status(404).json({ error: 'Service introuvable.' });
  const { name, description, unit_price, active } = req.body || {};
  db.prepare('UPDATE services SET name=?, description=?, unit_price=?, active=? WHERE id=?')
    .run(
      name !== undefined ? String(name) : s.name,
      description !== undefined ? String(description) : s.description,
      unit_price !== undefined ? Number(unit_price) : s.unit_price,
      active !== undefined ? Number(!!active) : s.active,
      s.id
    );
  res.json(db.prepare('SELECT * FROM services WHERE id=?').get(s.id));
});

router.delete('/services/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM services WHERE id=? AND business_id=?').get(req.params.id, req.business.id);
  if (!s) return res.status(404).json({ error: 'Service introuvable.' });
  db.prepare('DELETE FROM services WHERE id=?').run(s.id);
  audit(req.business.id, 'delete_service', req.user.email, 'service', s.id, s.name);
  res.json({ ok: true });
});

module.exports = router;
