const { db, notify } = require('../db');
const { processMessage } = require('../ai/engine');
const { generateOrderPDF } = require('./pdf');

function getOrCreateConversation(businessId, platform, platformConvId, customerName, customerPlatformId) {
  let customer = db.prepare(
    'SELECT * FROM customers WHERE business_id = ? AND platform = ? AND platform_id = ?'
  ).get(businessId, platform, customerPlatformId || platformConvId);

  if (!customer) {
    const result = db.prepare(
      'INSERT INTO customers (business_id, name, platform, platform_id) VALUES (?, ?, ?, ?)'
    ).run(businessId, customerName || 'Client', platform, customerPlatformId || platformConvId);
    customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
    notify(businessId, 'new_customer', 'Nouveau client', `${customer.name} via ${platform}`, { customerId: customer.id });
  } else if (customerName && customer.name !== customerName) {
    db.prepare('UPDATE customers SET name = ? WHERE id = ?').run(customerName, customer.id);
  }

  let conv = db.prepare(
    'SELECT * FROM conversations WHERE business_id = ? AND platform = ? AND platform_conv_id = ?'
  ).get(businessId, platform, platformConvId || '');

  if (!conv) {
    const result = db.prepare(
      `INSERT INTO conversations (business_id, customer_id, platform, platform_conv_id, status, ai_enabled, ai_mode)
       VALUES (?, ?, ?, ?, 'active', 1, 1)`
    ).run(businessId, customer.id, platform, platformConvId || '');
    conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(result.lastInsertRowid);
  } else {
    db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(conv.id);
  }

  if (!conv.customer_id && customer.id) {
    db.prepare('UPDATE conversations SET customer_id = ? WHERE id = ?').run(customer.id, conv.id);
  }

  return { conv, customer };
}

async function handleIncomingMessage(businessId, platform, platformConvId, text, customerName, customerPlatformId) {
  const { conv, customer } = getOrCreateConversation(businessId, platform, platformConvId, customerName, customerPlatformId);

  db.prepare(
    'INSERT INTO messages (conversation_id, sender, body) VALUES (?, ?, ?)'
  ).run(conv.id, 'customer', text);

  db.prepare(
    `UPDATE platforms SET message_count = message_count + 1, last_sync_at = CURRENT_TIMESTAMP WHERE business_id = ? AND type = ?`
  ).run(businessId, platform);

  const result = await processMessage(conv.id, text);

  if (result.reply) {
    db.prepare('INSERT INTO messages (conversation_id, sender, body) VALUES (?, ?, ?)')
      .run(conv.id, 'ai', result.reply);

    if (result.action === 'order_confirmed' && result.orderId) {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.orderId);
      const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
      if (order && biz) {
        try {
          const { pdfPath, filename } = await generateOrderPDF(order, biz);
          db.prepare('UPDATE orders SET pdf_path = ? WHERE id = ?').run(`pdfs/${filename}`, result.orderId);
          notify(businessId, 'order_confirmed', 'Commande confirmée', `${result.orderNumber} — ${customer.name}`, { orderId: result.orderId });
        } catch (e) {
          console.error('[pdf]', e.message);
        }
      }
    }

    if (result.action === 'escalate') {
      notify(businessId, 'escalation', 'Transfert à un humain', `${customer.name} via ${platform} — ${text}`, { conversationId: conv.id });
    }
  }

  return {
    conversationId: conv.id,
    reply: result.reply,
    action: result.action,
    aiMode: conv.ai_mode,
  };
}

module.exports = { handleIncomingMessage, getOrCreateConversation };
