// Orchestrates incoming customer messages -> AI -> message persistence -> async reply.
const { db, audit } = require('../db');
const ai = require('../ai/engine');
const jobs = require('./jobs');
const wa = require('./whatsapp');

// Register WhatsApp send jobs.
jobs.register('whatsapp_text', async ({ businessId, to, text }) => {
  await wa.sendText(businessId, to, text);
});

// Find-or-create a customer by phone within a business.
function findOrCreateCustomer(businessId, { phone, name }) {
  let cust = phone ? db.prepare('SELECT * FROM customers WHERE business_id=? AND phone=?').get(businessId, phone) : null;
  if (!cust && name) {
    cust = db.prepare('SELECT * FROM customers WHERE business_id=? AND lower(name)=lower(?)').get(businessId, name);
  }
  if (!cust) {
    const info = db.prepare('INSERT INTO customers (business_id, name, phone) VALUES (?,?,?)')
      .run(businessId, name || 'Client', phone || '');
    cust = db.prepare('SELECT * FROM customers WHERE id=?').get(info.lastInsertRowid);
  }
  return cust;
}

function findConversation(businessId, customerId) {
  return db.prepare(
    'SELECT * FROM conversations WHERE business_id=? AND customer_id=? ORDER BY id DESC LIMIT 1'
  ).get(businessId, customerId);
}

function ensureConversation(businessId, customerId) {
  let conv = findConversation(businessId, customerId);
  if (!conv) {
    const info = db.prepare(
      'INSERT INTO conversations (business_id, customer_id, channel) VALUES (?,?,?)'
    ).run(businessId, customerId, 'whatsapp');
    conv = db.prepare('SELECT * FROM conversations WHERE id=?').get(info.lastInsertRowid);
  }
  return conv;
}

function pushMessage(conversationId, sender, body, payload) {
  const info = db.prepare(
    'INSERT INTO messages (conversation_id, sender, body, payload) VALUES (?,?,?,?)'
  ).run(conversationId, sender, body, payload ? JSON.stringify(payload) : null);
  db.prepare(`UPDATE conversations SET updated_at=datetime('now') WHERE id=?`).run(conversationId);
  return db.prepare('SELECT * FROM messages WHERE id=?').get(info.lastInsertRowid);
}

function history(conversationId) {
  return db.prepare(
    'SELECT * FROM messages WHERE conversation_id=? ORDER BY id ASC'
  ).all(conversationId);
}

// Process an incoming text message from a customer and (if AI is on) reply.
async function processIncoming({ businessId, customerId, text, channel = 'whatsapp' }) {
  const business = db.prepare('SELECT * FROM businesses WHERE id=?').get(businessId);
  if (!business) return { error: 'business not found' };
  const settings = db.prepare(`SELECT * FROM ai_settings WHERE business_id=?`).get(businessId) || {
    enabled: 0, language: 'darija_fr', eskalate_rules: '{}', faqs: '[]',
  };
  let customer = db.prepare('SELECT * FROM customers WHERE id=?').get(customerId);
  if (!customer) {
    customer = findOrCreateCustomer(businessId, { phone: extractPhoneFromText(text), name: null });
  }

  const cacheKey = `custcalc:${customerId}`;
  let conv = findConversation(businessId, customer.id) || ensureConversation(businessId, customer.id);
  if (conv.status === 'closed') {
    db.prepare(`UPDATE conversations SET status='active' WHERE id=?`).run(conv.id);
    conv.status = 'active';
  }

  // 1. Persist the customer message
  pushMessage(conv.id, 'customer', text);

  // If the AI is paused for this conversation or globally disabled, do not reply.
  if (!settings.enabled || !conv.ai_enabled) {
    audit(businessId, 'message', 'system', 'conversation', conv.id, 'AI off — no auto reply');
    return { conv, replied: false, reason: 'ai_off' };
  }

  const hist = history(conv.id);
  const res = ai.handle(business, settings, conv, hist);

  if (res.escalate) {
    // Notify the owner the AI needs help; do not auto-reply (unless we have an
    // off-catalog fallback message that is safe).
    if (typeof res.reply === 'string') {
      const saved = pushMessage(conv.id, 'ai', res.reply, { intent: res.intent });
      queueSend(businessId, conv, customer, res.reply, res);
    }
    notifyOwner(businessId, conv.id, customer, res);
    return { conv, replied: !!res.reply, escalated: true, reason: res.reason, extracted: res.extracted };
  }

  let reply = res.reply;
  if (reply && typeof reply.then === 'function') {
    // LLM async reply
    reply = await Promise.resolve(reply).catch(() => null);
  }
  if (reply === null || reply === undefined) {
    // Last fallback: still respond with a helpful amber message.
    reply = 'نفهمتك، تعطيني المزيد من التفاصيل؟ واش تحب تعرف بالتحديد على خدمة اللي نقدموها، أو محتاج تعمل Devis؟';
  }

  const msgPayload = { intent: res.intent, extracted: res.extracted, qty: res.quantity };
  pushMessage(conv.id, 'ai', reply, msgPayload);
  queueSend(businessId, conv, customer, reply, msgPayload);

  return { conv, replied: true, reply, extracted: res.extracted };
  void cacheKey;
  void res.matchText;
}

function queueSend(businessId, conv, customer, text, payload) {
  const business = db.prepare('SELECT * FROM businesses WHERE id=?').get(businessId);
  if (!customer.phone) return;
  const { limits } = require('./pricing');
  const lim = limits(business);
  if (!lim.whatsapp) {
    // Not connected/not allowed — still record the intended send as a notification.
    db.prepare(
      `INSERT INTO notifications (business_id, type, title, body) VALUES (?,?,?,?)`
    ).run(businessId, 'message', 'Réponse IA prête', `Réponse à ${customer.name || customer.phone}`);
    return;
  }
  jobs.addJob('whatsapp_text', { businessId, to: customer.phone, text }, {
    idempotencyKey: `msg:${conv.id}:${payload.intent}:${Date.now()}`,
  });
}

function notifyOwner(businessId, convId, customer, res) {
  const title = 'Besoin de votre intervention';
  const reasonText = {
    unknown_price: 'Demande de prix hors catalogue — l\'IA a besoin de vous.',
    price_request: 'Demande de prix — à valider par le propriétaire.',
    ai_limit: 'Limite de messages IA atteinte.',
  }[res.reason] || 'L\'IA a besoin d\'aide.';
  db.prepare(
    `INSERT INTO notifications (business_id, type, title, body) VALUES (?,?,?,?)`
  ).run(businessId, 'escalation', title, `${reasonText} (client: ${customer.name || customer.phone})`);
  job_notify(businessId, convId, customer, res);
}

function job_notify(businessId, convId, customer, res) {
  void businessId; void convId; void customer; void res;
}

function extractPhoneFromText() {
  return null;
}

module.exports = { processIncoming, findOrCreateCustomer, pushMessage, history, findConversation };
