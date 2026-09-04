const { getWhatsAppIntegration } = require('./whatsapp');
const { getTelegramIntegration } = require('./telegram');
const { getFacebookIntegration } = require('./facebook');
const { getInstagramIntegration } = require('./instagram');

const PLATFORM_HANDLERS = {
  whatsapp: getWhatsAppIntegration,
  telegram: getTelegramIntegration,
  facebook: getFacebookIntegration,
  instagram: getInstagramIntegration,
};

function getPlatform(platformType, businessId) {
  const handler = PLATFORM_HANDLERS[platformType];
  return handler ? handler(businessId) : null;
}

function getAllPlatforms(businessId) {
  const { db } = require('../db');
  return db.prepare('SELECT * FROM platforms WHERE business_id = ?').all(businessId);
}

function ensurePlatformRows(businessId) {
  const { db } = require('../db');
  const types = ['whatsapp', 'instagram', 'facebook', 'telegram'];
  for (const type of types) {
    const exists = db.prepare('SELECT id FROM platforms WHERE business_id = ? AND type = ?').get(businessId, type);
    if (!exists) {
      db.prepare('INSERT INTO platforms (business_id, type, connected) VALUES (?, ?, 0)').run(businessId, type);
    }
  }
}

module.exports = { getPlatform, getAllPlatforms, ensurePlatformRows, PLATFORM_HANDLERS };
