let fetchFn = globalThis.fetch;
if (!fetchFn) { try { fetchFn = require('node-fetch'); } catch {} }

class FacebookIntegration {
  constructor(config, businessId) {
    this.pageToken = config.pageToken || process.env.FB_PAGE_TOKEN;
    this.verifyToken = config.verifyToken || process.env.FB_VERIFY_TOKEN;
    this.businessId = businessId;
  }

  get connected() { return Boolean(this.pageToken); }

  async sendMessage(recipientId, text) {
    if (!this.connected) return null;
    const res = await fetchFn('https://graph.facebook.com/v19.0/me/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.pageToken}` },
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
          customerName: 'Facebook User',
          customerPlatformId: event.sender?.id || '',
          platformMsgId: event.message.mid,
        });
      }
    }
    return results;
  }
}

function getFacebookIntegration(businessId) {
  const { db } = require('../db');
  const row = db.prepare('SELECT config FROM platforms WHERE business_id = ? AND type = ?').get(businessId, 'facebook');
  return new FacebookIntegration(row ? JSON.parse(row.config) : {}, businessId);
}

module.exports = { FacebookIntegration, getFacebookIntegration };
