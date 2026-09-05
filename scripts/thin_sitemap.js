// Regenerate a thinner sitemap from the existing one, using only the
// pages that are NOT auto-generated thin team/league pages.
// This keeps the same hreflang reciprocity and structure but drops URLs
// for teams/leagues that have no predictions, fixtures or results.
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function exists(p) {
  try { return fs.statSync(p).isFile() || fs.statSync(p).isDirectory(); } catch (e) { return false; }
}
function findFile(urlPath) {
  let full = path.join(ROOT, urlPath);
  try {
    if (fs.statSync(full).isDirectory()) full = path.join(full, 'index.html');
  } catch (e) { return null; }
  return fs.existsSync(full) ? full : null;
}
function fileIsThinNoindex(filePath) {
  try {
    const html = fs.readFileSync(filePath, 'utf8');
    // Match "<meta name="robots" content="noindex, follow">" in the head
    return /<meta\s+name=["']robots["']\s+content=["']noindex[^"']*["']/i.test(html);
  } catch (e) { return false; }
}

const sitemapPath = path.join(ROOT, 'sitemap.xml');
let sitemap = fs.readFileSync(sitemapPath, 'utf8');

// Split into <url> blocks
const blocks = sitemap.split(/<url>/).slice(1).map(b => '<url>' + b.split('</url>')[0] + '</url>');

const kept = [];
const dropped = [];
for (const block of blocks) {
  const loc = (block.match(/<loc>([^<]+)<\/loc>/) || [])[1] || '';
  if (!loc) continue;
  const urlPath = loc.replace('https://xwhiz.com', '');
  const file = findFile(urlPath);
  if (!file) {
    dropped.push({ loc, reason: 'no file' });
    continue;
  }
  // Drop pages that are marked noindex (auto-generated thin team/league pages).
  if (fileIsThinNoindex(file)) {
    dropped.push({ loc, reason: 'noindex (thin)' });
    continue;
  }
  kept.push(block);
}

const header = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`;
const footer = `\n</urlset>\n`;
const newSitemap = header + '\n' + kept.join('\n') + footer;

fs.writeFileSync(sitemapPath, newSitemap);
console.log(`Sitemap regenerated: ${kept.length} kept, ${dropped.length} dropped (thin/noindex).`);

// Group drop reasons
const reasons = {};
for (const d of dropped) {
  reasons[d.reason] = (reasons[d.reason] || 0) + 1;
}
for (const r in reasons) console.log(`  ${r}: ${reasons[r]}`);
