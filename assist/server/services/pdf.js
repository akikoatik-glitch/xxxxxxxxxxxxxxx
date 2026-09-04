const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../db');

const BLUE = '#0084FF';
const DARK = '#171717';
const GRAY = '#6B7280';
const LIGHT = '#F3F4F6';

async function generateOrderPDF(order, business) {
  return new Promise((resolve, reject) => {
    const pdfsDir = path.join(DATA_DIR, 'pdfs');
    fs.mkdirSync(pdfsDir, { recursive: true });
    const filename = `${order.number}.pdf`;
    const pdfPath = path.join(pdfsDir, filename);
    const stream = fs.createWriteStream(pdfPath);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(stream);

    // ── Header ──
    const logoPath = business.logo_path ? path.resolve(DATA_DIR, '..', business.logo_path) : null;
    if (logoPath && fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 40, { width: 50, height: 50 });
    }
    doc.fontSize(22).font('Helvetica-Bold').fillColor(BLUE).text('Assist.', logoPath ? 110 : 50, 45);
    doc.fontSize(9).font('Helvetica').fillColor(GRAY).text(business.name || '', logoPath ? 110 : 50, 72);

    // ── Invoice header box ──
    doc.rect(50, 110, 512, 60).fill(LIGHT);
    doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold');
    doc.text('FACTURE / INVOICE', 60, 120);
    doc.fontSize(9).font('Helvetica').fillColor(GRAY);
    doc.text(`N° : ${order.number}`, 60, 140);
    doc.text(`Date : ${new Date(order.created_at).toLocaleDateString('fr-DZ')}`, 60, 152);
    doc.text(`Statut : ${order.status}`, 320, 140);
    doc.text(`Mode : ${order.payment_method || '—'}`, 320, 152);

    // ── Customer ──
    let y = 190;
    doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text('CLIENT', 50, y);
    y += 16;
    doc.fontSize(9).font('Helvetica').fillColor(GRAY);
    doc.text(`Nom : ${order.customer_name || '—'}`, 50, y); y += 14;
    doc.text(`Tél : ${order.customer_phone || '—'}`, 50, y); y += 14;
    doc.text(`Adresse : ${order.customer_address || '—'}`, 50, y); y += 14;
    doc.text(`Wilaya : ${order.customer_wilaya || '—'}${order.customer_commune ? ', ' + order.customer_commune : ''}`, 50, y); y += 24;

    // ── Items table ──
    doc.rect(50, y, 512, 24).fill(BLUE);
    doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
    doc.text('Produit', 60, y + 7);
    doc.text('Qté', 320, y + 7, { width: 50, align: 'center' });
    doc.text('Prix unit.', 375, y + 7, { width: 70, align: 'right' });
    doc.text('Total', 460, y + 7, { width: 80, align: 'right' });
    y += 28;

    let items = [];
    try { items = JSON.parse(order.products_json || '[]'); } catch { items = []; }
    doc.fillColor(DARK).font('Helvetica');
    items.forEach((item, i) => {
      const bg = i % 2 === 0 ? '#FFFFFF' : LIGHT;
      doc.rect(50, y, 512, 20).fill(bg);
      doc.fillColor(DARK).fontSize(9);
      doc.text(item.name || '', 60, y + 5, { width: 240 });
      doc.text(String(item.qty || 1), 320, y + 5, { width: 50, align: 'center' });
      doc.text(`${(item.price || 0).toLocaleString()}`, 375, y + 5, { width: 70, align: 'right' });
      doc.text(`${((item.price || 0) * (item.qty || 1)).toLocaleString()}`, 460, y + 5, { width: 80, align: 'right' });
      y += 20;
    });
    if (!items.length) {
      doc.text('—', 60, y + 5);
      y += 20;
    }
    y += 8;

    // ── Totals ──
    doc.moveTo(350, y).lineTo(562, y).stroke(GRAY);
    y += 8;
    doc.fontSize(9).font('Helvetica').fillColor(GRAY);
    doc.text('Sous-total', 375, y, { width: 70, align: 'right' });
    doc.fillColor(DARK).text(`${(order.subtotal || 0).toLocaleString()} ${business.currency || 'DA'}`, 460, y, { width: 80, align: 'right' });
    y += 16;
    doc.fillColor(GRAY);
    doc.text('Livraison', 375, y, { width: 70, align: 'right' });
    doc.fillColor(DARK).text(`${(order.delivery_cost || 0).toLocaleString()} ${business.currency || 'DA'}`, 460, y, { width: 80, align: 'right' });
    y += 16;
    doc.moveTo(350, y).lineTo(562, y).stroke(GRAY);
    y += 8;
    doc.fontSize(11).font('Helvetica-Bold').fillColor(BLUE);
    doc.text('TOTAL', 375, y, { width: 70, align: 'right' });
    doc.text(`${(order.total || 0).toLocaleString()} ${business.currency || 'DA'}`, 460, y, { width: 80, align: 'right' });

    // ── Footer ──
    const footerY = 750;
    doc.moveTo(50, footerY).lineTo(562, footerY).stroke(GRAY);
    doc.fontSize(8).font('Helvetica').fillColor(GRAY);
    doc.text(`Généré par Assist. — ${business.name || ''}`, 50, footerY + 8);
    doc.text(`Contact : ${business.phone || business.email || '—'}`, 50, footerY + 20);
    doc.text('Merci pour votre confiance !', 50, footerY + 32);

    doc.end();
    stream.on('finish', () => resolve({ pdfPath, filename }));
    stream.on('error', reject);
  });
}

module.exports = { generateOrderPDF };
