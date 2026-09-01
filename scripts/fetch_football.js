// Fetches real football data from football-data.org (free tier).
// Outputs:
//   football/today.json, tomorrow.json, yesterday.json, upcoming.json, results.json, fixtures.json
//   football/live.json          -> consumed by /live.html (matches + standings + scorers)
// Predictions.json is owned by generate-predictions.js (runs after this in the workflow).
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
const { predict } = require('./dixon_coles');

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

async function fetchStandings(competition = 'PL') {
  try { return await fdGet(`https://api.football-data.org/v4/competitions/${competition}/standings`); }
  catch (e) { return null; }
}

async function fetchScorers(competition = 'PL') {
  try { return await fdGet(`https://api.football-data.org/v4/competitions/${competition}/scorers`); }
  catch (e) { return null; }
}

function enrichMatch(m) {
  const d = new Date(m.utcDate);
  const utcStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
  const cetStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }) + ' CET';
  const dc = predict(m.homeTeam.name, m.awayTeam.name);
  const pH = dc.pH, pD = dc.pD, pA = dc.pA;
  const xGTotal = parseFloat(dc.lamH) + parseFloat(dc.lamA);
  const overProb = Math.min(85, Math.max(30, Math.round(30 + xGTotal * 15)));
  const bttsProb = Math.round(45 + (pH + pA) / 2 * 0.3);
  let correctScore = '1-0';
  if (dc.pred === 'Away Win') correctScore = '1-2';
  else if (dc.pred === 'Draw') correctScore = '1-1';
  else if (dc.pred === 'Home Win' && xGTotal > 2.5) correctScore = '2-1';
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
      market1X2: { pred: dc.pred, conf: dc.conf, odds: dc.odds, pH, pD, pA },
      doubleChance: { '1X': Math.min(97, pH + pD), 'X2': Math.min(97, pD + pA), '12': Math.min(97, pH + pA) },
      overUnder: { over2_5: overProb, under2_5: 100 - overProb, oddsOver: (100 / overProb).toFixed(2), oddsUnder: (100 / (100 - overProb)).toFixed(2) },
      btts: { yes: bttsProb, no: 100 - bttsProb },
      correctScore: { score: correctScore, prob: Math.round(Math.max(pH, pD, pA) * 0.3) },
      halfTime: dc.pred === 'Home Win' ? 'Home Win HT' : dc.pred === 'Away Win' ? 'Away Win HT' : 'Draw HT',
      asianHandicap: dc.pH > pA ? 'Home -0.5' : 'Away +0.5',
      pred: dc.pred, sub: dc.sub, conf: dc.conf, odds: dc.odds, value: dc.value,
      model: 'Dixon-Coles',
      whyWin: `${m.homeTeam.name} vs ${m.awayTeam.name}: Dixon-Coles P(H)${pH}% D${pD}% A${pA}% • xG ${dc.lamH}-${dc.lamA} • ${dc.pred} confidence ${dc.conf}%`
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

  const enrich = arr => arr.map(enrichMatch);
  const write = (file, data) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  };
  const stamp = { source: 'football-data.org', lastUpdate: new Date().toISOString() };

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
