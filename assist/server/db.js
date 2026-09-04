const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'pdfs'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'logos'), { recursive: true });

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(DATA_DIR, 'assist.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
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
  delivery_wilayas TEXT DEFAULT '[]',
  payment_methods TEXT DEFAULT '[]',
  currency        TEXT NOT NULL DEFAULT 'DZD',
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS platforms (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK(type IN ('whatsapp','instagram','facebook','telegram')),
  name            TEXT DEFAULT '',
  config          TEXT DEFAULT '{}',
  connected       INTEGER NOT NULL DEFAULT 0,
  last_sync_at    TEXT,
  message_count   INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (business_id, type)
);
CREATE INDEX IF NOT EXISTS idx_platforms_business ON platforms(business_id);

CREATE TABLE IF NOT EXISTS customers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            TEXT DEFAULT '',
  phone           TEXT DEFAULT '',
  email           TEXT DEFAULT '',
  address         TEXT DEFAULT '',
  wilaya          TEXT DEFAULT '',
  commune         TEXT DEFAULT '',
  notes           TEXT DEFAULT '',
  platform        TEXT DEFAULT '',
  platform_id     TEXT DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (business_id, platform, platform_id)
);
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(business_id, phone);

CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT DEFAULT '',
  unit_price      REAL NOT NULL DEFAULT 0,
  category        TEXT DEFAULT 'general',
  stock           INTEGER NOT NULL DEFAULT -1,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);

CREATE TABLE IF NOT EXISTS conversations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  platform        TEXT NOT NULL DEFAULT 'whatsapp',
  platform_conv_id TEXT DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'active',
  ai_enabled      INTEGER NOT NULL DEFAULT 1,
  ai_mode         INTEGER NOT NULL DEFAULT 1,
  order_id        INTEGER,
  context         TEXT DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_conversations_business ON conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(business_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_platform ON conversations(business_id, platform);
CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender          TEXT NOT NULL CHECK(sender IN ('customer','ai','owner','system')),
  body            TEXT NOT NULL,
  platform_msg_id TEXT,
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  number          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'new',
  customer_name   TEXT DEFAULT '',
  customer_phone  TEXT DEFAULT '',
  customer_address TEXT DEFAULT '',
  customer_wilaya TEXT DEFAULT '',
  customer_commune TEXT DEFAULT '',
  products_json   TEXT DEFAULT '[]',
  subtotal        REAL NOT NULL DEFAULT 0,
  delivery_cost   REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL DEFAULT 0,
  payment_method  TEXT DEFAULT '',
  delivery_method TEXT DEFAULT 'home',
  notes           TEXT DEFAULT '',
  pdf_path        TEXT,
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_orders_business ON orders(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(business_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(business_id, number);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);

CREATE TABLE IF NOT EXISTS ai_settings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  enabled         INTEGER NOT NULL DEFAULT 1,
  personality     TEXT DEFAULT '',
  greeting        TEXT DEFAULT '',
  language        TEXT NOT NULL DEFAULT 'auto',
  escalation_keywords TEXT DEFAULT '[]',
  custom_instructions TEXT DEFAULT '',
  faqs            TEXT DEFAULT '[]',
  updated_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (business_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  title           TEXT DEFAULT '',
  body            TEXT DEFAULT '',
  read            INTEGER NOT NULL DEFAULT 0,
  meta            TEXT DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_notifications_business ON notifications(business_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(business_id, read);

CREATE TABLE IF NOT EXISTS audit_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id     INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  actor           TEXT DEFAULT 'system',
  action          TEXT NOT NULL,
  entity          TEXT,
  entity_id       INTEGER,
  details         TEXT DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
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
    console.error('[audit]', e.message);
  }
}

function notify(businessId, type, title, body, meta) {
  try {
    db.prepare(
      `INSERT INTO notifications (business_id, type, title, body, meta)
       VALUES (?, ?, ?, ?, ?)`
    ).run(businessId, type, title, body, meta ? JSON.stringify(meta) : '{}');
  } catch (e) {
    console.error('[notify]', e.message);
  }
}

function nextNumber(prefix, table, businessId) {
  const row = db.prepare(
    `SELECT COUNT(*) AS c FROM ${table} WHERE business_id = ?`
  ).get(businessId);
  const n = (row.c + 1).toString().padStart(4, '0');
  return `${prefix}-${new Date().getFullYear()}-${n}`;
}

module.exports = { db, audit, notify, nextNumber, DATA_DIR, DB_PATH };
