// Cross-check: every class token used in every xwhiz.com HTML file must have a
// matching CSS selector in site.css (allowing for variant + arbitrary escaping).
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'site.css'), 'utf8');

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'wassil' || e.name === 'forex-assistant' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

// Does css contain a selector for this class token? (uses exact CSS-escaped form)
function hasSelector(tok) {
  const cssForm = tok.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/\./g, '\\.').replace(/\//g, '\\/').replace(/([\[\]])/g, '\\$1');
  return css.indexOf('.' + cssForm) !== -1;
}

const files = walk(ROOT);
const missing = new Map();
let total = 0;

const CLASS_RE = /class\s*=\s*["'`]([^"'`]+)["'`]/g;
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  for (const m of c.matchAll(CLASS_RE)) {
    for (const tok of m[1].split(/\s+/)) {
      if (!tok) continue;
      if (/\$\{/.test(tok) || /[{}]/.test(tok)) continue;
      total++;
      // skip dynamic fragments that are clearly JS
      if (tok.includes('m.') || tok.includes('+')) continue;
      if (!hasSelector(tok)) {
        if (!missing.has(tok)) missing.set(tok, []);
        missing.get(tok).push(path.relative(ROOT, f));
      }
    }
  }
}

console.log('Classes checked:', total);
console.log('Unique tokens missing a selector:', missing.size);
for (const [tok, files_] of missing) {
  console.log(`  ${tok}   <- ${Array.from(new Set(files_)).slice(0,3).join(', ')}${files_.length > 3 ? ' …' : ''}`);
}