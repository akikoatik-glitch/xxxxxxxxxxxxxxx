// Central registration of all background job handlers.
const { db } = require('../db');
const jobs = require('./jobs');
const wa = require('./whatsapp');
const pdf = require('./pdf');

function docRef(kind, number) {
  return `${kind.toLowerCase()}-${number.replace(/[\\/:*?"<>|]/g, '_')}`;
}

// Sending a WhatsApp text message
jobs.register('whatsapp_text', async ({ businessId, to, text }) => {
  await wa.sendText(businessId, to, text);
});

// Generate an invoice PDF
jobs.register('invoice_pdf', async ({ businessId, invoiceId, number }) => {
  const biz = db.prepare('SELECT * FROM businesses WHERE id=?').get(businessId);
  const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(invoiceId);
  if (!biz || !inv) throw new Error('missing business/invoice for pdf job');
  const its = db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(inv.id);
  const cust = inv.customer_id ? db.prepare('SELECT * FROM customers WHERE id=?').get(inv.customer_id) : null;
  const ref = docRef('facture', number);
  const file = await pdf.build({
    business: biz,
    customer: cust || { customer_name: inv.customer_name, customer_phone: inv.customer_phone },
    docRef: ref,
    items: its,
    discount: inv.discount,
    taxRate: inv.tax_rate,
    notes: inv.notes,
    validity: null,
    kind: 'facture',
    number,
    date: inv.created_at.slice(0, 10),
    status: inv.status,
  });
  db.prepare('UPDATE invoices SET pdf_path=? WHERE id=?').run(file, inv.id);
});

module.exports = { registerAll: () => {} };
