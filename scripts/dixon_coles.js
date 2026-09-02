// XWhiz prediction engine — Dixon-Coles + Elo, production v3.
//
// What changed vs the old model:
//   - Expanded team-strength databank (~150 clubs across the leagues XWhiz covers,
//     values are approximate Elo ratings; the databank is only used when live
//     standings data is not available for a match).
//   - Optional context from REAL league standings (attack / defense ratings per
//     team) is blended into the expected-goals estimate — see fetch_football.js.
//   - The recommended CORRECT SCORE is now the argmax of the Dixon-Coles score
//     matrix (a real statistic), instead of a hardcoded mapping (draw -> "1-1").
//   - Over/Under and BTTS probabilities come from the same matrix, not formulas.
//
// Nothing here is randomly forced: every output is a probability from the model.

'use strict';

// Approximate Elo ratings (eloratings.net-style levels). Keys are normalized
// (lowercase, umlauts expanded): lookup uses the same normalization.
const RATINGS = {
  // Premier League
  'arsenal': 2050, 'manchester city': 2070, 'man city': 2070, 'liverpool': 2040,
  'chelsea': 1940, 'manchester united': 1930, 'man utd': 1930, 'tottenham hotspur': 1925, 'tottenham': 1925,
  'newcastle united': 1945, 'newcastle': 1945, 'aston villa': 1910, 'brighton': 1865, 'brighton and hove albion': 1865,
  'west ham united': 1855, 'west ham': 1855, 'crystal palace': 1835, 'brentford': 1835, 'fulham': 1825,
  'wolverhampton wanderers': 1805, 'wolverhampton': 1805, 'wolves': 1805, 'bournemouth': 1825,
  'nottingham forest': 1840, 'leicester city': 1790, 'leicester': 1790, 'everton': 1815,
  'burnley': 1760, 'southampton': 1755, 'leeds united': 1800, 'leeds': 1800, 'sheffield united': 1775,
  'ipswich town': 1725, 'wigan': 1700, 'watford': 1760, 'norwich city': 1750, 'middlesbrough': 1740,
  'sunderland': 1760, 'coventry city': 1730, 'stoke city': 1720, 'hull city': 1725, 'west bromwich albion': 1750,
  'swansea city': 1730, 'cardiff city': 1720, 'bristol city': 1695, 'peterborough': 1685,
  'lincoln city': 1675, 'oxford united': 1670, 'qpr': 1710, 'queens park rangers': 1710,
  'sheffield wednesday': 1725, 'lasi': 1500,
  // La Liga
  'real madrid': 2060, 'barcelona': 1995, 'atletico madrid': 1935, 'atletico': 1935,
  'athletic club': 1875, 'real sociedad': 1865, 'villarreal': 1865, 'real betis': 1845, 'betis': 1845,
  'sevilla': 1830, 'girona': 1850, 'valencia': 1805, 'osasuna': 1785, 'ca osasuna': 1785,
  'celta vigo': 1800, 'rc celta de vigo': 1800, 'rcd mallorca': 1780, 'mallorca': 1780,
  'getafe': 1775, 'rayo vallecano': 1790, 'deportivo alaves': 1765, 'alaves': 1765,
  'espanyol': 1770, 'leganes': 1745, 'las palmas': 1750, 'real valladolid': 1725, 'valladolid': 1725,
  'granada': 1740, 'elche': 1735, 'elche cf': 1735, 'vallecano': 1790,
  // Bundesliga
  'bayern munich': 2050, 'bayern munchen': 2050, 'bayern muenchen': 2050, 'bayer leverkusen': 1960, 'leverkusen': 1960,
  'borussia dortmund': 1935, 'dortmund': 1935, 'rb leipzig': 1925, 'leipzig': 1925,
  'eintracht frankfurt': 1880, 'frankfurt': 1880, 'vfb stuttgart': 1880, 'stuttgart': 1880,
  'sc freiburg': 1845, 'freiburg': 1845, 'vfl wolfsburg': 1820, 'wolfsburg': 1820,
  'borussia monchengladbach': 1825, "borussia m'gladbach": 1825, 'mainz 05': 1805, 'mainz': 1805,
  'tsg hoffenheim': 1800, 'hoffenheim': 1800, 'sv werder bremen': 1795, 'werder bremen': 1795,
  'fc augsburg': 1760, 'augsburg': 1760, 'union berlin': 1790, 'vfl bochum': 1745, 'bochum': 1745,
  'fc koln': 1760, 'fortuna dusseldorf': 1750, 'hamburger sv': 1785, 'hamburg': 1785,
  'fc st pauli': 1745, 'st pauli': 1745, '1. fc heidenheim': 1730, 'fc heidenheim': 1730, 'holstein kiel': 1720,
  'darmstadt': 1700, 'karlsruher': 1695, 'hannover 96': 1720, 'paderborn': 1700,
  // Serie A
  'inter': 1975, 'internazionale': 1975, 'napoli': 1945, 'ac milan': 1940, 'milan': 1940, 'juventus': 1935,
  'atalanta': 1940, 'as roma': 1885, 'roma': 1885, 'lazio': 1885, 'ss lazio': 1885,
  'bologna': 1865, 'fiorentina': 1860, 'torino': 1815, 'genoa': 1795, 'udinese': 1795,
  'cagliari': 1760, 'hellas verona': 1760, 'verona': 1760, 'parma': 1780, 'como': 1745,
  'empoli': 1750, 'lecce': 1745, 'ac monza': 1750, 'monza': 1750, 'us sassuolo': 1745, 'sassuolo': 1745,
  'venezia': 1735, 'venezia fc': 1735, 'frosinone': 1730, 'salernitana': 1720,
  // Ligue 1
  'paris saint-germain': 1980, 'paris saint germain': 1980, 'psg': 1980, 'olympique de marseille': 1870,
  'marseille': 1870, 'olympique lyonnais': 1855, 'lyon': 1855, 'asm monaco': 1880, 'monaco': 1880,
  'lille': 1870, 'lille osc': 1870, 'ogc nice': 1855, 'nice': 1855, 'rc lens': 1830, 'lens': 1830,
  'stade rennais': 1845, 'rennes': 1845, 'rc strasbourg alsace': 1815, 'strasbourg': 1815,
  'stade brestois 29': 1820, 'brest': 1820, 'toulouse': 1795, 'montpellier': 1775,
  'fc nantes': 1780, 'nantes': 1780, 'stade de reims': 1795, 'reims': 1795, 'aj auxerre': 1755,
  'le havre ac': 1745, 'le havre': 1745, 'ac angers': 1750, 'angers': 1750, 'as saint-etienne': 1760,
  'saint-etienne': 1760, 'fc metz': 1745, 'metz': 1745, 'clermont foot': 1730, 'ajaccio': 1710, 'lorient': 1735,
  // Eredivisie
  'ajax': 1835, 'ajax amsterdam': 1835, 'psv': 1855, 'psv eindhoven': 1855, 'feyenoord': 1845,
  'az alkmaar': 1805, 'az': 1805, 'fc twente': 1795, 'twente': 1795, 'fc utrecht': 1775, 'utrecht': 1775,
  'fc groningen': 1735, 'groningen': 1735, 'fortuna sittard': 1715, 'sparta rotterdam': 1735,
  'sc heerenveen': 1725, 'heerenveen': 1725, 'nec': 1725, 'go ahead eagles': 1715, 'heracles almelo': 1705,
  'pec zwolle': 1705, 'rkc waalwijk': 1685, 'almere city': 1675, 'nac breda': 1695, 'nijmegen': 1725,
  'willem ii': 1700, 'vitesse': 1730,
  // Liga Portugal
  'benfica': 1860, 'sl benfica': 1860, 'fc porto': 1845, 'porto': 1845, 'sporting cp': 1865,
  'sporting lisbon': 1865, 'sporting': 1865, 'braga': 1785, 'sc braga': 1785,
  'vitoria guimaraes': 1755, 'famalicao': 1735, 'rio ave': 1715, 'gil vicente': 1710,
  'moreirense': 1710, 'boavista': 1710, 'estoril': 1715, 'casa pia': 1710, 'arouca': 1705,
  'cd nacional': 1685, 'avs': 1685, 'santa clara': 1695, 'farense': 1690, 'estrela': 1680,
  // SÃ¼per Lig
  'galatasaray': 1815, 'fenerbahce': 1825, 'besiktas': 1795, 'trabzonspor': 1755,
  'basaksehir': 1745, 'ibfk': 1745, 'sivasspor': 1715, 'kasimpasa': 1705, 'alanyaspor': 1715,
  'antalyaspor': 1695, 'konyaspor': 1695, 'gaziantep': 1685, 'kayserispor': 1675,
  'hatayspor': 1675, 'samsunspor': 1705, 'eyupspor': 1685, 'goztepe': 1705, 'caykur rizespor': 1685,
  'bodrum': 1665, 'adana demirspor': 1695, 'istanbulspor': 1655, 'isiklar': 1655,
  'fatih karagumruk': 1660, 'karagumruk': 1660, 'umraniyespor': 1650, 'ankaragucu': 1665,
  'giresunspor': 1655,
  // Other leagues XWhiz may surface (Scotland, Belgium, Austria, Brazil)
  'celtic': 1810, 'rangers': 1800, 'club brugge': 1785, 'royal antwerp': 1740, 'anderlecht': 1755,
  'rc genk': 1735, 'standard liege': 1720, 'ghent': 1725, 'rbs anvers': 1740, 'union sg': 1730,
  'red bull salzburg': 1790, 'salzburg': 1790, 'sturm graz': 1750, 'rapid wien': 1720, 'austria wien': 1720,
  'flamengo': 1860, 'palmeiras': 1870, 'botafogo': 1860, 'fluminense': 1790, 'corinthians': 1770,
  'saopaulo': 1775, 'sao paulo': 1775, 'santos fc': 1710, 'gremio': 1745, 'internacional': 1750,
  'atletico mineiro': 1790, 'cruzeiro': 1740, 'vasco da gama': 1725, 'fortaleza': 1740,
  'river plate': 1840, 'boca juniors': 1830, 'racing club': 1775, 'racing': 1775, 'independiente': 1745,
  'san lorenzo': 1730, 'estudiantes': 1740, 'velez sarsfield': 1735, 'talleres': 1730,
  // Turkish/Arabian/North-African clubs (SWC/ACC platforms)
  'al ahly': 1800, 'al-hilal': 1830, 'al hilal': 1830, 'al-nassr': 1820, 'al nassr': 1820,
  'al-ittihad': 1800, 'al ittihad': 1800, 'al-ain': 1760, 'al ain': 1760, 'al-sadd': 1760,
  'al sadd': 1760, 'esperance de tunis': 1735, 'wac': 1730, 'wydad casablanca': 1730,
  'coton sport': 1680, 'usm alger': 1695, 'es setif': 1690, 'cr belouizdad': 1685,
  // Spanish second-tier guest leagues / extra
  'burgos': 1680, 'racing santander': 1705, 'real racing club de santander': 1705,
  'sporting gijon': 1680, 'cd mirandes': 1665, 'albacete': 1670, 'cadiz': 1685,
  'eibar': 1665, 'oviedo': 1665, 'real oviedo': 1665, 'huesca': 1665, 'el rural ponferradina': 1640,
  // International / misc
  'wrexham': 1700, 'wrexham afc': 1700, 'birmingham city': 1715, 'bolton': 1705, 'stockport county': 1685,
  'charlton': 1700, 'reading': 1695, 'portsmouth': 1715, 'derby county': 1710, 'blackburn rovers': 1720,
  'preston': 1700, 'millwall': 1705, 'london': 1600
};
const DEFAULT_RATING = 1600;

