let fetchFn = globalThis.fetch;
if (!fetchFn) { try { fetchFn = require('node-fetch'); } catch {} }

class InstagramIntegration {
  constructor(config, businessId) {
    this.token = config.token || process.env.IG_TOKEN;
    this.verifyToken = config.verifyToken || process.env.IG_VERIFY_TOKEN;
    this.businessId = businessId;
  }

  get connected() { return Boolean(this.token); }

  async sendMessage(recipientId, text) {
    if (!this.connected) return null;
    const res = await fetchFn('https://graph.facebook.com/v19.0/me/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
      body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
    });
    return res.json();
  }

  verifyWebhook(mode, token, challenge) {
    if (mode === 'subscribe' && token === this.verifyToken) return challenge;
    return null;
  }

  parseWebhook(body) {
    const entries = body.entry || [];
    const results = [];
    for (const entry of entries) {
      for (const event of (entry.messaging || [])) {
        if (!event.message?.text) continue;
        results.push({
          platformConvId: event.sender?.id || '',
          text: event.message.text,
          customerName: 'Instagram User',
          customerPlatformId: event.sender?.id || '',
          platformMsgId: event.message.mid,
        });
      }
    }
    return results;
  }
}

function getInstagramIntegration(businessId) {
  const { db } = require('../db');
  const row = db.prepare('SELECT config FROM platforms WHERE business_id = ? AND type = ?').get(businessId, 'instagram');
  return new InstagramIntegration(row ? JSON.parse(row.config) : {}, businessId);
}

module.exports = { InstagramIntegration, getInstagramIntegration };
