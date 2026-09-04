const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-production';
const COOKIE = 'devisalg_session';

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function signToken(user) {
  return jwt.sign({ uid: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

// Middleware: require an authenticated user
function requireUser(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE];
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  delete user.password_hash;
  req.user = user;
  next();
}

// Load the current business (first business owned by the user). Multi-tenant:
// every business-scoped query must be filtered by req.business.id.
function loadBusiness(req, res, next) {
  const business = db.prepare('SELECT * FROM businesses WHERE user_id = ?').get(req.user.id);
  if (!business) {
    return res.status(404).json({ error: 'No business found. Please create one.' });
  }
  req.business = business;
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  setSessionCookie,
  clearSessionCookie,
  COOKIE,
  JWT_SECRET,
  requireUser,
  loadBusiness,
};
