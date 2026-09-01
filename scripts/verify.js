// Verification harness for the generated xwhiz.com site (run after scripts/sitegen.js)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://xwhiz.com';
const LOCALES = ['en', 'fr', 'ar'];

let errors = 0, warnings = 0, checks = 0;
const err = (m, f) => { errors++; console.log('ERR  ' + (f ? f + ' — ' : '') + m); };
const warn = (m, f) => { warnings++; console.log('WARN ' + (f ? f + ' — ' : '') + m); };
const ok = msg => { checks++; };

function allHtml() {
  const out = [];
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'wassil' || e.name === 'forex-assistant' || e.name === 'node_modules' || e.name === '.git') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'fr' || e.name === 'ar' || e.name === 'football' || e.name === 'predictions' || e.name === 'news') walk(full);
      } else if (e.name.endsWith('.html')) out.push(full);
    }
  };
  for (const f of ['index.html', '404.html', 'live.html', 'predictor.html', 'search.html', 'seo-checkup.html']) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) out.push(p);
  }
  walk(ROOT);
  return out;
}

function urlToFile(u) {
  if (!u.startsWith('/')) return null;
  const p = u.split('#')[0].split('?')[0];
  let full = path.join(ROOT, p);
  try {
    if (fs.statSync(full).isDirectory()) full = path.join(full, 'index.html');
    return fs.existsSync(full) ? full : null;
  } catch (e) { return null; }
}

// ---------- 1. internal links ----------
console.log('== 1. Internal link integrity ==');
const htmlFiles = allHtml();
for (const f of htmlFiles) {
  const c0 = fs.readFileSync(f, 'utf8');
  const c = c0.replace(/<script[\s\S]*?<\/script>/gi, '');
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const m = f.match(/[\\/](fr|ar)\//) ? (f.match(/[\\/](fr|ar)\//)[1]) : 'en';
  const re = /(?:href|src)="([^"]+)"/g;
  let mm;
  while ((mm = re.exec(c))) {
    const u = mm[1];
    if (!u || u === '#' || u.startsWith('http') || u.startsWith('mailto:') || u.startsWith('tel:') || u.startsWith('data:') || u.startsWith('javascript:')) continue;
    if (u.startsWith('#') || u.startsWith('/')) { /* ok path */ } else { warn('relative URL inside locale page: ' + u, rel); continue; }
    if (u.startsWith('#')) continue;
    if (u.startsWith('/') && m !== 'en' && !u.startsWith('/' + m + '/') && u !== '/site.css' && u !== '/rtl.css' && u !== '/apple-touch-icon.png' && u !== '/og-image.png' && u !== '/logo.png' && u !== '/sitemap.xml' && u !== '/robots.txt') {
      // locale pages linking to absolute /en paths is allowed for shared assets only;
      // cross-locale page links are OK for lang switcher on purpose. Skip asset URLs.
    }
    const target = urlToFile(u.split('#')[0]);
    if (!target) err('broken link -> ' + u, rel);
  }
}

// ---------- 2. per-page head checks ----------
console.log('== 2. Head: lang/dir/canonical/hreflang/og ==');
for (const f of htmlFiles) {
  const c = fs.readFileSync(f, 'utf8');
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const locale = f.match(/[\\/](fr|ar)[\\/]/) ? f.match(/[\\/](fr|ar)[\\/]/)[1] : 'en';
  if (rel === 'seo-checkup.html' || rel === 'site.css') continue;
  const lang = c.match(/<html lang="([^"]+)" dir="([^"]+)">/);
  if (!lang) { err('no lang/dir on <html>', rel); continue; }
  if (locale === 'ar' && (lang[1] !== 'ar' || lang[2] !== 'rtl')) err('ar page must be lang=ar dir=rtl', rel);
  if (locale === 'fr' && lang[1] !== 'fr') err('fr page must be lang=fr', rel);
  if (locale === 'en' && lang[2] !== 'ltr') warn('en page dir not ltr', rel);
  if (!c.includes('rel="canonical"')) err('missing canonical', rel);
  if (!c.includes('hreflang="x-default"')) err('missing hreflang x-default', rel);
  for (const ll of LOCALES) {
    if (locale === ll) { if (!c.includes(`hreflang="${ll}"`)) err('missing self hreflang ' + ll, rel); }
    else if (!c.includes(`hreflang="${ll}"`)) err('missing hreflang ' + ll, rel);
  }
  if (!c.includes('og:image')) err('missing og:image', rel);
  if (!c.includes('twitter:image')) err('missing twitter:image', rel);
  if (locale === 'ar' && !c.includes('/rtl.css')) err('ar page missing rtl.css', rel);
}

