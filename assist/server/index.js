if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
}
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const { db } = require('./db');
const { authMiddleware } = require('./auth');
const { apiLimiter } = require('./middleware/ratelimit');

const app = express();
const PORT = process.env.PORT || 4000;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const VIEWS_DIR = path.resolve(__dirname, '..', 'views');
const DATA_DIR = path.resolve(__dirname, '..', 'data');

app.use('/static', express.static(PUBLIC_DIR));
app.use('/data', express.static(DATA_DIR));
app.use('/uploads', express.static(path.join(DATA_DIR, 'logos')));

// ── Public routes ──
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// ── Webhook routes (public, no auth) ──
const webhookRoutes = require('./routes/webhook');
app.use('/webhook', webhookRoutes);
// ── Health (public) ──
app.get('/api/health', (_req, res) => res.json({ ok: true, time: Date.now() }));
app.get('/healthz', (_req, res) => res.send('ok'));

// ── Protected API ──
app.use('/api', apiLimiter, authMiddleware);
app.use('/api/business', require('./routes/business'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/products', require('./routes/products'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/ai-settings', require('./routes/ai-settings'));
app.use('/api/integrations', require('./routes/integrations'));
app.use('/api/notifications', require('./routes/notifications'));

// ── SPA: /app/* serves dashboard shell ──
const APP_RE = /^\/app(\/.*)?$/;
app.get(APP_RE, (_req, res) => res.sendFile(path.join(VIEWS_DIR, 'app.html')));
app.get('/app', (_req, res) => res.redirect('/app/dashboard'));

// ── Auth pages ──
app.get('/login', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'login.html')));
app.get('/register', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'register.html')));

// ── Static files ──
app.use(express.static(PUBLIC_DIR));

// ── 404 ──
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Error handler ──
app.use((err, _req, res, _next) => {
  console.error('[server]', err.message, '\n', err.stack);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Erreur interne.' });
});

app.listen(PORT, () => {
  console.log(`\n  ╔═══════════════════════════════════════╗`);
  console.log(`  ║  Assist. server running on port ${PORT}   ║`);
  console.log(`  ║  http://localhost:${PORT}               ║`);
  console.log(`  ╚═══════════════════════════════════════╝\n`);
});

module.exports = app;
