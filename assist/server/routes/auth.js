const express = require('express');
const bcrypt = require('bcryptjs');
const { db, audit } = require('../db');
const { signToken } = require('../auth');
const { authLimiter } = require('../middleware/ratelimit');
const { ensurePlatformRows } = require('../integrations/platforms');

const router = express.Router();

router.post('/register', authLimiter, (req, res) => {
  try {
    const { email, password, businessName } = req.body;
    if (!email || !password || !businessName) {
      return res.status(400).json({ error: 'Email, mot de passe et nom du business requis.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé.' });

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hash);
    const userId = result.lastInsertRowid;

    const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const bizResult = db.prepare(
      'INSERT INTO businesses (user_id, name, slug) VALUES (?, ?, ?)'
    ).run(userId, businessName, slug);
    const businessId = bizResult.lastInsertRowid;

    db.prepare('INSERT INTO ai_settings (business_id) VALUES (?)').run(businessId);
    ensurePlatformRows(businessId);

    audit(businessId, 'register', email, 'business', businessId, businessName);

    const token = signToken({ userId, businessId, email });
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 86400000, sameSite: 'lax' });
    res.json({ token, user: { id: userId, email }, business: { id: businessId, name: businessName, slug } });
  } catch (e) {
    console.error('[auth:register]', e);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

router.post('/login', authLimiter, (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    const biz = db.prepare('SELECT * FROM businesses WHERE user_id = ? LIMIT 1').get(user.id);
    if (!biz) return res.status(404).json({ error: 'Aucun business trouvé.' });

    audit(biz.id, 'login', email, 'user', user.id);

    const token = signToken({ userId: user.id, businessId: biz.id, email });
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 86400000, sameSite: 'lax' });
    res.json({ token, user: { id: user.id, email }, business: { id: biz.id, name: biz.name, slug: biz.slug } });
  } catch (e) {
    console.error('[auth:login]', e);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

router.get('/me', (req, res) => {
  const { authMiddleware } = require('../auth');
  authMiddleware(req, res, () => {
    const user = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(req.user.userId);
    const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.user.businessId);
    if (!user || !biz) return res.status(404).json({ error: 'Non trouvé.' });
    res.json({ user, business: biz });
  });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

module.exports = router;
