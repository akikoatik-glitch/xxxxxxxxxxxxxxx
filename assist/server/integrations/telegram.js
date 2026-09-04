let fetchFn = globalThis.fetch;
if (!fetchFn) { try { fetchFn = require('node-fetch'); } catch {} }

class TelegramIntegration {
  constructor(config, businessId) {
    this.token = config.token || process.env.TELEGRAM_BOT_TOKEN;
    this.businessId = businessId;
  }

  get connected() { return Boolean(this.token); }

  async sendMessage(chatId, text) {
    if (!this.connected) return null;
    const res = await fetchFn(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
    return res.json();
  }

  async sendDocument(chatId, filePath, filename) {
    if (!this.connected) return null;
    const FormData = require('form-data');
    const fs = require('fs');
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('document', fs.createReadStream(filePath), { filename });
    const res = await fetchFn(`https://api.telegram.org/bot${this.token}/sendDocument`, {
      method: 'POST',
      body: form,
    });
    return res.json();
  }

  parseWebhook(body) {
    const msg = body.message || body.edited_message;
    if (!msg) return null;
    return {
      platformConvId: String(msg.chat.id),
      text: msg.text || '',
      customerName: [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || 'Telegram User',
      customerPlatformId: String(msg.from?.id),
      platformMsgId: String(msg.message_id),
    };
  }
}

function getTelegramIntegration(businessId) {
  const { db } = require('../db');
  const row = db.prepare('SELECT config FROM platforms WHERE business_id = ? AND type = ?').get(businessId, 'telegram');
  return new TelegramIntegration(row ? JSON.parse(row.config) : {}, businessId);
}

module.exports = { TelegramIntegration, getTelegramIntegration };
