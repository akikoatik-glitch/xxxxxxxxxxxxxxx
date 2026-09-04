// WhatsApp Cloud API webhook.
// GET  -> webhook verification (hub.challenge)
// POST -> incoming messages. Deduplicated and processed in background.
const express = require('express');
const { db, audit } = require('../db');
const wa = require('../services/whatsapp');
const convSvc = require('../services/conversation');
const jobs = require('../services/jobs');

const router = express.Router();

// Registry mapping verifyToken -> businessId, populated from the integrations route.
let REGISTRY = {};
function setRegistry(r) { REGISTRY = r; }
router.setRegistry = setRegistry;

// Also allow env-based secret for webhook race.
function resolveBusinessByToken(token) {
  if (REGISTRY[token]) return Number(REGISTRY[token]);
  // fallback: global verify token from env (single-tenant dev mode)
  if (process.env.WHATSAPP_VERIFY_TOKEN && process.env.WHATSAPP_VERIFY_TOKEN === token) {
    const row = db.prepare(`SELECT business_id FROM integrations WHERE type='whatsapp' AND connected=1 LIMIT 1`).get();
    return row ? row.business_id : null;
  }
  return null;
}

// Idempotency / dedup for webhook deliveries
const seen = new Set();
const DEDUP_WINDOW = 5 * 60 * 1000; // 5 min

// Register a background job to process an incoming WhatsApp message.
jobs.register('whatsapp_incoming', async ({ businessId, customerId, text, messageId }) => {
  await convSvc.processIncoming({ businessId, customerId, text, channel: 'whatsapp' });
  audit(businessId, 'whatsapp_incoming', 'customer', 'message', customerId, text.slice(0, 80));
});

router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token && resolveBusinessByToken(token)) {
    return res.type('text/plain').send(challenge);
  }
  res.sendStatus(403);
});

router.post('/webhook', express.json({ limit: '2mb' }), (req, res) => {
  // Acknowledge quickly (Meta expects 200 fast)
  res.sendStatus(200);

  const body = req.body || {};
  const entries = body.entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      const value = change.value || {};
      const messages = value.messages || [];
      const contacts = value.contacts || [];
      for (const recv of messages) {
        const id = recv.id;
        if (!id) continue;
        const dedupKey = `${entry.id}:${id}`;
        // Deduplicate webhook deliveries
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);
        setTimeout(() => seen.delete(dedupKey), DEDUP_WINDOW);

        if (recv.type !== 'text') continue; // handle only text in this version
        const text = recv.text && recv.text.body ? recv.text.body : '';
        if (!text) continue;

        const from = recv.from; // sender's whatsapp number
        const contact = (contacts || []).find((c) => c.wa_id === from);
        const contactName = contact && contact.profile ? contact.profile.name : from;

        // Find the business to route to.
        // The webhook must route to the right business. Since the Cloud API
        // endpoint is shared, we identify the business by phone_number_id:
        const pnid = value.metadata && value.metadata.phone_number_id;
        const bizRow = findBusinessByPhoneNumberId(pnid);

        if (!bizRow) {
          console.warn('Webhook: no business found for phone_number_id', pnid);
          continue;
        }
        const bid = bizRow.business_id;

        let customer = db.prepare('SELECT * FROM customers WHERE business_id=? AND phone=?').get(bid, from);
        if (!customer) {
          const info = db.prepare('INSERT INTO customers (business_id, name, phone) VALUES (?,?,?)')
            .run(bid, contactName || 'Client WhatsApp', from);
          customer = db.prepare('SELECT * FROM customers WHERE id=?').get(info.lastInsertRowid);
        }

        // Enqueue processing in the background
        jobs.addJob('whatsapp_incoming', { businessId: bid, customerId: customer.id, text, messageId: id }, {
          idempotencyKey: `wa:${dedupKey}`,
        });
      }
    }
  }
});

function findBusinessByPhoneNumberId(pnid) {
  if (!pnid) return null;
  const rows = db.prepare(`SELECT business_id, config FROM integrations WHERE type='whatsapp' AND connected=1`).all();
  for (const r of rows) {
    try {
      const c = JSON.parse(r.config || '{}');
      if (c.phoneNumberId === String(pnid)) return r;
    } catch {}
  }
  return null;
}

module.exports = router;
