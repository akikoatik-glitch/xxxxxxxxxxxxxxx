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

function getAnalysis(home, away, pred, dc) {
  const top = (dc.topScores && dc.topScores.length)
    ? ` Expected-goal model: ${dc.lamH}–${dc.lamA}. Most likely scores: ${dc.topScores.map(t => `${t.score} (${t.prob}%)`).join(', ')}.`
    : '';
  const base = {
    'Home Win': `${home} are the stronger side on current data.`,
    'BTTS Yes': `Both teams are expected to score based on the model's combined xG.`,
    'Over 2.5': `Combined xG points to a high-scoring game.`,
    'Draw': `The teams are closely matched on strength data.`,
    'Away Win': `${away} are the stronger side on current data.`,
    'Under 2.5': `Combined xG points to a low-scoring game.`
  };
  return `${base[pred] || `${home} vs ${away} statistical outlook.`}${top}`;
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
      lamH: (p.xg && p.xg.home) || null, lamA: (p.xg && p.xg.away) || null,
      dc: p.doubleChance || null, ou: p.overUnder || null, btts: p.btts || null, cs: p.correctScore || null,
      top: p.topScores || null, ah: p.asianHandicap || null, model: p.model || 'Dixon-Coles v3'
    };
    const m2 = dixonPredict(home, away);
    // Old data files may lack matrix-derived markets — fill them from the model
    // instead of shipping hardcoded 1-1 scores.
    if (!dc.cs) dc.cs = m2.correctScore;
    if (!dc.top) dc.top = m2.topScores;
    if (!dc.ou) dc.ou = m2.overUnder;
    if (!dc.btts) dc.btts = m2.btts;
    if (!dc.pH && dc.pH !== 0) { dc.pH = m2.pH; dc.pD = m2.pD; dc.pA = m2.pA; }
    if (!dc.lamH) { dc.lamH = m2.lamH; dc.lamA = m2.lamA; }
    if (p.whyWin && !p.whyWin.includes('won 4 of last 5')) m._whyReal = p.whyWin;
  } else {
    dc = dixonPredict(home, away);
    // dixonPredict returns full-named properties; expose the short aliases
    // the rest of this function reads (cs/ou/top/btts).
    dc.cs = dc.correctScore;
    dc.ou = dc.overUnder;
    dc.top = dc.topScores;
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
    topScores: dc.top || null,
    asianHandicap: dc.ah || null,
    form: m.form || null,
    injuries: m.injuries || 'Lineups confirmed ~1h before kickoff',
    whyWin: m._whyReal || `${getAnalysis(home, away, dc.pred, dc)} Dixon-Coles: P(H)${dc.pH}% D${dc.pD}% A${dc.pA}%${dc.lamH ? ` • xG ${dc.lamH}-${dc.lamA}` : ''}`,
    betExplain: getBetExplain(dc.pred),
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
  const now = new Date().toISOString();
  let raw = null, source = '', dataTimestamp = null;

  const fToday = readJSON('football/today.json');
  const fTomorrow = readJSON('football/tomorrow.json');
  const fUpcoming = readJSON('football/upcoming.json');

  if (fToday && fToday.matches && fToday.matches.length) {
    raw = fToday.matches; source = 'football-data.org (today)'; dataTimestamp = fToday.lastUpdate;
  } else if (fTomorrow && fTomorrow.matches && fTomorrow.matches.length) {
    raw = fTomorrow.matches; source = 'football-data.org (tomorrow)'; dataTimestamp = fTomorrow.lastUpdate;
  } else if (fUpcoming && fUpcoming.matches && fUpcoming.matches.length) {
    raw = fUpcoming.matches.slice(0, 12); source = 'football-data.org (upcoming)'; dataTimestamp = fUpcoming.lastUpdate;
  } else {
    try {
      const direct = await fetchFootballDataDirect();
      if (direct && direct.length) { raw = direct; source = 'football-data.org (direct)'; dataTimestamp = now; }
      else {
        const af = await fetchApiFootballDirect();
        if (af && af.length) { raw = af; source = 'API-Football'; dataTimestamp = now; }
      }
    } catch (e) { console.log('Direct API fallback failed:', e.message); }
  }

  // Check for stale data (warn if older than 48 hours)
  let dataFreshness = 'fresh';
  if (dataTimestamp) {
    const ageMs = new Date(now) - new Date(dataTimestamp);
    const ageH = Math.round(ageMs / 3600000);
    if (ageH > 48) { dataFreshness = `stale (${ageH}h old)`; console.log(`⚠️ Data is ${ageH} hours old — may be outdated`); }
    else if (ageH > 12) { dataFreshness = `recent (${ageH}h ago)`; }
  }

  // Only predict matches from major leagues (ones we have standings data for)
  const PREDICTION_LEAGUES = new Set([
    'Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1',
    'Eredivisie', 'Primeira Liga', 'Championship', 'Brasileirão', 'Süper Lig',
    'UEFA Champions League', 'UEFA Europa League', 'UEFA Conference League',
    'FA Cup', 'Copa del Rey', 'DFB Pokal', 'Coppa Italia', 'Coupe de France',
    'J1 League', 'K League 1', 'MLS', 'Saudi Pro League',
    'LigaPro Serie A', 'Categoría Primera A', 'Brazilian Cup',
  ]);

  let matches;
  if (raw) {
    // Filter to major leagues only, then upcoming only
    const majorOnly = raw.filter(m => {
      const league = (m.competition && m.competition.name) || '';
      return PREDICTION_LEAGUES.has(league) || PREDICTION_LEAGUES.has(m._ssCompetition || '');
    });
    if (majorOnly.length > 0) raw = majorOnly;
    // Filter out finished/matches that already kicked off — only keep upcoming
    const upcoming = raw.filter(m => {
      const st = (m.status || '').toUpperCase();
      return st === 'TIMED' || st === 'SCHEDULED' || st === 'TIMED' || st === '' || st === 'NS';
    });
    matches = (upcoming.length ? upcoming : raw).slice(0, 12).map(normalizeMatch);
    console.log(`Major leagues: ${majorOnly.length} of ${raw.length} matches, upcoming: ${upcoming.length}`);
    if (matches.length < raw.length) console.log(`Filtered ${raw.length - matches.length} finished matches, keeping ${matches.length} upcoming`);
  } else {
    // No new source available (e.g. running offline without API keys):
    // keep the previous predictions instead of wiping them.
    const prev = readJSON('predictions.json');
    matches = prev && Array.isArray(prev.matches) ? prev.matches
      .filter(m => {
        // Even from cache, skip finished matches
        const st = (m.status || '').toUpperCase();
        if (st === 'FINISHED' || st === 'FT') return false;
        // Skip matches whose kickoff has passed (more than 3h ago)
        if (m.utcDate) {
          const diff = Date.now() - new Date(m.utcDate).getTime();
          if (diff > 3 * 3600000) return false;
        }
        return true;
      })
      .map(normalizeMatch) : [];
    if (matches.length) {
      source = 'previous run (re-normalized)';
      dataFreshness = 'stale (cached from previous run)';
    }
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
    lastUpdate: now,
    predictionGenerated: now,
    dataTimestamp: dataTimestamp || now,
    dataFreshness,
    source,
    matches,
    results,
    news,
    melbetLink: MELBET_LINK,
    promoCode: 'KIKOS77'
  };

  fs.writeFileSync('predictions.json', JSON.stringify(data, null, 2));
  console.log(`✅ predictions.json written (${matches.length} matches, ${results.length} results, ${news.length} news) [${dataFreshness}]`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
