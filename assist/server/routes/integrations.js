const express = require('express');
const { db, audit } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const platforms = db.prepare('SELECT * FROM platforms WHERE business_id = ?').all(req.user.businessId);
  res.json(platforms);
});

router.put('/:type', (req, res) => {
  const { type } = req.params;
  const allowed = ['whatsapp', 'instagram', 'facebook', 'telegram'];
  if (!allowed.includes(type)) return res.status(400).json({ error: 'Plateforme invalide.' });

  let platform = db.prepare('SELECT * FROM platforms WHERE business_id = ? AND type = ?').get(req.user.businessId, type);
  if (!platform) {
    db.prepare('INSERT INTO platforms (business_id, type) VALUES (?, ?)').run(req.user.businessId, type);
    platform = db.prepare('SELECT * FROM platforms WHERE business_id = ? AND type = ?').get(req.user.businessId, type);
  }

  const { config, connected, name } = req.body;
  const updates = [];
  const params = [];
  if (config !== undefined) { updates.push('config = ?'); params.push(JSON.stringify(config)); }
  if (connected !== undefined) { updates.push('connected = ?'); params.push(connected ? 1 : 0); }
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  updates.push('updated_at = CURRENT_TIMESTAMP');

  if (updates.length) {
    params.push(platform.id);
    db.prepare(`UPDATE platforms SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  audit(req.user.businessId, 'update_platform', req.user.email, 'platform', platform.id, type);
  const updated = db.prepare('SELECT * FROM platforms WHERE id = ?').get(platform.id);
  res.json(updated);
});

router.post('/test', async (req, res) => {
  const { platform: platformType, message } = req.body;
  if (!platformType || !message) return res.status(400).json({ error: 'Plateforme et message requis.' });
  const { getPlatform } = require('../integrations/platforms');
  const platform = getPlatform(platformType, req.user.businessId);
  if (!platform || !platform.connected) return res.status(400).json({ error: 'Plateforme non connectée.' });
  try {
    const result = await platform.sendMessage(message);
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
