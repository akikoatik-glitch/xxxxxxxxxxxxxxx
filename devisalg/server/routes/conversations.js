const express = require('express');
const { db, audit } = require('../db');
const { requireUser, loadBusiness } = require('../auth');
const { apiLimiter } = require('../middleware/ratelimit');
const convSvc = require('../services/conversation');
const ai = require('../ai/engine');

const router = express.Router();
router.use(requireUser, loadBusiness);

router.get('/', (req, res) => {
  const rows = db.prepare(
    `SELECT c.*, cust.name AS customer_name, cust.phone AS customer_phone,
       (SELECT body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
       (SELECT sender FROM messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS last_sender
     FROM conversations c LEFT JOIN customers cust ON cust.id=c.customer_id
     WHERE c.business_id=? ORDER BY c.updated_at DESC`
  ).all(req.business.id);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id=? AND business_id=?').get(req.params.id, req.business.id);
  if (!conv) return res.status(404).json({ error: 'Conversation introuvable.' });
  const messages = db.prepare('SELECT * FROM messages WHERE conversation_id=? ORDER BY id ASC').all(conv.id);
  const customer = conv.customer_id ? db.prepare('SELECT * FROM customers WHERE id=?').get(conv.customer_id) : null;
  res.json({ ...conv, messages, customer });
});

// Simulate an incoming customer message in the app (for testing/demo without WhatsApp)
router.post('/simulate', apiLimiter, (req, res) => {
  const { text, customerId, customerName, phone } = req.body || {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'Message requis.' });
  let cust;
  if (customerId) {
    cust = db.prepare('SELECT * FROM customers WHERE id=? AND business_id=?').get(customerId, req.business.id);
  }
  if (!cust) {
    cust = convSvc.findOrCreateCustomer(req.business.id, { phone: phone || '', name: customerName || null });
  }
  convSvc.processIncoming({ businessId: req.business.id, customerId: cust.id, text, channel: 'app' })
    .then((result) => res.json(result))
    .catch((e) => res.status(500).json({ error: e.message }));
});

// Owner sends a manual message to the customer (and via WhatsApp if connected)
router.post('/:id/message', (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id=? AND business_id=?').get(req.params.id, req.business.id);
  if (!conv) return res.status(404).json({ error: 'Conversation introuvable.' });
  const { body } = req.body || {};
  if (!body || !String(body).trim()) return res.status(400).json({ error: 'Message requis.' });
  const msg = convSvc.pushMessage(conv.id, 'owner', String(body).trim());
  audit(req.business.id, 'owner_message', req.user.email, 'conversation', conv.id, String(body).trim().slice(0, 100));
  const customer = conv.customer_id ? db.prepare('SELECT * FROM customers WHERE id=?').get(conv.customer_id) : null;
  if (customer && customer.phone) {
    const wa = require('../services/whatsapp');
    const jobs = require('../services/jobs');
    jobs.addJob('whatsapp_text', { businessId: req.business.id, to: customer.phone, text: String(body).trim() }, {
      idempotencyKey: `ownermsg:${conv.id}:${Date.now()}`,
    });
  }
  res.json(msg);
});

router.put('/:id/ai', (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id=? AND business_id=?').get(req.params.id, req.business.id);
  if (!conv) return res.status(404).json({ error: 'Conversation introuvable.' });
  const enabled = req.body && req.body.enabled !== undefined ? Number(!!req.body.enabled) : conv.ai_enabled;
  db.prepare('UPDATE conversations SET ai_enabled=? WHERE id=?').run(enabled, conv.id);
  audit(req.business.id, enabled ? 'resume_ai' : 'pause_ai', req.user.email, 'conversation', conv.id, '');
  res.json({ ok: true, ai_enabled: enabled });
});

router.put('/:id/status', (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id=? AND business_id=?').get(req.params.id, req.business.id);
  if (!conv) return res.status(404).json({ error: 'Conversation introuvable.' });
  const status = String(req.body.status || 'active');
  db.prepare('UPDATE conversations SET status=? WHERE id=?').run(status, conv.id);
  res.json({ ok: true, status });
});

// Extract proposal data from a conversation's messages (for Create Devis)
router.post('/:id/extract', (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id=? AND business_id=?').get(req.params.id, req.business.id);
  if (!conv) return res.status(404).json({ error: 'Conversation introuvable.' });
  const messages = db.prepare('SELECT * FROM messages WHERE conversation_id=? ORDER BY id ASC').all(conv.id);
  const customer = conv.customer_id ? db.prepare('SELECT * FROM customers WHERE id=?').get(conv.customer_id) : null;
  const allText = messages.map((m) => m.body).join(' ');

  const quantity = ai.extractQuantity(allText);
  const match = ai.findCatalog(req.business.id, allText, { quantity });
  const phone = customer && customer.phone ? customer.phone : ai.extractPhone(allText);

  res.json({
    customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null,
    suggested_items: match.matched ? [{ name: match.matched.name, quantity, unit_price: match.matched.unit_price }] : [],
    all_candidates: match.candidates.map((c) => c.item).slice(0, 8),
    quantity,
    phone,
  });
});

module.exports = router;
