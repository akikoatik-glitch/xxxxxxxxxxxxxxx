const express = require('express');
const { db } = require('../db');
const { handleIncomingMessage } = require('../services/conversation');
const { getPlatform } = require('../integrations/platforms');

const router = express.Router();

// ── WhatsApp Cloud API Webhook ──
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === (process.env.WHATSAPP_VERIFY_TOKEN || 'assist-verify')) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

router.post('/whatsapp', express.json({ limit: '5mb' }), async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;
    for (const entry of (body.entry || [])) {
      for (const change of (entry.changes || [])) {
        const value = change.value;
        for (const msg of (value.messages || [])) {
          if (!msg.text?.body) continue;
          const platform = db.prepare(
            "SELECT business_id FROM platforms WHERE type = 'whatsapp' AND connected = 1"
          ).get();
          if (!platform) continue;
          const result = await handleIncomingMessage(
            platform.business_id, 'whatsapp', msg.from,
            msg.text.body, msg.from, msg.from
          );
          if (result.reply) {
            await getPlatform('whatsapp', platform.business_id).sendMessage(msg.from, result.reply);
          }
        }
      }
    }
  } catch (e) {
    console.error('[webhook:whatsapp]', e.message);
  }
});

// ── Telegram Webhook ──
router.post('/telegram', express.json({ limit: '5mb' }), async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    const msg = body.message || body.edited_message;
    if (!msg?.text) return;
    const chatId = String(msg.chat.id);
    const bots = db.prepare("SELECT business_id, config FROM platforms WHERE type = 'telegram' AND connected = 1").all();
    for (const bot of bots) {
      const config = JSON.parse(bot.config || '{}');
      if (config.token === process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_BOT_TOKEN) {
        const result = await handleIncomingMessage(
          bot.business_id, 'telegram', chatId,
          msg.text,
          [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || 'Telegram User',
          String(msg.from?.id)
        );
        if (result.reply) {
          await getPlatform('telegram', bot.business_id).sendMessage(chatId, result.reply);
        }
      }
    }
  } catch (e) {
    console.error('[webhook:telegram]', e.message);
  }
});

// ── Facebook / Instagram Webhook (verification) ──
router.get('/facebook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe') {
    const platforms = db.prepare("SELECT * FROM platforms WHERE type IN ('facebook','instagram') AND connected = 1").all();
    for (const p of platforms) {
      const config = JSON.parse(p.config || '{}');
      const vt = config.verifyToken || process.env.FB_VERIFY_TOKEN || process.env.IG_VERIFY_TOKEN;
      if (token === vt) return res.status(200).send(challenge);
    }
  }
  res.sendStatus(403);
});

router.post('/facebook', express.json({ limit: '5mb' }), async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    for (const entry of (body.entry || [])) {
      for (const event of (entry.messaging || [])) {
        if (!event.message?.text) continue;
        const senderId = event.sender?.id;
        const fbPlatforms = db.prepare("SELECT * FROM platforms WHERE type = 'facebook' AND connected = 1").all();
        for (const p of fbPlatforms) {
          const result = await handleIncomingMessage(
            p.business_id, 'facebook', senderId, event.message.text, senderId, senderId
          );
          if (result.reply) {
            await getPlatform('facebook', p.business_id).sendMessage(senderId, result.reply);
          }
        }
      }
    }
  } catch (e) {
    console.error('[webhook:facebook]', e.message);
  }
});

router.post('/instagram', express.json({ limit: '5mb' }), async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    for (const entry of (body.entry || [])) {
      for (const event of (entry.messaging || [])) {
        if (!event.message?.text) continue;
        const senderId = event.sender?.id;
        const igPlatforms = db.prepare("SELECT * FROM platforms WHERE type = 'instagram' AND connected = 1").all();
        for (const p of igPlatforms) {
          const result = await handleIncomingMessage(
            p.business_id, 'instagram', senderId, event.message.text, senderId, senderId
          );
          if (result.reply) {
            await getPlatform('instagram', p.business_id).sendMessage(senderId, result.reply);
          }
        }
      }
    }
  } catch (e) {
    console.error('[webhook:instagram]', e.message);
  }
});

module.exports = router;
