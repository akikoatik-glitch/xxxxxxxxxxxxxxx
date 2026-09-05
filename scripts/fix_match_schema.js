// Fix misleading SportsEvent organizer on existing prediction pages.
// The homepages had XWhiz as organizer; that is incorrect. XWhiz is a contributor,
// the actual organizer is the competition itself.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://xwhiz.com';

const LEAGUE_ORG = {
  'Premier League': 'https://www.premierleague.com/',
  'La Liga': 'https://www.laliga.com/',
  'Bundesliga': 'https://www.bundesliga.com/',
  'Serie A': 'https://www.legaseriea.it/',
  'Ligue 1': 'https://www.ligue1.com/',
  'Eredivisie': 'https://www.eredivisie.nl/',
  'Primeira Liga': 'https://www.ligaportugal.pt/',
  'UEFA Champions League': 'https://www.uefa.com/uefachampionsleague/',
  'UEFA Europa League': 'https://www.uefa.com/uefaeuropaleague/',
  'Championship': 'https://www.efl.com/',
};

const dirs = [
  path.join(ROOT, 'predictions'),
  path.join(ROOT, 'fr', 'predictions'),
  path.join(ROOT, 'ar', 'predictions'),
];

let updated = 0;
for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.html')) continue;
    const file = path.join(dir, f);
    let html = fs.readFileSync(file, 'utf8');
    let changed = false;

    // Find SportsEvent JSON-LD blocks
    const re = /<script type="application\/ld\+json">(\{[^<]*?"@type":"SportsEvent"[^<]*?\})<\/script>/g;
    html = html.replace(re, (m, block) => {
      try {
        const obj = JSON.parse(block);
        if (!obj.location || !obj.location.name) return m;
        const lg = obj.location.name;
        const org = LEAGUE_ORG[lg];
        // Replace organizer XWhiz -> the league
        if (org) {
          obj.organizer = { '@type': 'Organization', name: lg, url: org };
          obj.contributor = { '@type': 'Organization', name: 'XWhiz', url: SITE };
          changed = true;
        } else if (obj.organizer && obj.organizer.name === 'XWhiz') {
          // No known league -> drop organizer entirely (avoid misleading)
          delete obj.organizer;
          obj.contributor = { '@type': 'Organization', name: 'XWhiz', url: SITE };
          changed = true;
        }
        return '<script type="application/ld+json">' + JSON.stringify(obj) + '</script>';
      } catch (e) { return m; }
    });

    if (changed) {
      fs.writeFileSync(file, html);
      updated++;
    }
  }
}
console.log(`Updated SportsEvent organizer on ${updated} prediction pages.`);
