// Build a single static CSS for the xwhiz.com static site.
// Scans all HTML (and the HTML-generating build scripts) under the project root
// (excluding wassil/forex-assistant/node_modules), collects every class token
// (static attributes + classes built in JS strings), and compiles them with
// Tailwind 3 using the same theme config the pages relied on from the Play CDN.
// Custom inline <style> rules used across pages are preserved verbatim.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let tailwind, postcss;
for (const base of [path.join(ROOT, 'node_modules'), path.join(ROOT, '..', 'wassil', 'node_modules')]) {
  try { tailwind = require(path.join(base, 'tailwindcss')); postcss = require(path.join(base, 'postcss')); break; } catch (e) { /* try next */ }
}
if (!tailwind || !postcss) {
  console.error('tailwindcss/postcss not found. Run: npm install (root package.json).');
  process.exit(1);
}
const OUT = path.join(ROOT, 'site.css');

function walk(dir, acc = [], exts) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'wassil' || e.name === 'forex-assistant' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc, exts);
    else if (exts.some(x => e.name.endsWith(x))) acc.push(full);
  }
  return acc;
}

const htmlFiles = [];
const jsFiles = walk(ROOT, [], ['.js']);
for (const sub of ['football', 'news', 'predictions', 'fr', 'ar']) walk(path.join(ROOT, sub), htmlFiles, ['.html']);
for (const f of ['index.html', '404.html', 'live.html', 'search.html', 'predictor.html', 'seo-checkup.html', 'news.html']) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) htmlFiles.push(p);
}
// scripts dir already covered by jsFiles walk from ROOT

// ---------- 1. collect class tokens ----------
const classSet = new Set();
const styles = new Map(); // file -> inline <style>
let configSource = null;

const CLASS_RE = /class\s*=\s*["'`]([^"'`]+)["'`]/g;
const STYLE_RE = /<style>([\s\S]*?)<\/style>/g;
const CONFIG_RE = /tailwind\.config\s*=\s*(\{[\s\S]*?\})\s*(?:;)?\s*<\/script>/;

function addTokens(str) {
  for (const tok of str.split(/\s+/)) {
    if (!tok) continue;
    // strip obvious JS expression leftovers
    if (/\$\{/.test(tok)) continue;
    if (/[{}<>]/.test(tok)) continue;
    const clean = tok.replace(/'/g, '').replace(/"/g, '').replace(/`/g, '').replace(/\+/g, '');
    if (!clean || !/\S/.test(clean)) continue;
    if (clean.includes('$') && !clean.includes('-')) continue;
    classSet.add(clean);
  }
}

for (const file of htmlFiles) {
  const c = fs.readFileSync(file, 'utf8');
  for (const m of c.matchAll(CLASS_RE)) addTokens(m[1]);
  for (const m of c.matchAll(STYLE_RE)) styles.set(file, m[1]);
  if (!configSource) {
    const cm = c.match(CONFIG_RE);
    if (cm) configSource = cm[1];
  }
}
// HTML templates living inside generator scripts
for (const file of jsFiles) {
  if (file.includes('node_modules')) continue;
  const c = fs.readFileSync(file, 'utf8');
  for (const m of c.matchAll(CLASS_RE)) addTokens(m[1]);
}

// Remove obviously-invalid leftover tokens (bare/empty, or template leftovers)
const valid = Array.from(classSet).filter(t => {
  if (!t) return false;
  if (t.startsWith(':') || t.endsWith(':')) return false;
  if (t === '[' || t === ']' || t === '0') return false;
  return true;
});

const allClasses = Array.from(new Set(valid));
fs.writeFileSync(path.join(ROOT, '.build-classes.txt'), allClasses.sort().join('\n'));

console.log('HTML files:', htmlFiles.length);
console.log('JS files scanned:', jsFiles.length);
console.log('Class tokens:', allClasses.length);
const variants = allClasses.filter(c => c.includes(':'));
console.log('Tokens with variants (sample):', variants.slice(0, 25).join(' '));

// ---------- 2. virtual content file for Tailwind scanning ----------
// Feed all tokens as a blob of text; Tailwind's extractor will pick candidates,
// generating responsive/hover/arbitrary variants automatically.
const CSS_DIR = path.join(__dirname, '..', '.cache-xwhiz');
if (!fs.existsSync(CSS_DIR)) fs.mkdirSync(CSS_DIR);
const scanFile = path.join(CSS_DIR, 'classes.txt');
fs.writeFileSync(scanFile, allClasses.join(' ') + ' placeholder');

// theme config (union of the inline page configs)
const theme = { extend: { fontFamily: { sans: ['Inter', 'sans-serif'] }, colors: { brand: {} } } };
if (configSource) {
  const brandM = configSource.match(/brand\s*:\s*\{([\s\S]*?)\}/);
  if (brandM) {
    const re = /(\d+)\s*:\s*['"]([^'"]+)['"]/g;
    let mm;
    while ((mm = re.exec(brandM[1]))) theme.extend.colors.brand[mm[1]] = mm[2];
  }
  console.log('Brand palette:', JSON.stringify(theme.extend.colors.brand));
}

const tailwindConfig = {
  content: { files: [scanFile], extract: { default: (raw) => raw.split(/\s+/) } },
  theme,
  plugins: [],
};

const inputCss = `@tailwind base;
@tailwind components;
@tailwind utilities;
`;

const processCss = postcss([tailwind(tailwindConfig)]);

processCss.process(inputCss, { from: undefined }).then(result => {
  let css = result.css;

  // ---------- 3. append custom inline styles (dedup) ----------
  const seen = new Set();
  const extra = [];
  for (const [file, style] of styles.entries()) {
    const key = style.replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);
    extra.push(`/* ---- ${path.relative(ROOT, file)} ---- */\n${style}\n`);
  }
  css += '\n/* ===== XWhiz page-specific custom styles ===== */\n' + extra.join('\n');

  fs.writeFileSync(OUT, css);
  console.log('Wrote', OUT, fs.statSync(OUT).size, 'bytes');
}).catch(e => {
  console.error('Tailwind compile failed:', e.message);
  process.exit(1);
});