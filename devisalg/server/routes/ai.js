const express = require('express');
const { db, audit } = require('../db');
const { requireUser, loadBusiness } = require('../auth');

const router = express.Router();
router.use(requireUser, loadBusiness);

router.get('/', (req, res) => {
  let row = db.prepare('SELECT * FROM ai_settings WHERE business_id=?').get(req.business.id);
  if (!row) {
    db.prepare('INSERT OR IGNORE INTO ai_settings (business_id) VALUES (?)').run(req.business.id);
    row = db.prepare('SELECT * FROM ai_settings WHERE business_id=?').get(req.business.id);
  }
  const catalog = {
    products: db.prepare('SELECT id,name,unit_price FROM products WHERE business_id=? AND active=1').all(req.business.id),
    services: db.prepare('SELECT id,name,unit_price FROM services WHERE business_id=? AND active=1').all(req.business.id),
  };
  res.json({ ...row, catalog });
});

router.put('/', (req, res) => {
  const existing = db.prepare('SELECT * FROM ai_settings WHERE business_id=?').get(req.business.id) || {};
  const fields = ['enabled', 'personality', 'language', 'eskalate_rules', 'faqs', 'greeting'];
  const vals = [];
  const sets = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      sets.push(`${f}=?`);
      let v = req.body[f];
      if (f === 'faqs' || f === 'eskalate_rules') v = typeof v === 'string' ? v : JSON.stringify(v || (f === 'faqs' ? [] : {}));
      vals.push(v);
    }
  }
  if (!existing.id) {
    db.prepare('INSERT OR IGNORE INTO ai_settings (business_id) VALUES (?)').run(req.business.id);
  }
  if (sets.length) {
    vals.push(req.business.id);
    db.prepare(`UPDATE ai_settings SET ${sets.join(', ')}, updated_at=datetime('now') WHERE business_id=?`).run(...vals);
  }
  audit(req.business.id, 'update_ai', req.user.email, 'ai_settings', req.business.id, '');
  res.json(db.prepare('SELECT * FROM ai_settings WHERE business_id=?').get(req.business.id));
});

// Test the engine locally (no external call)
router.post('/test', (req, res) => {
  const { text } = req.body || {};
  const settings = db.prepare('SELECT * FROM ai_settings WHERE business_id=?').get(req.business.id) || {
    enabled: 0, language: 'darija_fr', eskalate_rules: '{}', faqs: '[]',
  };
  const ai = require('../ai/engine');
  const conv = { id: 0, status: 'active', ai_enabled: 1 };
  const res2 = ai.handle(req.business, settings, conv, [{ sender: 'customer', body: String(text || '') }]);
  res.json({
    intent: res2.intent,
    reply: typeof res2.reply === 'string' ? res2.reply : null,
    escalate: res2.escalate,
    reason: res2.reason,
    extracted: res2.extracted,
    catalog: ai.findCatalog(req.business.id, String(text || '')),
  });
});

module.exports = router;
