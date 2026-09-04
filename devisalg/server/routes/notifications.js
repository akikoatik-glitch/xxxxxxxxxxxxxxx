const express = require('express');
const { db } = require('../db');
const { requireUser, loadBusiness } = require('../auth');

const router = express.Router();
router.use(requireUser, loadBusiness);

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM notifications WHERE business_id=? ORDER BY id DESC LIMIT 30').all(req.business.id));
});

router.put('/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET read=1 WHERE id=? AND business_id=?').run(req.params.id, req.business.id);
  res.json({ ok: true });
});

router.put('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET read=1 WHERE business_id=?').run(req.business.id);
  res.json({ ok: true });
});

module.exports = router;
