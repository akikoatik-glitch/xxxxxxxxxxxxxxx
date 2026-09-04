const { db } = require('../db');

function createNotification(businessId, type, title, body, meta) {
  db.prepare(
    'INSERT INTO notifications (business_id, type, title, body, meta) VALUES (?, ?, ?, ?, ?)'
  ).run(businessId, type, title, body, meta ? JSON.stringify(meta) : '{}');
}

function getNotifications(businessId, { unreadOnly, limit } = {}) {
  let sql = 'SELECT * FROM notifications WHERE business_id = ?';
  const params = [businessId];
  if (unreadOnly) { sql += ' AND read = 0'; }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit || 50);
  return db.prepare(sql).all(...params);
}

function markRead(businessId, notificationId) {
  if (notificationId) {
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND business_id = ?').run(notificationId, businessId);
  } else {
    db.prepare('UPDATE notifications SET read = 1 WHERE business_id = ?').run(businessId);
  }
}

function unreadCount(businessId) {
  const row = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE business_id = ? AND read = 0').get(businessId);
  return row.c;
}

module.exports = { createNotification, getNotifications, markRead, unreadCount };
