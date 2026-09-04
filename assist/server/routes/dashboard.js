const express = require('express');
const { db } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const bid = req.user.businessId;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const totalConv = db.prepare('SELECT COUNT(*) AS c FROM conversations WHERE business_id = ?').get(bid).c;
  const totalCustomers = db.prepare('SELECT COUNT(*) AS c FROM customers WHERE business_id = ?').get(bid).c;
  const newCustomersWeek = db.prepare('SELECT COUNT(*) AS c FROM customers WHERE business_id = ? AND created_at >= ?').get(bid, weekAgo).c;

  const statusCounts = {};
  for (const s of ['new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled']) {
    statusCounts[s] = db.prepare('SELECT COUNT(*) AS c FROM orders WHERE business_id = ? AND status = ?').get(bid, s).c;
  }
  const totalOrders = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const ordersToday = db.prepare('SELECT COUNT(*) AS c FROM orders WHERE business_id = ? AND created_at >= ?').get(bid, today).c;
  const ordersWeek = db.prepare('SELECT COUNT(*) AS c FROM orders WHERE business_id = ? AND created_at >= ?').get(bid, weekAgo).c;
  const ordersMonth = db.prepare('SELECT COUNT(*) AS c FROM orders WHERE business_id = ? AND created_at >= ?').get(bid, monthStart).c;

  const revenue = db.prepare('SELECT COALESCE(SUM(total), 0) AS t FROM orders WHERE business_id = ? AND status != ?').get(bid, 'cancelled').t;
  const revenueMonth = db.prepare('SELECT COALESCE(SUM(total), 0) AS t FROM orders WHERE business_id = ? AND status != ? AND created_at >= ?').get(bid, 'cancelled', monthStart).t;

  const pendingOrders = db.prepare('SELECT COUNT(*) AS c FROM orders WHERE business_id = ? AND status IN (?, ?)').get(bid, 'new', 'confirmed').c;
  const unReadNotif = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE business_id = ? AND read = 0').get(bid).c;
  const activeConvs = db.prepare('SELECT COUNT(*) AS c FROM conversations WHERE business_id = ? AND status = ?').get(bid, 'active').c;
  const aiEnabledConvs = db.prepare('SELECT COUNT(*) AS c FROM conversations WHERE business_id = ? AND ai_mode = 1 AND status = ?').get(bid, 'active').c;

  const recentOrders = db.prepare('SELECT id, number, customer_name, total, status, created_at FROM orders WHERE business_id = ? ORDER BY created_at DESC LIMIT 5').all(bid);
  const recentConvs = db.prepare(
    `SELECT c.id, c.platform, c.status, c.updated_at, cu.name AS customer_name
     FROM conversations c LEFT JOIN customers cu ON c.customer_id = cu.id
     WHERE c.business_id = ? ORDER BY c.updated_at DESC LIMIT 5`
  ).all(bid);

  const platformStats = db.prepare('SELECT type, connected, message_count FROM platforms WHERE business_id = ?').all(bid);

  const aiResponses = db.prepare("SELECT COUNT(*) AS c FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE business_id = ?) AND sender = 'ai'").get(bid).c;
  const totalMessages = db.prepare("SELECT COUNT(*) AS c FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE business_id = ?)").get(bid).c;

  res.json({
    totalConversations: totalConv,
    activeConversations: activeConvs,
    aiEnabledConversations: aiEnabledConvs,
    totalCustomers,
    newCustomersWeek,
    totalOrders,
    ordersToday,
    ordersWeek,
    ordersMonth,
    pendingOrders,
    statusCounts,
    revenue,
    revenueMonth,
    unreadNotifications: unReadNotif,
    platformStats,
    aiStats: { aiResponses, totalMessages, responseRate: totalMessages > 0 ? Math.round((aiResponses / totalMessages) * 100) : 0 },
    recentOrders,
    recentConversations: recentConvs,
  });
});

module.exports = router;
