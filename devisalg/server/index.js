if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
}
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs');

const { db } = require('./db');
const jobs = require('./services/jobs');
const reminders = require('./services/reminders');
require('./services/registerJobs');

// ---- Routes ----
const authRoutes = require('./routes/auth');
const businessRoutes = require('./routes/business');
const customerRoutes = require('./routes/customers');
const conversationRoutes = require('./routes/conversations');
const devisRoutes = require('./routes/devis');
const invoiceRoutes = require('./routes/invoices');
const aiRoutes = require('./routes/ai');
const integrationsRoutes = require('./routes/integrations');
const dashboardRoutes = require('./routes/dashboard');
const notificationRoutes = require('./routes/notifications');
const planRoutes = require('./routes/plan');
const webhookRoutes = require('./routes/webhook');

const { apiLimiter } = require('./middleware/ratelimit');

const app = express();
const PORT = process.env.PORT || 4000;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static frontend + uploaded media/logos
app.use('/static', express.static(path.resolve(__dirname, '..', 'public')));
app.use('/data', express.static(path.resolve(__dirname, '..', 'data')));
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'data', 'logos')));

// Serve the three.js module (for the landing 3D scene)
try {
  const threeEntry = require.resolve('three'); // e.g. .../three/build/three.cjs
  const threeBuildDir = path.dirname(threeEntry);
  app.use('/static/three', express.static(threeBuildDir));
} catch (e) {
  console.warn('three not found; landing 3D scene disabled:', e.message);
}

// ---- API routes ----
app.use('/api/auth', authRoutes);
app.use('/api', apiLimiter);
app.use('/api/business', businessRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/devis', devisRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/plan', planRoutes);

// Public WhatsApp webhook (no auth)
app.use('/whatsapp', webhookRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, jobs: jobs.stats(), time: Date.now() }));
app.get('/healthz', (req, res) => res.send('ok'));

// ---- Frontend (SPA shell) ----
const VIEWS = path.resolve(__dirname, '..', 'views');
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
// Express 5: use a regex path for the SPA catch-all (no bare '*' wildcard)
const APP_RE = /^\/app(\/.*)?$/;
app.get(APP_RE, (req, res) => {
  res.sendFile(path.join(VIEWS, 'app.html'));
});
app.get('/app', (req, res) => res.redirect('/app/dashboard'));

// Landing / public pages
app.get('/login', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'register.html')));
app.use(express.static(PUBLIC_DIR));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message, '\n', err.stack);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Erreur interne. Réessayez.' });
});

// Sync webhook registry from integrations
integrationsRoutes.syncVerifyTokens();
webhookRoutes.setRegistry(integrationsRoutes.getVerifyRegistry());

// Start reminder scheduler (Pro plans only checked inside)
const scheduler = reminders.startScheduler({ intervalMs: Number(process.env.REMINDER_INTERVAL_MS) || 60 * 60 * 1000 });

app.listen(PORT, () => {
  console.log(`DevisAlg server running on http://localhost:${PORT}`);
});

module.exports = app;

// Keep references to avoid GC
void scheduler; void db;
