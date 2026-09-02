// Fetches real football data from SportScore (primary, no API key) + football-data.org (fallback).
// Outputs:
//   football/today.json, tomorrow.json, yesterday.json, upcoming.json, results.json, fixtures.json
//   football/live.json          -> consumed by /live.html (matches + standings + scorers)
// Predictions.json is owned by generate-predictions.js (runs after this in the workflow).
//
// SportScore: ~10k req/day, no key needed, just a "Powered by SportScore" attribution link.
// football-data.org: 10 req/min, needs FOOTBALL_DATA_API_KEY for upcoming date-range queries.
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

// Competitions that have standings on football-data.org free tier
const STANDINGS_CODES = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'DED', 'PPL', 'BSA', 'PPL', 'NL1', 'SB'];

// SportScore competition slugs for standings (verified working)
const SS_STANDINGS = {
  'Premier League': 'english-premier-league',
  'La Liga': 'spanish-la-liga',
  'Serie A': 'italian-serie-a',
  'Ligue 1': 'french-ligue-1',
  'Brasileirão': 'brazilian-serie-a',
};

// Top leagues we care about for predictions (filter out random U19/youth/women's leagues)
const PREDICTION_LEAGUES = new Set([
  'Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1',
  'Eredivisie', 'Primeira Liga', 'Championship', 'Brasileirão', 'Süper Lig',
  'UEFA Champions League', 'UEFA Europa League', 'UEFA Conference League',
  'FA Cup', 'Copa del Rey', 'DFB Pokal', 'Coppa Italia', 'Coupe de France',
  'J1 League', 'K League 1', 'MLS', 'Saudi Pro League',
]);

function getDates() {
  const day = 86400000;
  return {
    today: new Date().toISOString().slice(0, 10),
    tomorrow: new Date(Date.now() + day).toISOString().slice(0, 10),
    yesterday: new Date(Date.now() - day).toISOString().slice(0, 10),
    weekLater: new Date(Date.now() + 7 * day).toISOString().slice(0, 10)
  };
}

// ── SportScore fetchers (primary, no key) ──────────────────────────────────

async function ssGet(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) { console.log(`SportScore ${url} -> ${res.status}`); return null; }
    return res.json();
  } catch (e) { console.log('SportScore fetch error:', e.message); return null; }
}

// Map SportScore match to our internal format
function ssToInternal(m) {
  const statusMap = { 'finished': 'FINISHED', 'alive': 'IN_PLAY', 'ns': 'TIMED', 'postponed': 'POSTPONED', 'cancelled': 'CANCELED' };
  const st = statusMap[m.status] || 'TIMED';
  return {
    id: m.url ? m.url.replace(/\/$/, '').split('/').pop() : null,
    utcDate: m.time || new Date().toISOString(),
    status: st,
    matchday: null,
    competition: { id: null, name: m.competition || '', code: null, emblem: m.competition_logo || null },
    homeTeam: { id: null, name: m.home || '', shortName: m.home || '', tla: null, crest: m.home_logo || null },
    awayTeam: { id: null, name: m.away || '', shortName: m.away || '', tla: null, crest: m.away_logo || null },
    score: st === 'FINISHED' ? { fullTime: { home: parseInt(m.home_score) || 0, away: parseInt(m.away_score) || 0 } } : null,
    _ssCompetition: m.competition || '',
    _ssUrl: m.url || ''
  };
}

// Fetch today's live/recent matches from SportScore
async function fetchSportScoreToday() {
  const data = await ssGet('https://sportscore.com/api/widget/matches/?sport=football&limit=50');
  if (!data || !data.matches) return [];
  return data.matches.map(ssToInternal);
}

// Fetch standings from SportScore for a league
async function fetchSportScoreStandings(slug) {
  const data = await ssGet(`https://sportscore.com/api/widget/standings/?sport=football&slug=${slug}`);
  if (!data || !data.tables || !data.tables[0]) return null;
  return data;
}

