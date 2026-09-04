// PDF generation for Devis and Facture using pdfkit.
// Produces a clean, professional, bilingual (Arabic RTL labels + French) document.
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { formatDZD } = require('../ai/engine');

const OUTPUT_DIR = path.resolve(__dirname, '..', '..', 'data', 'pdfs');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function esc(s) {
  return String(s ?? '');
}

function money(n) {
  return formatDZD(n);
}

function computation(items, discount, taxRate) {
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
  const discountVal = Math.min(Number(discount) || 0, subtotal);
  const afterDiscount = subtotal - discountVal;
  const tax = afterDiscount * (Number(taxRate) || 0) / 100;
  const total = afterDiscount + tax;
  return { subtotal, discount: discountVal, tax, total };
}

// doc is pdfkit; draw a labelled row in the totals box.
function totalRow(doc, label, value, bold) {
  const y = doc.y;
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11);
  doc.text(label, 300, y, { width: 120, align: 'right' });
  doc.text(value, 420, y, { width: 130, align: 'right' });
}

function build({ business, customer, docRef, items, discount, taxRate, notes, validity, kind, number, date, status }) {
  const logo = business.logo_path
    ? (fs.existsSync(business.logo_path) ? business.logo_path : null)
    : null;

  const comp = computation(items, discount, taxRate);
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const target = path.join(OUTPUT_DIR, `${docRef}.pdf`);
  const stream = fs.createWriteStream(target);
  doc.pipe(stream);

  // Header bar
  doc.rect(0, 0, 612, 120).fill('#0f172a');
  doc.fill('#ffffff');
  if (logo) {
    doc.image(logo, 50, 25, { width: 70, height: 70, fit: [70, 70] });
  }
  doc.font('Helvetica-Bold').fontSize(24);
  doc.text(esc(business.name), logo ? 140 : 50, 30);
  doc.font('Helvetica').fontSize(10).fillColor('#cbd5e1');
  const bizBits = [business.address, business.phone, business.email].filter(Boolean);
  doc.text(bizBits.join('  •  '), logo ? 140 : 50, 62, { width: 410 });
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20);
  doc.text(kind.toUpperCase(), 420, 30, { width: 140, align: 'right' });
  doc.font('Helvetica').fontSize(11);
  doc.text(`N° ${esc(number)}`, 420, 58, { width: 140, align: 'right' });
  doc.text(`Date: ${esc(date)}`, 420, 76, { width: 140, align: 'right' });
  if (validity) doc.text(`Validité: ${validity} jours`, 420, 94, { width: 140, align: 'right' });

  // Customer block
  doc.y = 150;
  doc.fillColor('#334155').font('Helvetica-Bold').fontSize(12).text('CLIENT');
  doc.fillColor('#0f172a').font('Helvetica').fontSize(11);
  doc.text(esc(customer.name || customer.customer_name || ''));
  if (customer.phone || customer.customer_phone) doc.text(esc(customer.phone || customer.customer_phone));
  if (customer.address) doc.text(esc(customer.address));
  if (customer.email) doc.text(esc(customer.email));

  // Items table header
  doc.y = 230;
  doc.rect(50, doc.y, 512, 26).fill('#e2e8f0');
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11);
  const cols = [50, 330, 100, 432, 512];
  doc.text('Description', 58, doc.y + 8);
  doc.text('Qté', 330, doc.y + 8, { width: 70, align: 'right' });
  doc.text('P.U.', 410, doc.y + 8, { width: 80, align: 'right' });
  doc.text('Total', 502, doc.y + 8, { width: 58, align: 'right' });
  let y = doc.y + 26;

  for (const it of items) {
    doc.fillColor('#0f172a').font('Helvetica').fontSize(10);
    doc.text(esc(it.name), 58, y + 3, { width: 240 });
    doc.text(String(it.quantity), 330, y + 3, { width: 70, align: 'right' });
    doc.text(money(it.unit_price), 410, y + 3, { width: 80, align: 'right' });
    doc.text(money(it.quantity * it.unit_price), 502, y + 3, { width: 58, align: 'right' });
    y += 22;
    if (y > 700) { doc.addPage(); y = 60; }
  }

  // Totals
  doc.y = Math.max(y + 10, 330);
  doc.x = 300;
  totalRow(doc, 'Sous-total', money(comp.subtotal), false);
  if (comp.discount > 0) totalRow(doc, 'Remise (-)', '-' + money(comp.discount), false);
  if (taxRate > 0) totalRow(doc, `TVA (${taxRate}%)`, money(comp.tax), false);
  doc.moveUp(1);
  totalRow(doc, 'TOTAL', money(comp.total), true);

  // Status stamp
  if (status && ['paid', 'accepted', 'en retard', 'unpaid'].includes(String(status).toLowerCase() === 'paid' ? 'paid' : status.toLowerCase())) {
    doc.font('Helvetica-Bold').fontSize(28).fillColor('#16a34a');
    doc.text(status.toUpperCase().replace('_', ' '), 350, 90, { width: 200, align: 'right', rotate: -12 });
  }

  // Notes & payment info
  doc.fillColor('#475569').font('Helvetica').fontSize(9);
  if (notes) {
    doc.moveDown();
    doc.font('Helvetica-Bold').text('Notes / Remarques');
    doc.font('Helvetica').text(esc(notes));
  }
  if (business.payment_methods && kind === 'facture') {
    doc.font('Helvetica-Bold').text('Paiement');
    doc.font('Helvetica').text('Méthodes acceptées: ' + esc(business.payment_methods));
  }

  doc.end();
  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(target));
    stream.on('error', reject);
  });
}

module.exports = { build, computation, OUTPUT_DIR };
