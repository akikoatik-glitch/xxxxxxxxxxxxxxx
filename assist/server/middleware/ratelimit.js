const windows = new Map();

function apiLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60_000;
  const max = 120;

  if (!windows.has(ip)) windows.set(ip, []);
  const hits = windows.get(ip);

  while (hits.length && hits[0] < now - windowMs) hits.shift();

  if (hits.length >= max) {
    return res.status(429).json({ error: 'Trop de requêtes. Réessayez dans une minute.' });
  }
  hits.push(now);
  next();
}

function authLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 15 * 60_000;
  const max = 20;

  if (!windows.has('auth_' + ip)) windows.set('auth_' + ip, []);
  const hits = windows.get('auth_' + ip);

  while (hits.length && hits[0] < now - windowMs) hits.shift();

  if (hits.length >= max) {
    return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' });
  }
  hits.push(now);
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of windows) {
    if (!hits.length) windows.delete(key);
  }
}, 5 * 60_000);

module.exports = { apiLimiter, authLimiter };
