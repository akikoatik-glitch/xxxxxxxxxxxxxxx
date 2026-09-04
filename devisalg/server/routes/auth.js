const express = require('express');
const { db, audit } = require('../db');
const { hashPassword, verifyPassword, signToken, setSessionCookie, clearSessionCookie, requireUser, loadBusiness } = require('../auth');
const { authLimiter } = require('../middleware/ratelimit');

const router = express.Router();

// Lightweight inline validation (no heavy deps)
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', authLimiter, (req, res) => {
  const { email, password, businessName } = req.body || {};
  if (!email || !emailRe.test(String(email))) return res.status(400).json({ error: 'Email invalide.' });
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
  if (!businessName || !String(businessName).trim()) return res.status(400).json({ error: 'Nom du commerce requis.' });

  const exists = db.prepare('SELECT id FROM users WHERE lower(email)=lower(?)').get(email);
  if (exists) return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });

  const hash = hashPassword(password);
  const info = db.prepare('INSERT INTO users (email, password_hash) VALUES (?,?)').run(email.toLowerCase(), hash);
  const uid = info.lastInsertRowid;

  const bizInfo = db.prepare(
    'INSERT INTO businesses (user_id, name, plan) VALUES (?,?,?)'
  ).run(uid, String(businessName).trim(), 'free');
  const bizId = bizInfo.lastInsertRowid;

  db.prepare('INSERT OR IGNORE INTO ai_settings (business_id, enabled, language) VALUES (?,?,?)').run(bizId, 0, 'darija_fr');

  const token = signToken({ id: uid, email: email.toLowerCase() });
  setSessionCookie(res, token);
  audit(bizId, 'register', 'system', 'business', bizId, 'New business registered');
  res.status(201).json({ ok: true, user: { id: uid, email }, businessId: bizId });
});

router.post('/login', authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE lower(email)=lower(?)').get(email || '');
  if (!user || !verifyPassword(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  }
  const token = signToken(user);
  setSessionCookie(res, token);
  delete user.password_hash;
  res.json({ ok: true, user });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireUser, (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE user_id=?').get(req.user.id);
  res.json({ user: req.user, business: business || null });
});

module.exports = router;