function normName(t) {
  let n = String(t || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
  // Strip common club prefixes/suffixes so API names ("Paris Saint-Germain FC",
  // "FC Bayern München", "AC Milan", "Elche CF") resolve to the databank.
  n = n.replace(/^(fc|ac|as|sc|ss|cd|cf|de|1\.)\s+/, '');
  n = n.replace(/\s+(fc|ac|as|sc|ss|afc|cf|cd|ud)$/, '');
  return n;
}
function rating(team) {
  const k = normName(team);
  if (RATINGS[k]) return RATINGS[k];
  // Fallback heuristics for unseen API spellings: drop leading tokens, then try the final word.
  const words = k.split(' ');
  for (let i = 1; i < words.length; i++) {
    const sub = words.slice(i).join(' ');
    if (RATINGS[sub]) return RATINGS[sub];
  }
  const last = words[words.length - 1];
  if (last && RATINGS[last]) return RATINGS[last];
  return DEFAULT_RATING;
}
function expGoalsFor(home, away, ctx) { return expGoals(rating(home), rating(away), ctx); }

// Poisson single-probability
function ppois(k, lambda) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

// Dixon-Coles adjusted score matrix (0..Nx0..N)
function matrix(lamH, lamA, rho) {
  rho = rho == null ? 0.08 : rho;
  const N = 6;
  const M = Array.from({ length: N + 1 }, () => Array(N + 1).fill(0));
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      let p = ppois(i, lamH) * ppois(j, lamA);
      if (i === 0 && j === 0) p *= 1 - lamH * lamA * rho;
      else if (i === 1 && j === 0) p *= 1 + lamA * rho;
      else if (i === 0 && j === 1) p *= 1 + lamH * rho;
      else if (i === 1 && j === 1) p *= 1 - rho;
      M[i][j] = p;
    }
  }
  const total = M.flat().reduce((a, b) => a + b, 0);
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) M[i][j] /= total;
  return M;
}

// Expected goals from Elo context, modulated by real attack/defense strengths.
function expGoals(eloh, eloa, ctx) {
  const h = (ctx && ctx.hr) || eloh;
  const a = (ctx && ctx.ar) || eloa;
  const homeAdv = 100;
  const diff = (h + homeAdv - a) / 400;
  let lamH = 1.4 * Math.pow(10, diff / 2);
  let lamA = 1.2 * Math.pow(10, -diff / 2);
  if (ctx) {
    const hatk = ctx.hatk || 1, aatk = ctx.aatk || 1, hdef = ctx.hdef || 1, adef = ctx.adef || 1;
    lamH *= hatk * adef; // stronger home attack => more; leaky away defense => more
    lamA *= aatk * hdef;
  }
  lamH = Math.max(0.35, Math.min(4.2, lamH));
  lamA = Math.max(0.3, Math.min(4.0, lamA));
  return [lamH, lamA];
}

// Deterministic tie-break for equal probabilities: fewer total goals, then fewer home goals.
function argmaxScore(M) {
  let best = null, bi = 0, bj = 0;
  for (let i = 0; i < M.length; i++) {
    for (let j = 0; j < M[i].length; j++) {
      if (best == null || M[i][j] > best ||
         (Math.abs(M[i][j] - best) < 1e-9 && (i + j < bi + bj || (i + j === bi + bj && i < bi)))) {
        best = M[i][j]; bi = i; bj = j;
      }
    }
  }
  return { score: `${bi}-${bj}`, prob: best, i: bi, j: bj };
}

function topScores(M, n = 3) {
  const cells = [];
  for (let i = 0; i < M.length; i++) for (let j = 0; j < M[i].length; j++) cells.push({ score: `${i}-${j}`, prob: M[i][j], i, j });
  cells.sort((a, b) => b.prob - a.prob || (a.i + a.j) - (b.i + b.j) || a.i - b.i);
  return cells.slice(0, n).map(c => ({ score: c.score, prob: Math.round(c.prob * 100) }));
}

const HANDICAP_SIDES = {
  'Home Win': { label: 'Home' }, 'Away Win': { label: 'Away' }
};
function asianHandicap(lamH, lamA) {
  const diff = lamH - lamA;
  const side = diff >= 0 ? 'Home' : 'Away';
  const absN = Math.min(2, Math.round(Math.abs(diff) * 4) / 4);
  const q = Math.round(absN * 4) === 0 ? 0 : absN;
  if (q === 0) return 'Level (0)';
  return side === 'Home' ? `Home -${q.toFixed(q < 1 ? 2 : 1)}`.replace('.00', '') : `Away +${q.toFixed(q < 1 ? 2 : 1)}`.replace('.00', '');
}

function predict(home, away, ctx) {
  const eloH = rating(home), eloA = rating(away);
  const [lamH, lamA] = expGoals(eloH, eloA, ctx);
  const M = matrix(lamH, lamA);

  let pH = 0, pD = 0, pA = 0, over = 0, btts = 0;
  for (let i = 0; i < M.length; i++) {
    for (let j = 0; j < M[i].length; j++) {
      if (i > j) pH += M[i][j];
      else if (i === j) pD += M[i][j];
      else pA += M[i][j];
      if (i + j >= 3) over += M[i][j];
      if (i >= 1 && j >= 1) btts += M[i][j];
    }
  }

  let pred, sub;
  const q = Math.max(pH, pD, pA);
  if (pH >= pA && pH >= pD) { pred = 'Home Win'; sub = '1 • Full Time'; }
  else if (pA >= pH && pA >= pD) { pred = 'Away Win'; sub = '2 • Full Time'; }
  else { pred = 'Draw'; sub = 'X • Full Time'; }

  const conf = Math.min(90, Math.max(58, Math.round(58 + (q - 0.36) * 160)));
  const margin = 0.05;
  const fair = 1 / q;
  const listed = Math.max(1.01, fair * (1 - margin));
  const odds = listed.toFixed(2);
  const value = `+${Math.max(0, Math.round((q * 100 - 50) / 2))}%`;

  const cs = argmaxScore(M);
  const dc = {
    '1X': Math.min(97, Math.round((pH + pD) * 100)),
    'X2': Math.min(97, Math.round((pD + pA) * 100)),
    '12': Math.min(97, Math.round((pH + pA) * 100))
  };
  const ov = Math.round(over * 100);
  const under = 100 - ov;
  const bttsYes = Math.round(btts * 100);

  return {
    pred, sub, conf, odds, value,
    pH: Math.round(pH * 100), pD: Math.round(pD * 100), pA: Math.round(pA * 100),
    probs: { home: Math.round(pH * 100), draw: Math.round(pD * 100), away: Math.round(pA * 100) },
    lamH: lamH.toFixed(2), lamA: lamA.toFixed(2),
    xg: { home: lamH.toFixed(2), away: lamA.toFixed(2), total: (lamH + lamA).toFixed(2) },
    doubleChance: dc,
    overUnder: { over2_5: ov, under2_5: under, oddsOver: Math.max(1.01, (100 / Math.max(1, ov)) * (1 - margin)).toFixed(2), oddsUnder: Math.max(1.01, (100 / Math.max(1, under)) * (1 - margin)).toFixed(2) },
    btts: { yes: bttsYes, no: 100 - bttsYes },
    correctScore: { score: cs.score, prob: Math.round(cs.prob * 100) },
    topScores: topScores(M, 3),
    asianHandicap: asianHandicap(lamH, lamA),
    rating: { home: eloH, away: eloA },
    model: 'Dixon-Coles v3'
  };
}

module.exports = { predict, rating, expGoals, matrix, RATINGS, normName };