const express = require('express');
const { db, audit } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  let settings = db.prepare('SELECT * FROM ai_settings WHERE business_id = ?').get(req.user.businessId);
  if (!settings) {
    db.prepare('INSERT INTO ai_settings (business_id) VALUES (?)').run(req.user.businessId);
    settings = db.prepare('SELECT * FROM ai_settings WHERE business_id = ?').get(req.user.businessId);
  }
  res.json(settings);
});

router.put('/', (req, res) => {
  const { enabled, personality, greeting, language, escalation_keywords, custom_instructions, faqs } = req.body;
  let settings = db.prepare('SELECT * FROM ai_settings WHERE business_id = ?').get(req.user.businessId);
  if (!settings) {
    db.prepare('INSERT INTO ai_settings (business_id) VALUES (?)').run(req.user.businessId);
    settings = db.prepare('SELECT * FROM ai_settings WHERE business_id = ?').get(req.user.businessId);
  }
  db.prepare(
    `UPDATE ai_settings SET enabled = ?, personality = ?, greeting = ?, language = ?, escalation_keywords = ?, custom_instructions = ?, faqs = ?, updated_at = CURRENT_TIMESTAMP WHERE business_id = ?`
  ).run(
    enabled === undefined ? settings.enabled : (enabled ? 1 : 0),
    personality ?? settings.personality,
    greeting ?? settings.greeting,
    language ?? settings.language,
    escalation_keywords ? JSON.stringify(escalation_keywords) : settings.escalation_keywords,
    custom_instructions ?? settings.custom_instructions,
    faqs ? JSON.stringify(faqs) : settings.faqs,
    req.user.businessId
  );
  audit(req.user.businessId, 'update_ai_settings', req.user.email, 'ai_settings', req.user.businessId);
  const updated = db.prepare('SELECT * FROM ai_settings WHERE business_id = ?').get(req.user.businessId);
  res.json(updated);
});

router.post('/test', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message requis.' });
  const { processMessage } = require('../ai/engine');
  const { getOrCreateConversation } = require('../services/conversation');

  const testCache = db.prepare(
    "SELECT id FROM conversations WHERE business_id = ? AND platform = 'test' AND platform_conv_id = 'ai-test'"
  ).get(req.user.businessId);
  let convId = testCache ? testCache.id : null;
  if (!convId) {
    const created = getOrCreateConversation(req.user.businessId, 'test', 'ai-test', 'Test', 'ai-test');
    convId = created.conv.id;
  }

  let result;
  try {
    result = await processMessage(convId, message);
  } catch (e) {
    console.error('[ai-test]', e);
    return res.status(500).json({ error: 'Erreur.', result: null });
  }
  res.json({ result: result.reply || '', action: result.action });
});

module.exports = router;
