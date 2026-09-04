const express = require('express');
const { db, audit, nextNumber } = require('../db');
const { requireUser, loadBusiness } = require('../auth');
const { PLANS, limits } = require('../services/pricing');
const ai = require('../ai/engine');

const router = express.Router();
router.use(requireUser, loadBusiness);

router.get('/', (req, res) => {
  const usage = {
    devis: db.prepare('SELECT COUNT(*) c FROM devis WHERE business_id=?').get(req.business.id).c,
    invoices: db.prepare('SELECT COUNT(*) c FROM invoices WHERE business_id=?').get(req.business.id).c,
    customers: db.prepare('SELECT COUNT(*) c FROM customers WHERE business_id=?').get(req.business.id).c,
    products: db.prepare('SELECT COUNT(*) c FROM products WHERE business_id=?').get(req.business.id).c,
    ai_messages_this_month: ai.aiMessagesUsed(req.business.id),
  };
  res.json({
    business: req.business,
    plan: req.business.plan,
    limits: limits(req.business),
    usage,
    plans: Object.fromEntries(Object.entries(PLANS).map(([k, v]) => [k, { ...v }])),
  });
});

// Change plan is stubbed intentionally: no fake payments.
// A real billing webhook would update business.plan server-side.
router.post('/select', (req, res) => {
  const plan = String(req.body.plan || 'free');
  if (!PLANS[plan]) return res.status(400).json({ error: 'Plan invalide.' });
  // Show plan intent; actual upgrade requires real payment handled elsewhere.
  res.json({ ok: true, message: 'Plan noté. Le paiement est géré séparément.', plan });
});

module.exports = router;
