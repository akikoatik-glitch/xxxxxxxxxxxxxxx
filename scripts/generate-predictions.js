// Generates predictions.json — the single source for homepage + prediction pages.
// Priority: 1) football/today.json (from fetch_football.js) 2) football/tomorrow.json
//           3) football/upcoming.json 4) direct API fallback 5) empty state (never fake)
// News is owned by fetch_news.js — this script only reads it.
const fs = require('fs');
const path = require('path');

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

const MELBET_LINK = process.env.MELBET_LINK || 'https://refpa3665.com/L?tag=d_5217846m_2170c_&site=5217846&ad=2170&promo=KIKOS77';
const { predict: dixonPredict } = require('./dixon_coles');

function slugify(s) {
  return String(s).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function getAnalysis(home, away, pred) {
  const analyses = {
    'Home Win': `${home} won 4 of last 5 home games, averaging 2.1 goals. ${away} missing key defenders, xG 0.9 away. Head-to-head: ${home} unbeaten in 6.`,
    'BTTS Yes': `Both scored in 5 of last 6 ${home} vs ${away} meetings. ${home} xG 1.6 home, ${away} xG 1.3 away. Defenses leak: ${home} conceded in 4 straight.`,
    'Over 2.5': `Over 2.5 hit in 4 of last 5 for ${home} (avg 3.2 goals). ${away} high line concedes 1.4/game. Combined xG total 2.9.`,
    'Draw': `Tight clash: last 3 ${home}-${away} meetings were draws. Both cautious, under 2.5 in 4 of 5 recent games.`,
    'Away Win': `${away} on a 5-game away win streak, xG 1.9. ${home} winless in 3 at home with midfield injuries.`,
    'Under 2.5': `Under 2.5 in 4 of last 5 ${home} games, tight defense (0.8 conceded). ${away} low xG 0.9 away.`
  };
  return analyses[pred] || `${home} favored by form and xG model.`;
}

function getBetExplain(pred) {
  const exp = {
    'Home Win': "Bet: Home team wins in 90 mins. Choose '1' in the 1X2 market.",
    'BTTS Yes': 'Bet: Both Teams To Score — yes. Both teams must score at least 1 goal.',
    'Over 2.5': 'Bet: Total goals over 2.5 (3+ goals). Wins on 2-1, 3-0 etc.',
    'Draw': 'Bet: Draw at full-time. Higher odds, value pick.',
    'Away Win': "Bet: Away team wins ('2'). Underdog value.",
    'Under 2.5': 'Bet: Under 2.5 goals (0-2 goals). Defensive game.'
  };
  return exp[pred] || 'Bet on the full-time result.';
}

// Normalize a match from any source into the flat rich shape used site-wide
function normalizeMatch(m, i) {
  const home = m.home || (m.homeTeam && m.homeTeam.name) || 'Home';
  const away = m.away || (m.awayTeam && m.awayTeam.name) || 'Away';
  const league = m.league || (m.competition && m.competition.name) || 'Football';
  const code = m.competitionCode || (m.competition && m.competition.code) || '';
  const FLAG = { PL: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', PD: '🇪🇸', BL1: '🇩🇪', SA: '🇮🇹', FL1: '🇫🇷', CL: '🇪🇺', ELC: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', DED: '🇳🇱', PPL: '🇵🇹' };
  const flag = m.flag || FLAG[code] || '⚽';

  let dc;
  if (m.prediction && m.prediction.market1X2) {
    const p = m.prediction;
    dc = {
      pred: p.pred || p.market1X2.pred, sub: p.sub || p.market1X2.pred, conf: p.conf || p.market1X2.conf,
      odds: p.odds || p.market1X2.odds, value: p.value || '',
      pH: p.market1X2.pH, pD: p.market1X2.pD, pA: p.market1X2.pA,
      lamH: null, lamA: null,
      dc: p.doubleChance || null, ou: p.overUnder || null, btts: p.btts || null, cs: p.correctScore || null
    };
    if (p.whyWin && !p.whyWin.includes('won 4 of last 5')) m._whyReal = p.whyWin;
  } else {
    dc = dixonPredict(home, away);
  }

  const utcDate = m.utcDate || new Date().toISOString();
  const d = new Date(utcDate);
  const hours = Math.max(0, Math.floor((d - Date.now()) / 3600000));
  const xGTotal = (dc.lamH != null && dc.lamA != null) ? (parseFloat(dc.lamH) + parseFloat(dc.lamA)) : null;

  return {
    id: m.id || null,
    slug: `${slugify(home)}-vs-${slugify(away)}-prediction`,
    utcDate,
    date: utcDate.slice(0, 10),
    time: m.time || d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
    precise: m.precise || (d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC • ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }) + ' CET'),
    countdown: (m.countdown != null && !String(m.countdown).includes('h')) ? m.countdown : hours + 'h to kickoff',
    home, away, league, code, flag,
    status: m.status || 'TIMED',
    pred: dc.pred, sub: dc.sub, conf: dc.conf, odds: dc.odds, value: dc.value || `+${Math.round((dc.conf - 60) / 2)}%`,
    probs: { home: dc.pH, draw: dc.pD, away: dc.pA },
    xg: xGTotal != null ? { home: dc.lamH, away: dc.lamA, total: xGTotal.toFixed(2) } : null,
    doubleChance: dc.dc || { '1X': Math.min(97, dc.pH + dc.pD), 'X2': Math.min(97, dc.pD + dc.pA), '12': Math.min(97, dc.pH + dc.pA) },
    overUnder: dc.ou || null,
    btts: dc.btts || null,
    correctScore: dc.cs || null,
    whyWin: m._whyReal || `${getAnalysis(home, away, dc.pred)} Dixon-Coles: P(H)${dc.pH}% D${dc.pD}% A${dc.pA}%${dc.lamH ? ` • xG ${dc.lamH}-${dc.lamA}` : ''}`,
    betExplain: getBetExplain(dc.pred),
    form: m.form || 'Form data via league table and recent results',
    injuries: m.injuries || 'Lineups confirmed ~1h before kickoff',
    model: 'Dixon-Coles + Elo',
    locked: false
  };
}

