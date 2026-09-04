// Automatic payment reminders.
// Configurable timing (days overdue) and an optional reminder message.
// Reminders are only sent if the business has WhatsApp connected and the
// invoice has reminders enabled. Scheduled via a periodic check + jobs.

const { db } = require('../db');
const jobs = require('./jobs');
const wa = require('./whatsapp');

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// Scan for overdue invoices and enqueue reminder jobs.
async function scan(businessId) {
  const settings = db.prepare(`SELECT * FROM ai_settings WHERE business_id=?`).get(businessId) || {};
  let reminderDays = 7;
  let msg = null;
  try {
    const rules = JSON.parse(settings.eskalate_rules || '{}');
    if (rules.reminder_days) reminderDays = Number(rules.reminder_days) || 7;
    if (rules.reminder_message) msg = rules.reminder_message;
  } catch {}
  if (!msg) {
    msg = 'سلام، حبيت غير نذكرك بلي الفاتورة مازالت ما تخلصتش. إذا تحتاج أي معلومة رانا هنا.';
  }

  const cred = wa.credentials(businessId);
  if (!cred) return;

  const overdue = db.prepare(
    `SELECT * FROM invoices
     WHERE business_id=? AND status='unpaid' AND reminders_enabled=1 AND due_date IS NOT NULL AND due_date < ?`
  ).all(businessId, isoDaysAgo(reminderDays));

  for (const inv of overdue) {
    // Avoid spamming: only remind once per day, and not if just set.
    const today = new Date().toISOString().slice(0, 10);
    if (inv.last_reminder_at && inv.last_reminder_at.slice(0, 10) === today) continue;
    if (!inv.customer_phone) continue;

    const full = msg.replace('#NUM', inv.number).replace('#NUMBER', inv.number);
    jobs.addJob(
      'whatsapp_text',
      { businessId, to: inv.customer_phone, text: full },
      { idempotencyKey: `reminder:${inv.id}:${today}` }
    );
    db.prepare(`UPDATE invoices SET last_reminder_at=datetime('now') WHERE id=?`).run(inv.id);
  }
}

// Periodic scheduler (registered by the server entry).
function startScheduler({ intervalMs = 60 * 60 * 1000 } = {}) {
  const tick = async () => {
    try {
      const biz = db.prepare(`SELECT id, plan FROM businesses`).all();
      for (const b of biz) {
        const { limits } = require('./pricing');
        const lim = limits(b);
        if (lim.reminders) {
          await scan(b.id);
        }
      }
    } catch (e) {
      console.error('reminder scan error', e.message);
    }
  };
  tick();
  return setInterval(tick, intervalMs);
}

module.exports = { scan, startScheduler };
