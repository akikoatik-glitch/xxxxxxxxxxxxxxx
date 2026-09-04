'use strict';

// Shared test bootstrap: point the app at an isolated throwaway database
// directory BEFORE any server module (which reads DATA_DIR at require time) is
// loaded. node --test runs each test file in its own process, so this is safe.

const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devisalg-test-'));

process.env.DATA_DIR = dir;
process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify-token';
process.env.JWT_SECRET = 'test-secret';

module.exports = { dir };
