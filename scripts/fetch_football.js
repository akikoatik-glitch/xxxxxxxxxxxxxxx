// Fetches real football data from football-data.org (free tier, real fixtures only).
// Outputs:
//   football/today.json, tomorrow.json, yesterday.json, upcoming.json, results.json, fixtures.json
//   football/live.json          -> consumed by /live.html (matches + standings + scorers)
// Predictions.json is owned by generate-predictions.js (runs after this in the workflow).
//
// Prediction upgrade (v3):
//   - Real league standings (goals for / against per game) are turned into per-team
//     attack / defense ratings for every competition that has fixtures today.
//   - Those ratings are blended into the Dixon-Coles expected-goals estimate, so
//     predicted scores differ per team instead of defaulting to a uniform 1-1/1-0.
//   - The recommended correct score is the argmax of the score matrix (statistical),
//     and Over/Under + BTTS come from the same matrix.
const fs = require('fs');
const path = require('path');

// Tiny .env loader (no dependency)
try {
  const envPaths = ['.env', '../.env', __dirname + '/../.env'];
  for (const ep of envPaths) {
    if (fs.existsSync(ep)) {
      fs.readFileSync(ep, 'utf8').split('\n').forEach(l => {
        const idx = l.indexOf('=');
        if (idx === -1) return;
        const k = l.slice(0, idx).trim(), v = l.slice(idx + 1).trim();
        if (k && v && !process.env[k]) process.env[k] = v;
      });
      break;
    }
  }
} catch (e) {}

const KEY = process.env.FOOTBALL_DATA_API_KEY;
const { predict, rating } = require('./dixon_coles');

// Competitions that have standings on the free tier (used to derive real team strengths).
const STANDINGS_CODES = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'DED', 'PPL', 'BSA', 'PPL', 'NL1', 'SB'];

function getDates() {
  const day = 86400000;
  return {
    today: new Date().toISOString().slice(0, 10),
    tomorrow: new Date(Date.now() + day).toISOString().slice(0, 10),
    yesterday: new Date(Date.now() - day).toISOString().slice(0, 10),
    weekLater: new Date(Date.now() + 7 * day).toISOString().slice(0, 10)
  };
}

async function fdGet(url) {
  const headers = {};
  if (KEY) headers['X-Auth-Token'] = KEY;
  const res = await fetch(url, { headers });
  if (!res.ok) { console.log(`GET ${url} -> ${res.status}`); return null; }
  return res.json();
}

async function fetchMatches(dateFrom, dateTo) {
  try {
    const data = await fdGet(`https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`);
    return (data && data.matches) || [];
  } catch (e) { console.log('fetchMatches error', e.message); return []; }
}

async function fetchStandings(competition) {
  try { return await fdGet(`https://api.football-data.org/v4/competitions/${competition}/standings`); }
  catch (e) { return null; }
}
async function fetchScorers(competition = 'PL') {
  try { return await fdGet(`https://api.football-data.org/v4/competitions/${competition}/scorers`); }
  catch (e) { return null; }
}

// ---- real team strengths from standings ----
// attack_i   = (goals for / played)   / league average goals-per-game
// defense_i  = (goals against / played) / league average goals-per-game
function buildStrengths(standingsData) {
  const out = new Map();
  if (!standingsData || !standingsData.standings || !standingsData.standings[0]) return out;
  const rows = standingsData.standings[0].table || [];
  const entries = rows.map(r => {
    const played = Math.max(1, r.playedGames || 0);
    return { name: r.team.name, gf: (r.goalsFor || 0) / played, ga: (r.goalsAgainst || 0) / played };
  });
  if (!entries.length) return out;
  const avg = entries.reduce((s, e) => s + e.gf, 0) / entries.length || 1;
  for (const e of entries) {
    out.set(e.name, { attack: +(e.gf / avg).toFixed(3), defense: +(e.ga / avg).toFixed(3) });
  }
  return out;
}

// Blend real standings strengths into the model context for a match.
function ctxFor(home, away, strengths) {
  const hs = strengths.get(home), as = strengths.get(away);
  return {
    hr: rating(home),
    ar: rating(away),
    hatk: hs && js(hs.attack) || 1, hdef: hs && js(hs.defense) || 1,
    aatk: as && js(as.attack) || 1, adef: as && js(as.defense) || 1
  };
}
const js = v => (v == null || !isFinite(v) || v <= 0) ? 1 : v;

