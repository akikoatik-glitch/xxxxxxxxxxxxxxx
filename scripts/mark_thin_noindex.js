// Mark thin team and league pages with noindex.
// A team/league page is "thin" if it has:
//   - no prediction links to /predictions/...
//   - no upcoming fixtures
//   - no finished fixtures
// AND the body only contains the "noMatches" placeholder.
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let marked = 0;
const dirs = [
  { root: path.join(ROOT, 'football/teams'), lang: 'en' },
  { root: path.join(ROOT, 'football/leagues'), lang: 'en' },
  { root: path.join(ROOT, 'fr/football/teams'), lang: 'fr' },
  { root: path.join(ROOT, 'fr/football/leagues'), lang: 'fr' },
  { root: path.join(ROOT, 'ar/football/teams'), lang: 'ar' },
  { root: path.join(ROOT, 'ar/football/leagues'), lang: 'ar' },
];

function processFile(f) {
  let html = fs.readFileSync(f, 'utf8');
  if (html.includes('content="noindex')) return; // already noindex
  // Look for body content
  const m = html.match(/<main[\s\S]*?<\/main>/);
  if (!m) return;
  const body = m[0];
  const hasPred = /\/predictions\/[a-z0-9-]+-vs-[a-z0-9-]+-prediction\.html/.test(body);
  const noMatches = body.includes('No matches available') || body.includes('Aucun match disponible') || body.includes('لا توجد مباريات');
  // Count "no matches" occurrences - thin = all three sections show "no matches"
  const noMatchesCount = (body.match(/No matches available|Aucun match disponible|لا توجد مباريات/g) || []).length;
  const isThin = !hasPred && noMatchesCount >= 2;
  if (!isThin) return;

  // Insert noindex meta. Use first occurrence to preserve order (must come BEFORE canonical usually, but robots is fine here).
  if (/<meta name="robots" content="index, follow/i.test(html)) {
    html = html.replace(/<meta name="robots" content="index, follow, max-image-preview:large">/g, '<meta name="robots" content="noindex, follow">');
  } else if (!/<meta name="robots"/.test(html)) {
    html = html.replace(/<meta charset="UTF-8">\s*<meta name="viewport"[^>]+>/, m => m + '\n<meta name="robots" content="noindex, follow">');
  }
  fs.writeFileSync(f, html);
  marked++;
}

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name === 'index.html') processFile(full);
  }
}

for (const d of dirs) {
  if (fs.existsSync(d.root)) walk(d.root);
}
console.log(`Marked ${marked} thin team/league pages as noindex.`);
