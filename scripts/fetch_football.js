// Fetches real football data.
// PRIMARY: API-Football (api-sports.io) when API_FOOTBALL_KEY is set (free tier:
//   100 req/day, covers ALL world leagues incl. the top-5 European leagues).
// FALLBACK: SportScore (no key) — filtered & prioritised so the top-5 European
//   leagues win over random youth/regional/South-American noise.
//          football-data.org (optional, needs FOOTBALL_DATA_API_KEY).
// Outputs:
//   football/today.json, tomorrow.json, yesterday.json, upcoming.json,
//   results.json, fixtures.json, live.json
// Predictions.json is owned by generate-predictions.js (runs after this).
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
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY; // api-sports.io
const { predict, rating } = require('./dixon_coles');

// ── League priority & filtering ────────────────────────────────────────────
// Curated "good leagues" list — youth/regional/women's noise is filtered out.
// Order matters: top-5 European leagues surface first, then continental cups,
// then national leagues grouped by region (Europe → Americas → Asia → Africa → Oceania).
const LEAGUE_PRIORITY = [
  // Tier 1 — Big-5 European leagues
  'Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1',

  // Tier 2 — Continental cups
  'UEFA Champions League', 'UEFA Europa League', 'UEFA Conference League',
  'AFC Champions League', 'AFC Champions League Two',
  'Copa Libertadores', 'Copa Sudamericana',
  'CONCACAF Champions Cup', 'CONCACAF Champions League',
  'CAF Champions League', 'CAF Confederation Cup',
  'OFC Champions League',

  // Tier 3 — European secondary + cups
  'Eredivisie', 'Primeira Liga', 'Championship', 'Brasileirão', 'Süper Lig',
  'FA Cup', 'Copa del Rey', 'DFB Pokal', 'Coppa Italia', 'Coupe de France',
  'Scottish Premiership', 'Belgian Pro League', 'Swiss Super League',
  'Austrian Bundesliga', 'Greek Super League', 'Czech First League',
  'Croatian First Football League', 'Serbian SuperLiga', 'Ukrainian Premier League',
  'Russian Premier League', 'Polish Ekstraklasa', 'Danish Superliga',
  'Norwegian Eliteserien', 'Swedish Allsvenskan', 'Romanian Liga I',
  'Israeli Premier League', 'Cypriot First Division',

  // Tier 4 — Americas
  'MLS', 'Liga MX', 'Argentine Primera División', 'Argentine Liga Profesional',
  'Brazilian Serie B', 'Chilean Primera División', 'Uruguayan Primera División',
  'Paraguayan Primera División', 'Peruvian Primera División', 'Bolivian Primera División',
  'Ecuadorian Serie A', 'Colombian Primera A', 'Venezuelan Primera División',
  'LigaPro Serie A', 'Categoría Primera A', 'Canadian Premier League',
  'Costa Rican Primera División', 'Honduran Liga Nacional', 'Guatemalan Liga Nacional',
  'Panamanian Liga de Futbol', 'Salvadoran Primera División',
  'Dominican Liga', 'Jamaican Premier League',

  // Tier 5 — Asia
  'J1 League', 'J2 League', 'K League 1', 'K League 2', 'Chinese Super League',
  'Chinese League One', 'Saudi Pro League', 'UAE Pro League', 'Qatar Stars League',
  'Kuwait Premier League', 'Bahrain Premier League', 'Oman Professional League',
  'Iranian Persian Gulf Pro League', 'Iraq Premier League', 'Jordanian Pro League',
  'A-League', 'Indian Super League', 'I-League', 'Thai League 1',
  'Vietnamese V.League', 'Malaysian Super League', 'Singapore Premier League',
  'Indonesian Liga 1', 'Filipino Premier League', 'Hong Kong Premier League',
  'AFC Cup', 'AFF Championship',

  // Tier 6 — Africa
  'Egyptian Premier League', 'South African Premier Division', 'Moroccan Botola Pro',
  'Tunisian Ligue Professionnelle 1', 'Algerian Ligue Professionnelle 1',
  'Libyan Premier League', 'Sudanese Premier League',
  'Nigerian Professional Football League', 'Ghanaian Premier League',
  'Kenyan Premier League', 'Tanzanian Premier League', 'Ugandan Premier League',
  'Ethiopian Premier League', 'Zambian Super League',
  'Cameroon Elite One', 'DR Congo Linafoot',

  // Tier 7 — Oceania
  'New Zealand National League', 'Fiji Premier League', 'Papua New Guinea National Soccer League',
];
const LEAGUE_PRIORITY_SET = new Set(LEAGUE_PRIORITY);
const LEAGUE_PRIORITY_SET_LC = new Set(LEAGUE_PRIORITY.map(s => s.toLowerCase()));

// Explicitly excluded substrings (noise we never want on the homepage).
// English tiers are handled SEPARATELY in leaguePriority, so we only match
// clearly-low-value competitions here (youth, women's, reserve, regional,
// Indian/Kazakh/Georgian regional leagues, non-national friendlies).
const NOISE = [
  'u19', 'u20', 'u21', 'u23', 'youth', 'reserve', 'development', 'academy',
  'amateur', 'veteran', 'legend', 'women', 'lady',
  'erovnuli', 'calcutta', 'sikkim', 'shillong', 'mizoram', 'aguada', 's-league',
  'telekom', 'division 2', 'division 3', 'division 4', 'division 5',
  'regional', 'district', 'north zone', 'south zone', 'group stage',
];

