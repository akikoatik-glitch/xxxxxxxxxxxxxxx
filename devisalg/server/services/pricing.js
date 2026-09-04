// Configurable pricing. Change these values to adjust plans later.
// Prices are in DZD. No fake payments: plans only gate usage/limits.
const PLANS = {
  free: {
    name: 'FREE',
    label: 'Gratuit',
    price_monthly: 0,
    max_devis: 10,
    max_invoices: 10,
    max_customers: 50,
    max_products: 30,
    max_ai_messages_per_month: 100,
    ai_assistant: true,
    whatsapp: false,
    reminders: false,
    pdf: true,
    advanced_dashboard: false,
  },
  pro: {
    name: 'PRO',
    label: 'Pro',
    price_monthly: 2900, // DZD / month, configurable
    max_devis: -1,       // -1 = unlimited
    max_invoices: -1,
    max_customers: -1,
    max_products: -1,
    max_ai_messages_per_month: -1,
    ai_assistant: true,
    whatsapp: true,
    reminders: true,
    pdf: true,
    advanced_dashboard: true,
  },
};

// Returns the effective limits for a business plan.
function limits(business) {
  const plan = PLANS[business.plan] || PLANS.free;
  return plan;
}

function isUnlimited(v) {
  return v === -1;
}

function count(table, businessId) {
  const { db } = require('../db');
  const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE business_id = ?`).get(businessId);
  return row.c;
}

// Check whether the business is allowed to create another record of a type.
// Returns { ok, reason }.
function canCreate(businessId, type) {
  const biz = require('../db').db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!biz) return { ok: false, reason: 'Business not found' };
  const lim = limits(biz);
  const limitMap = {
    devis: { lim: lim.max_devis, table: 'devis' },
    invoices: { lim: lim.max_invoices, table: 'invoices' },
    customers: { lim: lim.max_customers, table: 'customers' },
    products: { lim: lim.max_products, table: 'products' },
  };
  const entry = limitMap[type];
  if (!entry) return { ok: true };
  if (isUnlimited(entry.lim)) return { ok: true };
  const c = count(entry.table, businessId);
  if (c >= entry.lim) {
    return {
      ok: false,
      limit: entry.lim,
      reason: `Limite ${entry.lim} atteinte. Passez au plan Pro pour un usage illimité.`,
    };
  }
  return { ok: true };
}

module.exports = { PLANS, limits, isUnlimited, canCreate };
