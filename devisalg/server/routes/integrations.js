const express = require('express');
const { db, audit } = require('../db');
const { requireUser, loadBusiness } = require('../auth');
const wa = require('../services/whatsapp');

const router = express.Router();
router.use(requireUser, loadBusiness);

// GET current integration state
router.get('/whatsapp', (req, res) => {
  const row = db.prepare(`SELECT * FROM integrations WHERE business_id=? AND type='whatsapp'`).get(req.business.id);
  const isConnected = !!(row && row.connected);
  const hasServerEnv = !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  res.json({
    connected: isConnected,
    has_server_env: hasServerEnv,
    // Do NOT leak secrets back to the client:
    config: row ? (() => {
      let cfg = {};
      try { cfg = JSON.parse(row.config || '{}'); } catch {}
      return { phoneNumberId: cfg.phoneNumberId ? '••••' + String(cfg.phoneNumberId).slice(-4) : '', hasToken: !!cfg.token };
    })() : null,
    instructions: {
      steps: [
        '1. Créez un compte développeur sur developers.facebook.com',
        '2. Créez une application et ajoutez le produit "WhatsApp".',
        '3. Connectez votre numéro WhatsApp Business (abonnement requis).',
        '4. Copiez le "System User Access Token" et le "Phone Number ID".',
        '5. Collez-les ci-dessous dans les champs sécurisés.',
        '6. Configurez le webhook (URL + Verify Token) pour recevoir les messages.',
      ],
    },
  });
});

// Save WhatsApp credentials (stored server-side in DB, never returned to client)
router.post('/whatsapp', (req, res) => {
  const { token, phoneNumberId, verifyToken } = req.body || {};
  if (!token || !phoneNumberId) {
    return res.status(400).json({ error: 'Token et Phone Number ID requis.' });
  }
  const existing = db.prepare(`SELECT * FROM integrations WHERE business_id=? AND type='whatsapp'`).get(req.business.id);
  let cfg = {};
  if (existing) { try { cfg = JSON.parse(existing.config || '{}'); } catch {} }
  if (token) cfg.token = String(token);
  if (phoneNumberId) cfg.phoneNumberId = String(phoneNumberId);
  if (verifyToken) cfg.verifyToken = String(verifyToken);
  if (existing) {
    db.prepare(`UPDATE integrations SET config=?, connected=1, updated_at=datetime('now') WHERE id=?`).run(JSON.stringify(cfg), existing.id);
  } else {
    db.prepare(`INSERT INTO integrations (business_id, type, config, connected) VALUES (?,?,?,1)`)
      .run(req.business.id, 'whatsapp', JSON.stringify(cfg));
  }
  // Update the global verify token registry used by the webhook
  syncVerifyTokens();
  audit(req.business.id, 'connect_whatsapp', req.user.email, 'integration', req.business.id, 'WhatsApp connected');
  res.json({ ok: true, connected: true });
});

// Test sending a message to a number
router.post('/whatsapp/test', async (req, res) => {
  const { to } = req.body || {};
  if (!to) return res.status(400).json({ error: 'Numéro requis.' });
  try {
    const result = await wa.sendText(req.business.id, String(to), 'DevisAlg ✓ Test de connexion WhatsApp.');
    if (result.ok) {
      audit(req.business.id, 'whatsapp_test', req.user.email, 'integration', req.business.id, 'OK');
      res.json({ ok: true, id: result.id });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (e) {
    res.status(502).json({ error: 'Erreur envoi: ' + e.message });
  }
});

// Send a generated PDF document to a customer via WhatsApp
router.post('/whatsapp/send-document', async (req, res) => {
  const { id, kind, to } = req.body || {};
  if (!id || !to) return res.status(400).json({ error: 'id et numéro requis.' });
  const table = kind === 'devis' ? 'devis' : 'invoices';
  const row = kind === 'devis'
    ? db.prepare('SELECT * FROM devis WHERE id=? AND business_id=?').get(id, req.business.id)
    : db.prepare('SELECT * FROM invoices WHERE id=? AND business_id=?').get(id, req.business.id);
  if (!row) return res.status(404).json({ error: 'Document introuvable.' });
  if (!row.pdf_path) return res.status(400).json({ error: 'PDF non généré. Générez-le d\'abord.' });

  // Serve the PDF over a public URL. In this build we note the local path; a
  // real deployment would upload to cloud storage and send that URL.
  const publicUrl = `/data/pdfs/${encodeURIComponent(require('path').basename(row.pdf_path))}`;
  const filename = kind === 'devis'
    ? `Devis_${row.number}.pdf`
    : `Facture_${row.number}.pdf`;
  try {
    const result = await wa.sendDocument(req.business.id, to, require('url').pathToFileURL(row.pdf_path).href, filename, 'DevisAlg');
    // Fallback: if file URL not supported, send text with the number
    if (!result.ok) {
      // send simple text acknowledging
      const textRes = await wa.sendText(req.business.id, to, `Votre ${kind === 'devis' ? 'Devis' : 'Facture'} ${row.number} est prêt. Le PDF vous sera remis.`);
      if (!textRes.ok) return res.status(502).json({ error: result.error || textRes.error });
    }
    // Mark as sent
    db.prepare(`UPDATE ${kind === 'devis' ? 'devis' : 'invoices'} SET status=?, sent_via='whatsapp' WHERE id=?`)
      .run(kind === 'devis' ? 'sent' : 'sent', row.id);
    audit(req.business.id, 'send_' + kind, req.user.email, kind, row.id, row.number);
    res.json({ ok: true, pdf_url: publicUrl });
  } catch (e) {
    res.status(502).json({ error: 'Erreur envoi WhatsApp: ' + e.message });
  }
});

router.delete('/whatsapp', (req, res) => {
  db.prepare(`UPDATE integrations SET connected=0, updated_at=datetime('now') WHERE business_id=? AND type='whatsapp'`).run(req.business.id);
  audit(req.business.id, 'disconnect_whatsapp', req.user.email, 'integration', req.business.id, '');
  res.json({ ok: true, connected: false });
});

// The webhook needs to map a verify token back to a business; keep an in-memory
// registry built from all connected businesses.
const VERIFY_REGISTRY = {};
function syncVerifyTokens() {
  const rows = db.prepare(`SELECT business_id, config FROM integrations WHERE type='whatsapp' AND connected=1`).all();
  Object.keys(VERIFY_REGISTRY).forEach((k) => delete VERIFY_REGISTRY[k]);
  for (const r of rows) {
    try {
      const c = JSON.parse(r.config || '{}');
      if (c.verifyToken) VERIFY_REGISTRY[c.verifyToken] = r.business_id;
    } catch {}
  }
  return VERIFY_REGISTRY;
}
router.syncVerifyTokens = syncVerifyTokens;

// Expose registry for the webhook route
router.getVerifyRegistry = function () { return VERIFY_REGISTRY; };

module.exports = router;