// Low-value league names we still want to de-prioritise but NOT hard-drop
// (used only for display ordering when nothing better exists).
const LW_WEIGHT = {
  'international club friendly': 2, 'leagues cup': 4, 'caribbean cup': 4,
  'canadian championship': 4, 'copa argentina': 4, 'polish cup': 4,
  'nicaragua liga primera': 4, 'chili liga de primera': 4,
  'mexico liga mx femenil': 1, 'brazil w l': 1, 'united states women\'s national soccer league': 1,
  'japanese nadeshiko league 2': 1, 'new zealand cup women': 1, 'australian brisbane capital league 1': 1,
  'australia northern new south wales premier league': 1, 'australia tasmania national premier league': 1,
  'national premier leagues victoria': 1, 'south australia reserve league': 1,
  'western australia reserves league': 1, 'western australia u23': 1, 'mls next pro': 3,
  'brazilian campeonato amazonense2': 1, 'chilean tercera': 1, 'mexican tdp league': 1,
  'mex liga premier': 2, 'mexico ascenso mx': 3, 'solomon islands telekom s-league': 1,
  'saint kitts nevis premier league': 1, 'china youth football league (men\'s u17 group)': 1,
  'ofc u19 championship': 1, 'ecuadorian campeonato serie b': 2,
};

// Score a league's desirability: higher = show earlier.
function leaguePriority(name) {
  const n = (name || '').replace(/\s+/g, ' ').trim();
  if (!n) return 0;
  const lc = n.toLowerCase();
  // Penalise clearly noisy competitions
  for (const bad of NOISE) {
    if (lc.includes(bad)) {
      return -1;
    }
  }
  // Exact / canonical top-5 match (both exact and normalized)
  const idx = LEAGUE_PRIORITY.indexOf(n);
  if (idx >= 0) return 100 - idx;
  const ci = LEAGUE_PRIORITY.findIndex(k => k.toLowerCase() === lc);
  if (ci >= 0) return 90;
  // A few well-known standings aliases (SportScore / API-Football naming).
  // Maps the upstream feed's exact name → our canonical name from LEAGUE_PRIORITY.
  const alias = {
    // Big-5 + European
    'brazilian serie a': 'Brasileirão', 'italian serie a': 'Serie A',
    'english premier league': 'Premier League', 'spanish la liga': 'La Liga',
    'french ligue 1': 'Ligue 1', 'german bundesliga': 'Bundesliga',
    'ecuador liga pro': 'LigaPro Serie A', 'brasileirao': 'Brasileirão',
    'brazilian serie b': 'Brazilian Serie B',
    'dutch eredivisie': 'Eredivisie', 'dutch eeerste divisie': 'Eredivisie',
    'portuguese primeira liga': 'Primeira Liga',
    'english championship': 'Championship', 'english league championship': 'Championship',
    'turkish süper lig': 'Süper Lig', 'scottish premiership': 'Scottish Premiership',
    'belgian pro league': 'Belgian Pro League', 'belgian jupiler pro league': 'Belgian Pro League',
    'swiss super league': 'Swiss Super League', 'austrian bundesliga': 'Austrian Bundesliga',
    'greek super league': 'Greek Super League', 'greek superleague': 'Greek Super League',
    'czech first league': 'Czech First League', 'czech liga': 'Czech First League',
    'croatian first football league': 'Croatian First Football League',
    'serbian superliga': 'Serbian SuperLiga', 'serbian super league': 'Serbian SuperLiga',
    'ukrainian premier league': 'Ukrainian Premier League',
    'russian premier league': 'Russian Premier League',
    'polish ekstraklasa': 'Polish Ekstraklasa', 'ekstraklasa': 'Polish Ekstraklasa',
    'danish superliga': 'Danish Superliga', 'danish 1st division': 'Danish Superliga',
    'norwegian eliteserien': 'Norwegian Eliteserien',
    'swedish allsvenskan': 'Swedish Allsvenskan',
    'romanian liga i': 'Romanian Liga I', 'romanian liga 1': 'Romanian Liga I',
    'israeli premier league': 'Israeli Premier League',
    'cypriot first division': 'Cypriot First Division',
    // Americas
    'mexican liga mx': 'Liga MX', 'liga mx': 'Liga MX', 'mexican apertura': 'Liga MX',
    'american major league soccer': 'MLS', 'usa mls': 'MLS', 'major league soccer': 'MLS',
    'argentine primera división': 'Argentine Primera División',
    'argentine liga profesional': 'Argentine Liga Profesional',
    'argentine primera division': 'Argentine Primera División',
    'chilean primera división': 'Chilean Primera División',
    'chilean primera division': 'Chilean Primera División',
    'uruguayan primera división': 'Uruguayan Primera División',
    'paraguayan primera división': 'Paraguayan Primera División',
    'peruvian primera división': 'Peruvian Primera División',
    'bolivian primera división': 'Bolivian Primera División',
    'ecuadorian serie a': 'LigaPro Serie A',
    'colombian primera a': 'Categoría Primera A',
    'colombian torneo betplay dimayor': 'Categoría Primera A',
    'venezuelan primera división': 'Venezuelan Primera División',
    'canadian premier league': 'Canadian Premier League',
    'costa rican primera división': 'Costa Rican Primera División',
    'costa rica primera division': 'Costa Rican Primera División',
    'honduran liga nacional': 'Honduran Liga Nacional',
    'honduras primera division': 'Honduran Liga Nacional',
    'guatemalan liga nacional': 'Guatemalan Liga Nacional',
    'guatemala liga nacional': 'Guatemalan Liga Nacional',
    'panamanian liga de futbol': 'Panamanian Liga de Futbol',
    'panama lpf': 'Panamanian Liga de Futbol',
    // Asia
    'j1 league': 'J1 League', 'japanese j1 league': 'J1 League',
    'j2 league': 'J2 League', 'japanese j2 league': 'J2 League',
    'k league 1': 'K League 1', 'korean k league 1': 'K League 1',
    'k league 2': 'K League 2', 'korean k league 2': 'K League 2',
    'chinese super league': 'Chinese Super League', 'china super league': 'Chinese Super League',
    'chinese league one': 'Chinese League One',
    'saudi pro league': 'Saudi Pro League',
    'uae pro league': 'UAE Pro League', 'uae arabian gulf league': 'UAE Pro League',
    'qatar stars league': 'Qatar Stars League',
    'kuwait premier league': 'Kuwait Premier League',
    'bahrain premier league': 'Bahrain Premier League',
    'oman professional league': 'Oman Professional League',
    'iranian persian gulf pro league': 'Iranian Persian Gulf Pro League',
    'iraq premier league': 'Iraq Premier League',
    'jordanian pro league': 'Jordanian Pro League',
    'a-league': 'A-League', 'australian a-league': 'A-League',
    'indian super league': 'Indian Super League', 'isl': 'Indian Super League',
    'i-league': 'I-League',
    'thai league 1': 'Thai League 1', 'thai premier league': 'Thai League 1',
    'vietnamese v.league': 'Vietnamese V.League', 'v.league 1': 'Vietnamese V.League',
    'malaysian super league': 'Malaysian Super League',
    'singapore premier league': 'Singapore Premier League',
    'indonesian liga 1': 'Indonesian Liga 1',
    'filipino premier league': 'Filipino Premier League',
    'hong kong premier league': 'Hong Kong Premier League',
    // Africa
    'egyptian premier league': 'Egyptian Premier League',
    'south african premier division': 'South African Premier Division',
    'south african premiership': 'South African Premier Division',
    'moroccan botola pro': 'Moroccan Botola Pro', 'moroccan botola': 'Moroccan Botola Pro',
    'tunisian ligue professionnelle 1': 'Tunisian Ligue Professionnelle 1',
    'algerian ligue professionnelle 1': 'Algerian Ligue Professionnelle 1',
    'libyan premier league': 'Libyan Premier League',
    'sudanese premier league': 'Sudanese Premier League',
    'nigerian professional football league': 'Nigerian Professional Football League',
    'ghanaian premier league': 'Ghanaian Premier League',
    'kenyan premier league': 'Kenyan Premier League',
    'tanzanian premier league': 'Tanzanian Premier League',
    'ugandan premier league': 'Ugandan Premier League',
    'ethiopian premier league': 'Ethiopian Premier League',
    'zambian super league': 'Zambian Super League',
    'cameroon elite one': 'Cameroon Elite One',
    'dr congo linafoot': 'DR Congo Linafoot',
    // Oceania
    'new zealand national league': 'New Zealand National League',
    'fiji premier league': 'Fiji Premier League',
    'papua new guinea national soccer league': 'Papua New Guinea National Soccer League',
  };
  const a = alias[lc];
  if (a) return 95 - Math.max(0, LEAGUE_PRIORITY.findIndex(k => k.toLowerCase() === a.toLowerCase()));
  // Low-value but keepable leagues (shown after real competitions)
  const lw = LW_WEIGHT[lc];
  if (lw) return lw;
  return 8; // unknown but not clearly noise
}

