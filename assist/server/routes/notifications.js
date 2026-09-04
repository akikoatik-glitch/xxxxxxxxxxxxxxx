const express = require('express');
const { getNotifications, markRead, unreadCount } = require('../services/notifications');

const router = express.Router();

router.get('/', (req, res) => {
  const { unread_only } = req.query;
  const notifications = getNotifications(req.user.businessId, { unreadOnly: unread_only === '1' });
  res.json(notifications);
});

router.get('/unread-count', (req, res) => {
  res.json({ count: unreadCount(req.user.businessId) });
});

router.patch('/read', (req, res) => {
  markRead(req.user.businessId, null);
  res.json({ ok: true });
});

router.patch('/:id/read', (req, res) => {
  markRead(req.user.businessId, parseInt(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