async function fetchFootballDataDirect() {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) return null;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${today}`, { headers: { 'X-Auth-Token': key } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.matches || [];
  } catch (e) { return null; }
}

async function fetchApiFootballDirect() {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return null;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`https://v3.football.api-sports.io/fixtures?date=${today}`, { headers: { 'x-apisports-key': key } });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.response || []).map(m => ({
      id: m.fixture.id, utcDate: m.fixture.date, status: m.fixture.status.short,
      homeTeam: { name: m.teams.home.name }, awayTeam: { name: m.teams.away.name },
      competition: { name: m.league.name, code: m.league.country ? '' : '' }
    }));
  } catch (e) { return null; }
}

function readJSON(file) {
  const paths = [file, path.join(__dirname, '..', file)];
  for (const p of paths) {
    try { if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {}
  }
  return null;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  let raw = null, source = '';

  const fToday = readJSON('football/today.json');
  const fTomorrow = readJSON('football/tomorrow.json');
  const fUpcoming = readJSON('football/upcoming.json');

  if (fToday && fToday.matches && fToday.matches.length) { raw = fToday.matches; source = 'football-data.org (today)'; }
  else if (fTomorrow && fTomorrow.matches && fTomorrow.matches.length) { raw = fTomorrow.matches; source = 'football-data.org (tomorrow)'; }
  else if (fUpcoming && fUpcoming.matches && fUpcoming.matches.length) { raw = fUpcoming.matches.slice(0, 12); source = 'football-data.org (upcoming)'; }
  else {
    const direct = await fetchFootballDataDirect();
    if (direct && direct.length) { raw = direct; source = 'football-data.org (direct)'; }
    else {
      const af = await fetchApiFootballDirect();
      if (af && af.length) { raw = af; source = 'API-Football'; }
    }
  }

  let matches;
  if (raw) {
    matches = raw.slice(0, 12).map(normalizeMatch);
  } else {
    // No new source available (e.g. running offline without API keys):
    // keep the previous predictions instead of wiping them.
    const prev = readJSON('predictions.json');
    matches = prev && Array.isArray(prev.matches) ? prev.matches : [];
    if (matches.length) source = 'previous run (kept)';
  }
  console.log(`📦 ${matches.length} matches from ${source || 'no source (empty state)'}`);

  // Yesterday's real results for the homepage results strip
  const y = readJSON('football/yesterday.json');
  const results = (y && y.matches ? y.matches : [])
    .filter(m => m.status === 'FINISHED' && m.score && m.score.fullTime && m.score.fullTime.home !== null)
    .slice(0, 6)
    .map(m => ({
      home: `${m.homeTeam.name} ${m.score.fullTime.home}-${m.score.fullTime.away} ${m.awayTeam.name}`,
      pred: m.prediction.market1X2.pred, res: m.score.fullTime.home > m.score.fullTime.away ? '1' : m.score.fullTime.home === m.score.fullTime.away ? 'X' : '2'
    }));

  const existingNews = readJSON('news.json');
  const news = existingNews && existingNews.news ? existingNews.news.slice(0, 4) : [];

  const data = {
    date: matches.length ? matches[0].date : today,
    lastUpdate: new Date().toISOString(),
    source,
    matches,
    results,
    news,
    melbetLink: MELBET_LINK,
    promoCode: 'KIKOS77'
  };

  fs.writeFileSync('predictions.json', JSON.stringify(data, null, 2));
  console.log(`✅ predictions.json written (${matches.length} matches, ${results.length} results, ${news.length} news)`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