const isNoise = n => leaguePriority(n) < 0;

// Sort matches so the "best" leagues are first, preserving stability.
const sortByLeague = arr => arr.slice().sort((a, b) => {
  const pa = a && a._league ? leaguePriority(a._league) : 0;
  const pb = b && b._league ? leaguePriority(b._league) : 0;
  return pb - pa;
});

// ── SportScore (zero-key) ──────────────────────────────────────────────────

async function ssGet(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) { console.log(`SportScore ${url} -> ${res.status}`); return null; }
    return res.json();
  } catch (e) { console.log('SportScore fetch error:', e.message); return null; }
}

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
    _league: m.competition || '',
    _source: 'SportScore',
    _ssUrl: m.url || ''
  };
}

async function fetchSportScoreToday(limit = 120) {
  // Fetch a larger window so we have more matches to filter & prioritise.
  const data = await ssGet(`https://sportscore.com/api/widget/matches/?sport=football&limit=${limit}`);
  if (!data || !data.matches) return [];
  const all = data.matches.map(ssToInternal);
  // Keep everything, but sort by league priority (noise goes last anyway).
  return sortByLeague(all);
}

// ── API-Football (api-sports.io) — PRIMARY when key present ────────────────
// Endpoint: GET https://v3.football.api-sports.io/fixtures
//   Headers: x-apisports-key: <KEY>
//   Params:  date=YYYY-MM-DD  (matches on that date across all leagues)
//            league=, season=  (optional scoping)
// Free tier: 100 requests/day.

// Which api-sports league ids to fetch (top-5 + secondary). We fetch all
// fixtures for a date and let the league filter decide what to keep.
const API_FOOTBALL = {
  base: 'https://v3.football.api-sports.io/fixtures',
  leagueIds: {
    // league_id -> friendly name (+ optional Code)
    39: 'Premier League',        // England (Premier League)
    140: 'La Liga',              // Spain
    78: 'Bundesliga',            // Germany
    135: 'Serie A',              // Italy
    61: 'Ligue 1',               // France
    2: 'UEFA Champions League',
    3: 'UEFA Europa League',
    848: 'UEFA Conference League',
    88: 'Eredivisie',            // Netherlands
    94: 'Primeira Liga',         // Portugal
    40: 'Championship',          // England (EFL Championship)
    203: 'Brasileirão',          // Brazil Serie A
    71: 'Süper Lig',             // Turkey
    86: 'Serie A',               // (Legacy / Italian alternate) — handled below fallback
  },
};

