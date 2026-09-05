#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const isPastKickoff = m => {
  if (!m || !m.utcDate) return false;
  const diff = Date.now() - new Date(m.utcDate).getTime();
  return diff > 3 * 3600000;
};

const files = ['football/today.json', 'football/tomorrow.json', 'football/upcoming.json', 'football/live.json'];
let totalDropped = 0;

for (const f of files) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!Array.isArray(data.matches)) continue;
  const before = data.matches.length;
  // Keep finished matches in yesterday.json only.
  // For today/tomorrow/upcoming/live — drop past-kickoff matches entirely.
  if (f.includes('today') || f.includes('tomorrow') || f.includes('upcoming') || f.includes('live')) {
    data.matches = data.matches.filter(m => !isPastKickoff(m));
  }
  const after = data.matches.length;
  if (before !== after) {
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    console.log(`${f}: dropped ${before - after} past-kickoff matches (was ${before}, now ${after})`);
    totalDropped += before - after;
  }
}
console.log(totalDropped ? `Total cleaned: ${totalDropped} stale matches removed.` : 'No stale matches found.');
