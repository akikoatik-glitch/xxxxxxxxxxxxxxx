const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, audit, DATA_DIR } = require('../db');

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(DATA_DIR, 'logos'),
    filename: (_req, file, cb) => cb(null, `logo-${Date.now()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.get('/', (req, res) => {
  const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.user.businessId);
  if (!biz) return res.status(404).json({ error: 'Business non trouvé.' });
  res.json(biz);
});

router.put('/', (req, res) => {
  const fields = ['name', 'description', 'address', 'phone', 'email', 'opening_hours', 'delivery_info', 'payment_methods', 'currency', 'delivery_wilayas'];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'Aucun champ à modifier.' });
  params.push(req.user.businessId);
  db.prepare(`UPDATE businesses SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  audit(req.user.businessId, 'update_business', req.user.email, 'business', req.user.businessId);
  const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.user.businessId);
  res.json(biz);
});

router.post('/logo', upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier.' });
  const logoPath = `logos/${req.file.filename}`;
  db.prepare('UPDATE businesses SET logo_path = ? WHERE id = ?').run(logoPath, req.user.businessId);
  res.json({ logo_path: logoPath });
});

module.exports = router;
