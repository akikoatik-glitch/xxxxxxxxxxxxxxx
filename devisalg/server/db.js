const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'devisalg.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS businesses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE,
  description     TEXT DEFAULT '',
  logo_path       TEXT,
  address         TEXT DEFAULT '',
  phone           TEXT DEFAULT '',
  email           TEXT DEFAULT '',
  opening_hours   TEXT DEFAULT '',
  delivery_info   TEXT DEFAULT '',
  payment_methods TEXT DEFAULT '',
  plan            TEXT NOT NULL DEFAULT 'free',
  currency        TEXT NOT NULL DEFAULT 'DZD',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS customers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  phone           TEXT DEFAULT '',
  email           TEXT DEFAULT '',
  address         TEXT DEFAULT '',
  notes           TEXT DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT DEFAULT '',
  unit_price      REAL NOT NULL DEFAULT 0,
  category        TEXT DEFAULT 'product',
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);

CREATE TABLE IF NOT EXISTS services (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT DEFAULT '',
  unit_price      REAL NOT NULL DEFAULT 0,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_services_business ON services(business_id);

CREATE TABLE IF NOT EXISTS conversations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL DEFAULT 'whatsapp',
  status          TEXT NOT NULL DEFAULT 'active',  -- active | paused | closed
  ai_enabled      INTEGER NOT NULL DEFAULT 1,
  meta            TEXT DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_conversations_business ON conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender          TEXT NOT NULL,                    -- customer | ai | owner | system
  body            TEXT NOT NULL,
  payload         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

CREATE TABLE IF NOT EXISTS devis (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  number          TEXT NOT NULL,
  customer_name   TEXT DEFAULT '',
  customer_phone  TEXT DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'draft',    -- draft | sent | accepted | declined | converted
  subtotal        REAL NOT NULL DEFAULT 0,
  discount        REAL NOT NULL DEFAULT 0,
  tax             REAL NOT NULL DEFAULT 0,
  tax_rate        REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL DEFAULT 0,
  notes           TEXT DEFAULT '',
  validity_days   INTEGER NOT NULL DEFAULT 14,
  pdf_path        TEXT,
  sent_via        TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_devis_business ON devis(business_id);
CREATE INDEX IF NOT EXISTS idx_devis_customer ON devis(customer_id);

CREATE TABLE IF NOT EXISTS devis_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  devis_id        INTEGER NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT DEFAULT '',
  quantity        REAL NOT NULL DEFAULT 1,
  unit_price      REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_devis_items_devis ON devis_items(devis_id);

CREATE TABLE IF NOT EXISTS invoices (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  devis_id        INTEGER REFERENCES devis(id) ON DELETE SET NULL,
  customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  number          TEXT NOT NULL,
  customer_name   TEXT DEFAULT '',
  customer_phone  TEXT DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'draft',    -- draft | sent | paid | unpaid | overdue | cancelled
  subtotal        REAL NOT NULL DEFAULT 0,
  discount        REAL NOT NULL DEFAULT 0,
  tax             REAL NOT NULL DEFAULT 0,
  tax_rate        REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL DEFAULT 0,
  paid_amount     REAL NOT NULL DEFAULT 0,
  payment_method  TEXT,
  payment_date    TEXT,
  due_date        TEXT,
  notes           TEXT DEFAULT '',
  pdf_path        TEXT,
  sent_via        TEXT,
  reminders_enabled INTEGER NOT NULL DEFAULT 0,
  last_reminder_at  TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invoices_business ON invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE TABLE IF NOT EXISTS invoice_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id      INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT DEFAULT '',
  quantity        REAL NOT NULL DEFAULT 1,
  unit_price      REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

CREATE TABLE IF NOT EXISTS payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id      INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount          REAL NOT NULL,
  method          TEXT DEFAULT '',
  paid_at         TEXT DEFAULT (datetime('now')),
  notes           TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);

CREATE TABLE IF NOT EXISTS ai_settings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  enabled         INTEGER NOT NULL DEFAULT 0,
  personality     TEXT DEFAULT '',
  language        TEXT NOT NULL DEFAULT 'darija_fr',
  eskalate_rules  TEXT DEFAULT '{}',
  faqs            TEXT DEFAULT '[]',
  greeting        TEXT DEFAULT '',
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (business_id)
);

CREATE TABLE IF NOT EXISTS integrations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,                    -- whatsapp | llm
  config          TEXT DEFAULT '{}',
  connected       INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (business_id, type)
);

CREATE TABLE IF NOT EXISTS notifications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  title           TEXT DEFAULT '',
  body            TEXT DEFAULT '',
  read            INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_business ON notifications(business_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id     INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  actor           TEXT DEFAULT '',
  action          TEXT NOT NULL,
  entity          TEXT,
  entity_id       INTEGER,
  details         TEXT DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_business ON audit_logs(business_id);
`;

db.exec(SCHEMA);

function audit(businessId, action, actor, entity, entityId, details) {
  try {
    db.prepare(
      `INSERT INTO audit_logs (business_id, actor, action, entity, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(businessId ?? null, actor ?? 'system', action, entity ?? null, entityId ?? null, details ?? '');
  } catch (e) {
    console.error('audit failed', e.message);
  }
}

function nextNumber(prefix, table, businessId) {
  const row = db.prepare(
    `SELECT COUNT(*) AS c FROM ${table} WHERE business_id = ?`
  ).get(businessId);
  const n = (row.c + 1).toString().padStart(4, '0');
  return `${prefix}-${new Date().getFullYear()}-${n}`;
}

module.exports = { db, audit, nextNumber, DATA_DIR, DB_PATH };
