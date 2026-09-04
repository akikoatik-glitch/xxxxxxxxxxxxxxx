const express = require('express');
const { db } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { platform, status, search } = req.query;
  let sql = `SELECT c.*, cu.name AS customer_name, cu.phone AS customer_phone
             FROM conversations c LEFT JOIN customers cu ON c.customer_id = cu.id
             WHERE c.business_id = ?`;
  const params = [req.user.businessId];
  if (platform) { sql += ' AND c.platform = ?'; params.push(platform); }
  if (status) { sql += ' AND c.status = ?'; params.push(status); }
  if (search) { sql += " AND (cu.name LIKE ? OR cu.phone LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY c.updated_at DESC LIMIT 100';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const conv = db.prepare(
    `SELECT c.*, cu.name AS customer_name, cu.phone AS customer_phone, cu.email AS customer_email, cu.address AS customer_address, cu.wilaya AS customer_wilaya
     FROM conversations c LEFT JOIN customers cu ON c.customer_id = cu.id
     WHERE c.id = ? AND c.business_id = ?`
  ).get(req.params.id, req.user.businessId);
  if (!conv) return res.status(404).json({ error: 'Conversation non trouvée.' });
  const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(conv.id);
  res.json({ ...conv, messages });
});

router.get('/:id/messages', (req, res) => {
  const messages = db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? AND conversation_id IN (SELECT id FROM conversations WHERE business_id = ?) ORDER BY created_at ASC'
  ).all(req.params.id, req.user.businessId);
  res.json(messages);
});

router.post('/:id/send', (req, res) => {
  const { body: text } = req.body;
  if (!text) return res.status(400).json({ error: 'Message requis.' });
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ? AND business_id = ?').get(req.params.id, req.user.businessId);
  if (!conv) return res.status(404).json({ error: 'Conversation non trouvée.' });

  db.prepare('INSERT INTO messages (conversation_id, sender, body) VALUES (?, ?, ?)').run(conv.id, 'owner', text);
  db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(conv.id);

  const { getPlatform } = require('../integrations/platforms');
  const platform = getPlatform(conv.platform, conv.business_id);
  if (platform && platform.connected) {
    const customer = db.prepare('SELECT platform_id FROM customers WHERE id = ?').get(conv.customer_id);
    if (customer?.platform_id) {
      platform.sendMessage(customer.platform_id, text).catch(e => console.error('[send]', e.message));
    }
  }

  res.json({ ok: true });
});

router.patch('/:id/ai-mode', (req, res) => {
  const { enabled } = req.body;
  db.prepare('UPDATE conversations SET ai_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?')
    .run(enabled ? 1 : 0, req.params.id, req.user.businessId);
  res.json({ ok: true, ai_mode: enabled ? 1 : 0 });
});

router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  const allowed = ['active', 'paused', 'closed'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Statut invalide.' });
  db.prepare('UPDATE conversations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?')
    .run(status, req.params.id, req.user.businessId);
  res.json({ ok: true, status });
});

module.exports = router;