async function apiFootballGet(url) {
  try {
    const res = await fetch(url, { headers: { 'x-apisports-key': API_FOOTBALL_KEY } });
    if (!res.ok) { console.log(`API-Football ${url.slice(0, 60)}... -> ${res.status}`); return null; }
    return res.json();
  } catch (e) { console.log('API-Football fetch error:', e.message); return null; }
}

// Map api-sports fixture to our internal format for today/tomorrow enricher.
function afToInternal(fx) {
  if (!fx || !fx.fixture) return null;
  const home = fx.teams && fx.teams.home, away = fx.teams && fx.teams.away;
  const league = (fx.league && fx.league.name) || '';
  const statusFull = (fx.fixture.status && fx.fixture.status.short) || '';
  const statusMap = { 'FT': 'FINISHED', 'AET': 'FINISHED', 'PEN': 'FINISHED',
    '1H': 'IN_PLAY', '2H': 'IN_PLAY', 'HT': 'IN_PLAY', 'ET': 'IN_PLAY', 'BT': 'IN_PLAY',
    'NS': 'TIMED', 'TBD': 'TIMED', 'SUSP': 'POSTPONED', 'PST': 'POSTPONED', 'CANC': 'CANCELED',
    'AWD': 'FINISHED', 'WO': 'FINISHED' };
  const st = statusMap[statusFull] || 'TIMED';
  let fullTime = null;
  if (st === 'FINISHED' && fx.score && fx.score.fulltime) {
    const h = fx.score.fulltime.home, a = fx.score.fulltime.away;
    if (h != null && a != null) fullTime = { home: h, away: a };
  }
  return {
    id: String(fx.fixture.id),
    utcDate: fx.fixture.date || new Date().toISOString(),
    status: st,
    matchday: (fx.league && fx.league.round) || null,
    competition: { id: fx.league && fx.league.id, name: league,
      code: (fx.league && fx.league.id) ? String(fx.league.id) : null, emblem: null },
    homeTeam: { id: home && home.id, name: (home && home.name) || 'TBD',
      shortName: (home && home.name) || 'TBD', tla: null, crest: (home && home.logo) || null },
    awayTeam: { id: away && away.id, name: (away && away.name) || 'TBD',
      shortName: (away && away.name) || 'TBD', tla: null, crest: (away && away.logo) || null },
    score: fullTime,
    _ssCompetition: league,
    _league: league,
    _source: 'API-Football',
    _ssUrl: ''
  };
}

// Fetch all fixtures for a single date (across all leagues) via API-Football.
async function fetchApiFootballDate(dateStr) {
  if (!API_FOOTBALL_KEY) return [];
  const data = await apiFootballGet(`${API_FOOTBALL.base}?date=${dateStr}&timezone=UTC`);
  if (!data || !data.response) return [];
  const matches = data.response.map(afToInternal).filter(Boolean);
  // Map known api-sports league ids to our priority names and normalise aliases.
  for (const m of matches) {
    const lid = m.competition.id;
    const mapped = API_FOOTBALL.leagueIds[lid];
    if (mapped) m._league = mapped;
  }
  return sortByLeague(matches);
}

// ── WorldCup26 free API (worldcup26.ir) — zero-key, covers England+Spain ────
// Free, no API key. Premier League (eng.1) & LaLiga (esp.1) reliably present.
// Covers England & Spain. (Serie A / Bundesliga / Ligue 1 need the
// API-Football key.) Base: https://worldcup26.ir/get/soccer/{league_slug}/...
const WC26 = {
  base: 'https://worldcup26.ir/get/soccer',
  // league_slug -> internal league name
  slugs: {
    'eng.1': 'Premier League',
    'eng.2': 'Championship',
    'esp.1': 'La Liga',
  },
};

async function wc26Get(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) { console.log(`WC26 ${url.slice(0, 60)}... -> ${res.status}`); return null; }
    return res.json();
  } catch (e) { console.log('WC26 fetch error:', e.message); return null; }
}