// Build strengths from SportScore standings
function buildSSStrengths(standingsData) {
  const out = new Map();
  if (!standingsData || !standingsData.tables || !standingsData.tables[0]) return out;
  const rows = standingsData.tables[0].rows || [];
  const entries = rows.map(r => {
    const played = Math.max(1, r.p || 0);
    return { name: r.team, gf: (r.gf || 0) / played, ga: (r.ga || 0) / played,
             won: r.w || 0, draw: r.d || 0, lost: r.l || 0, points: r.pts || 0 };
  });
  if (!entries.length) return out;
  const avg = entries.reduce((s, e) => s + e.gf, 0) / entries.length || 1;
  for (const e of entries) {
    out.set(e.name, { attack: +(e.gf / avg).toFixed(3), defense: +(e.ga / avg).toFixed(3),
                      form: null, won: e.won, draw: e.draw, lost: e.lost, points: e.points });
  }
  return out;
}

// ── football-data.org fetchers (fallback, needs key) ───────────────────────

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

// Build strengths from football-data.org standings
function buildStrengths(standingsData) {
  const out = new Map();
  if (!standingsData || !standingsData.standings || !standingsData.standings[0]) return out;
  const rows = standingsData.standings[0].table || [];
  const entries = rows.map(r => {
    const played = Math.max(1, r.playedGames || 0);
    return { name: r.team.name, gf: (r.goalsFor || 0) / played, ga: (r.goalsAgainst || 0) / played,
             form: r.form || null, won: r.won || 0, draw: r.draw || 0, lost: r.lost || 0, points: r.points || 0 };
  });
  if (!entries.length) return out;
  const avg = entries.reduce((s, e) => s + e.gf, 0) / entries.length || 1;
  for (const e of entries) {
    out.set(e.name, { attack: +(e.gf / avg).toFixed(3), defense: +(e.ga / avg).toFixed(3),
                      form: e.form, won: e.won, draw: e.draw, lost: e.lost, points: e.points });
  }
  return out;
}

// ── Shared helpers ──────────────────────────────────────────────────────────

function computeForm(results, teamName) {
  const recent = [];
  for (const m of results) {
    if (!m.score || !m.score.fullTime || m.score.fullTime.home === null) continue;
    const isHome = m.homeTeam && m.homeTeam.name === teamName;
    const isAway = m.awayTeam && m.awayTeam.name === teamName;
    if (!isHome && !isAway) continue;
    const h = m.score.fullTime.home, a = m.score.fullTime.away;
    if (isHome) recent.push(h > a ? 'W' : h === a ? 'D' : 'L');
    else recent.push(a > h ? 'W' : a === h ? 'D' : 'L');
  }
  return recent.slice(0, 5).join('') || null;
}

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

function enrichMatch(m, strengths, recentResults) {
  const d = new Date(m.utcDate);
  const utcStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
  const cetStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }) + ' CET';
  const home = m.homeTeam.name, away = m.awayTeam.name;

  const strengthsOk = strengths && strengths.size >= 4;
  const dc = predict(home, away, strengthsOk ? ctxFor(home, away, strengths) : undefined);

  const homeForm = (recentResults && computeForm(recentResults, home)) || (strengthsOk && strengths.get(home) && strengths.get(home).form) || null;
  const awayForm = (recentResults && computeForm(recentResults, away)) || (strengthsOk && strengths.get(away) && strengths.get(away).form) || null;
  const homeFormStr = homeForm ? homeForm.slice(0, 5) : null;
  const awayFormStr = awayForm ? awayForm.slice(0, 5) : null;

  const over = dc.overUnder, btts = dc.btts, cs = dc.correctScore;
  const formNote = homeFormStr && awayFormStr ? `Recent form: ${home} ${homeFormStr} · ${away} ${awayFormStr}` : '';
  const whyWin = `${home} vs ${away}: Dixon-Coles P(H)${dc.pH}% D${dc.pD}% A${dc.pA}% • xG ${dc.lamH}-${dc.lamA} • most likely score ${cs.score} (${cs.prob}%) • ${dc.pred} confidence ${dc.conf}%${formNote ? ' • ' + formNote : ''}${strengthsOk ? ' • strengths from real standings' : ''}`;

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
    form: { home: homeFormStr, away: awayFormStr },
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

