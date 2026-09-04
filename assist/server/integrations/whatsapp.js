const { db } = require('../db');

let fetchFn = globalThis.fetch;
if (!fetchFn) { try { fetchFn = require('node-fetch'); } catch {} }

class WhatsAppIntegration {
  constructor(config, businessId) {
    this.token = config.token || process.env.WHATSAPP_TOKEN;
    this.phoneId = config.phoneId || process.env.WHATSAPP_PHONE_ID;
    this.verifyToken = config.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN;
    this.businessId = businessId;
  }

  get connected() { return Boolean(this.token && this.phoneId); }

  async sendMessage(to, text) {
    if (!this.connected) return null;
    const res = await fetchFn(
      `https://graph.facebook.com/v19.0/${this.phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        }),
      }
    );
    return res.json();
  }

  async sendDocument(to, filePath, filename) {
    if (!this.connected) return null;
    const uploadRes = await fetchFn(
      `https://graph.facebook.com/v19.0/${this.phoneId}/media`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
        body: (() => {
          const FormData = require('form-data');
          const form = new FormData();
          form.append('file', require('fs').createReadStream(filePath));
          form.append('messaging_product', 'whatsapp');
          form.append('type', 'application/pdf');
          return form;
        })(),
      }
    );
    const uploadData = await uploadRes.json();
    if (!uploadData.id) return null;
    const res = await fetchFn(
      `https://graph.facebook.com/v19.0/${this.phoneId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'document',
          document: { id: uploadData.id, filename },
        }),
      }
    );
    return res.json();
  }

  verifyWebhook(mode, token, challenge) {
    if (mode === 'subscribe' && token === this.verifyToken) return challenge;
    return null;
  }
}

function getWhatsAppIntegration(businessId) {
  const row = db.prepare('SELECT config FROM platforms WHERE business_id = ? AND type = ?').get(businessId, 'whatsapp');
  return new WhatsAppIntegration(row ? JSON.parse(row.config) : {}, businessId);
}

module.exports = { WhatsAppIntegration, getWhatsAppIntegration };
