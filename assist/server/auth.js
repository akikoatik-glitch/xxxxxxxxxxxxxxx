const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'assist-dev-secret-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function extractToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  if (req.cookies && req.cookies.token) return req.cookies.token;
  return null;
}

function authMiddleware(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Authentification requise.' });
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expirée. Connectez-vous à nouveau.' });
  }
}

function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (token) {
    try { req.user = verifyToken(token); } catch { /* ignore */ }
  }
  next();
}

module.exports = { signToken, verifyToken, extractToken, authMiddleware, optionalAuth };