// Build slim standings from SportScore format
function slimStandingsSS(data, n = 10) {
  if (!data || !data.tables || !data.tables[0]) return null;
  const t = data.tables[0].rows.slice(0, n).map(r => ({
    position: r.pos, team: r.team, crest: r.team_logo,
    played: r.p, won: r.w, draw: r.d, lost: r.l,
    goals: `${r.gf}:${r.ga}`, points: r.pts, form: null
  }));
  return { competition: data.competition, code: null, table: t, updatedAt: new Date().toISOString() };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { today, tomorrow, yesterday, weekLater } = getDates();
  console.log(`Fetching football: today ${today}, tomorrow ${tomorrow}, yesterday ${yesterday}, week ${weekLater}`);

  // ── Step 1: Try SportScore first (no key needed) ──
  console.log('Trying SportScore (no API key required)...');
  const ssMatches = await fetchSportScoreToday();
  console.log(`SportScore returned ${ssMatches.length} matches`);

  // Separate into today/tomorrow/yesterday by date
  const ssToday = ssMatches.filter(m => m.utcDate && m.utcDate.slice(0, 10) === today);
  const ssTomorrow = ssMatches.filter(m => m.utcDate && m.utcDate.slice(0, 10) === tomorrow);
  const ssYesterday = ssMatches.filter(m => m.utcDate && m.utcDate.slice(0, 10) === yesterday);
  console.log(`SportScore split: today=${ssToday.length}, tomorrow=${ssTomorrow.length}, yesterday=${ssYesterday.length}`);

  // ── Step 2: Fetch standings from SportScore for top leagues ──
  const strengths = new Map();
  const seenLeagues = new Set(ssMatches.map(m => m._ssCompetition).filter(Boolean));
  // Only pull standings for leagues that appear in the feed (saves requests)
  const missing = Object.keys(SS_STANDINGS).filter(n => seenLeagues.has(n));
  const ssLeaguesToFetch = missing.length ? missing : Object.keys(SS_STANDINGS);
  for (const leagueName of ssLeaguesToFetch) {
    try {
      const slug = SS_STANDINGS[leagueName];
      const st = await fetchSportScoreStandings(slug);
      const s = buildSSStrengths(st);
      if (s.size > 0) {
        console.log(`  standings ${leagueName}: ${s.size} teams`);
        for (const [k, v] of s) strengths.set(k, v);
      }
    } catch (e) { console.log(`  standings ${leagueName} failed: ${e.message}`); }
  }

  // ── Step 3: Fallback to football-data.org for upcoming fixtures ──
  let fdToday = [], fdTomorrow = [], fdYesterday = [], fdUpcoming = [], fdRecent = [];
  if (KEY) {
    console.log('Also fetching from football-data.org (has API key)...');
    [fdToday, fdTomorrow, fdYesterday, fdUpcoming] = await Promise.all([
      fetchMatches(today, today),
      fetchMatches(tomorrow, tomorrow),
      fetchMatches(yesterday, yesterday),
      fetchMatches(today, weekLater)
    ]);
    console.log(`football-data.org: today=${fdToday.length}, tomorrow=${fdTomorrow.length}, yesterday=${fdYesterday.length}, upcoming=${fdUpcoming.length}`);

    // Recent results for form (last 7 days)
    try {
      const day = 86400000;
      const weekAgo = new Date(Date.now() - 7 * day).toISOString().slice(0, 10);
      const recentData = await fdGet(`https://api.football-data.org/v4/matches?dateFrom=${weekAgo}&dateTo=${today}`);
      fdRecent = (recentData && recentData.matches) || [];
      console.log(`Recent results (7 days): ${fdRecent.length}`);
    } catch (e) { console.log('Recent results fetch failed:', e.message); }

    // Build strengths from fd.org standings too
    const allFd = fdToday.concat(fdTomorrow);
    const compCodes = [...new Set(allFd.map(m => m.competition && m.competition.code).filter(Boolean))];
    const toFetch = compCodes.filter(c => STANDINGS_CODES.includes(c)).slice(0, 10);
    for (const code of toFetch) {
      try {
        const st = await fetchStandings(code);
        const s = buildStrengths(st);
        console.log(`  fd.org standings ${code}: ${s.size} teams`);
        for (const [k, v] of s) strengths.set(k, v);
      } catch (e) { console.log(`  fd.org standings ${code} failed: ${e.message}`); }
    }
  } else {
    console.log('No FOOTBALL_DATA_API_KEY — using SportScore only for data.');
  }

  // ── Step 4: Merge sources (SportScore primary, fd.org supplements) ──
  // For today: use SportScore if available, else fd.org
  const todayFinal = ssToday.length >= fdToday.length ? ssToday : fdToday;
  const tomorrowFinal = ssTomorrow.length >= fdTomorrow.length ? ssTomorrow : fdTomorrow;
  const yesterdayFinal = ssYesterday.length >= fdYesterday.length ? ssYesterday : fdYesterday;
  const upcomingFinal = fdUpcoming.length > 0 ? fdUpcoming : ssMatches;

  // Combine recent results from both sources for form computation
  const allRecent = fdRecent.length > 0 ? fdRecent : ssYesterday.concat(ssToday.filter(m => m.status === 'FINISHED'));

  const dataSource = ssToday.length > 0 ? 'SportScore' : (fdToday.length > 0 ? 'football-data.org' : 'none');
  console.log(`\nMerged data: today=${todayFinal.length}, tomorrow=${tomorrowFinal.length}, yesterday=${yesterdayFinal.length}, upcoming=${upcomingFinal.length} (source: ${dataSource})`);

  const enrich = arr => arr.map(m => enrichMatch(m, strengths, allRecent));
  const write = (file, data) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  };
  const stamp = { source: `SportScore + football-data.org`, strengthsFromStandings: strengths.size, lastUpdate: new Date().toISOString() };

  write('football/today.json', { date: today, count: todayFinal.length, matches: enrich(todayFinal), ...stamp });
  write('football/tomorrow.json', { date: tomorrow, count: tomorrowFinal.length, matches: enrich(tomorrowFinal), ...stamp });
  write('football/yesterday.json', { date: yesterday, count: yesterdayFinal.length, matches: enrich(yesterdayFinal), ...stamp });
  write('football/upcoming.json', { dateFrom: today, dateTo: weekLater, count: upcomingFinal.length, matches: enrich(upcomingFinal).slice(0, 30), ...stamp });
  write('football/results.json', { date: yesterday, count: yesterdayFinal.length, matches: enrich(yesterdayFinal.filter(m => m.status === 'FINISHED')), ...stamp });
  write('football/fixtures.json', { dateFrom: today, dateTo: weekLater, count: upcomingFinal.length, matches: enrich(upcomingFinal), ...stamp });

  // live.json -> powers /live.html
  let plStandings = null, plScorers = null;
  if (KEY) {
    [plStandings, plScorers] = await Promise.all([fetchStandings('PL'), fetchScorers('PL')]);
  } else {
    // Try SportScore for Premier League standings
    try {
      const ssPL = await fetchSportScoreStandings('english-premier-league');
      if (ssPL) plStandings = { standings: [{ table: (ssPL.tables[0].rows || []).map(r => ({
        position: r.pos, team: { name: r.team, crest: r.team_logo },
        playedGames: r.p, won: r.w, draw: r.d, lost: r.l,
        goalsFor: r.gf, goalsAgainst: r.ga, points: r.pts, form: null
      }))}], competition: { name: 'Premier League', code: 'PL' } };
    } catch (e) { console.log('SportScore PL standings failed:', e.message); }
  }
  const live = {
    date: today,
    matches: enrich(todayFinal),
    standings: plStandings ? (plStandings.standings ? slimStandings(plStandings) : slimStandingsSS(plStandings)) : null,
    scorers: plScorers && plScorers.scorers ? plScorers.scorers.slice(0, 6).map(s => ({
      player: s.player.name, team: s.team ? s.team.name : '', goals: s.goals || 0, assists: s.assists || 0
    })) : [],
    ...stamp
  };
  write('football/live.json', live);
  console.log(`✅ Football data saved (live.json: ${live.matches.length} matches, standings: ${live.standings ? 'ok' : 'none'})`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