// Fetch yesterday/today/tomorrow fixtures from worldcup26.ir for a league slug.
async function fetchWc26(leagueSlug, leagueName, from, to) {
  try {
    const data = await wc26Get(`${WC26.base}/${leagueSlug}/fixtures?from=${from}&to=${to}`);
    if (!data || !data.events) return [];
    const out = [];
    for (const ev of data.events) {
      const c = ev.competitions && ev.competitions[0];
      if (!c) continue;
      const hm = (c.competitors || []).find(x => x.homeAway === 'home');
      const aw = (c.competitors || []).find(x => x.homeAway === 'away');
      if (!hm || !aw) continue;
      const homeName = (hm.team && hm.team.name) || '';
      const awayName = (aw.team && aw.team.name) || '';
      if (!homeName || !awayName) continue;
      const short = (c.status && c.status.type && c.status.type.shortDetail) || '';
      const statusMap = { 'FT': 'FINISHED', 'AET': 'FINISHED', 'PEN': 'FINISHED',
        'HT': 'IN_PLAY', '1H': 'IN_PLAY', '2H': 'IN_PLAY', 'ET': 'IN_PLAY',
        'Scheduled': 'TIMED', 'Postponed': 'POSTPONED', 'Cancelled': 'CANCELED',
        'Delayed': 'POSTPONED' };
      let st = statusMap[short] || 'TIMED';
      if (/^[0-9]+'$/.test(short) || short === 'Halftime') st = 'IN_PLAY';
      let fullTime = null;
      if (st === 'FINISHED') {
        const h = parseInt(hm.score), a = parseInt(aw.score);
        if (!isNaN(h) && !isNaN(a)) fullTime = { home: h, away: a };
      }
      out.push({
        id: String(ev.id),
        utcDate: ev.date || new Date().toISOString(),
        status: st,
        matchday: null,
        competition: { id: ev.id, name: leagueName, code: leagueSlug, emblem: null },
        homeTeam: { id: hm.team && hm.team.id, name: homeName, shortName: homeName,
          tla: (hm.team && hm.team.abbreviation) || null, crest: (hm.team && hm.team.logo) || null },
        awayTeam: { id: aw.team && aw.team.id, name: awayName, shortName: awayName,
          tla: (aw.team && aw.team.abbreviation) || null, crest: (aw.team && aw.team.logo) || null },
        score: fullTime,
        _ssCompetition: leagueName,
        _league: leagueName,
        _source: 'WorldCup26',
        _ssUrl: ''
      });
    }
    return out;
  } catch (e) { console.log('WC26 fetch error:', e.message); return []; }
}

// Fetch standings (top table) from worldcup26.ir for a league slug.
async function fetchWc26Standings(leagueSlug) {
  const data = await wc26Get(`${WC26.base}/${leagueSlug}/standings`);
  return data;
}

// ── openfootball/football.json (free public-domain JSON, all top-8 leagues) ─
// No API key. Daily auto-updated by the upstream repo. Covers the 5 major
// European leagues plus the Championship (en.2), Eredivisie (nl.1) and
// Primeira Liga (pt.1). Each body is a season of fixtures/results:
//   { name, matches: [ { date:"YYYY-MM-DD", round, team1, team2, score:{ht,ft}|{} } ] }
const FOOTBALL_JSON = {
  base: 'https://raw.githubusercontent.com/openfootball/football.json/master/2026-27',
  leagues: [
    { slug: 'en.1', name: 'Premier League',      code: 'PL' },
    { slug: 'es.1', name: 'La Liga',             code: 'PD' },
    { slug: 'de.1', name: 'Bundesliga',          code: 'BL1' },
    { slug: 'it.1', name: 'Serie A',             code: 'SA' },
    { slug: 'fr.1', name: 'Ligue 1',             code: 'FL1' },
    { slug: 'en.2', name: 'Championship',        code: 'ELC' },
    { slug: 'nl.1', name: 'Eredivisie',          code: 'DED' },
    { slug: 'pt.1', name: 'Primeira Liga',       code: 'PPL' },
  ]
};

// Fetch & map one league's season JSON into our internal match shape (dates only,
// no kickoff time — we use the date at 15:00 local default and filter by day).
async function fetchFootballJson(slug, name, code) {
  try {
    const url = `${FOOTBALL_JSON.base}/${slug}.json`;
    const res = await fetch(url);
    if (!res.ok) { console.log(`FJSON ${slug} -> ${res.status}`); return []; }
    const data = await res.json();
    const out = [];
    for (const m of (data.matches || [])) {
      const home = m.team1 || '', away = m.team2 || '';
      if (!home || !away) continue;
      const ft = m.score && m.score.ft;
      const status = (Array.isArray(ft) && ft.length === 2) ? 'FINISHED' : 'TIMED';
      const fullTime = status === 'FINISHED'
        ? { home: parseInt(ft[0], 10), away: parseInt(ft[1], 10) } : null;
      out.push({
        id: `${slug}:${m.date}:${home}:${away}`,
        utcDate: `${m.date}T15:00:00Z`,
        status: status,
        matchday: typeof m.round === 'string' ? (parseInt(m.round.replace(/\D+/g, ''), 10) || null) : null,
        competition: { id: code, name: name, code: code, emblem: null },
        homeTeam: { id: null, name: home.replace(/\s*FC$/, ''), shortName: home.replace(/\s*FC$/, ''), tla: null, crest: null },
        awayTeam: { id: null, name: away.replace(/\s*FC$/, ''), shortName: away.replace(/\s*FC$/, ''), tla: null, crest: null },
        score: fullTime,
        _ssCompetition: name,
        _league: name,
        _source: 'FootballJSON',
        _ssUrl: ''
      });
    }
    return out;
  } catch (e) { console.log('FJSON fetch error:', e.message); return []; }
}

// ── football-data.org (optional fallback, needs key) ───────────────────────

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

// football-data.org competition codes for leagues with reliable standings data.
// Used to fetch per-league standings for Elo + form calculation.
const STANDINGS_CODES = [
  // Europe — Big-5 + secondary
  'PL', 'PD', 'BL1', 'SA', 'FL1',     // Big-5
  'DED', 'PPL', 'ELC', 'SB',          // Eredivisie, Primeira Liga, Championship, Süper Lig
  'BEL1', 'SUI1', 'AUT1', 'GRE1',     // Belgian, Swiss, Austrian, Greek
  'DEN1', 'NOR1', 'SWE1', 'POL1',     // Scandinavian + Polish
  'UKR1', 'ISR1', 'RUS1', 'CZE1',     // Eastern European
  // Americas
  'BSA',                              // Brasileirão
  'ARG1', 'MEX1',                     // Argentine + Liga MX
  // Asia (limited fd.org coverage)
  'KRE1', 'JPN1', 'CHN1', 'AUS1',
  // Africa (limited)
  'EGY1', 'RSA1', 'MAR1', 'TUN1',
];

// ── SportScore standings (used for strengths) ──────────────────────────────

const SS_STANDINGS = {
  'Premier League': 'english-premier-league',
  'La Liga': 'spanish-la-liga',
  'Serie A': 'italian-serie-a',
  'Ligue 1': 'french-ligue-1',
  'Brasileirão': 'brazilian-serie-a',
};

async function fetchSportScoreStandings(slug) {
  const data = await ssGet(`https://sportscore.com/api/widget/standings/?sport=football&slug=${slug}`);
  if (!data || !data.tables || !data.tables[0]) return null;
  return data;
}

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

// ── Shared helpers ─────────────────────────────────────────────────────────

function getDates() {
  const day = 86400000;
  return {
    today: new Date().toISOString().slice(0, 10),
    tomorrow: new Date(Date.now() + day).toISOString().slice(0, 10),
    yesterday: new Date(Date.now() - day).toISOString().slice(0, 10),
    weekLater: new Date(Date.now() + 7 * day).toISOString().slice(0, 10)
  };
}

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

function slimStandingsSS(data, n = 10) {
  if (!data || !data.tables || !data.tables[0]) return null;
  const t = data.tables[0].rows.slice(0, n).map(r => ({
    position: r.pos, team: r.team, crest: r.team_logo,
    played: r.p, won: r.w, draw: r.d, lost: r.l,
    goals: `${r.gf}:${r.ga}`, points: r.pts, form: null
  }));
  return { competition: data.competition, code: null, table: t, updatedAt: new Date().toISOString() };
}

// Drop matches whose teams are anonymous/placeholder names (e.g. SportScore
// returns ""Team zp5rzgh1lepq82w"" or "to-be-confirmed"). These would otherwise
// generate junk team pages and fill the sitemap with thin auto-generated URLs.
function isJunkTeamName(n) {
  if (!n) return true;
  const lc = String(n).trim().toLowerCase();
  if (!lc) return true;
  // Placeholder / anonymous opponents (spaces or hyphens), both English forms.
  if (lc === 'to be confirmed' || lc === 'to-be-confirmed' || lc === 'tbc' ||
      lc === 'to be decided' || lc === 'to-be-decided' || lc === 'tbd' ||
      lc === 'team' || lc === 'undecided' || lc === 'unknown' || lc === 'bye') return true;
  // "team <random-hash>" anonymous placeholders from the feed
  return /^team [a-z0-9]{6,}$/.test(lc) || /^team [a-f0-9]{8,}$/.test(lc);
}

// Clean noise out of an internal match list.
const dropNoise = arr => arr.filter(m => {
  const league = m._league || m._ssCompetition || (m.competition && m.competition.name) || '';
  // Drop matches with anonymous/placeholder teams on either side.
  const homeN = (m.homeTeam && m.homeTeam.name) || (m._home) || '';
  const awayN = (m.awayTeam && m.awayTeam.name) || (m._away) || '';
  if (isJunkTeamName(homeN) || isJunkTeamName(awayN)) return false;
  // Keep known-good leagues always.
  if (leaguePriority(league) >= 50) return true;
  // For unknown leagues, keep matches that are NOT clearly noise.
  return !isNoise(league);
});

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { today, tomorrow, yesterday, weekLater } = getDates();
  console.log(`Fetching football: today ${today}, tomorrow ${tomorrow}, yesterday ${yesterday}, week ${weekLater}`);
  console.log(`API-Football key: ${API_FOOTBALL_KEY ? 'present' : 'NONE'}; football-data key: ${KEY ? 'present' : 'NONE'}`);

  let ssToday = [], ssTomorrow = [], ssYesterday = [];
  let afToday = [], afTomorrow = [], afYesterday = [];
  let fjAll = []; // openfootball/football.json — all top-5 leagues
  let wcToday = [], wcTomorrow = [], wcYesterday = [];
  let fdToday = [], fdTomorrow = [], fdYesterday = [], fdUpcoming = [], fdRecent = [];

  // ── Step 1: API-Football (primary, when key present) ──
  if (API_FOOTBALL_KEY) {
    console.log('Trying API-Football (api-sports.io)...');
    [afToday, afTomorrow, afYesterday] = await Promise.all([
      fetchApiFootballDate(today),
      fetchApiFootballDate(tomorrow),
      fetchApiFootballDate(yesterday),
    ]);
    // drop noise from every source uniformly
    afToday = dropNoise(afToday); afTomorrow = dropNoise(afTomorrow); afYesterday = dropNoise(afYesterday);
    afToday = sortByLeague(afToday); afTomorrow = sortByLeague(afTomorrow); afYesterday = sortByLeague(afYesterday);
    console.log(`API-Football: today=${afToday.length}, tomorrow=${afTomorrow.length}, yesterday=${afYesterday.length}`);
  }

  // ── Step 2: openfootball/football.json — free public-domain, ALL top-5 leagues ──
  console.log('Trying openfootball/football.json (free public-domain, all top-5)...');
  const fjByLeague = await Promise.all(FOOTBALL_JSON.leagues.map(l =>
    fetchFootballJson(l.slug, l.name, l.code)
  ));
  fjAll = fjByLeague.flat();
  const fjToday = fjAll.filter(m => m.utcDate && m.utcDate.slice(0, 10) === today);
  const fjTomorrow = fjAll.filter(m => m.utcDate && m.utcDate.slice(0, 10) === tomorrow);
  const fjYesterday = fjAll.filter(m => m.utcDate && m.utcDate.slice(0, 10) === yesterday);
  console.log(`FootballJSON: today=${fjToday.length}, tomorrow=${fjTomorrow.length}, yesterday=${fjYesterday.length}, seasonTotal=${fjAll.length}`);

  // ── Step 3: WorldCup26 free API (England + Spain, zero key) ──
  console.log('Trying WorldCup26 (worldcup26.ir, no key) — England & Spain...');
  const wcSlugs = Object.keys(WC26.slugs);
  const wcResults = await Promise.all(wcSlugs.map(slug =>
    Promise.all([
      fetchWc26(slug, WC26.slugs[slug], today.replace(/-/g, ''), today.replace(/-/g, '')),
      fetchWc26(slug, WC26.slugs[slug], tomorrow.replace(/-/g, ''), tomorrow.replace(/-/g, '')),
      fetchWc26(slug, WC26.slugs[slug], yesterday.replace(/-/g, ''), yesterday.replace(/-/g, '')),
    ])
  ));
  // Flatten across leagues; merge home/away so we keep all matches
  for (let qi = 0; qi < wcSlugs.length; qi++) {
    wcToday = wcToday.concat(wcResults[qi][0]);
    wcTomorrow = wcTomorrow.concat(wcResults[qi][1]);
    wcYesterday = wcYesterday.concat(wcResults[qi][2]);
  }
  wcToday = sortByLeague(wcToday); wcTomorrow = sortByLeague(wcTomorrow); wcYesterday = sortByLeague(wcYesterday);
  console.log(`WorldCup26: today=${wcToday.length}, tomorrow=${wcTomorrow.length}, yesterday=${wcYesterday.length}`);

  // ── Step 3: SportScore (zero-key fallback / enrichment) ──
  console.log('Trying SportScore (no API key required)...');
  const ssMatches = await fetchSportScoreToday(120);
  console.log(`SportScore returned ${ssMatches.length} matches (raw)`);
  const goodSS = dropNoise(ssMatches);
  ssToday = goodSS.filter(m => m.utcDate && m.utcDate.slice(0, 10) === today);
  ssTomorrow = goodSS.filter(m => m.utcDate && m.utcDate.slice(0, 10) === tomorrow);
  ssYesterday = goodSS.filter(m => m.utcDate && m.utcDate.slice(0, 10) === yesterday);
  ssToday = sortByLeague(ssToday); ssTomorrow = sortByLeague(ssTomorrow); ssYesterday = sortByLeague(ssYesterday);
  console.log(`SportScore filtered: today=${ssToday.length}, tomorrow=${ssTomorrow.length}, yesterday=${ssYesterday.length}`);

  // ── Step 4: football-data.org (optional) ──
  if (KEY) {
    console.log('Also fetching from football-data.org...');
    [fdToday, fdTomorrow, fdYesterday, fdUpcoming] = await Promise.all([
      fetchMatches(today, today),
      fetchMatches(tomorrow, tomorrow),
      fetchMatches(yesterday, yesterday),
      fetchMatches(today, weekLater)
    ]);
    try {
      const day = 86400000;
      const weekAgo = new Date(Date.now() - 7 * day).toISOString().slice(0, 10);
      const recentData = await fdGet(`https://api.football-data.org/v4/matches?dateFrom=${weekAgo}&dateTo=${today}`);
      fdRecent = (recentData && recentData.matches) || [];
    } catch (e) { console.log('Recent results fetch failed:', e.message); }
  }

  // ── Step 5: Pick primary per-day source with priority ──
  // Prefer API-Football (if it gave matches), then openfootball/football.json
  // (free, ALL top-5 leagues), then WorldCup26 (England+Spain), then SportScore,
  // then football-data.org.
  const fjMatch = (arr, day) => arr.filter(m => m.utcDate && m.utcDate.slice(0, 10) === day);
  function pick(af, fj, wc, ss, fd, day) {
    if (af.length) return af;
    if (fj.length) return fj;
    const fjw = fjMatch(fjAll, day);
    if (fjw.length) return fjw;
    if (wc.length) return wc;
    if (ss.length) return ss;
    return fd;
  }
  // Merge multiple sources and dedupe, keeping league priority order.
  // This lets us KEEP broader coverage (SportScore's non-noise small leagues,
  // e.g. LigaPro, Categoría Primera A, Brazilian Cup) alongside the top-8
  // football.json majors instead of replacing them.
  function mergeSourceSets(sets) {
    const seen = new Set();
    const out = [];
    for (const arr of sets) {
      for (const m of arr || []) {
        const h = (m.homeTeam && m.homeTeam.name) || m._home || '';
        const a = (m.awayTeam && m.awayTeam.name) || m._away || '';
        // Never let anonymous/placeholder team matches into the output, whatever source.
        if (isJunkTeamName(h) || isJunkTeamName(a)) continue;
        const key = m.id || `${h}||${a}||${m.utcDate}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(m);
      }
    }
    return sortByLeague(out);
  }
  let todayFinal = mergeSourceSets([pick(afToday, fjToday, wcToday, ssToday, fdToday, today), ssToday]);
  let tomorrowFinal = mergeSourceSets([pick(afTomorrow, fjTomorrow, wcTomorrow, ssTomorrow, fdTomorrow, tomorrow), ssTomorrow]);
  let yesterdayFinal = mergeSourceSets([pick(afYesterday, fjYesterday, wcYesterday, ssYesterday, fdYesterday, yesterday), ssYesterday]);
  const upcomingFinal = mergeSourceSets([
    afTomorrow.length ? afTomorrow : fjTomorrow.length ? fjTomorrow : wcTomorrow.length ? wcTomorrow : [],
    ssTomorrow,
    afToday.length ? afToday : fjToday.length ? fjToday : wcToday.length ? wcToday : [],
    ssToday,
  ]).slice(0, 40);

  // Recent results for form from every source
  const allRecent = fdRecent.length > 0 ? fdRecent :
    fjYesterday.filter(m => m.status === 'FINISHED').concat(
      ssYesterday.concat(ssToday.filter(m => m.status === 'FINISHED')).concat(afYesterday).concat(afToday.filter(m => m.status === 'FINISHED'))
    );

  const dataSource = API_FOOTBALL_KEY && afToday.length > 0 ? 'API-Football'
    : todayFinal && todayFinal[0] && todayFinal[0]._source === 'FootballJSON' ? 'openfootball/football.json'
    : todayFinal && todayFinal[0] && todayFinal[0]._source === 'WorldCup26' ? 'WorldCup26'
    : todayFinal && todayFinal[0] && todayFinal[0]._source === 'SportScore' ? 'SportScore'
    : todayFinal && todayFinal[0] && todayFinal[0]._source === 'API-Football' ? 'API-Football'
    : fdToday.length > 0 ? 'football-data.org' : 'none';

  console.log(`\nMerged data: today=${todayFinal.length}, tomorrow=${tomorrowFinal.length}, yesterday=${yesterdayFinal.length}, upcoming=${upcomingFinal.length} (source: ${dataSource})`);

  // ── Strengths from standings (needs todayFinal/tomorrowFinal context) ──
  const strengths = new Map();
  for (const leagueName of Object.keys(SS_STANDINGS)) {
    try {
      const slug = SS_STANDINGS[leagueName];
      const st = await fetchSportScoreStandings(slug);
      const s = buildSSStrengths(st);
      if (s.size > 0) { console.log(`  standings ${leagueName}: ${s.size} teams`); for (const [k, v] of s) strengths.set(k, v); }
    } catch (e) { console.log(`  standings ${leagueName} failed: ${e.message}`); }
  }
  let plScorers = null;
  if (KEY) {
    const allFd = fdToday.concat(fdTomorrow);
    const compCodes = [...new Set(allFd.map(m => m.competition && m.competition.code).filter(Boolean))];
    const toFetch = compCodes.filter(c => STANDINGS_CODES.includes(c)).slice(0, 10);
    for (const code of toFetch) {
      try {
        const st = await fetchStandings(code);
        const s = buildStrengths(st);
        if (s.size > 0) { console.log(`  fd.org standings ${code}: ${s.size} teams`); for (const [k, v] of s) strengths.set(k, v); }
      } catch (e) { console.log(`  fd.org standings ${code} failed: ${e.message}`); }
    }
    try { plScorers = await fetchScorers('PL'); } catch (e) {}
  }

  const enrich = arr => arr.map(m => enrichMatch(m, strengths, allRecent));
  const write = (file, data) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  };

  // Total-outage guard: if every source returned nothing, DO NOT overwrite the
  // previously deployed data (which still has yesterday's real fixtures). This
  // keeps the site populated during an API outage instead of showing "no matches".
  const hasAnyData =
    todayFinal.length > 0 || tomorrowFinal.length > 0 ||
    yesterdayFinal.length > 0 || upcomingFinal.length > 0;

  if (!hasAnyData) {
    console.log('⚠️ No data from any source — keeping previous football data files.');
    return;
  }

  write('football/today.json', { date: today, count: todayFinal.length, matches: enrich(todayFinal), source: `openfootball/football.json + WorldCup26 + SportScore${API_FOOTBALL_KEY ? ' + API-Football' : ''}`, strengthsFromStandings: strengths.size, lastUpdate: new Date().toISOString() });
  write('football/tomorrow.json', { date: tomorrow, count: tomorrowFinal.length, matches: enrich(tomorrowFinal), source: `openfootball/football.json + WorldCup26 + SportScore${API_FOOTBALL_KEY ? ' + API-Football' : ''}`, strengthsFromStandings: strengths.size, lastUpdate: new Date().toISOString() });
  write('football/yesterday.json', { date: yesterday, count: yesterdayFinal.length, matches: enrich(yesterdayFinal), source: `openfootball/football.json + WorldCup26 + SportScore${API_FOOTBALL_KEY ? ' + API-Football' : ''}`, strengthsFromStandings: strengths.size, lastUpdate: new Date().toISOString() });
  write('football/upcoming.json', { dateFrom: today, dateTo: weekLater, count: upcomingFinal.length, matches: enrich(upcomingFinal).slice(0, 30), source: `openfootball/football.json + WorldCup26 + SportScore${API_FOOTBALL_KEY ? ' + API-Football' : ''}`, strengthsFromStandings: strengths.size, lastUpdate: new Date().toISOString() });
  write('football/results.json', { date: yesterday, count: yesterdayFinal.length, matches: enrich(yesterdayFinal.filter(m => m.status === 'FINISHED')), source: `openfootball/football.json + WorldCup26 + SportScore${API_FOOTBALL_KEY ? ' + API-Football' : ''}`, strengthsFromStandings: strengths.size, lastUpdate: new Date().toISOString() });
  write('football/fixtures.json', { dateFrom: today, dateTo: weekLater, count: upcomingFinal.length, matches: enrich(upcomingFinal), source: `openfootball/football.json + WorldCup26 + SportScore${API_FOOTBALL_KEY ? ' + API-Football' : ''}`, strengthsFromStandings: strengths.size, lastUpdate: new Date().toISOString() });

  // ── live.json (drives /live.html) ──
  let plStandings = null;
  try {
    const plSS = await fetchSportScoreStandings('english-premier-league');
    if (plSS) plStandings = { standings: [{ table: (plSS.tables[0].rows || []).map(r => ({
      position: r.pos, team: { name: r.team, crest: r.team_logo },
      playedGames: r.p, won: r.w, draw: r.d, lost: r.l,
      goalsFor: r.gf, goalsAgainst: r.ga, points: r.pts, form: null
    }))}], competition: { name: 'Premier League', code: 'PL' } };
  } catch (e) { console.log('SportScore PL standings failed:', e.message); }

  const live = {
    date: today,
    matches: enrich(todayFinal),
    standings: plStandings ? (plStandings.standings ? slimStandings(plStandings) : slimStandingsSS(plStandings)) : null,
    scorers: plScorers && plScorers.scorers ? plScorers.scorers.slice(0, 6).map(s => ({
      player: s.player.name, team: s.team ? s.team.name : '', goals: s.goals || 0, assists: s.assists || 0
    })) : [],
    source: dataSource,
    strengthsFromStandings: strengths.size,
    lastUpdate: new Date().toISOString()
  };
  write('football/live.json', live);
  console.log(`✅ Football data saved (live.json: ${live.matches.length} matches, standings: ${live.standings ? 'ok' : 'none'})`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