// ---------- 3. JSON-LD sanity ----------
console.log('== 3. JSON-LD valid JSON ==');
for (const f of htmlFiles) {
  const c = fs.readFileSync(f, 'utf8');
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  if (rel === 'seo-checkup.html') continue;
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let mm, n = 0;
  while ((mm = re.exec(c))) { try { JSON.parse(mm[1]); n++; } catch (e) { err('invalid JSON-LD: ' + e.message, rel); } }
  if (n === 0) warn('no JSON-LD on page', rel);
}

// ---------- 4. sitemap checks ----------
console.log('== 4. Sitemap ==');
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const anchors = locs.filter(l => l.includes('#'));
if (anchors.length) err('anchor URLs in sitemap: ' + anchors.join(', '));
for (const l of locs) {
  const p = l.replace(SITE, '').split('?')[0];
  const file = urlToFile(p);
  if (!file) err('sitemap loc has no file: ' + l);
}
for (const l of locs) {
  const block = sitemap.split('<url>').find(b => b.includes(l));
  if (!block) continue;
  const alts = [...block.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map(a => a[1]);
  for (const ll of ['en', 'fr', 'ar', 'x-default']) {
    if (!alts.includes(ll)) err('sitemap url missing alternate hreflang ' + ll + ' for ' + l);
  }
  const nloc = block.match(/<loc>([^<]+)<\/loc>/g).length;
  if (nloc !== 1) err('multiple <loc> in one <url> block for ' + l);
}

// ---------- 5. counts expectations ----------
console.log('== 5. Counts ==');
const enPred = fs.readdirSync(path.join(ROOT, 'predictions')).filter(x => x.endsWith('.html')).length;
if (enPred < 3) err('too few en prediction pages: ' + enPred);
const frHtml = fs.readdirSync(path.join(ROOT, 'fr')).length;
const arHtml = fs.readdirSync(path.join(ROOT, 'ar')).length;
if (frHtml < 3) err('fr has only ' + frHtml + ' top-level pages');
if (arHtml < 3) err('ar has only ' + arHtml + ' top-level pages');
for (const l of ['fr', 'ar']) {
  for (const f of ['index.html', 'live/index.html', 'predictor/index.html', 'search.html', '404.html']) {
    const p = path.join(ROOT, l, f);
    if (!fs.existsSync(p)) err('missing ' + l + '/' + f);
  }
}

// ---------- 6. robots + data files ----------
console.log('== 6. robots/data ==');
const robots = fs.existsSync(path.join(ROOT, 'robots.txt')) ? fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8') : '';
if (!robots.includes('Sitemap: ' + SITE + '/sitemap.xml')) err('robots missing sitemap line');
if (!fs.existsSync(path.join(ROOT, 'logo.png'))) err('missing logo.png');
if (!fs.existsSync(path.join(ROOT, 'og-image.png'))) err('missing og-image.png');
if (!fs.existsSync(path.join(ROOT, 'apple-touch-icon.png'))) err('missing apple-touch-icon.png');
if (!fs.existsSync(path.join(ROOT, 'rtl.css'))) err('missing rtl.css');
if (!fs.existsSync(path.join(ROOT, 'search-index.json'))) err('missing en search-index.json');
if (!fs.existsSync(path.join(ROOT, 'fr/search-index.json'))) err('missing fr search-index.json');
if (!fs.existsSync(path.join(ROOT, 'ar/search-index.json'))) err('missing ar search-index.json');

// ---------- 7. no leaked API key in live page ----------
console.log('== 7. Secrets ==');
for (const f of allHtml()) {
  const c = fs.readFileSync(f, 'utf8');
  if (c.includes('fb11dd66ed834a41a0f7841c569d5057')) err('hardcoded API key leaked', path.relative(ROOT, f));
  if (c.includes('localhost')) warn('"localhost" reference', path.relative(ROOT, f));
}

console.log(`\n==== ${checks + 0} checks, ${errors} ERRORS, ${warnings} warnings ====`);
process.exit(errors ? 1 : 0);