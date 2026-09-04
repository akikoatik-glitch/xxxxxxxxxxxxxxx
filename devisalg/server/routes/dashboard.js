const express = require('express');
const { db } = require('../db');
const { requireUser, loadBusiness } = require('../auth');

const router = express.Router();
router.use(requireUser, loadBusiness);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

router.get('/', (req, res) => {
  const bid = req.business.id;
  const today = todayStr();

  // Today's sales = sum of payments made today + invoices marked paid today
  const todaySales = db.prepare(
    `SELECT COALESCE(SUM(p.amount),0) AS total FROM payments p
     WHERE p.business_id=? AND date(p.paid_at)=?`
  ).get(bid, today);

  const unpaidCount = db.prepare(`SELECT COUNT(*) c FROM invoices WHERE business_id=? AND status='unpaid'`).get(bid);
  const unpaidTotal = db.prepare(`SELECT COALESCE(SUM(total),0) s FROM invoices WHERE business_id=? AND status='unpaid'`).get(bid);
  const overdueCount = db.prepare(`SELECT COUNT(*) c FROM invoices WHERE business_id=? AND status='overdue'`).get(bid);
  const overdueTotal = db.prepare(`SELECT COALESCE(SUM(total),0) s FROM invoices WHERE business_id=? AND status='overdue'`).get(bid);
  const devisCount = db.prepare(`SELECT COUNT(*) c FROM devis WHERE business_id=?`).get(bid);
  const invoiceCount = db.prepare(`SELECT COUNT(*) c FROM invoices WHERE business_id=?`).get(bid);
  const acceptedDevis = db.prepare(`SELECT COUNT(*) c FROM devis WHERE business_id=? AND status IN ('accepted','converted')`).get(bid);
  const customerCount = db.prepare(`SELECT COUNT(*) c FROM customers WHERE business_id=?`).get(bid);
  const conversationCount = db.prepare(`SELECT COUNT(*) c FROM conversations WHERE business_id=?`).get(bid);
  const unreadNotifs = db.prepare(`SELECT COUNT(*) c FROM notifications WHERE business_id=? AND read=0`).get(bid);

  // AI activity (last 7 days messages by ai)
  const aiMessages = db.prepare(
    `SELECT COUNT(*) c FROM messages m JOIN conversations c ON c.id=m.conversation_id
     WHERE c.business_id=? AND m.sender='ai' AND date(m.created_at)>=date('now','-6 days')`
  ).get(bid).c;

  // Recent customers
  const recentCustomers = db.prepare(
    'SELECT * FROM customers WHERE business_id=? ORDER BY id DESC LIMIT 5'
  ).all(bid);

  // Recent conversations (with last message)
  const recentConversations = db.prepare(
    `SELECT c.*, cust.name AS customer_name, cust.phone AS customer_phone,
       (SELECT body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
       (SELECT sender FROM messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS last_sender
     FROM conversations c LEFT JOIN customers cust ON cust.id=c.customer_id
     WHERE c.business_id=? ORDER BY c.updated_at DESC LIMIT 6`
  ).all(bid);

  // Recent notifications
  const notifications = db.prepare(
    'SELECT * FROM notifications WHERE business_id=? ORDER BY id DESC LIMIT 8'
  ).all(bid);

  // Monthly revenue (last 6 months) for chart
  const monthly = db.prepare(
    `SELECT strftime('%Y-%m', paid_at) AS month, SUM(amount) AS total FROM payments
     WHERE business_id=? AND paid_at >= date('now','-6 months','start of month') AND paid_at < date('now','start of month')
     GROUP BY month ORDER BY month`
  ).all(bid);

  // Devis by status (pie)
  const devisByStatus = db.prepare(
    `SELECT status, COUNT(*) c FROM devis WHERE business_id=? GROUP BY status`
  ).all(bid);
  const invoicesByStatus = db.prepare(
    `SELECT status, COUNT(*) c FROM invoices WHERE business_id=? GROUP BY status`
  ).all(bid);

  res.json({
    todaySales: todaySales.total,
    unpaid: { count: unpaidCount.c, total: unpaidTotal.s },
    overdue: { count: overdueCount.c, total: overdueTotal.s },
    devis: devisCount.c,
    invoices: invoiceCount.c,
    acceptedDevis: acceptedDevis.c,
    customers: customerCount.c,
    conversations: conversationCount.c,
    aiMessages,
    unreadNotifs: unreadNotifs.c,
    recentCustomers,
    recentConversations,
    notifications,
    monthly,
    devisByStatus,
    invoicesByStatus,
    business: req.business,
  });
});

module.exports = router;