function enrichMatch(m, strengths) {
  const d = new Date(m.utcDate);
  const utcStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
  const cetStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }) + ' CET';
  const home = m.homeTeam.name, away = m.awayTeam.name;

  // Only use per-competition standings when the fixture is in a competition we
  // have real numbers for; otherwise fall back to the Elo databank alone.
  const strengthsOk = strengths && strengths.size >= 4;
  const dc = predict(home, away, strengthsOk ? ctxFor(home, away, strengths) : undefined);

  const over = dc.overUnder, btts = dc.btts, cs = dc.correctScore;
  const whyWin = `${home} vs ${away}: Dixon-Coles P(H)${dc.pH}% D${dc.pD}% A${dc.pA}% • xG ${dc.lamH}-${dc.lamA} • most likely score ${cs.score} (${cs.prob}%) • ${dc.pred} confidence ${dc.conf}%${strengthsOk ? ' • strengths derived from real league standings' : ''}`;

  return {
    id: m.id,
    utcDate: m.utcDate,
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
    precise: `${utcStr} • ${cetStr}`,
    status: m.status,
    matchday: m.matchday,
    competition: { id: m.competition.id, name: m.competition.name, code: m.competition.code, emblem: m.competition.emblem },
    homeTeam: { id: m.homeTeam.id, name: m.homeTeam.name, shortName: m.homeTeam.shortName, tla: m.homeTeam.tla, crest: m.homeTeam.crest },
    awayTeam: { id: m.awayTeam.id, name: m.awayTeam.name, shortName: m.awayTeam.shortName, tla: m.awayTeam.tla, crest: m.awayTeam.crest },
    score: m.score,
    prediction: {
      market1X2: { pred: dc.pred, conf: dc.conf, odds: dc.odds, pH: dc.pH, pD: dc.pD, pA: dc.pA },
      doubleChance: dc.doubleChance,
      overUnder: over,
      btts,
      correctScore: cs,
      topScores: dc.topScores,
      asianHandicap: dc.asianHandicap,
      halfTime: dc.pred === 'Home Win' ? 'Home Win HT' : dc.pred === 'Away Win' ? 'Away Win HT' : 'Draw HT',
      pred: dc.pred, sub: dc.sub, conf: dc.conf, odds: dc.odds, value: dc.value,
      model: dc.model,
      xg: dc.xg,
      whyWin
    }
  };
}

function slimStandings(data, n = 10) {
  if (!data || !data.standings || !data.standings[0]) return null;
  const t = data.standings[0].table.slice(0, n).map(r => ({
    position: r.position, team: r.team.name, crest: r.team.crest,
    played: r.playedGames, won: r.won, draw: r.draw, lost: r.lost,
    goals: `${r.goalsFor}:${r.goalsAgainst}`, points: r.points, form: r.form || null
  }));
  return { competition: data.competition.name, code: data.competition.code, table: t, updatedAt: new Date().toISOString() };
}

async function main() {
  const { today, tomorrow, yesterday, weekLater } = getDates();
  console.log(`Fetching football: today ${today}, tomorrow ${tomorrow}, yesterday ${yesterday}, week ${weekLater}`);
  if (!KEY) console.log('⚠️ No FOOTBALL_DATA_API_KEY set — outputs will be empty (pages show graceful empty states).');

  const [todayMatches, tomorrowMatches, yesterdayMatches, upcomingMatches] = await Promise.all([
    fetchMatches(today, today),
    fetchMatches(tomorrow, tomorrow),
    fetchMatches(yesterday, yesterday),
    fetchMatches(today, weekLater)
  ]);
  console.log(`Today: ${todayMatches.length}, Tomorrow: ${tomorrowMatches.length}, Yesterday: ${yesterdayMatches.length}, Upcoming: ${upcomingMatches.length}`);

  // Build real team strengths per competition, limited to free-tier leagues.
  const allMatches = todayMatches.concat(tomorrowMatches);
  const compCodes = [...new Set(allMatches.map(m => m.competition && m.competition.code).filter(Boolean))];
  const toFetch = compCodes.filter(c => STANDINGS_CODES.includes(c)).slice(0, 10);
  const strengths = new Map();
  for (const code of toFetch) {
    const st = await fetchStandings(code);
    const s = buildStrengths(st);
    console.log(`  standings ${code}: ${s.size} teams with goals data`);
    for (const [k, v] of s) strengths.set(k, v);
  }

  const enrich = arr => arr.map(m => enrichMatch(m, strengths));
  const write = (file, data) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  };
  const stamp = { source: 'football-data.org', strengthsFromStandings: strengths.size, lastUpdate: new Date().toISOString() };

  write('football/today.json', { date: today, count: todayMatches.length, matches: enrich(todayMatches), ...stamp });
  write('football/tomorrow.json', { date: tomorrow, count: tomorrowMatches.length, matches: enrich(tomorrowMatches), ...stamp });
  write('football/yesterday.json', { date: yesterday, count: yesterdayMatches.length, matches: enrich(yesterdayMatches), ...stamp });
  write('football/upcoming.json', { dateFrom: today, dateTo: weekLater, count: upcomingMatches.length, matches: enrich(upcomingMatches).slice(0, 30), ...stamp });
  write('football/results.json', { date: yesterday, count: yesterdayMatches.length, matches: enrich(yesterdayMatches.filter(m => m.status === 'FINISHED')), ...stamp });
  write('football/fixtures.json', { dateFrom: today, dateTo: weekLater, count: upcomingMatches.length, matches: enrich(upcomingMatches), ...stamp });

  // live.json -> powers /live.html with no API key on the client
  const [plStandings, plScorers] = await Promise.all([fetchStandings('PL'), fetchScorers('PL')]);
  const live = {
    date: today,
    matches: enrich(todayMatches),
    standings: slimStandings(plStandings),
    scorers: plScorers && plScorers.scorers ? plScorers.scorers.slice(0, 6).map(s => ({
      player: s.player.name, team: s.team ? s.team.name : '', goals: s.goals || 0, assists: s.assists || 0
    })) : [],
    ...stamp
  };
  write('football/live.json', live);
  console.log(`✅ Football data saved (live.json: ${live.matches.length} matches, standings: ${live.standings ? 'ok' : 'none'})`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });