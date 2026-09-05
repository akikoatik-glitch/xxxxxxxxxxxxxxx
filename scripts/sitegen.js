// ============================================================
// XWhiz static site generator (multilingual: en @ root, /fr/, /ar/ RTL)
// Replaces the old build_pages.js.
//   Input : predictions.json, news.json, football/*.json
//   Output: all HTML pages per locale, sitemap.xml (with hreflang),
//           robots.txt, llms.txt, per-locale search-index.json
// Run daily in CI after fetch_football.js + generate-predictions.js + fetch_news.js
// Usage: node scripts/sitegen.js [--batch|--full]
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const i18n = require('./i18n');
const dcModel = require('./dixon_coles');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://xwhiz.com';
const LOCALES = ['en', 'fr', 'ar'];
const DAY = 86400000;

// Tiny .env loader (so GA4_ID / MELBET_LINK can come from env in CI)
try {
  const envPaths = ['.env', path.join(ROOT, '.env')];
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
// Google Analytics 4 — only injected when a measurement ID is provided.
const GA4 = (process.env.GA4_ID || '').trim();

const read = f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { return null; } };
const readJSON = f => { try { return JSON.parse(read(f)); } catch (e) { return null; } };
const writePath = (f, c) => { fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true }); fs.writeFileSync(path.join(ROOT, f), c); console.log('  • ' + f); };
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
// Format a match "form" value into readable text. m.form may be a plain string
// or an object like { home: "WDLWW", away: "DLWWD" } (or nulls when unknown).
function fmtForm(f) {
  if (f == null) return 'No recent form data available.';
  if (typeof f === 'string') return f.trim() ? f.trim() : 'No recent form data available.';
  if (typeof f === 'object') {
    const parts = [];
    if (f.home) parts.push(`Home: ${f.home}`);
    if (f.away) parts.push(`Away: ${f.away}`);
    if (parts.length) return parts.join(' · ');
    return 'No recent form data available.';
  }
  return String(f);
}
// Clean team names coming from feeds: fix spacing/casing artefacts like
// "Barcelona SC(ECU)" -> "Barcelona SC (ECU)" or "Knoxville troops" -> "Knoxville Troops".
// Keeps acronyms (SC, FC, RC) uppercase, title-cases ordinary words.
function cleanTeamName(n) {
  if (n == null) return '';
  let s = String(n).trim().replace(/\s+/g, ' ');
  if (!s) return '';
  s = s.replace(/([A-Za-z])\((ECU|USA|ENG|ESP|FRA|GER|ITA)\)/g, '$1 ($2)');
  s = s.replace(/\)\(/g, ') (');
  const KEEP = new Set(['SC', 'FC', 'RC', 'AC', 'AS', 'CF', 'CD', 'UD', 'CA', 'ECU', 'USA', 'U20', 'OSC', 'PSG', 'BVB']);
  const LOWER = new Set(['de', 'del', 'da', 'do', 'das', 'dos', 'der', 'den', 'van', 'von', 'el', 'la', 'le', 'les', 'al', 'y', 'e']);
  s = s.split(' ').map(w => {
    const up = w.toUpperCase();
    if (KEEP.has(up)) return up;
    if (LOWER.has(w.toLowerCase()) && /^[A-Za-z]+$/.test(w)) return w.toLowerCase();
    if (/^[A-Z0-9\-\.']+$/.test(w) && w.length <= 4) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
  return s;
}
// Single source of truth for "date • time" lines. predictions.json `precise`
// already contains "15:00 UTC • 17:00 CET", so don't prepend utcTime() again
// (that produced "15:00 UTC • 15:00 UTC • 17:00 CET" on cards).
function formatMatchTime(loc, m) {
  const date = fmtDate(loc, m.utcDate);
  const precise = (m.precise || '').trim();
  if (precise && /UTC/.test(precise)) return `${date} • ${precise}`;
  const tt = utcTime(m);
  if (precise) return `${date} • ${tt} UTC • ${precise}`;
  return `${date} • ${tt} UTC`;
}
// Over 2.5 / BTTS hubs: m.pred is a 1X2 pick ("Home Win"...), never "Over 2.5",
// so filtering by pred always yields 0 tips (thin "0 Over 2.5" cards). Derive
// from the Dixon-Coles matrix probabilities instead.
function isOverTip(m) {
  if (!m) return false;
  if (m.pred === 'Over 2.5') return true;
  const v = m.overUnder && (m.overUnder.over2_5 ?? m.overUnder.over);
  return typeof v === 'number' && v >= 55;
}
function isBttsTip(m) {
  if (!m) return false;
  if (m.pred === 'BTTS Yes') return true;
  const v = m.btts && m.btts.yes;
  return typeof v === 'number' && v >= 55;
}
const todayISO = () => new Date().toISOString().slice(0, 10);
const slugify = s => String(s == null ? '' : s).toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const num = (loc, n) => {
  const v = n == null ? '' : n;
  try { return Number(v).toLocaleString(loc === 'fr' ? 'fr-FR' : 'en-US'); } catch (e) { return String(v); }
};
const fmtDate = (loc, iso) => {
  try { return new Date(iso).toLocaleDateString(loc === 'fr' ? 'fr-FR' : loc === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return iso || ''; }
};

// ---- data ----
const preds = readJSON('predictions.json') || { matches: [], results: [], news: [] };
const newsData = readJSON('news.json') || { news: [] };
const fDay = readJSON('football/today.json');
const fTom = readJSON('football/tomorrow.json');
const fYest = readJSON('football/yesterday.json');
const fLive = readJSON('football/live.json');
const fFix = readJSON('football/fixtures.json');
const MELBET = preds.melbetLink || ('https://melbet-49771.bar/en?tag=d_5217846m_2170c_&site=5217846&ad=2170&promo=KIKOS77');
const CODE = preds.promoCode || 'KIKOS77';

const slugUsed = new Set();
const MATCHES = Array.isArray(preds.matches) ? preds.matches.map(normalizeMatch).filter(Boolean) : [];
const NEWS = Array.isArray(newsData.news) ? newsData.news : [];
// News categories actually present in the feed (football-only since fetch_news
// was scoped to soccer). Avoids thin empty /news/tennis + /news/basketball hubs.
const NEWS_CATS = [...new Set(NEWS.map(n => (n.category || '').toLowerCase()).filter(Boolean))];
if (!NEWS_CATS.length) NEWS_CATS.push('football');
const TOMORROW = Array.isArray(fTom && fTom.matches) ? fTom.matches : [];
const YESTERDAY = Array.isArray(fYest && fYest.matches) ? fYest.matches.filter(m => m.status === 'FINISHED') : [];
const TODAY = Array.isArray(fDay && fDay.matches) ? fDay.matches : [];
const UPCOMING = Array.isArray(fFix && fFix.matches) ? fFix.matches : [];
const LIVE_JSON = {
  matches: (fLive && fLive.matches) || [],
  standings: (fLive && fLive.standings) || null,
  scorers: (fLive && fLive.scorers) || []
};

const FLAG = { PL: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', PD: '🇪🇸', BL1: '🇩🇪', SA: '🇮🇹', FL1: '🇫🇷', CL: '🇪🇺', ELC: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', UCL: '🇪🇺', DED: '🇳🇱', PPL: '🇵🇹', EL: '🇪🇺', UEL: '🇪🇺', UEC: '🇪🇺', EC: '🇪🇺', WC: '🏆' };
const flag = l => FLAG[l] || (l ? '⚽' : '⚽');

// ---- translation helper ----
function t(loc, key, params) {
  const D = i18n[loc] || i18n.en;
  let v = key.split('.').reduce((o, k) => (o == null ? o : o[k]), D);
  if (v == null) v = key.split('.').reduce((o, k) => (o == null ? o : o[k]), i18n.en);
  if (v == null) return key;
  v = typeof v === 'string' ? v : JSON.stringify(v);
  if (params) for (const k in params) v = v.split('{' + k + '}').join(params[k] == null ? '' : params[k]);
  return v;
}
const HOME_LABEL = { en: 'Home', fr: 'Accueil', ar: 'الرئيسية' };
const PROMO_H = { en: 'Welcome offer — new customers', fr: 'Offre de bienvenue — nouveaux clients', ar: 'عرض ترحيبي للعملاء الجدد' };
const safeJson = o => JSON.stringify(o).replace(/</g, '\\u003c');

// Normalize any predictions.json shape into the fields sitegen needs.
// Missing probabilities are recomputed with the Dixon-Coles model (server-side).
function normalizeMatch(m) {
  if (!m || !m.home || !m.away) return null;
  const home = m.home, away = m.away;
  let slug = `${slugify(home)}-vs-${slugify(away)}-prediction`;
  let i = 2;
  while (slugUsed.has(slug)) slug = `${slugify(home)}-vs-${slugify(away)}-prediction-${i++}`;
  slugUsed.add(slug);
  const dc = dcModel.predict(home, away);
  const haveProbs = m.probs && typeof m.probs.home === 'number';
  const probs = haveProbs ? m.probs : { home: dc.pH, draw: dc.pD, away: dc.pA };
  const pH = Math.round(probs.home), pD = Math.round(probs.draw), pA = Math.round(probs.away);
  const conf = m.conf || dc.conf;
  // Matrix-derived markets (v3): Over/Under + BTTS come from the same Dixon-Coles
  // score matrix as the 1X2 probs; the correct score is the matrix argmax.
  const over = m.overUnder || dc.overUnder;
  const btts = m.btts || dc.btts;
  const cs = m.correctScore || dc.correctScore;
  const topScores = m.topScores || dc.topScores;
  return Object.assign({}, m, {
    slug,
    league: m.league || 'Football',
    flag: m.flag || flag(m.code),
    pred: m.pred || dc.pred,
    sub: m.sub || dc.sub,
    conf,
    odds: m.odds != null ? m.odds : dc.odds,
    value: m.value || `+${Math.round((conf - 60) / 2)}%`,
    probs,
    xg: m.xg || dc.xg,
    doubleChance: m.doubleChance || { '1X': Math.min(97, pH + pD), 'X2': Math.min(97, pD + pA), '12': Math.min(97, pH + pA) },
    overUnder: over,
    btts,
    correctScore: cs,
    topScores,
    asianHandicap: m.asianHandicap || dc.asianHandicap,
    precise: m.precise || `${String(m.time || '').slice(0, 5)} — ${home} vs ${away}`,
    countdown: m.countdown || '',
    model: m.model || dc.model,
    date: m.date || String(m.utcDate || '').slice(0, 10)
  });
}
const utcTime = m => {
  try { return new Date(m.utcDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }); } catch (e) { return String(m.time || '').slice(0, 5) || '--:--'; }
};

// ---- URL model ----
// page = { type, arg }
function prefix(loc) { return loc === 'en' ? '' : '/' + loc; }
function pageUrl(loc, page) {
  const p = prefix(loc);
  switch (page.type) {
    case 'home': return (p || '') + '/';
    case 'predIndex': return p + '/predictions/';
    case 'pred': return p + '/predictions/' + page.arg + '.html';
    case 'btts': return p + '/predictions/btts-predictions-today.html';
    case 'over': return p + '/predictions/over-2-5-goals-predictions-today.html';
    case 'botd': return p + '/bet-of-the-day/';
    case 'acca': return p + '/accumulator-tips/';
    case 'live': return loc === 'en' ? '/live.html' : p + '/live/';
    case 'predictor': return loc === 'en' ? '/predictor.html' : p + '/predictor/';
    case 'search': return p + '/search.html';
    case 'football': return p + '/football/';
    case 'leagues': return p + '/football/leagues/';
    case 'league': return p + '/football/leagues/' + page.arg + '/';
    case 'leaguePreds': return p + '/football/leagues/' + page.arg + '/predictions/';
    case 'teams': return p + '/football/teams/';
    case 'team': return p + '/football/teams/' + page.arg + '/';
    case 'fixtures': return p + '/football/fixtures/';
    case 'results': return p + '/football/results/';
    case 'news': return p + '/news/';
    case 'newsCat': return p + '/news/' + page.arg + '/';
    case 'bonusCodes': return p + '/bonus-codes/';
    case 'bonusCode': return p + '/bonus-codes/' + page.arg + '/';
    case 'bettingGuides': return p + '/betting-guides/';
    case 'bettingGuide': return p + '/betting-guides/' + page.arg + '/';
    case 'about': return p + '/about/';
    case 'methodology': return p + '/methodology/';
    case 'contact': return p + '/contact/';
    case 'privacy': return p + '/privacy/';
    case 'terms': return p + '/terms/';
    case 'safer-gambling': return p + '/safer-gambling/';
    case '404': return p + '/404.html';
    default: return (p || '') + '/';
  }
}

function hreflang(loc, page) {
  // Self alternate first, then the other language versions, then x-default.
  const others = LOCALES.filter(ll => ll !== loc);
  let out = `<link rel="alternate" hreflang="${loc}" href="${SITE}${pageUrl(loc, page)}">` + '\n';
  for (const ll of others) out += `<link rel="alternate" hreflang="${ll}" href="${SITE}${pageUrl(ll, page)}">` + '\n';
  out += `<link rel="alternate" hreflang="x-default" href="${SITE}${pageUrl('en', page)}">` + '\n';
  return out;
}

// ---- competitions / teams derived from real data ----
function leagueNameOf(m) { return m.league || (m.competition && m.competition.name) || 'Football'; }
const LEAGUE_SLUG_MAP = {
  'premier league': 'premier-league', 'premier-ligue': 'premier-league', 'la liga': 'la-liga', 'primera division': 'la-liga',
  'bundesliga': 'bundesliga', 'serie a': 'serie-a', 'ligue 1': 'ligue-1', 'liga portugal': 'liga-portugal',
  'champions league': 'champions-league', 'europa league': 'europa-league', 'europa conference league': 'conference-league',
  'eredivisie': 'eredivisie', 'süper lig': 'super-lig', 'super lig': 'super-lig', 'laliga': 'la-liga', 'premier league ': 'premier-league'
};
function leagueSlug(name) {
  const n = String(name || '').toLowerCase();
  if (LEAGUE_SLUG_MAP[n]) return LEAGUE_SLUG_MAP[n];
  const s = slugify(n);
  return s || 'football';
}
const homeName = m => (m.homeTeam && m.homeTeam.name) || m.home || '';
const awayName = m => (m.awayTeam && m.awayTeam.name) || m.away || '';
const compName = m => (m.competition && m.competition.name) || m.league || 'Football';

// Prediction slug -> whether page exists (all slugs in predictions.json get pages)
const PRED_SLUGS = new Set(MATCHES.map(m => m.slug));
// team slug -> set of teams appearing in any real data
function allTeams() {
  const set = new Map();
  const add = tm => { if (tm && tm.name) set.set(slugify(tm.name), tm.name); };
  MATCHES.forEach(m => { add({ name: m.home }); add({ name: m.away }); });
  [...TODAY, ...TOMORROW, ...UPCOMING, ...YESTERDAY, ...LIVE_JSON.matches].forEach(m => { add(m.homeTeam); add(m.awayTeam); });
  return set;
}
const TEAMS = allTeams();
function allLeagues() {
  const map = new Map();
  const add = (name, code) => { if (name) { const s = leagueSlug(name); if (!map.has(s)) map.set(s, { name, code: code || '', count: 0 }); map.get(s).count++; } };
  MATCHES.forEach(m => add(m.league, m.code));
  [...TODAY, ...TOMORROW, ...UPCOMING, ...YESTERDAY, ...LIVE_JSON.matches].forEach(m => add(compName(m), m.competition && m.competition.code));
  return map;
}
const LEAGUES = allLeagues();

// match key home||away -> prediction slug
const MATCH_KEY_TO_SLUG = new Map();
MATCHES.forEach(m => MATCH_KEY_TO_SLUG.set(`${String(m.home).toLowerCase()}||${String(m.away).toLowerCase()}`, m.slug));
function predSlugFor(home, away) { return MATCH_KEY_TO_SLUG.get(`${String(home).toLowerCase()}||${String(away).toLowerCase()}`) || null; }

// ---- shared shell ----
const FONT = { en: 'Inter:wght@400;600;700;800;900', fr: 'Inter:wght@400;600;700;800;900', ar: 'Tajawal:wght@400;500;700;800;900' };
const OG_IMG = `${SITE}/og-image.png`;
const OG_LOC = { en: 'en_US', fr: 'fr_FR', ar: 'ar_AR' };

function schemaOrg(loc) {
  return [{
    '@context': 'https://schema.org', '@type': 'Organization',
    name: 'XWhiz', alternateName: 'XWhiz Football Predictions', url: SITE,
    description: 'Independent statistical football predictions using a Dixon-Coles + Elo model on real fixtures only.',
    logo: { '@type': 'ImageObject', url: `${SITE}/logo.png`, width: 512, height: 512 },
    foundingDate: '2024',
    sameAs: [`${SITE}/sitemap.xml`, `${SITE}/llms.txt`],
    contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', url: `${SITE}/contact/`, availableLanguage: ['English', 'French', 'Arabic'] }]
  }, {
    '@context': 'https://schema.org', '@type': 'WebSite',
    name: 'XWhiz', alternateName: 'XWhiz Football Predictions', url: `${SITE}${prefix(loc)}/`,
    inLanguage: loc,
    publisher: { '@type': 'Organization', name: 'XWhiz', logo: { '@type': 'ImageObject', url: `${SITE}/logo.png` } },
    potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${SITE}${prefix(loc)}/search.html?q={search_term_string}` }, 'query-input': 'required name=search_term_string' }
  }];
}

const GA_SNIPPET = GA4 ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(GA4)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(GA4)}',{send_page_view:true});</script>` : '';

const FX_CSS = `/* ---- XWhiz 3D football effects (progressive enhancement, GPU-light) ---- */
.xw-hero{position:absolute;right:clamp(4px,4vw,2rem);top:50%;width:230px;height:258px;transform:translateY(-50%);perspective:900px;pointer-events:none;z-index:0}
.xw-ball{position:absolute;right:0;top:0;width:200px;height:200px;background:url('/football.svg') no-repeat center/contain;animation:xw-spin 10s linear infinite;will-change:transform}
.xw-shadow{position:absolute;right:26px;bottom:2px;width:148px;height:16px;border-radius:50%;background:rgba(0,0,0,.35);filter:blur(6px);animation:xw-sb 10s linear infinite}
@keyframes xw-spin{0%{transform:rotateY(0deg)}50%{transform:rotateY(180deg)}100%{transform:rotateY(360deg)}}
@keyframes xw-sb{0%,100%{transform:scaleX(1);opacity:.85}25%,75%{transform:scaleX(.55);opacity:.5}50%{transform:scaleX(1);opacity:.85}}
@media (max-width:767px){.xw-hero{display:none}}
@media (prefers-reduced-motion: reduce){.xw-ball,.xw-shadow{animation:none}}
`;
const FX_JS = `<script>(function(){try{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||!window.matchMedia('(pointer: fine)').matches)return;
var L=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);if(L)return;
function r(e){var el=e.currentTarget,b=el.getBoundingClientRect(),x=(e.clientX-b.left)/b.width-.5,y=(e.clientY-b.top)/b.height-.5;el.style.transform='perspective(700px) rotateX('+(-y*3.5).toFixed(2)+'deg) rotateY('+(x*3.5).toFixed(2)+'deg) translateZ(0)'}
function o(e){e.currentTarget.style.transform='';e.currentTarget.style.transformOrigin='center'}
document.querySelectorAll('[data-tilt]').forEach(function(el){el.style.transformOrigin='center';el.addEventListener('pointermove',r,{passive:true});el.addEventListener('pointerleave',o)})}catch(e){}})();</script>`;

function shell(loc, { title, desc, canonical, body, page, noindex = false, jsonld = [], extraHead = '', ogType = 'website', publishedTime = '' }) {
  const meta = i18n[loc].meta;
  const robots = noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large">';
  const json = jsonld.concat(schemaOrg(loc)).map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n');
  const pt = (page && page.type) || '';
  const overlayCss = '<link rel="stylesheet" href="/xwhiz-3d.css">';
  const overlayHead = overlayCss + '\n<script defer src="/xwhiz-3d.js"></script>';
  const ogImgAlt = desc ? esc(desc.slice(0, 100)) : 'XWhiz — Football predictions today';
  const articleMeta = publishedTime ? `<meta property="article:published_time" content="${esc(publishedTime)}">` : '';
  const canonicalTag = canonical ? `<link rel="canonical" href="${canonical}">` : '';
  return `<!DOCTYPE html>
<html lang="${meta.lang}" dir="${meta.dir}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${robots}
${canonicalTag}
${hreflang(loc, page)}
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical || ''}">
<meta property="og:site_name" content="XWhiz">
<meta property="og:image" content="${OG_IMG}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${ogImgAlt}">
<meta property="og:locale" content="${OG_LOC[loc]}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${OG_IMG}">
<meta name="twitter:image:alt" content="${ogImgAlt}">
${articleMeta}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="dns-prefetch" href="https://a.espncdn.com">
<link rel="preload" as="image" href="/football.svg" fetchpriority="high">
<link href="https://fonts.googleapis.com/css2?family=${FONT[loc]}&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="https://fonts.googleapis.com/css2?family=${FONT[loc]}&display=swap" rel="stylesheet"></noscript>
<link rel="preload" as="style" href="/site.css">
<link rel="stylesheet" href="/site.css" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="/site.css"></noscript>
${loc === 'ar' ? '<link rel="preload" as="style" href="/rtl.css"><link rel="stylesheet" href="/rtl.css" media="print" onload="this.media=\'all\'"><noscript><link rel="stylesheet" href="/rtl.css"></noscript>' : ''}
<link rel="preload" as="style" href="/xwhiz-3d.css">
<link rel="stylesheet" href="/xwhiz-3d.css" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="/xwhiz-3d.css"></noscript>
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#16a34a">
<link rel="manifest" href="/manifest.json">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="XWhiz">
<link rel="alternate" type="application/rss+xml" title="XWhiz Predictions RSS" href="/feed.xml">
${GA_SNIPPET}
${extraHead}
<style>/* Critical CSS for fast FCP/LCP */
body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#fff;color:#18181b}
.bg-zinc-900{background:#18181b}.text-white{color:#fff}.text-green-400{color:#4ade80}
.border-t{border-top-width:1px}.border-b{border-bottom-width:1px}.sticky{position:sticky}.top-0{top:0}.z-50{z-index:50}
.max-w-7xl{max-width:80rem}.mx-auto{margin-left:auto;margin-right:auto}.px-4{padding-left:1rem;padding-right:1rem}
.py-3{padding-top:.75rem;padding-bottom:.75rem}.flex{display:flex}.items-center{align-items:center}.justify-between{justify-content:space-between}
.gap-3{gap:.75rem}.font-extrabold{font-weight:800}.text-lg{font-size:1.125rem}.rounded-full{border-radius:9999px}
.bg-brand-600{background:#16a34a}.hover\:bg-brand-700:hover{background:#15803d}.text-xs{font-size:.75rem}
.px-4{padding-left:1rem;padding-right:1rem}.py-2{padding-top:.5rem;padding-bottom:.5rem}
</style>
<style>${FX_CSS}</style>
${json}
</head>
<body class="bg-white text-zinc-900">
${topBar(loc)}
${header(loc, page)}
${body}
<div class="max-w-7xl mx-auto px-4 md:px-6 py-6 border-t border-zinc-100">
<p class="text-sm font-bold text-zinc-700 mb-3">${t(loc, 'share.title', { title: esc(title) })}</p>
<div class="flex flex-wrap gap-2">
<a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(canonical || '')}&text=${encodeURIComponent(title)}" target="_blank" rel="noopener nofollow" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1DA1F2] text-white text-xs font-bold hover:opacity-90">Twitter / X</a>
<a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonical || '')}" target="_blank" rel="noopener nofollow" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1877F2] text-white text-xs font-bold hover:opacity-90">Facebook</a>
<a href="https://api.whatsapp.com/send?text=${encodeURIComponent(title + ' ' + (canonical || ''))}" target="_blank" rel="noopener nofollow" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#25D366] text-white text-xs font-bold hover:opacity-90">WhatsApp</a>
<a href="https://t.me/share/url?url=${encodeURIComponent(canonical || '')}&text=${encodeURIComponent(title)}" target="_blank" rel="noopener nofollow" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0088cc] text-white text-xs font-bold hover:opacity-90">Telegram</a>
<a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(canonical || '')}" target="_blank" rel="noopener nofollow" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0A66C2] text-white text-xs font-bold hover:opacity-90">LinkedIn</a>
<a href="mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(canonical || '')}" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-600 text-white text-xs font-bold hover:opacity-90">Email</a>
</div>
</div>
${footer(loc)}
${FX_JS}
</body>
</html>`;
}

function topBar(loc) {
  const home = pageUrl(loc, { type: 'home' });
  return `<div class="bg-zinc-900 text-white text-center py-1.5 text-xs px-4">${tR(loc, 'topbar.text')} · <a href="${home}#promo" class="underline font-semibold text-green-400">${tR(loc, 'topbar.bonus')}</a></div>`;
}
function tR(loc, key, params) { return t(loc, key, params); }

function header(loc, page) {
  const nav = [
    { href: pageUrl(loc, { type: 'predIndex' }), label: t(loc, 'nav.predictions') },
    { href: pageUrl(loc, { type: 'football' }), label: t(loc, 'nav.football') },
    { href: pageUrl(loc, { type: 'live' }), label: t(loc, 'nav.live') },
    { href: pageUrl(loc, { type: 'news' }), label: t(loc, 'nav.news') },
    { href: pageUrl(loc, { type: 'predictor' }), label: t(loc, 'nav.predictor') }
  ];
  const linkLangs = LOCALES.map(l => `<a href="${SITE}${pageUrl(l, page)}" lang="${i18n[l].meta.lang}" dir="${i18n[l].meta.dir}" class="px-2 py-1 rounded-full text-xs font-bold ${l === loc ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}">${i18n[l].meta.label}</a>`).join('');
  const navLinks = nav.map(n => `<a href="${n.href}" class="hover:text-zinc-900">${n.label}</a>`).join('\n');
  return `<header class="bg-white border-b border-zinc-100 sticky top-0 z-50">
<div class="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
<div class="flex items-center gap-2"><a href="${pageUrl(loc, { type: 'home' })}" class="flex items-center gap-2"><span class="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center text-sm">⚽</span><span class="font-extrabold text-lg tracking-tight">XWhiz</span></a></div>
<nav class="hidden md:flex items-center gap-5 text-sm font-medium text-zinc-600">
${navLinks}
<a href="${pageUrl(loc, { type: 'search' })}" class="hover:text-zinc-900" aria-label="${t(loc, 'nav.search')}"><span aria-hidden="true">🔍</span> ${t(loc, 'nav.search')}</a>
</nav>
<div class="flex items-center gap-2">
<div class="hidden md:flex items-center gap-1">${linkLangs}</div>
<a href="${MELBET}" target="_blank" rel="sponsored nofollow noopener" class="hidden sm:inline text-xs font-bold px-4 py-2 rounded-full bg-brand-600 text-white hover:bg-brand-700">${t(loc, 'topbar.cta')}</a>
<details class="md:hidden relative">
<summary class="cursor-pointer list-none text-2xl leading-none px-2" aria-label="Menu">☰</summary>
<div class="absolute right-0 top-10 w-56 bg-white border border-zinc-100 rounded-2xl shadow-lg p-3 space-y-2 text-sm z-50">
${nav.map(n => `<a href="${n.href}" class="block font-medium text-zinc-700 px-3 py-2 rounded-xl hover:bg-zinc-50">${n.label}</a>`).join('')}
<a href="${pageUrl(loc, { type: 'search' })}" class="block font-medium text-zinc-700 px-3 py-2 rounded-xl hover:bg-zinc-50">${t(loc, 'nav.search')}</a>
<a href="${MELBET}" target="_blank" rel="sponsored nofollow noopener" class="block font-bold text-white bg-brand-600 px-3 py-2 rounded-xl text-center">Melbet</a>
<div class="flex items-center gap-1 pt-2 border-t border-zinc-100">${linkLangs}</div>
</div>
</details>
</div>
</div>
</header>`;
}

function footer(loc) {
  const home = pageUrl(loc, { type: 'home' });
  const p = i18n[loc];
  return `<div class="mt-12 px-4 md:px-6">
<div class="max-w-7xl mx-auto mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs leading-relaxed text-zinc-700"><strong>18+</strong> · ${t(loc, 'rg.affiliate')} · <a href="https://www.begambleaware.org" target="_blank" rel="nofollow noopener" class="underline font-semibold">${t(loc, 'rg.help')}</a></div>
<footer class="border-t border-zinc-100 py-10">
<div class="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
<div class="col-span-2 md:col-span-1"><div class="flex items-center gap-2 font-extrabold"><span class="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center text-xs">⚽</span> XWhiz</div><p class="mt-3 text-zinc-500 text-xs">${t(loc, 'footer.blurb')}</p><p class="mt-3 text-xs text-zinc-400">© ${new Date().getFullYear()} XWhiz</p></div>
<div><div class="font-semibold text-zinc-900">${t(loc, 'footer.colP')}</div><div class="mt-3 space-y-2 text-xs"><a href="${pageUrl(loc, { type: 'predIndex' })}" class="block hover:text-zinc-900">${t(loc, 'footer.today')}</a><a href="${pageUrl(loc, { type: 'botd' })}" class="block hover:text-zinc-900">${boa(loc, 'botd').nav}</a><a href="${pageUrl(loc, { type: 'acca' })}" class="block hover:text-zinc-900">${boa(loc, 'acca').nav}</a><a href="${pageUrl(loc, { type: 'btts' })}" class="block hover:text-zinc-900">${t(loc, 'footer.btts')}</a><a href="${pageUrl(loc, { type: 'over' })}" class="block hover:text-zinc-900">${t(loc, 'footer.over')}</a><a href="${pageUrl(loc, { type: 'predictor' })}" class="block hover:text-zinc-900">${t(loc, 'footer.predictor')}</a></div></div>
<div><div class="font-semibold text-zinc-900">${t(loc, 'footer.colF')}</div><div class="mt-3 space-y-2 text-xs"><a href="${pageUrl(loc, { type: 'leagues' })}" class="block hover:text-zinc-900">${t(loc, 'footer.leagues')}</a><a href="${pageUrl(loc, { type: 'teams' })}" class="block hover:text-zinc-900">${t(loc, 'footer.teams')}</a><a href="${pageUrl(loc, { type: 'fixtures' })}" class="block hover:text-zinc-900">${t(loc, 'footer.fixtures')}</a><a href="${pageUrl(loc, { type: 'results' })}" class="block hover:text-zinc-900">${t(loc, 'footer.results')}</a></div></div>
<div><div class="font-semibold text-zinc-900">${t(loc, 'footer.colM')}</div><div class="mt-3 space-y-2 text-xs"><a href="${pageUrl(loc, { type: 'live' })}" class="block hover:text-zinc-900">${t(loc, 'footer.live')}</a><a href="${pageUrl(loc, { type: 'news' })}" class="block hover:text-zinc-900">${t(loc, 'footer.news')}</a><a href="${pageUrl(loc, { type: 'search' })}" class="block hover:text-zinc-900">${t(loc, 'footer.search')}</a><a href="${SITE}/sitemap.xml" class="block hover:text-zinc-900">${t(loc, 'footer.sitemap')}</a><a href="${pageUrl(loc, { type: 'about' })}" class="block hover:text-zinc-900">${(LEGAL_LABEL[loc]||LEGAL_LABEL.en).about}</a><a href="${pageUrl(loc, { type: 'methodology' })}" class="block hover:text-zinc-900">${(LEGAL_LABEL[loc]||LEGAL_LABEL.en).methodology}</a><a href="${pageUrl(loc, { type: 'contact' })}" class="block hover:text-zinc-900">${(LEGAL_LABEL[loc]||LEGAL_LABEL.en).contact}</a><a href="${pageUrl(loc, { type: 'privacy' })}" class="block hover:text-zinc-900">${(LEGAL_LABEL[loc]||LEGAL_LABEL.en).privacy}</a><a href="${pageUrl(loc, { type: 'terms' })}" class="block hover:text-zinc-900">${(LEGAL_LABEL[loc]||LEGAL_LABEL.en).terms}</a><a href="${pageUrl(loc, { type: 'safer-gambling' })}" class="block hover:text-zinc-900">${(LEGAL_LABEL[loc]||LEGAL_LABEL.en)['safer-gambling']}</a></div></div>
</div>
<p class="max-w-7xl mx-auto mt-6 text-[10px] text-zinc-400 flex items-center gap-1.5">Live data by <a href="https://sportscore.com/" rel="noopener" title="Sports data by SportScore" class="underline">SportScore</a></p>
</footer>
</div>`;
}

// ---- shared components ----
function breadcrumb(loc, items) {
  return `<nav class="text-xs text-zinc-500 flex flex-wrap items-center gap-1" aria-label="Breadcrumb">` +
    items.map((it, i) => i < items.length - 1
      ? `<a href="${it.href}" class="hover:underline">${it.label}</a><span aria-hidden="true"> › </span>`
      : `<span aria-current="page">${it.label}</span>`).join('') + `</nav>`;
}
function marketBadge(loc, text, strong, cls) {
  return `<span class="${cls} px-2.5 py-1 rounded-full font-bold">${esc(text)}</span>`;
}
const PILL_GREEN_STRONG = 'bg-brand-600 text-white';
const PILL_GREY = 'bg-zinc-100 text-zinc-700';

function predCard(loc, m) {
  const href = pageUrl(loc, { type: 'pred', arg: m.slug });
  return `<div class="border border-zinc-200 rounded-2xl hover:bg-zinc-50 hover:shadow-sm transition">
<a href="${href}" data-tilt class="block p-5 pb-2">
<div><span class="text-xs font-bold tracking-widest text-brand-700">${esc(flag(m.code))} ${esc(m.league).toUpperCase()}</span></div>
<div class="mt-2 font-bold leading-tight">${esc(cleanTeamName(m.home))} ${t(loc, 'detail.vs')} ${esc(cleanTeamName(m.away))}</div>
</a>
<div class="px-5 pb-5">
<div class="flex flex-wrap items-center gap-2 text-xs">${marketBadge(loc, `${esc(m.pred)} @ ${esc(m.odds)}`, false, PILL_GREEN_STRONG)}${marketBadge(loc, `${m.conf}% ${t(loc, 'market.conf')}`, false, PILL_GREY)}</div>
<div class="mt-2 text-xs text-zinc-500">${esc(formatMatchTime(loc, m))}</div>
</div>
</div>`;
}

function homeMatchRow(loc, m) {
  const home = cleanTeamName(homeName(m)), away = cleanTeamName(awayName(m));
  const slug = predSlugFor(homeName(m), awayName(m)) || predSlugFor(home, away);
  const score = (m.score && m.score.fullTime && m.score.fullTime.home != null) ? `${m.score.fullTime.home} - ${m.score.fullTime.away}` : null;
  const status = statusLabel(loc, m.status);
  const linkTarget = slug ? pageUrl(loc, { type: 'pred', arg: slug }) : pageUrl(loc, { type: 'team', arg: slugify(home) });
  const timeLabel = score != null ? 'FT' : esc(utcTime(m));
  return `<a href="${linkTarget}" class="bg-white border border-zinc-200 rounded-2xl p-3 flex items-center justify-between gap-3 hover:bg-zinc-50 transition">
<div class="min-w-0"><div class="text-xs text-zinc-400 font-medium">${esc(compName(m))} · ${esc(status)}</div><div class="font-bold text-sm truncate">${esc(home)} ${t(loc, 'detail.vs')} ${esc(away)}</div></div>
<div class="shrink-0"><span class="text-sm font-semibold text-zinc-500">${timeLabel}</span>${score != null ? ` · <span class="font-bold text-zinc-900">${score}</span>` : ''}</div></a>`;
}

function statusLabel(loc, st) {
  const map = { SCHEDULED: 'scheduled', TIMED: 'timed', FINISHED: 'finished', LIVE: 'live', IN_PLAY: 'live', HT: 'ht', FT: 'ft', POSTPONED: 'postponed', CANC: 'cancelled' };
  const k = map[String(st || '').toUpperCase()] || 'timed';
  return t(loc, 'status.' + k);
}

function newsCard(loc, n) {
  const img = n.image || '';
  const url = n.url || pageUrl(loc, { type: 'news' });
  return `<div class="border border-zinc-200 rounded-2xl overflow-hidden hover:bg-zinc-50 hover:shadow-sm transition">
<a href="${esc(url)}" target="_blank" rel="noopener nofollow" class="block">
${img ? `<img loading="lazy" decoding="async" width="600" height="400" referrerpolicy="no-referrer" src="${esc(img)}" alt="${esc(n.title || '')}" class="h-40 w-full object-cover">` : ''}
<div class="p-4 pb-2"><div class="font-bold text-sm leading-snug">${esc(n.title || '')} →</div></div>
</a>
<div class="px-4 pb-4">
<div class="text-xs text-zinc-400 font-medium">${esc(n.category || '')}${n.league ? ' · ' + esc(n.league) : ''}</div>
<p class="mt-1 text-xs text-zinc-500">${esc((n.excerpt || '').slice(0, 110))}…</p>
</div>
</div>`;
}

function faqBlock(loc, items) {
  return `<div class="mt-8"><h2 class="text-xl font-extrabold">${t(loc, 'analysis.faq')}</h2><div class="mt-3 space-y-3">${items.map(f => `<details class="border border-zinc-200 rounded-2xl p-4"><summary class="font-semibold text-sm cursor-pointer">${esc(f.q)}</summary><p class="mt-2 text-sm text-zinc-600">${esc(f.a)}</p></details>`).join('')}</div></div>`;
}

function rgNote(loc) {
  return `<div class="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs leading-relaxed">${t(loc, 'rg.block')} · <a href="https://www.begambleaware.org" target="_blank" rel="nofollow noopener" class="underline font-semibold">${t(loc, 'rg.helpCta')}</a></div>`;
}

// ---------------- PAGES ----------------

function homePage(loc) {
  const t = (k, p) => tR(loc, k, p);
  const top = MATCHES.slice(0, 6);
  const over = MATCHES.filter(isOverTip).slice(0, 3);
  const btts = MATCHES.filter(isBttsTip).slice(0, 3);
  const newsHead = NEWS.slice(0, 3);
  const liveRows = UI_matches(loc, LIVE_JSON.matches.slice(0, 6));
  const byCompetition = groupBy(MATCHES, m => m.league);
  const comps = [...byCompetition.keys()].slice(0, 8).map(name => {
    const ms = byCompetition.get(name)[0];
    const slug = leagueSlug(name);
    return `<a href="${pageUrl(loc, { type: 'league', arg: slug })}" data-tilt class="border border-zinc-200 rounded-2xl p-4 hover:bg-zinc-50 transition block"><div class="text-xs text-zinc-400">${esc(flag(ms.code))} ${t('football.leagues')}</div><div class="mt-1 font-bold text-sm">${esc(name)}</div><div class="mt-1 text-xs text-brand-700">${byCompetition.get(name).length} ${t('detail.views').toLowerCase()}</div></a>`;
  }).join('');

  const body = `
<main>
<div class="relative overflow-hidden bg-zinc-900 text-white">
<div class="xw-hero"><div class="xw-ball"></div><div class="xw-shadow"></div></div>
<div class="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-14 md:py-20">
<p class="text-xs font-bold tracking-widest text-green-400 uppercase">${t('hero.badge')}</p>
<h1 class="mt-3 text-3xl md:text-5xl font-black tracking-tight leading-tight max-w-3xl">${t('hero.h1')}</h1>
<p class="mt-4 text-zinc-300 max-w-2xl">${t('hero.sub')}</p>
<div class="mt-6 flex flex-wrap gap-3">
<a href="#picks" class="bg-brand-600 hover:bg-brand-700 text-white font-black px-6 py-3 rounded-full">${t('hero.cta1')}</a>
<a href="${pageUrl(loc, { type: 'live' })}" class="bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3 rounded-full">${t('hero.cta2')}</a>
</div>
<p class="mt-4 text-xs text-zinc-400">${t('hero.trust')}</p>
</div>
</div>
<div id="picks" class="max-w-7xl mx-auto px-4 md:px-6 py-10 scroll-mt-24">
<div class="flex items-center justify-between gap-3">
<h2 class="text-2xl font-extrabold tracking-tight">${(MATCHES.length && new Date(MATCHES[0].utcDate).toISOString().slice(0, 10) === todayISO()) ? t('sec.topPicks') : t('sec.latestPicks')}</h2>
${MATCHES.length && new Date(MATCHES[0].utcDate).toISOString().slice(0, 10) !== todayISO() ? `<p class="mt-1 text-xs text-brand-700">${t('sec.asOf', { date: fmtDate(loc, MATCHES[0].utcDate) })}</p>` : ''}
<a href="${pageUrl(loc, { type: 'predIndex' })}" class="text-sm font-bold text-brand-700 hover:underline">${t('sec.allCta')} →</a>
</div>
${MATCHES.length ? `<div class="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${top.map(m => predCard(loc, m)).join('')}</div>` : `<div class="mt-5 p-6 border border-zinc-200 rounded-2xl text-sm text-zinc-600">${t('predHub.empty')}</div>`}
<div class="mt-8 grid sm:grid-cols-2 gap-4">
${(() => { const bp = bestPick(); return `<a href="${pageUrl(loc, { type: 'botd' })}" class="border border-brand-600/30 bg-brand-600/5 rounded-2xl p-5 hover:bg-brand-600/10"><div class="font-bold">${boa(loc, 'botd').nav} ⭐</div><div class="text-sm text-zinc-500 mt-1">${bp ? `${esc(cleanTeamName(bp.home))} ${t('detail.vs')} ${esc(cleanTeamName(bp.away))} — ${esc(bp.pred)} @ ${esc(bp.odds)}` : t('football.noMatches')}</div></a>`; })()}
${(() => { const legs = accaLegs(); return `<a href="${pageUrl(loc, { type: 'acca' })}" class="border border-zinc-200 rounded-2xl p-5 hover:bg-zinc-50"><div class="font-bold">${boa(loc, 'acca').nav}</div><div class="text-sm text-zinc-500 mt-1">${legs.length >= 2 ? `${legs.length} legs @ ${accaOdds(legs).toFixed(2)}` : t('football.noMatches')}</div></a>`; })()}
<a href="${pageUrl(loc, { type: 'over' })}" class="border border-zinc-200 rounded-2xl p-5 hover:bg-zinc-50"><div class="font-bold">${t('sec.overCta')}</div><div class="text-sm text-zinc-500 mt-1">${over.length ? `${over.length} ${t('market.over')}` : t('football.noMatches')}</div></a>
<a href="${pageUrl(loc, { type: 'btts' })}" class="border border-zinc-200 rounded-2xl p-5 hover:bg-zinc-50"><div class="font-bold">${t('sec.bttsCta')}</div><div class="text-sm text-zinc-500 mt-1">${btts.length ? `${btts.length} ${t('market.btts')}` : t('football.noMatches')}</div></a>
</div>
</div>
<div class="border-t border-zinc-100">
<div class="max-w-7xl mx-auto px-4 md:px-6 py-10">
<h2 class="text-2xl font-extrabold tracking-tight">${t('sec.liveTitle')}</h2>
<div class="mt-5 grid md:grid-cols-2 gap-4">
<div class="space-y-2">${liveRows.length ? liveRows.join('') : `<div class="p-4 border border-zinc-200 rounded-2xl text-sm text-zinc-500">${t('sec.liveEmpty')}</div>`}</div>
<div class="grid sm:grid-cols-2 gap-4">
${standingsPanel(loc)}
${scorersPanel(loc)}
</div>
</div>
<a href="${pageUrl(loc, { type: 'live' })}" class="mt-5 inline-block text-sm font-bold text-brand-700 hover:underline">${t('sec.liveTitle')} →</a>
</div>
</div>
<div class="border-t border-zinc-100">
<div class="max-w-7xl mx-auto px-4 md:px-6 py-10">
<div class="flex items-center justify-between gap-3">
<h2 class="text-2xl font-extrabold tracking-tight">${t('sec.news')}</h2>
<a href="${pageUrl(loc, { type: 'news' })}" class="text-sm font-bold text-brand-700 hover:underline">${t('sec.newsCta')} →</a>
</div>
<div class="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${newsHead.map(n => newsCard(loc, n)).join('') || `<div class="col-span-full p-6 border border-zinc-200 rounded-2xl text-sm text-zinc-600">${t('predHub.empty')}</div>`}</div>
</div>
</div>
<div class="border-t border-zinc-100">
<div class="max-w-7xl mx-auto px-4 md:px-6 py-10">
<h2 class="text-2xl font-extrabold tracking-tight">${t('sec.leagues')}</h2>
<div class="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">${comps}</div>
</div>
</div>
<div id="promo" class="border-t border-zinc-100 scroll-mt-24">
<div class="max-w-7xl mx-auto px-4 md:px-6 py-10">
<div class="rounded-3xl bg-zinc-900 text-white p-6 md:p-8">
<div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
<div><h2 class="text-2xl font-black">${PROMO_H[loc]}</h2><p class="mt-1 text-sm text-zinc-300">${t('cta.bonus', { code: CODE })}</p></div>
<a href="${MELBET}" target="_blank" rel="sponsored nofollow noopener" class="bg-brand-600 hover:bg-brand-700 text-white font-black px-8 py-4 rounded-full text-center">${t('cta.betHome')} →</a>
</div>
<p class="mt-3 text-xs text-zinc-400">${t('promo.disclose')}</p>
</div>
</div>
</div>
${(MATCHES.length ? `<div class="border-t border-zinc-100">
<div class="max-w-7xl mx-auto px-4 md:px-6 py-10">
<h2 class="text-2xl font-extrabold tracking-tight">${t('sec.trendTitle')}</h2>
<p class="mt-3 text-sm text-zinc-600 max-w-3xl">${t('sec.trendBody')}</p>
<div class="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${top.map(m => { const cs = m.correctScore ? `${esc(m.correctScore.score)} (${m.correctScore.prob}%)` : ''; return `<div class="border border-zinc-200 rounded-2xl p-5 text-sm"><div class="text-xs text-zinc-400">${esc(m.league)}</div><div class="mt-1 font-bold">${esc(cleanTeamName(m.home))} ${t('detail.vs')} ${esc(cleanTeamName(m.away))}</div><div class="mt-1 text-zinc-500">${t('sec.trendPick')}: ${esc(m.pred)} @ ${esc(m.odds)} • ${m.conf}%${cs ? ' • ' + t('market.cs') + ': ' + cs : ''}</div></div>`; }).join('')}</div>
</div>
</div>` : '')}
<div class="border-t border-zinc-100">
<div class="max-w-7xl mx-auto px-4 md:px-6 py-10">
<h2 class="text-2xl font-extrabold tracking-tight">${t('sec.howTitle')}</h2>
<p class="mt-2 text-sm text-zinc-600 max-w-3xl">${t('sec.howBody')}</p>
<div class="mt-5 grid sm:grid-cols-3 gap-4">
${[t('sec.how1'), t('sec.how2'), t('sec.how3')].map(h => `<div class="border border-zinc-200 rounded-2xl p-5 text-sm font-medium">${h}</div>`).join('')}
</div>
<p class="mt-4 text-xs text-zinc-400">${t('sec.update')} ${t('sec.dataNote')}</p>
</div>
</div>
<div class="border-t border-zinc-100">
<div class="max-w-7xl mx-auto px-4 md:px-6 py-10">
<h2 class="text-2xl font-extrabold tracking-tight">${t('sec.aboutTitle')}</h2>
<p class="mt-3 text-sm text-zinc-600 max-w-3xl">${t('sec.aboutP1')}</p>
<h3 class="mt-6 text-lg font-extrabold">${t('sec.aboutH3')}</h3>
<p class="mt-2 text-sm text-zinc-600 max-w-3xl">${t('sec.aboutP2')}</p>
</div>
</div>
${rgNote(loc)}
</main>`;
  const itemList = MATCHES.length ? [{ '@context': 'https://schema.org', '@type': 'ItemList', name: t('sec.topPicks'), numberOfItems: top.length, itemListElement: top.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: `${m.home} vs ${m.away} — ${m.pred} @ ${m.odds}`, url: `${SITE}${pageUrl(loc, { type: 'pred', arg: m.slug })}` })) }] : [];
  return shell(loc, {
    title: t('site.home.title'), desc: t('site.home.desc'), page: { type: 'home' },
    canonical: `${SITE}${pageUrl(loc, { type: 'home' })}`, body,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: HOME_LABEL[loc], item: `${SITE}${pageUrl(loc, { type: 'home' })}` }] }
    ].concat(itemList)
  });
}

function groupBy(arr, fn) {
  const m = new Map();
  arr.forEach(x => { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
  return m;
}

function standingsPanel(loc) {
  const st = LIVE_JSON.standings;
  if (!st || !st.table || !st.table.length) return '';
  const rows = st.table.slice(0, 8).map(r => `<div class="flex items-center gap-2 text-xs"><span class="w-5 text-zinc-400">${r.position}</span><span class="flex-1 font-medium truncate">${esc(cleanTeamName(r.team))}</span><span class="font-bold tabular-nums">${r.points}</span></div>`).join('');
  return `<div class="border border-zinc-200 rounded-2xl p-4"><div class="font-bold text-sm">${tR(loc, 'sec.standings')}</div><div class="mt-3 space-y-1.5">${rows}</div></div>`;
}
function scorersPanel(loc) {
  const sc = LIVE_JSON.scorers;
  if (!sc.length) return '';
  const rows = sc.slice(0, 6).map(s => `<div class="flex items-center gap-2 text-xs"><span class="flex-1 font-medium truncate">${esc(s.player)}</span><span class="text-zinc-400 truncate">${esc(cleanTeamName(s.team))}</span><span class="font-bold tabular-nums">${s.goals}</span></div>`).join('');
  return `<div class="border border-zinc-200 rounded-2xl p-4"><div class="font-bold text-sm">${tR(loc, 'sec.scorers')}</div><div class="mt-3 space-y-1.5">${rows}</div></div>`;
}
function UI_matches(loc, list) {
  return list.map(m => homeMatchRow(loc, m));
}

function predIndexPage(loc) {
  const grouped = groupBy(MATCHES, m => m.league);
  const sections = [...grouped.entries()].map(([league, ms]) => {
    const slug = leagueSlug(league);
    const first = ms[0];
    return `<section class="mt-8">
<div class="flex items-center justify-between gap-2"><h2 class="text-lg font-extrabold">${esc(flag(first.code))} ${esc(league)}</h2><a href="${pageUrl(loc, { type: 'league', arg: slug })}" class="text-xs font-bold text-brand-700 hover:underline">${tR(loc, 'league.seeAll', { name: league })}</a></div>
<div class="mt-3 grid md:grid-cols-2 gap-4">${ms.map(m => predCard(loc, m)).join('')}</div>
</section>`;
  }).join('') || `<div class="mt-8 p-6 border border-zinc-200 rounded-2xl text-sm text-zinc-600">${tR(loc, 'predHub.empty')}</div>`;

  const body = `
<main class="max-w-6xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { label: tR(loc, 'nav.predictions') }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${tR(loc, 'predHub.title')}</h1>
<p class="mt-2 text-zinc-600">${tR(loc, 'predHub.desc', { n: MATCHES.length })}</p>
<div class="mt-4 flex flex-wrap gap-3 text-xs">
<span class="bg-zinc-100 px-3 py-1.5 rounded-full font-semibold">${MATCHES.length} ${tR(loc, 'predHub.count', { n: MATCHES.length })}</span>
<span class="bg-zinc-100 px-3 py-1.5 rounded-full font-semibold">${tR(loc, 'sec.update')}</span>
</div>
<section class="mt-6">
<h2 class="text-xl font-extrabold">${tR(loc, 'predHub.group')}</h2>
<p class="mt-2 text-sm text-zinc-600 max-w-3xl">${tR(loc, 'predHub.intro', { n: MATCHES.length })}</p>
</section>
${sections}
<div class="mt-10 grid sm:grid-cols-2 gap-4">
<a href="${pageUrl(loc, { type: 'botd' })}" class="border border-brand-600/30 bg-brand-600/5 rounded-2xl p-5 hover:bg-brand-600/10"><div class="font-bold">${boa(loc, 'botd').nav} ⭐</div><div class="text-sm text-zinc-500 mt-1">${boa(loc, 'botd').sub.slice(0, 90)}…</div></a>
<a href="${pageUrl(loc, { type: 'acca' })}" class="border border-zinc-200 rounded-2xl p-5 hover:bg-zinc-50"><div class="font-bold">${boa(loc, 'acca').nav}</div><div class="text-sm text-zinc-500 mt-1">${boa(loc, 'acca').sub.slice(0, 90)}…</div></a>
<a href="${pageUrl(loc, { type: 'btts' })}" class="border border-zinc-200 rounded-2xl p-5 hover:bg-zinc-50"><div class="font-bold">${tR(loc, 'footer.btts')}</div><div class="text-sm text-zinc-500 mt-1">${tR(loc, 'market.btts')}</div></a>
<a href="${pageUrl(loc, { type: 'over' })}" class="border border-zinc-200 rounded-2xl p-5 hover:bg-zinc-50"><div class="font-bold">${tR(loc, 'footer.over')}</div><div class="text-sm text-zinc-500 mt-1">${tR(loc, 'market.ou')}</div></a>
</div>
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${tR(loc, 'predHub.title')} ${tR(loc, 'site.suffix')}`,
    desc: tR(loc, 'predHub.desc', { n: MATCHES.length }), page: { type: 'predIndex' },
    canonical: `${SITE}${pageUrl(loc, { type: 'predIndex' })}`, body,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'ItemList', name: tR(loc, 'predHub.title'), itemListElement: MATCHES.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: `${m.home} vs ${m.away}`, url: `${SITE}${pageUrl(loc, { type: 'pred', arg: m.slug })}` })) }]
  });
}

const marketHubPage = (loc, which) => {
  const isOver = which === 'over';
  const matches = MATCHES.filter(m => isOver ? isOverTip(m) : isBttsTip(m));
  const title = isOver ? tR(loc, 'footer.over') : tR(loc, 'footer.btts');
  const desc = tR(loc, isOver ? 'marketHub.descOver' : 'marketHub.descBtts', { n: matches.length });
  const page = { type: isOver ? 'over' : 'btts' };
  const cards = matches.map(m => predCard(loc, m)).join('') || `<div class="mt-6 p-6 border border-zinc-200 rounded-2xl text-sm text-zinc-600">${tR(loc, 'predHub.empty')}</div>`;
  const body = `
<main class="max-w-5xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { href: pageUrl(loc, { type: 'predIndex' }), label: tR(loc, 'nav.predictions') }, { label: title }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${title} ${tR(loc, 'marketHub.today')}</h1>
<p class="mt-2 text-zinc-600">${tR(loc, isOver ? 'marketHub.descOver' : 'marketHub.descBtts', { n: matches.length })}</p>
<div class="mt-8 grid md:grid-cols-2 gap-4">${cards}</div>
<div class="mt-10 flex flex-wrap gap-3"><a href="${pageUrl(loc, { type: 'predIndex' })}" class="bg-zinc-900 text-white font-bold px-6 py-3 rounded-full">← ${tR(loc, 'marketHub.back')}</a><a href="${pageUrl(loc, { type: 'predictor' })}" class="bg-zinc-100 font-bold px-6 py-3 rounded-full">${tR(loc, 'marketHub.tryPredictor')}</a></div>
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${title} ${tR(loc, 'marketHub.today')} | XWhiz`,
    desc: desc, page,
    canonical: `${SITE}${pageUrl(loc, page)}`, body
  });
};

// ---- Bet of the Day + Accumulator hubs (high-volume keywords, built from model data) ----
const bestPick = () => MATCHES.slice().sort((a, b) => b.conf - a.conf)[0] || null;
const accaLegs = () => MATCHES.slice().sort((a, b) => b.conf - a.conf).slice(0, 4);
const legOdds = m => { const v = parseFloat(m.odds); return isFinite(v) && v > 1 ? v : null; };
const accaOdds = legs => legs.reduce((acc, m) => { const o = legOdds(m); return o ? acc * o : acc; }, 1);
const accaProb = legs => legs.reduce((acc, m) => acc * (m.conf / 100), 1) * 100;
const BOA = {
  botd: {
    en: { nav: 'Bet of the Day', h1: 'Bet of the Day Today', sub: 'Our single strongest pick today — the highest-confidence output of the Dixon-Coles + Elo model, published with its fair odds.', why: 'Why this pick', empty: 'No bet of the day yet — check back at 06:00 UTC.', faq1q: 'What is the bet of the day?', faq1a: 'The model pick with the highest confidence across all of today\'s matches. It is still a probability estimate, not a guarantee.', faq2q: 'What odds should I expect?', faq2a: 'We publish fair odds (100 divided by probability). Bookmaker prices move — only bet if the offered price matches or beats fair.' },
    fr: { nav: 'Pari du jour', h1: 'Pari du jour', sub: 'Notre pronostic le plus solide du jour — la sortie du modèle Dixon-Coles + Elo avec la plus haute confiance, publiée avec sa cote équitable.', why: 'Pourquoi ce pari', empty: 'Pas encore de pari du jour — revenez à 06h00 UTC.', faq1q: 'Qu\'est-ce que le pari du jour ?', faq1a: 'Le pronostic du modèle avec la plus haute confiance parmi tous les matchs du jour. Cela reste une estimation de probabilité, pas une garantie.', faq2q: 'Quelle cote attendre ?', faq2a: 'Nous publions des cotes équitables (100 divisé par la probabilité). Les cotes bookmakers bougent — ne pariez que si le prix offert égale ou dépasse l\'équitable.' },
    ar: { nav: 'رهان اليوم', h1: 'رهان اليوم', sub: 'أقوى توقعاتنا اليوم — أعلى مخرجات نموذج Dixon-Coles + Elo ثقةً، منشورًا مع احتماله العادل.', why: 'لماذا هذا الرهان', empty: 'لا يوجد رهان اليوم بعد — عُد الساعة 06:00 بتوقيت غرينتش.', faq1q: 'ما هو رهان اليوم؟', faq1a: 'توقع النموذج الأعلى ثقة بين جميع مباريات اليوم. يبقى تقديرًا احتماليًا وليس ضمانًا.', faq2q: 'ما الاحتمال المتوقع؟', faq2a: 'ننشر احتمالات عادلة (100 مقسومًا على الاحتمال). أسعار المراهنات تتحرك — لا تراهن إلا إذا كان السعر المعروض مساويًا أو أفضل.' }
  },
  acca: {
    en: { nav: 'Accumulator Tips', h1: 'Accumulator Tips Today', sub: 'Today\'s acca combines our highest-confidence picks into one bet. Combined odds and the true combined probability are shown honestly.', legs: 'Acca legs', combined: 'Combined', trueProb: 'True combined probability', warn: 'Warning: an accumulator needs every leg to win. The true probability above is low by design — accas are high-risk entertainment, never a steady strategy.', empty: 'No accumulator today — fewer than 2 qualifying picks. Check back at 06:00 UTC.', faq1q: 'How is the acca built?', faq1a: 'We take up to 4 of today\'s highest-confidence model picks. Combined odds multiply; the true win probability multiplies too — which is why it drops fast.', faq2q: 'Should I bet accumulators daily?', faq2a: 'No. Even strong legs combine into a long shot. Small stakes for fun only, if at all.' },
    fr: { nav: 'Pronostics Combinés', h1: 'Combinés du jour', sub: 'Le combiné du jour assemble nos pronostics les plus solides en un seul pari. Cote totale et vraie probabilité combinée affichées honnêtement.', legs: 'Sélections du combiné', combined: 'Combiné', trueProb: 'Vraie probabilité combinée', warn: 'Attention : un combiné exige que chaque sélection gagne. La vraie probabilité ci-dessus est faible par construction — les combinés sont un divertissement à haut risque, jamais une stratégie régulière.', empty: 'Pas de combiné aujourd\'hui — moins de 2 sélections qualifiées. Revenez à 06h00 UTC.', faq1q: 'Comment le combiné est-il construit ?', faq1a: 'Nous prenons jusqu\'à 4 pronostics du jour à plus haute confiance. Les cotes se multiplient ; la vraie probabilité de gain aussi — d\'où sa chute rapide.', faq2q: 'Faut-il jouer des combinés chaque jour ?', faq2a: 'Non. Même des sélections solides forment un pari lointain. Petites mises pour le plaisir uniquement, voire aucune.' },
    ar: { nav: 'توقعات التراكمي', h1: 'توقعات التراكمي اليوم', sub: 'يجمع رهان اليوم التراكمي أعلى توقعاتنا ثقة في رهان واحد. نعرض الاحتمال الإجمالي واحتمال الفوز الحقيقي بأمانة.', legs: 'أرجل التراكمي', combined: 'الإجمالي', trueProb: 'احتمال الفوز الحقيقي', warn: 'تحذير: يحتاج التراكمي فوز كل الأرجل. الاحتمال الحقيقي أعلاه منخفض بالتصميم — التراكمي ترفيه عالي المخاطر وليس استراتيجية ثابتة أبدًا.', empty: 'لا يوجد تراكمي اليوم — أقل من توقعين مؤهلين. عُد الساعة 06:00 بتوقيت غرينتش.', faq1q: 'كيف يُبنى التراكمي؟', faq1a: 'نأخذ حتى 4 من أعلى توقعات اليوم ثقة. تتضاعف الاحتمالات ويتضاعف احتمال الفوز الحقيقي أيضًا — لهذا ينخفض بسرعة.', faq2q: 'هل أراهن على التراكمي يوميًا؟', faq2a: 'لا. حتى الأرجل القوية تشكل رهانًا بعيدًا. مبالغ صغيرة للمتعة فقط إن وُجدت.' }
  }
};
const boa = (loc, k) => ((BOA[k] && BOA[k][loc]) || BOA[k].en);

function botdPage(loc) {
  const m = bestPick();
  const L = boa(loc, 'botd');
  const page = { type: 'botd' };
  const url = `${SITE}${pageUrl(loc, { type: 'botd' })}`;
  const pickHtml = m ? predCard(loc, m) + `<div class="mt-4 flex flex-wrap gap-3"><a href="${pageUrl(loc, { type: 'pred', arg: m.slug })}" class="bg-zinc-900 text-white font-bold px-6 py-3 rounded-full">${t(loc, 'analysis.title')} →</a></div>
<h2 class="mt-8 text-xl font-extrabold">${esc(L.why)}</h2>
<ul class="mt-2 list-disc pl-5 text-zinc-700 space-y-1"><li>${m.conf}% ${t(loc, 'market.conf')} — ${esc(m.pred)} @ ${esc(m.odds)}</li><li>${t(loc, 'sec.how2')}</li><li>${t(loc, 'rg.block')}</li></ul>`
    : `<div class="mt-6 p-6 border border-zinc-200 rounded-2xl text-sm text-zinc-600">${esc(L.empty)}</div>`;
  const faqs = [{ q: L.faq1q, a: L.faq1a }, { q: L.faq2q, a: L.faq2a }];
  const body = `
<main class="max-w-5xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { href: pageUrl(loc, { type: 'predIndex' }), label: t(loc, 'nav.predictions') }, { label: L.nav }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${esc(L.h1)}</h1>
<p class="mt-2 text-zinc-600">${esc(L.sub)}</p>
<p class="mt-1 text-xs text-zinc-400">By XWhiz Data Team · Updated ${esc(todayISO())}</p>
<div class="mt-6 grid md:grid-cols-2 gap-4">${m ? pickHtml : `<div class="col-span-full">${pickHtml}</div>`}</div>
${faqBlock(loc, faqs)}
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${L.h1} | XWhiz`, desc: L.sub, page, canonical: url, body, ogType: 'article', publishedTime: todayISO(),
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'Article', headline: L.h1, datePublished: todayISO(), dateModified: todayISO(), author: { '@type': 'Organization', name: 'XWhiz Data Team', url: SITE }, publisher: { '@type': 'Organization', name: 'XWhiz', logo: { '@type': 'ImageObject', url: `${SITE}/logo.png` } }, image: OG_IMG, mainEntityOfPage: url, isAccessibleForFree: true, description: L.sub },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: HOME_LABEL[loc], item: `${SITE}${pageUrl(loc, { type: 'home' })}` }, { '@type': 'ListItem', position: 2, name: t(loc, 'nav.predictions'), item: `${SITE}${pageUrl(loc, { type: 'predIndex' })}` }, { '@type': 'ListItem', position: 3, name: L.nav, item: url }] },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
    ].concat(m ? [{ '@context': 'https://schema.org', '@type': 'ItemList', name: L.h1, numberOfItems: 1, itemListElement: [{ '@type': 'ListItem', position: 1, name: `${m.home} vs ${m.away} — ${m.pred} @ ${m.odds}`, url: `${SITE}${pageUrl(loc, { type: 'pred', arg: m.slug })}` }] }] : [])
  });
}

function accaPage(loc) {
  const legs = accaLegs();
  const L = boa(loc, 'acca');
  const page = { type: 'acca' };
  const url = `${SITE}${pageUrl(loc, { type: 'acca' })}`;
  const ok = legs.length >= 2;
  const odds = ok ? accaOdds(legs) : 0;
  const prob = ok ? accaProb(legs) : 0;
  const rows = legs.map((m, i) => `<tr class="hover:bg-zinc-50"><td class="px-5 py-3 font-bold">${i + 1}. ${esc(cleanTeamName(m.home))} ${t(loc, 'detail.vs')} ${esc(cleanTeamName(m.away))}</td><td class="px-4 py-3">${esc(m.pred)}</td><td class="px-4 py-3 font-semibold">@ ${esc(m.odds)}</td><td class="px-4 py-3 text-right"><span class="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700">${m.conf}%</span></td></tr>`).join('');
  const faqs = [{ q: L.faq1q, a: L.faq1a }, { q: L.faq2q, a: L.faq2a }];
  const body = `
<main class="max-w-5xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { href: pageUrl(loc, { type: 'predIndex' }), label: t(loc, 'nav.predictions') }, { label: L.nav }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${esc(L.h1)}</h1>
<p class="mt-2 text-zinc-600">${esc(L.sub)}</p>
<p class="mt-1 text-xs text-zinc-400">By XWhiz Data Team · Updated ${esc(todayISO())}</p>
${ok ? `<div class="mt-6 grid sm:grid-cols-3 gap-4">
<div class="bg-zinc-900 text-white rounded-2xl p-5 text-center"><div class="text-xs text-zinc-400">${esc(L.legs)}: ${legs.length}</div><div class="text-3xl font-black mt-1">@ ${odds.toFixed(2)}</div><div class="text-xs text-zinc-400 mt-1">${esc(L.combined)}</div></div>
<div class="border border-zinc-200 rounded-2xl p-5 text-center"><div class="text-xs text-zinc-400">${esc(L.trueProb)}</div><div class="text-3xl font-black mt-1">${prob.toFixed(1)}%</div><div class="text-xs text-zinc-400 mt-1">${t(loc, 'market.conf')}</div></div>
<div class="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-xs leading-relaxed text-zinc-700">${esc(L.warn)}</div>
</div>
<div class="mt-6 overflow-x-auto border border-zinc-200 rounded-2xl"><table class="w-full text-sm"><tbody class="divide-y divide-zinc-100">${rows}</tbody></table></div>`
: `<div class="mt-6 p-6 border border-zinc-200 rounded-2xl text-sm text-zinc-600">${esc(L.empty)}</div>`}
${faqBlock(loc, faqs)}
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${L.h1} | XWhiz`, desc: L.sub, page, canonical: url, body, ogType: 'article', publishedTime: todayISO(),
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'Article', headline: L.h1, datePublished: todayISO(), dateModified: todayISO(), author: { '@type': 'Organization', name: 'XWhiz Data Team', url: SITE }, publisher: { '@type': 'Organization', name: 'XWhiz', logo: { '@type': 'ImageObject', url: `${SITE}/logo.png` } }, image: OG_IMG, mainEntityOfPage: url, isAccessibleForFree: true, description: L.sub },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: HOME_LABEL[loc], item: `${SITE}${pageUrl(loc, { type: 'home' })}` }, { '@type': 'ListItem', position: 2, name: t(loc, 'nav.predictions'), item: `${SITE}${pageUrl(loc, { type: 'predIndex' })}` }, { '@type': 'ListItem', position: 3, name: L.nav, item: url }] },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
    ].concat(ok ? [{ '@context': 'https://schema.org', '@type': 'ItemList', name: L.h1, numberOfItems: legs.length, itemListElement: legs.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: `${m.home} vs ${m.away} — ${m.pred} @ ${m.odds}`, url: `${SITE}${pageUrl(loc, { type: 'pred', arg: m.slug })}` })) }] : [])
  });
}

function predDetailPage(loc, m, related) {
  const url = `${SITE}${pageUrl(loc, { type: 'pred', arg: m.slug })}`;
  const dateStr = fmtDate(loc, m.utcDate);
  const dateISO = (m.utcDate || todayISO()).slice(0, 10);
  const pH = num(loc, m.probs.home), pD = num(loc, m.probs.draw), pA = num(loc, m.probs.away);
  const xgh = m.xg ? num(loc, m.xg.home) : '—', xga = m.xg ? num(loc, m.xg.away) : '—';
  const marketRows = [
    [t(loc, 'market._1x2'), `${pH}% / ${pD}% / ${pA}%`, `${esc(m.pred)} @ ${esc(m.odds)}`, m.conf]
  ];
  const dc = m.doubleChance;
  if (dc) marketRows.push([t(loc, 'market.dc'), `${num(loc, dc['1X'])}% / ${num(loc, dc.X2)}% / ${num(loc, dc['12'])}%`, '1X / X2 / 12', Math.max(dc['1X'], dc.X2, dc['12'])]);
  if (m.overUnder) marketRows.push([t(loc, 'market.ou'), `${t(loc, 'market.over')} ${num(loc, m.overUnder.over2_5)}% • ${t(loc, 'market.under')} ${num(loc, m.overUnder.under2_5)}%`, `Over @ ${esc(m.overUnder.oddsOver)}`, m.overUnder.over2_5]);
  if (m.btts) marketRows.push([t(loc, 'market.btts'), `${t(loc, 'market.yes')} ${num(loc, m.btts.yes)}% • ${t(loc, 'market.no')} ${num(loc, m.btts.no)}%`, `BTTS ${t(loc, 'market.yes')} @ ${num(loc, (100 / m.btts.yes).toFixed(2))}`, m.btts.yes]);
  if (m.correctScore) marketRows.push([t(loc, 'market.cs'), `${esc(m.correctScore.score)} (${num(loc, m.correctScore.prob)}%)`, esc(m.correctScore.score), m.correctScore.prob]);

  const faqs = [
    { q: t(loc, 'analysis.faq1.q', { home: m.home, away: m.away }), a: t(loc, 'analysis.faq1.a', { home: m.home, away: m.away, pH, pD, pA, xgh, xga, pred: m.pred, odds: m.odds, conf: m.conf }) },
    { q: t(loc, 'analysis.faq2.q', {}), a: t(loc, 'analysis.faq2.a', { pred: m.pred }) },
    { q: t(loc, 'analysis.faq3.q', { home: m.home, away: m.away }), a: t(loc, 'analysis.faq3.a', { precise: m.precise, countdown: m.countdown }) }
  ];

  const relatedHTML = related.map(r => `<div class="block border border-zinc-200 rounded-2xl hover:bg-zinc-50"><a href="${pageUrl(loc, { type: 'pred', arg: r.slug })}" class="block p-4 pb-1"><div class="font-bold text-sm">${esc(r.home)} ${t(loc, 'detail.vs')} ${esc(r.away)}</div></a><div class="px-4 pb-4 text-xs text-zinc-500">${esc(r.league)} • ${esc(r.pred)} @ ${esc(r.odds)} • ${r.conf}%</div></div>`).join('');

  const body = `
<main class="max-w-4xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [
  { href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] },
  { href: pageUrl(loc, { type: 'predIndex' }), label: t(loc, 'nav.predictions') },
  { href: pageUrl(loc, { type: 'league', arg: leagueSlug(m.league) }), label: m.league },
  { label: `${m.home} ${t(loc, 'detail.vs')} ${m.away}` }
])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight leading-tight">${esc(m.home)} ${t(loc, 'detail.vs')} ${esc(m.away)} — ${t(loc, 'analysis.title')}</h1>
<p class="mt-2 text-zinc-600">${esc(m.league)} • ${esc(dateStr)} • ${esc(m.precise)}</p>
<p class="mt-1 text-xs text-zinc-400">By XWhiz Data Team · Updated ${esc(todayISO())} · Model Dixon-Coles v3 · <a class="underline" href="${pageUrl(loc, { type: 'methodology' })}">${(LEGAL_LABEL[loc]||LEGAL_LABEL.en).methodology}</a></p>
<div class="mt-3 flex flex-wrap gap-2 text-xs">
<a href="${pageUrl(loc, { type: 'league', arg: leagueSlug(m.league) })}" class="font-semibold text-brand-700 hover:underline">${t(loc, 'analysis.leagueLink')}</a>
<a href="${pageUrl(loc, { type: 'team', arg: slugify(m.home) })}" class="font-semibold text-brand-700 hover:underline">${esc(m.home)}</a>
<a href="${pageUrl(loc, { type: 'team', arg: slugify(m.away) })}" class="font-semibold text-brand-700 hover:underline">${esc(m.away)}</a>
</div>

<div class="mt-6 bg-zinc-900 text-white rounded-3xl p-6 md:p-8">
<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
<div>
<div class="text-xs font-bold tracking-widest text-green-400">${t(loc, 'detail.tag')}</div>
<div class="mt-2 text-3xl font-black">${esc(m.pred)} <span class="text-lg font-semibold text-zinc-300">@ ${esc(m.odds)}</span></div>
<div class="mt-2 flex flex-wrap gap-2 text-xs"><span class="bg-green-600 px-3 py-1 rounded-full font-bold">${m.conf}% ${t(loc, 'market.conf')}</span><span class="bg-white/10 px-3 py-1 rounded-full">${t(loc, 'market.value')} ${esc(m.value)}</span><span class="bg-white/10 px-3 py-1 rounded-full">${esc(m.sub)}</span></div>
</div>
<div class="shrink-0 text-center"><div class="text-5xl font-black">${m.conf}%</div><div class="text-xs text-zinc-400 mt-1">${t(loc, 'market.conf')}</div></div>
</div>
<div class="mt-6 grid grid-cols-3 gap-3 text-center text-sm">
<div class="bg-white/10 rounded-2xl py-3"><div class="text-xs text-zinc-400">${esc(m.home)}</div><div class="text-2xl font-black">${pH}%</div></div>
<div class="bg-white/10 rounded-2xl py-3"><div class="text-xs text-zinc-400">${t(loc, 'market.draw')}</div><div class="text-2xl font-black">${pD}%</div></div>
<div class="bg-white/10 rounded-2xl py-3"><div class="text-xs text-zinc-400">${esc(m.away)}</div><div class="text-2xl font-black">${pA}%</div></div>
</div>
<a href="${MELBET}" target="_blank" rel="sponsored nofollow noopener" class="mt-6 block bg-green-600 hover:bg-green-700 text-white text-center font-black px-8 py-4 rounded-full">${t(loc, 'cta.bet', { pred: m.pred })} → <span class="block text-xs font-normal mt-0.5">${t(loc, 'cta.bonus', { code: CODE })}</span></a>
</div>

<h2 class="mt-10 text-2xl font-extrabold">${t(loc, 'market.markets')}</h2>
<div class="mt-4 overflow-x-auto border border-zinc-200 rounded-2xl">
<table class="w-full text-sm">
<thead class="bg-zinc-50 text-xs font-bold tracking-widest text-zinc-500"><tr><th class="text-left px-5 py-3">${t(loc, 'market.markets')}</th><th class="text-left px-4 py-3">${t(loc, 'market.prob')}</th><th class="text-left px-4 py-3">${t(loc, 'market.pick')}</th><th class="px-4 py-3">${t(loc, 'market.conf')}</th></tr></thead>
<tbody class="divide-y divide-zinc-100">
${marketRows.map(r => `<tr class="hover:bg-zinc-50"><td class="px-5 py-3 font-bold">${r[0]}</td><td class="px-4 py-3 text-zinc-600">${r[1]}</td><td class="px-4 py-3 font-semibold">${r[2]}</td><td class="px-4 py-3 text-right"><span class="inline-block min-w-[48px] px-2.5 py-1 rounded-full text-xs font-bold ${r[3] >= 70 ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-700'}">${r[3]}%</span></td></tr>`).join('')}
</tbody>
</table>
</div>

<article class="mt-10 leading-relaxed">
<h2 class="text-2xl font-extrabold">${t(loc, 'analysis.title')}</h2>
<p class="mt-3 text-zinc-700">${t(loc, 'analysis.intro', { home: m.home, away: m.away, league: m.league, xgh, xga, pH, pD, pA, pred: m.pred, odds: m.odds, conf: m.conf })}</p>
${m.topScores && m.topScores.length ? `<h3 class="mt-6 text-lg font-extrabold">${t(loc, 'analysis.scoresTitle')}</h3>
<p class="text-zinc-700">${t(loc, 'analysis.scoresPre')} ${m.topScores.map(s => `${esc(s.score)} (${s.prob}%)`).join(' · ')}.</p>` : ''}
<h3 class="mt-6 text-lg font-extrabold">${t(loc, 'analysis.why', { pred: m.pred })}</h3>
<ul class="mt-2 list-disc pl-5 text-zinc-700 space-y-1">
<li>${t(loc, 'bet.' + m.pred)}</li>
<li>${t(loc, 'analysis.formLabel')}: ${esc(fmtForm(m.form))}</li>
<li>${t(loc, 'analysis.injuriesLabel')}: ${esc(m.injuries)} · ${t(loc, 'analysis.formNote')}</li>
</ul>
<h3 class="mt-6 text-lg font-extrabold">${t(loc, 'analysis.howTo')}</h3>
<p class="text-zinc-700">${t(loc, 'analysis.stakeNote')}</p>
<h3 class="mt-6 text-lg font-extrabold">${t(loc, 'analysis.whereTo')}</h3>
<p class="text-zinc-700">${t(loc, 'analysis.whereNote', { bookie: 'Melbet', code: CODE })} — <a href="${MELBET}" target="_blank" rel="sponsored nofollow noopener" class="text-brand-700 underline">${t(loc, 'detail.register')}</a></p>
</article>
${rgNote(loc)}
${faqBlock(loc, faqs)}
<section class="mt-10">
<h2 class="text-2xl font-extrabold">${t(loc, 'detail.more')}</h2>
<div class="mt-4 grid md:grid-cols-2 gap-4">${relatedHTML}</div>
<div class="mt-6 flex flex-wrap gap-3"><a href="${pageUrl(loc, { type: 'predIndex' })}" class="bg-zinc-900 text-white font-bold px-6 py-3 rounded-full">← ${t(loc, 'marketHub.back')}</a><a href="${pageUrl(loc, { type: 'btts' })}" class="bg-zinc-100 font-bold px-6 py-3 rounded-full">${t(loc, 'detail.seeBtts')}</a><a href="${pageUrl(loc, { type: 'over' })}" class="bg-zinc-100 font-bold px-6 py-3 rounded-full">${t(loc, 'detail.seeOver')}</a></div>
</section>
</main>`;

  return shell(loc, {
    title: `${esc(m.home)} vs ${esc(m.away)} ${t(loc, 'detail.titleToken')} | XWhiz`,
    desc: t(loc, 'detail.desc', { home: m.home, away: m.away, pred: m.pred, odds: m.odds, conf: m.conf }),
    canonical: url, page: { type: 'pred', arg: m.slug }, body, ogType: 'article', publishedTime: dateISO,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'SportsEvent', name: `${m.home} ${t(loc, 'detail.vs')} ${m.away}`, sport: 'Soccer', inLanguage: loc, startDate: m.utcDate, eventStatus: 'https://schema.org/EventScheduled', homeTeam: { '@type': 'SportsTeam', name: m.home }, awayTeam: { '@type': 'SportsTeam', name: m.away }, location: { '@type': 'Place', name: m.league }, organizer: { '@type': 'Organization', name: m.league, url: m.code && LEAGUE_INTROS[m.league] && LEAGUE_INTROS[m.league].org ? LEAGUE_INTROS[m.league].org : undefined }, contributor: { '@type': 'Organization', name: 'XWhiz', url: SITE }, description: `${m.pred} @ ${m.odds}, ${m.conf}% confidence — statistical model analysis${m.correctScore ? `, most likely score ${m.correctScore.score}` : ''}.` },
      { '@context': 'https://schema.org', '@type': 'Article', headline: `${m.home} vs ${m.away} Prediction ${dateISO}`, datePublished: dateISO, dateModified: todayISO(), author: { '@type': 'Organization', name: 'XWhiz Data Team', url: `${SITE}/about/` }, publisher: { '@type': 'Organization', name: 'XWhiz', logo: { '@type': 'ImageObject', url: `${SITE}/logo.png` } }, image: OG_IMG, mainEntityOfPage: url, isAccessibleForFree: true, description: `${m.pred} @ ${m.odds} — Dixon-Coles statistical model.`, keywords: `${m.home} vs ${m.away} prediction, ${m.league} prediction, statistical football prediction` },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: HOME_LABEL[loc], item: `${SITE}${pageUrl(loc, { type: 'home' })}` }, { '@type': 'ListItem', position: 2, name: t(loc, 'nav.predictions'), item: `${SITE}${pageUrl(loc, { type: 'predIndex' })}` }, { '@type': 'ListItem', position: 3, name: `${m.home} vs ${m.away}`, item: url }] },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
    ]
  });
}

function livePage(loc) {
  const live = LIVE_JSON.matches;
  const rows = live.length ? live.map(m => {
    const home = cleanTeamName(homeName(m)), away = cleanTeamName(awayName(m));
    const score = (m.score && m.score.fullTime && m.score.fullTime.home != null) ? `${m.score.fullTime.home}–${m.score.fullTime.away}` : '—';
    const slug = predSlugFor(homeName(m), awayName(m)) || predSlugFor(home, away);
    const link = slug ? pageUrl(loc, { type: 'pred', arg: slug }) : pageUrl(loc, { type: 'team', arg: slugify(home) });
    return `<a href="${link}" class="border border-zinc-200 rounded-2xl p-4 flex items-center justify-between gap-3 hover:bg-zinc-50 transition"><div><div class="text-xs text-zinc-400">${esc(compName(m))} • ${statusLabel(loc, m.status)}</div><div class="font-bold">${esc(home)} ${t(loc, 'detail.vs')} ${esc(away)}</div></div><div class="text-xl font-black tabular-nums">${score}</div></a>`;
  }).join('') : `<div class="p-5 border border-zinc-200 rounded-2xl text-sm text-zinc-500">${t(loc, 'live.mg')}</div>`;
  const body = `
<main class="max-w-6xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { label: t(loc, 'nav.live') }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${t(loc, 'live.title')}</h1>
<p class="mt-2 text-zinc-600">${t(loc, 'live.sub')}</p>
<div class="mt-6 space-y-2">${rows}</div>
<div class="mt-10 grid md:grid-cols-3 gap-4">
${standingsPanelFull(loc)}
${scorersPanelFull(loc)}
</div>
<div class="mt-8 text-xs text-zinc-400">${t(loc, 'sec.update')}</div>
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${t(loc, 'live.title')} | XWhiz`, desc: t(loc, 'live.sub'), page: { type: 'live' },
    canonical: `${SITE}${pageUrl(loc, { type: 'live' })}`, body
  });
}
function standingsPanelFull(loc) {
  const st = LIVE_JSON.standings;
  if (!st || !st.table || !st.table.length) return `<div class="border border-zinc-200 rounded-2xl p-4 text-sm text-zinc-500">${tR(loc, 'football.standingsNote')}</div>`;
  const rows = st.table.map(r => `<div class="flex items-center gap-2 text-xs py-1.5 border-b border-zinc-50 last:border-0"><span class="w-5 text-zinc-400">${r.position}</span><span class="flex-1 font-medium truncate">${esc(cleanTeamName(r.team))}</span><span class="text-zinc-400 w-6 text-center">${r.played}</span><span class="w-6 text-center">${r.won}</span><span class="w-6 text-center">${r.draw}</span><span class="w-6 text-center">${r.lost}</span><span class="font-bold tabular-nums w-8 text-right">${r.points}</span></div>`).join('');
  return `<div class="border border-zinc-200 rounded-2xl p-4"><div class="font-bold text-sm">${tR(loc, 'live.standings')}</div><div class="mt-2 flex gap-2 text-[10px] text-zinc-400 font-semibold"><span class="w-5"></span><span class="flex-1">${tR(loc, 'football.teams')}</span><span class="w-6 text-center">J</span><span class="w-6 text-center">G</span><span class="w-6 text-center">N</span><span class="w-6 text-center">P</span><span class="w-8 text-right">Pts</span></div><div class="mt-1">${rows}</div></div>`;
}
function scorersPanelFull(loc) {
  const sc = LIVE_JSON.scorers;
  if (!sc.length) return `<div class="border border-zinc-200 rounded-2xl p-4 text-sm text-zinc-500">${tR(loc, 'football.standingsNote')}</div>`;
  const rows = sc.map((s, i) => `<div class="flex items-center gap-2 text-xs py-1.5 border-b border-zinc-50 last:border-0"><span class="w-5 text-zinc-400">${i + 1}</span><span class="flex-1 font-medium truncate">${esc(s.player)}</span><span class="text-zinc-400 truncate">${esc(cleanTeamName(s.team))}</span><span class="font-bold tabular-nums">${s.goals}</span></div>`).join('');
  return `<div class="border border-zinc-200 rounded-2xl p-4"><div class="font-bold text-sm">${tR(loc, 'live.scorers')}</div><div class="mt-2">${rows}</div></div>`;
}

function predictorPage(loc) {
  const teams = Array.from(TEAMS.keys()).sort().slice(0, 400);
  const teamNames = [...TEAMS.values()];
  const predLabels = {
    'Home Win': t(loc, 'market.home'), 'Draw': t(loc, 'market.draw'), 'Away Win': t(loc, 'market.away'),
    'Over 2.5': t(loc, 'market.over'), 'Under 2.5': t(loc, 'market.under'), 'BTTS Yes': t(loc, 'market.btts')
  };
  const body = `
<main class="max-w-3xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { label: t(loc, 'nav.predictor') }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${t(loc, 'predictor.title')}</h1>
<p class="mt-2 text-zinc-600">${t(loc, 'predictor.sub')}</p>
<p class="mt-2 text-xs text-zinc-500">${t(loc, 'predictor.modelDesc')}</p>
<div class="mt-6 bg-white border border-zinc-200 rounded-3xl p-6">
<div class="grid sm:grid-cols-2 gap-4">
<div><label class="text-xs font-bold text-zinc-500" for="pdh">${t(loc, 'predictor.teamA')}</label><input id="pdh" list="pdl" class="mt-1 w-full border border-zinc-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-brand-600" placeholder="${t(loc, 'predictor.placeholder')}" autocomplete="off"></div>
<div><label class="text-xs font-bold text-zinc-500" for="pda">${t(loc, 'predictor.teamB')}</label><input id="pda" list="pdl" class="mt-1 w-full border border-zinc-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-brand-600" placeholder="${t(loc, 'predictor.placeholder')}" autocomplete="off"></div>
</div>
<datalist id="pdl">${teamNames.map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>
<div class="mt-4 flex flex-wrap gap-3">
<button id="pdc" class="bg-brand-600 hover:bg-brand-700 text-white font-black px-6 py-3 rounded-full">${t(loc, 'predictor.calc')}</button>
<button id="pds" class="bg-zinc-100 hover:bg-zinc-200 font-bold px-6 py-3 rounded-full">${t(loc, 'predictor.swap')}</button>
</div>
${teamNames.length ? `<div class="mt-4 text-xs text-zinc-500"><span>${t(loc, 'predictor.suggestions')}:</span> ${teamNames.slice(0, 8).map(n => esc(n)).join(', ')}…</div>` : ''}
<div id="pdr" class="mt-6 hidden"></div>
<p class="mt-6 text-xs text-zinc-500">${t(loc, 'predictor.uncertainty')}</p>
</div>
<script>
(function(){
var ELO=${safeJson(dcModel.RATINGS)};
var LABEL=${safeJson(predLabels)};
function nm(t){var n=String(t||'').toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();n=n.replace(/^(fc|ac|as|sc|ss|cd|cf|de|1\.)\s+/,'').replace(/\s+(fc|ac|as|sc|ss|afc|cf|cd|ud)$/,'');return n}
function elo(t){var v=ELO[nm(t)];return v||1600}
function pois(k,l){var p=Math.exp(-l);for(var i=1;i<=k;i++)p*=l/i;return p}
function mat(lh,la){var rho=.08,N=6,M=[];var i,j;for(i=0;i<=N;i++){M[i]=[];for(j=0;j<=N;j++){var p=pois(i,lh)*pois(j,la);if(i===0&&j===0)p*=1-lh*la*rho;else if(i===1&&j===0)p*=1+la*rho;else if(i===0&&j===1)p*=1+lh*rho;else if(i===1&&j===1)p*=1-rho;M[i][j]=p}}var tot=0;for(i=0;i<=N;i++)for(j=0;j<=N;j++)tot+=M[i][j];for(i=0;i<=N;i++)for(j=0;j<=N;j++)M[i][j]/=tot;return M}
function run(h,a){var eh=elo(h),ea=elo(a),d=(eh+100-ea)/400,g=[1.4*Math.pow(10,d/2),1.2*Math.pow(10,-d/2)];g[0]=Math.max(.35,Math.min(4.2,g[0]));g[1]=Math.max(.3,Math.min(4,g[1]));var P=mat(g[0],g[1]),pH=0,pD=0,pA=0,over=0,btts=0,i,j;for(i=0;i<P.length;i++)for(j=0;j<P.length;j++){if(i>j)pH+=P[i][j];else if(i===j)pD+=P[i][j];else pA+=P[i][j];if(i+j>=3)over+=P[i][j];if(i>=1&&j>=1)btts+=P[i][j]}
var q=Math.max(pH,pD,pA);var pred;if(pH>=pA&&pH>=pD)pred='Home Win';else if(pA>=pH&&pA>=pD)pred='Away Win';else pred='Draw';
var conf=Math.min(90,Math.max(58,Math.round(58+(q-0.36)*160)));var odds=(1/q*0.95).toFixed(2);
var bi=0,bj=0,best=-1;for(i=0;i<P.length;i++)for(j=0;j<P.length;j++){if(P[i][j]>best+1e-9||(Math.abs(P[i][j]-best)<1e-9&&(i+j<bi+bj||(i+j===bi+bj&&i<bi)))){best=P[i][j];bi=i;bj=j}}
var cells=[];for(i=0;i<P.length;i++)for(j=0;j<P.length;j++)cells.push([i+j,P[i][j],i,j]);cells.sort(function(x,y){return y[1]-x[1]||(x[0]-y[0])||(x[2]-y[2])});
return{home:h,away:a,pH:Math.round(pH*100),pD:Math.round(pD*100),pA:Math.round(pA*100),over:Math.round(over*100),btts:Math.round(btts*100),pred:pred,conf:conf,odds:odds,xg:g,cs:bi+'-'+bj,csP:Math.round(best*100),top:cells.slice(0,3).map(function(c){return c[2]+'-'+c[3]+' ('+Math.round(c[1]*100)+'%)'}),ah:(g[0]-g[1])>=0?'Home -'+(Math.round(Math.abs(g[0]-g[1])*4)/4).toFixed(2):'Away +'+(Math.round(Math.abs(g[0]-g[1])*4)/4).toFixed(2)}}
function paint(h,a){var r=run(h,a),o=document.getElementById('pdr');o.classList.remove('hidden');o.innerHTML='<div class="text-xs font-bold tracking-widest text-brand-700 uppercase">XWHIZ</div><div class="mt-1 text-2xl font-black">'+LABEL[r.pred]+' <span class="text-sm font-semibold text-zinc-400">@ '+r.odds+'</span></div><div class="mt-1 text-xs text-zinc-500">'+r.conf+'% confidence</div><div class="mt-4 grid grid-cols-3 gap-2 text-center text-sm"><div class="bg-zinc-50 rounded-xl py-3"><div class="text-xs text-zinc-500">'+r.home+'</div><div class="text-xl font-black">'+r.pH+'%</div></div><div class="bg-zinc-50 rounded-xl py-3"><div class="text-xs text-zinc-500">Draw</div><div class="text-xl font-black">'+r.pD+'%</div></div><div class="bg-zinc-50 rounded-xl py-3"><div class="text-xs text-zinc-500">'+r.away+'</div><div class="text-xl font-black">'+r.pA+'%</div></div></div><div class="mt-3 grid grid-cols-2 gap-2 text-sm"><div class="border border-zinc-100 rounded-xl p-3"><span class="text-xs text-zinc-400">xG</span><div class="font-bold">'+r.xg[0].toFixed(2)+' : '+r.xg[1].toFixed(2)+'</div></div><div class="border border-zinc-100 rounded-xl p-3"><span class="text-xs text-zinc-400">2.5+</span><div class="font-bold">'+r.over+'%</div></div><div class="border border-zinc-100 rounded-xl p-3"><span class="text-xs text-zinc-400">BTTS</span><div class="font-bold">'+r.btts+'%</div></div><div class="border border-zinc-100 rounded-xl p-3"><span class="text-xs text-zinc-400">1X2</span><div class="font-bold">'+r.pH+'/'+r.pD+'/'+r.pA+'</div></div></div><div class="mt-3 grid grid-cols-2 gap-2 text-sm"><div class="border border-zinc-100 rounded-xl p-3"><span class="text-xs text-zinc-400">Most likely</span><div class="font-bold">'+r.cs+' ('+r.csP+'%)</div></div><div class="border border-zinc-100 rounded-xl p-3"><span class="text-xs text-zinc-400">Top scores</span><div class="font-bold">'+r.top.join(', ')+'</div></div></div><div class="mt-3 text-xs text-zinc-500">Handicap ~ '+r.ah+' • '+${safeJson(t(loc, 'predictor.uncertainty'))}+'</div>';
}
document.getElementById('pdc').addEventListener('click',function(){var h=document.getElementById('pdh').value.trim(),a=document.getElementById('pda').value.trim();if(!h||!a){document.getElementById('pdr').classList.remove('hidden');document.getElementById('pdr').innerHTML='<div class="text-sm text-red-600">Enter two teams.</div>';return}paint(h,a)});
document.getElementById('pds').addEventListener('click',function(){var h=document.getElementById('pdh'),a=document.getElementById('pda');var tmp=h.value;h.value=a.value;a.value=tmp;if(h.value&&a.value)paint(h.value,a.value)});
document.getElementById('pdh').addEventListener('keypress',function(e){if(e.key==='Enter')document.getElementById('pdc').click()});
document.getElementById('pda').addEventListener('keypress',function(e){if(e.key==='Enter')document.getElementById('pdc').click()});
})();
</script>
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${t(loc, 'predictor.title')} | XWhiz`, desc: t(loc, 'predictor.desc'), page: { type: 'predictor' },
    canonical: `${SITE}${pageUrl(loc, { type: 'predictor' })}`, body
  });
}

function footballHubPage(loc) {
  const comps = [...LEAGUES.entries()].map(([slug, lg]) => `<a href="${pageUrl(loc, { type: 'league', arg: slug })}" class="border border-zinc-200 rounded-2xl p-4 hover:bg-zinc-50 transition block"><div class="text-xs text-zinc-400 font-bold">${esc(flag(lg.code))} ${tR(loc, 'football.leagues')}</div><div class="mt-1 font-bold text-sm">${esc(lg.name)}</div><div class="mt-1 text-xs text-brand-700">${lg.count} ${tR(loc, 'detail.views').toLowerCase()}</div></a>`).join('');
  const teams = [...TEAMS.slice ? TEAMS.values() : []].slice(0, 18).map(n => { const s = slugify(n); return `<a href="${pageUrl(loc, { type: 'team', arg: s })}" class="border border-zinc-200 rounded-2xl px-4 py-2 text-sm font-medium hover:bg-zinc-50">${esc(n)}</a>`; }).join('');
  const cards = [
    { href: pageUrl(loc, { type: 'leagues' }), t: tR(loc, 'footer.leagues'), d: `${LEAGUES.size} ${tR(loc, 'detail.views').toLowerCase()}` },
    { href: pageUrl(loc, { type: 'teams' }), t: tR(loc, 'footer.teams'), d: `${TEAMS.size} ${tR(loc, 'detail.views').toLowerCase()}` },
    { href: pageUrl(loc, { type: 'fixtures' }), t: tR(loc, 'footer.fixtures'), d: tR(loc, 'football.upcoming') },
    { href: pageUrl(loc, { type: 'results' }), t: tR(loc, 'footer.results'), d: tR(loc, 'football.finished') }
  ];
  const body = `
<main class="max-w-6xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { label: tR(loc, 'nav.football') }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${tR(loc, 'football.hubTitle')}</h1>
<p class="mt-2 text-zinc-600">${tR(loc, 'football.hubDesc')}</p>
<p class="mt-3 text-sm text-zinc-600 max-w-3xl">${tR(loc, 'football.hubIntro')}</p>
<div class="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">${cards.map(c => `<a href="${c.href}" class="border border-zinc-200 rounded-2xl p-5 hover:bg-zinc-50"><div class="font-bold">${c.t}</div><div class="text-sm text-zinc-500 mt-1">${c.d}</div></a>`).join('')}</div>
<h2 class="mt-10 text-2xl font-extrabold">${tR(loc, 'sec.leagues')}</h2>
<div class="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${comps || `<div class="text-sm text-zinc-500">${tR(loc, 'football.noMatches')}</div>`}</div>
<h2 class="mt-10 text-2xl font-extrabold">${tR(loc, 'footer.teams')}</h2>
<div class="mt-4 flex flex-wrap gap-2">${teams || `<div class="text-sm text-zinc-500">${tR(loc, 'football.noMatches')}</div>`}</div>
<p class="mt-8 text-xs text-zinc-400">${tR(loc, 'sec.update')} — ${tR(loc, 'sec.dataNote')}</p>
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${tR(loc, 'football.hubTitle')} — ${tR(loc, 'football.hubKey')} | XWhiz`, desc: tR(loc, 'football.hubDesc'), page: { type: 'football' },
    canonical: `${SITE}${pageUrl(loc, { type: 'football' })}`, body
  });
}

function leagueIndexPage(loc) {
  const comps = [...LEAGUES.entries()].map(([slug, lg]) => `<a href="${pageUrl(loc, { type: 'league', arg: slug })}" class="border border-zinc-200 rounded-2xl p-4 hover:bg-zinc-50 transition block"><div class="text-xs text-zinc-400 font-bold">${esc(flag(lg.code))} ${tR(loc, 'football.leagues')}</div><div class="mt-1 font-bold text-sm">${esc(lg.name)}</div><div class="mt-1 text-xs text-brand-700">${lg.count} ${tR(loc, 'detail.views').toLowerCase()}</div></a>`).join('');
  const body = `
<main class="max-w-5xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { href: pageUrl(loc, { type: 'football' }), label: tR(loc, 'nav.football') }, { label: tR(loc, 'footer.leagues') }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${tR(loc, 'footer.leagues')}</h1>
<p class="mt-2 text-zinc-600">${tR(loc, 'football.hubDesc')}</p>
<div class="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${comps}</div>
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${tR(loc, 'footer.leagues')} — Football | XWhiz`, desc: tR(loc, 'football.hubDesc'), page: { type: 'leagues' },
    canonical: `${SITE}${pageUrl(loc, { type: 'leagues' })}`, body
  });
}

function leaguePage(loc, slug, lg) {
  const name = lg.name;
  const ps = MATCHES.filter(m => m.league === name);
  const up = UPCOMING.filter(m => compName(m) === name).slice(0, 12).map(m => homeMatchRow(loc, m)).join('');
  const fi = (YESTERDAY.concat(TODAY)).filter(m => compName(m) === name);
  const rows = fi.slice(0, 12).map(m => homeMatchRow(loc, m)).join('');
  const isPL = slug === 'premier-league';
  const st = isPL ? LIVE_JSON.standings : null;
  // Thin = no predictions AND no upcoming AND no finished. Don't index empty pages.
  const isThin = ps.length === 0 && !up && !rows;
  const tab = (p, label, active, content) => `<section class="mt-8">${content}</section>`;
  const body = `
<main class="max-w-5xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { href: pageUrl(loc, { type: 'football' }), label: tR(loc, 'nav.football') }, { href: pageUrl(loc, { type: 'leagues' }), label: tR(loc, 'footer.leagues') }, { label: name }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${esc(flag(lg.code))} ${esc(name)}</h1>
<p class="mt-2 text-zinc-600">${tR(loc, 'football.overview')} — ${tR(loc, 'football.hubDesc')}</p>
<p class="mt-3 text-sm text-zinc-600 max-w-3xl">${tR(loc, 'league.intro', { name })}</p>
<div class="mt-6">
<details class="border border-zinc-200 rounded-2xl overflow-hidden" open>
<summary class="px-5 py-4 font-extrabold cursor-pointer hover:bg-zinc-50">${tR(loc, 'sec.topPicks')}</summary>
<div class="px-5 pb-5">${ps.length ? `<div class="grid sm:grid-cols-2 gap-4">${ps.map(m => predCard(loc, m)).join('')}</div>` : `<div class="text-sm text-zinc-500">${tR(loc, 'football.noMatches')}</div>`}</div>
</details>
<details class="mt-4 border border-zinc-200 rounded-2xl overflow-hidden" open>
<summary class="px-5 py-4 font-extrabold cursor-pointer hover:bg-zinc-50">${tR(loc, 'football.upcoming')}</summary>
<div class="px-5 pb-5 space-y-2">${up || `<div class="text-sm text-zinc-500">${tR(loc, 'football.noMatches')}</div>`}</div>
</details>
<details class="mt-4 border border-zinc-200 rounded-2xl overflow-hidden">
<summary class="px-5 py-4 font-extrabold cursor-pointer hover:bg-zinc-50">${tR(loc, 'football.finished')}</summary>
<div class="px-5 pb-5 space-y-2">${rows || `<div class="text-sm text-zinc-500">${tR(loc, 'football.noMatches')}</div>`}</div>
</details>
${st && st.table ? `<details class="mt-4 border border-zinc-200 rounded-2xl overflow-hidden"><summary class="px-5 py-4 font-extrabold cursor-pointer hover:bg-zinc-50">${tR(loc, 'live.standings')}</summary><div class="px-5 pb-5">${standingsPanelFull(loc)}</div></details>` : ''}
</div>
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${esc(name)} ${tR(loc, 'site.tagline')} | XWhiz`, desc: `${name}. ${tR(loc, 'football.hubDesc')}`, page: { type: 'league', arg: slug },
    canonical: `${SITE}${pageUrl(loc, { type: 'league', arg: slug })}`, body,
    noindex: isThin
  });
}

function teamsIndexPage(loc) {
  const chips = [...TEAMS.values()].sort().map(n => `<a href="${pageUrl(loc, { type: 'team', arg: slugify(n) })}" class="border border-zinc-200 rounded-2xl px-4 py-2 text-sm font-medium hover:bg-zinc-50">${esc(n)}</a>`).join('');
  const body = `
<main class="max-w-5xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { href: pageUrl(loc, { type: 'football' }), label: tR(loc, 'nav.football') }, { label: tR(loc, 'footer.teams') }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${tR(loc, 'footer.teams')}</h1>
<p class="mt-2 text-zinc-600">${tR(loc, 'football.hubDesc')}</p>
<div class="mt-6 flex flex-wrap gap-2">${chips || `<div class="text-sm text-zinc-500">${tR(loc, 'football.noMatches')}</div>`}</div>
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${tR(loc, 'footer.teams')} — Football | XWhiz`, desc: tR(loc, 'football.hubDesc'), page: { type: 'teams' },
    canonical: `${SITE}${pageUrl(loc, { type: 'teams' })}`, body
  });
}

function teamPage(loc, slug, name) {
  const inPred = MATCHES.filter(m => m.home === name || m.away === name);
  const inFix = [...UPCOMING, ...TODAY, ...TOMORROW].filter(m => homeName(m) === name || awayName(m) === name).slice(0, 12);
  const inRes = YESTERDAY.filter(m => homeName(m) === name || awayName(m) === name).slice(0, 8);
  const rows = inFix.map(m => homeMatchRow(loc, m)).join('');
  const resRows = inRes.map(m => homeMatchRow(loc, m)).join('');
  // Thin = no predictions AND no upcoming AND no finished. Don't index empty pages.
  const isThin = inPred.length === 0 && !rows && !resRows;
  const body = `
<main class="max-w-4xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { href: pageUrl(loc, { type: 'football' }), label: tR(loc, 'nav.football') }, { href: pageUrl(loc, { type: 'teams' }), label: tR(loc, 'footer.teams') }, { label: name }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${esc(name)}</h1>
<p class="mt-2 text-zinc-600">${tR(loc, 'football.hubDesc')}</p>
<p class="mt-3 text-sm text-zinc-600 max-w-3xl">${tR(loc, 'team.intro', { name })}</p>
<div class="mt-6">
<details class="border border-zinc-200 rounded-2xl overflow-hidden" open>
<summary class="px-5 py-4 font-extrabold cursor-pointer hover:bg-zinc-50">${tR(loc, 'sec.topPicks')}</summary>
<div class="px-5 pb-5 grid sm:grid-cols-2 gap-4">${inPred.map(m => predCard(loc, m)).join('') || `<div class="text-sm text-zinc-500">${tR(loc, 'football.noMatches')}</div>`}</div>
</details>
<details class="mt-4 border border-zinc-200 rounded-2xl overflow-hidden" open>
<summary class="px-5 py-4 font-extrabold cursor-pointer hover:bg-zinc-50">${tR(loc, 'football.upcoming')}</summary>
<div class="px-5 pb-5 space-y-2">${rows || `<div class="text-sm text-zinc-500">${tR(loc, 'football.noMatches')}</div>`}</div>
</details>
<details class="mt-4 border border-zinc-200 rounded-2xl overflow-hidden">
<summary class="px-5 py-4 font-extrabold cursor-pointer hover:bg-zinc-50">${tR(loc, 'football.finished')}</summary>
<div class="px-5 pb-5 space-y-2">${resRows || `<div class="text-sm text-zinc-500">${tR(loc, 'football.noMatches')}</div>`}</div>
</details>
</div>
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${esc(name)} — ${tR(loc, 'site.tagline')} | XWhiz`, desc: `${name} — ${tR(loc, 'football.hubDesc')}`, page: { type: 'team', arg: slug },
    canonical: `${SITE}${pageUrl(loc, { type: 'team', arg: slug })}`, body,
    noindex: isThin
  });
}

function fixturesPage(loc) {
  const rows = UPCOMING.slice(0, 24).map(m => homeMatchRow(loc, m)).join('');
  const body = `
<main class="max-w-5xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { href: pageUrl(loc, { type: 'football' }), label: tR(loc, 'nav.football') }, { label: tR(loc, 'footer.fixtures') }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${tR(loc, 'footer.fixtures')}</h1>
<p class="mt-2 text-zinc-600">${tR(loc, 'football.upcoming')} — ${tR(loc, 'sec.update')}</p>
<div class="mt-6 space-y-2">${rows || `<div class="text-sm text-zinc-500">${tR(loc, 'football.noMatches')}</div>`}</div>
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${tR(loc, 'footer.fixtures')} — Football | XWhiz`, desc: tR(loc, 'football.upcoming'), page: { type: 'fixtures' },
    canonical: `${SITE}${pageUrl(loc, { type: 'fixtures' })}`, body
  });
}

function resultsPage(loc) {
  const rows = YESTERDAY.slice(0, 24).map(m => homeMatchRow(loc, m)).join('');
  const body = `
<main class="max-w-5xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { href: pageUrl(loc, { type: 'football' }), label: tR(loc, 'nav.football') }, { label: tR(loc, 'footer.results') }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${tR(loc, 'footer.results')}</h1>
<p class="mt-2 text-zinc-600">${tR(loc, 'football.finished')} — ${tR(loc, 'sec.update')}</p>
<div class="mt-6 space-y-2">${rows || `<div class="text-sm text-zinc-500">${tR(loc, 'football.noMatches')}</div>`}</div>
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${tR(loc, 'footer.results')} — Football | XWhiz`, desc: tR(loc, 'football.finished'), page: { type: 'results' },
    canonical: `${SITE}${pageUrl(loc, { type: 'results' })}`, body
  });
}

function newsIndexPage(loc) {
  const cats = NEWS_CATS.map(c => `<a href="${pageUrl(loc, { type: 'newsCat', arg: c })}" class="border border-zinc-200 rounded-2xl px-4 py-2 text-sm font-medium hover:bg-zinc-50">${tR(loc, 'news.cat.' + c)}</a>`).join('');
  const cards = NEWS.slice(0, 12).map(n => newsCard(loc, n)).join('');
  const body = `
<main class="max-w-6xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { label: tR(loc, 'nav.news') }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${tR(loc, 'news.title')}</h1>
<p class="mt-2 text-zinc-600">${tR(loc, 'news.desc')}</p>
<div class="mt-4 flex flex-wrap gap-2">${cats} <a href="${pageUrl(loc, { type: 'news' })}" class="bg-zinc-900 text-white border border-zinc-900 rounded-2xl px-4 py-2 text-sm font-medium">${tR(loc, 'news.cat.all')}</a></div>
<div class="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${cards || `<div class="col-span-full text-sm text-zinc-500">${tR(loc, 'football.noMatches')}</div>`}</div>
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${tR(loc, 'news.title')} | XWhiz`, desc: tR(loc, 'news.desc'), page: { type: 'news' },
    canonical: `${SITE}${pageUrl(loc, { type: 'news' })}`, body,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'ItemList', name: tR(loc, 'news.title'), itemListElement: NEWS.slice(0, 12).map((n, i) => ({ '@type': 'ListItem', position: i + 1, name: n.title, url: n.url || `${SITE}/news/` })) }]
  });
}

function newsCatPage(loc, cat) {
  const list = NEWS.filter(n => n.category === cat);
  const cards = list.map(n => newsCard(loc, n)).join('') || `<div class="text-sm text-zinc-500">${tR(loc, 'football.noMatches')}</div>`;
  const body = `
<main class="max-w-6xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { href: pageUrl(loc, { type: 'news' }), label: tR(loc, 'nav.news') }, { label: tR(loc, 'news.cat.' + cat) }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${tR(loc, 'news.cat.' + cat)}</h1>
<p class="mt-2 text-zinc-600">${tR(loc, 'news.desc')}</p>
<div class="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${cards}</div>
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${tR(loc, 'news.cat.' + cat)} | XWhiz`, desc: tR(loc, 'news.desc'), page: { type: 'newsCat', arg: cat },
    canonical: `${SITE}${pageUrl(loc, { type: 'newsCat', arg: cat })}`, body
  });
}

// ---- Trust / legal pages (E-E-A-T for a gambling-adjacent YMYL site) ----
const LEGAL_TYPES = ['about', 'methodology', 'contact', 'privacy', 'terms', 'safer-gambling'];
const BONUS_CODES = [
  { slug: 'melbet', name: 'Melbet', code: 'KIKOS77', bonus: 'Welcome bonus up to $130', rating: '4.8', desc: 'Melbet offers a wide range of football markets, live streaming, and competitive odds. Use promo code KIKOS77 for a welcome bonus.', features: ['Live streaming', 'Cash out', 'Build a bet', '200+ markets per match'], url: 'https://melbet-49771.bar/en?tag=d_5217846m_2170c_&site=5217846&ad=2170&promo=KIKOS77' },
  { slug: 'bet365', name: 'Bet365', code: 'SPORTSMAX', bonus: 'Bet £10, get £30 in free bets', rating: '4.9', desc: 'Bet365 is one of the world\'s largest bookmakers, offering extensive football coverage, in-play betting, and live streaming.', features: ['Best live streaming', 'In-play betting', 'Edit bet', 'Auto cash out'], url: '#' },
  { slug: 'betway', name: 'Betway', code: 'FOWAY', bonus: 'Free bet & free spins', rating: '4.5', desc: 'Betway is a leading global sportsbook with competitive odds on all major football leagues.', features: ['Free bet welcome offer', 'Bet builder', 'Daily promotions', 'Esports betting'], url: '#' },
  { slug: '1xbet', name: '1xBet', code: 'CASHMAX', bonus: 'Up to 15,000 BDT bonus', rating: '4.6', desc: '1xBet covers more football markets than almost any other bookmaker, with excellent live betting options.', features: ['300+ markets', 'Live streaming', 'Cryptocurrency accepted', 'Fast withdrawals'], url: '#' }
];
const BETTING_GUIDES = [
  { slug: 'betting-odds-explained', title: 'Betting Odds Explained', desc: 'Learn how to read and calculate football betting odds — fractional, decimal and American formats explained with examples.', body: `<h2 class="text-xl font-extrabold mt-6">What are betting odds?</h2><p class="mt-2 text-zinc-700">Betting odds represent the probability of an outcome occurring and determine how much you can win from a bet. Understanding odds is fundamental to making informed football predictions.</p><h2 class="text-xl font-extrabold mt-6">Decimal odds (European)</h2><p class="mt-2 text-zinc-700">Decimal odds show your total return per £1 wagered. For example, odds of 2.50 mean you receive £2.50 back for every £1 bet (including your stake). To calculate: Stake × Odds = Total Return.</p><h2 class="text-xl font-extrabold mt-6">Fractional odds (UK)</h2><p class="mt-2 text-zinc-700">Fractional odds show your profit relative to your stake. Odds of 5/1 mean you win £5 for every £1 bet. To convert to decimal: divide and add 1 (5/1 = 6.00).</p><h2 class="text-xl font-extrabold mt-6">American odds (US)</h2><p class="mt-2 text-zinc-700">Positive odds (+200) show profit on a $100 stake. Negative odds (-150) show how much you need to bet to win $100.</p><h2 class="text-xl font-extrabold mt-6">How our model calculates fair odds</h2><p class="mt-2 text-zinc-700">XWhiz uses the Dixon-Coles statistical model to calculate true probabilities for every outcome. Fair odds are then derived as 1/probability, adjusted for bookmaker margin. This gives you a benchmark to compare against bookmaker prices and find value bets.</p>` },
  { slug: 'draw-no-bet-explained', title: 'Draw No Bet Meaning', desc: 'What does Draw No Bet (DNB) mean in football betting? Learn how DNB removes the draw from the equation and reduces your risk.', body: `<h2 class="text-xl font-extrabold mt-6">What is Draw No Bet?</h2><p class="mt-2 text-zinc-700">Draw No Bet (DNB) is a betting market that removes the draw outcome from the 1X2 equation. If your selected team wins, you win. If the match ends in a draw, your stake is refunded. You only lose if your team loses.</p><h2 class="text-xl font-extrabold mt-6">When to use Draw No Bet</h2><p class="mt-2 text-zinc-700">DNB is popular for matches where you fancy a team to win but want insurance against a draw. It's especially useful in knockout competitions or when backing an underdog.</p><h2 class="text-xl font-extrabold mt-6">DNB vs Double Chance</h2><p class="mt-2 text-zinc-700">Double Chance (1X, X2, 12) covers two outcomes but at lower odds. DNB only covers one team but refunds the draw — often offering better value when the draw probability is low.</p>` },
  { slug: 'asian-handicap-explained', title: 'Asian Handicap Betting', desc: 'Complete guide to Asian Handicap betting — how handicap lines work, why they eliminate draws, and how to find value.', body: `<h2 class="text-xl font-extrabold mt-6">What is Asian Handicap?</h2><p class="mt-2 text-zinc-700">Asian Handicap is a form of football betting that eliminates the draw by giving one team a goal advantage or disadvantage. This creates a two-outcome market, similar to tennis.</p><h2 class="text-xl font-extrabold mt-6">How handicap lines work</h2><p class="mt-2 text-zinc-700">A -0.5 handicap means the team must win by at least one goal. A -1.0 handicap means they must win by two or more. If the margin matches the handicap exactly, your stake is refunded (with quarter lines offering half-win/half-loss).</p><h2 class="text-xl font-extrabold mt-6">Why use Asian Handicap?</h2><p class="mt-2 text-zinc-700">Asian Handicap offers better odds than the 1X2 market because it removes the draw. It's popular with statistical bettors because it aligns with expected goal models — our Dixon-Coles model outputs Asian Handicap predictions for every match.</p>` },
  { slug: 'over-under-2-5-explained', title: 'Over/Under 2.5 Goals Betting', desc: 'How Over/Under 2.5 goals betting works, when to back Over 2.5, and how our Dixon-Coles model predicts total goals.', body: `<h2 class="text-xl font-extrabold mt-6">What is Over/Under 2.5?</h2><p class="mt-2 text-zinc-700">Over 2.5 means you bet on three or more goals being scored in the match. Under 2.5 means two or fewer goals. It's one of the most popular football betting markets because it doesn't depend on which team wins.</p><h2 class="text-xl font-extrabold mt-6">How our model predicts totals</h2><p class="mt-2 text-zinc-700">The Dixon-Coles model estimates expected goals (xG) for each team based on their attack strength, defensive strength, and home advantage. The combined xG determines the Over/Under probability. When combined xG exceeds 2.5, the model favours Over 2.5.</p><h2 class="text-xl font-extrabold mt-6">When to back Over 2.5</h2><p class="mt-2 text-zinc-700">Over 2.5 typically offers value when both teams have strong attacks and weak defences. Derbies and matches between top-half teams often produce high-scoring games.</p>` },
  { slug: 'btts-prediction-guide', title: 'BTTS Prediction Guide', desc: 'How Both Teams To Score (BTTS) predictions work, what factors the model considers, and how to use BTTS in accumulators.', body: `<h2 class="text-xl font-extrabold mt-6">What is BTTS?</h2><p class="mt-2 text-zinc-700">BTTS (Both Teams To Score) is a betting market where you predict whether both teams will score at least one goal during the match. It doesn't matter who wins — both teams just need to find the net.</p><h2 class="text-xl font-extrabold mt-6">How our BTTS model works</h2><p class="mt-2 text-zinc-700">Our Dixon-Coles model calculates the probability that each team scores at least one goal. BTTS Yes probability = 1 - P(Home 0) - P(Away 0) + P(Both 0). When this probability exceeds 55%, we flag it as a BTTS tip.</p><h2 class="text-xl font-extrabold mt-6">BTTS in accumulators</h2><p class="mt-2 text-zinc-700">BTTS selections often offer good accumulator legs because the odds are typically between 1.70-2.20. Combined with strong statistical backing, BTTS can add value to accumulators without the risk of backing a specific result.</p>` }
];
const LEAGUE_INTROS = {
  'Premier League': { title: 'Premier League Predictions Today', desc: 'Free Premier League predictions today with statistical analysis, expected goals, 1X2 tips and correct score probabilities from the Dixon-Coles model.', body: `<p class="mt-3 text-zinc-700">The Premier League is the most-watched football league in the world, and our Dixon-Coles model provides statistical predictions for every match. We analyse team strength from Elo ratings and real league standings, then calculate expected goals, 1X2 probabilities, Over/Under 2.5, BTTS and the most likely correct score.</p><h2 class="mt-6 text-xl font-extrabold">How we predict Premier League matches</h2><p class="mt-2 text-zinc-700">Our model uses historical data from hundreds of Premier League matches to calibrate team attack and defence ratings. These are combined with Elo ratings for a robust strength estimate. The Dixon-Coles adjustment corrects for the low-scoring nature of football, giving accurate probabilities for 0-0, 1-0, 0-1 and 1-1 draws.</p><h2 class="mt-6 text-xl font-extrabold">Premier League betting markets</h2><p class="mt-2 text-zinc-700">We cover all major Premier League betting markets: 1X2, Double Chance, Over/Under 2.5 goals, Both Teams To Score, correct score, Asian handicap and both-half predictions. Every pick includes fair odds so you can compare against your bookmaker.</p>` },
  'La Liga': { title: 'La Liga Predictions Today', desc: 'Free La Liga predictions today with statistical analysis, expected goals, 1X2 tips and correct score probabilities from the Dixon-Coles model.', body: `<p class="mt-3 text-zinc-700">La Liga features some of the most technically gifted teams in world football. Our model analyses every La Liga fixture with the same rigorous statistical approach used for the Premier League, covering Real Madrid, Barcelona, Atletico Madrid and all 20 teams.</p><h2 class="mt-6 text-xl font-extrabold">La Liga prediction methodology</h2><p class="mt-2 text-zinc-700">We combine Elo ratings with La Liga standings data to calculate attack and defence strength ratings for each team. The Dixon-Coles Poisson model then generates expected goals and full market probabilities. La Liga matches tend to be lower-scoring than the Premier League, which the model accounts for naturally.</p>` },
  'Bundesliga': { title: 'Bundesliga Predictions Today', desc: 'Free Bundesliga predictions today with statistical analysis, expected goals, 1X2 tips and correct score probabilities from the Dixon-Coles model.', body: `<p class="mt-3 text-zinc-700">The Bundesliga is known for its high-scoring, attacking football. Our Dixon-Coles model captures this with accurate expected goals estimates that reflect the league's attacking nature. We cover Bayern Munich, Borussia Dortmund, Bayer Leverkusen and all 18 teams.</p><h2 class="mt-6 text-xl font-extrabold">Bundesliga goals market</h2><p class="mt-2 text-zinc-700">Bundesliga matches average more goals than most European leagues, making Over 2.5 and BTTS markets particularly interesting. Our model shows Bundesliga Over 2.5 probability typically runs 5-8% higher than equivalent Premier League fixtures.</p>` },
  'Serie A': { title: 'Serie A Predictions Today', desc: 'Free Serie A predictions today with statistical analysis, expected goals, 1X2 tips and correct score probabilities from the Dixon-Coles model.', body: `<p class="mt-3 text-zinc-700">Serie A is Italy's top flight, featuring tactical football with a strong defensive tradition. Our model accounts for Serie A's typically lower-scoring nature when calculating expected goals and market probabilities. We cover Inter, Napoli, AC Milan, Juventus and all 20 teams.</p><h2 class="mt-6 text-xl font-extrabold">Serie A prediction特点</h2><p class="mt-2 text-zinc-700">Serie A matches often produce fewer goals than other top European leagues, which our model reflects in its Under 2.5 predictions. The league's competitive balance means draws are more common, and our model captures this through accurate draw probability estimates.</p>` },
  'Ligue 1': { title: 'Ligue 1 Predictions Today', desc: 'Free Ligue 1 predictions today with statistical analysis, expected goals, 1X2 tips and correct score probabilities from the Dixon-Coles model.', body: `<p class="mt-3 text-zinc-700">Ligue 1 features Paris Saint-Germain alongside competitive sides like Monaco, Marseille and Lyon. Our model provides statistical predictions for every Ligue 1 fixture, accounting for the league's unique competitive dynamics.</p><h2 class="mt-6 text-xl font-extrabold">Ligue 1 statistical analysis</h2><p class="mt-2 text-zinc-700">Our Dixon-Coles model combines Elo ratings with Ligue 1 standings to produce accurate expected goals. PSG's dominance affects the league's statistical profile, and our model accounts for this when predicting matches involving the Parisian club.</p>` }
};
const LEGAL = {
  about: {
    en: { title: 'About XWhiz | Independent football predictions', desc: 'XWhiz publishes free, independent statistical football predictions from a Dixon-Coles + Elo model on real fixtures only. Learn who we are and how we are funded.', h1: 'About XWhiz', body: `<p class="mt-3 text-zinc-700">XWhiz is an independent football predictions site. Every day our model analyses real fixtures and publishes 1X2, Over/Under 2.5, BTTS and most-likely-score probabilities — free, with no account and no invented matches.</p><h2 class="mt-6 text-xl font-extrabold">Who runs XWhiz</h2><p class="mt-2 text-zinc-700">XWhiz is maintained by the XWhiz Data Team, who build and operate the prediction pipeline: data ingestion, the Dixon-Coles + Elo model, and this website. Editorial responsibility sits with the team as a whole; we do not publish anonymous tips.</p><h2 class="mt-6 text-xl font-extrabold">How we are funded</h2><p class="mt-2 text-zinc-700">XWhiz is free and affiliate-funded. Pages may contain Melbet affiliate links, always labelled and disclosed. If you register via those links we may earn a commission at no extra cost to you. Affiliate revenue never changes a pick: the model output is published as computed.</p><h2 class="mt-6 text-xl font-extrabold">Our principles</h2><ul class="mt-2 list-disc pl-5 text-zinc-700 space-y-1"><li>Real fixtures only — never fabricated matches or scores.</li><li>Probabilities, not promises — every pick states its confidence.</li><li>18+ only — gamble responsibly. See our <a class="underline font-semibold" href="/safer-gambling/">safer gambling</a> page.</li></ul>` },
    fr: { title: 'À propos de XWhiz | Pronostics football indépendants', desc: 'XWhiz publie des pronostics football gratuits et indépendants calculés par un modèle Dixon-Coles + Elo, uniquement sur de vrais matchs. Qui sommes-nous et comment sommes-nous financés.', h1: 'À propos de XWhiz', body: `<p class="mt-3 text-zinc-700">XWhiz est un site indépendant de pronostics football. Chaque jour, notre modèle analyse de vraies rencontres et publie des probabilités 1N2, Plus/Moins 2,5, BTTS et score exact le plus probable — gratuitement, sans compte et sans matchs inventés.</p><h2 class="mt-6 text-xl font-extrabold">Qui gère XWhiz</h2><p class="mt-2 text-zinc-700">XWhiz est maintenu par l'équipe XWhiz Data Team, qui construit et exploite la chaîne de pronostics : collecte des données, modèle Dixon-Coles + Elo et ce site. La responsabilité éditoriale appartient à l'équipe dans son ensemble ; nous ne publions jamais de pronostics anonymes.</p><h2 class="mt-6 text-xl font-extrabold">Comment nous sommes financés</h2><p class="mt-2 text-zinc-700">XWhiz est gratuit et financé par l'affiliation. Les pages peuvent contenir des liens affiliés Melbet, toujours signalés. Si vous vous inscrivez via ces liens, nous pouvons percevoir une commission sans coût supplémentaire pour vous. Ces revenus ne modifient jamais un pronostic : le modèle est publié tel que calculé.</p><h2 class="mt-6 text-xl font-extrabold">Nos principes</h2><ul class="mt-2 list-disc pl-5 text-zinc-700 space-y-1"><li>De vrais matchs uniquement — jamais de rencontres ou de scores inventés.</li><li>Des probabilités, pas des promesses — chaque pronostic affiche sa confiance.</li><li>18+ uniquement — jouez responsable. Voir notre page <a class="underline font-semibold" href="/fr/safer-gambling/">jeu responsable</a>.</li></ul>` },
    ar: { title: 'من نحن | توقعات كرة قدم مستقلة — XWhiz', desc: 'ينشر XWhiz توقعات كرة قدم مجانية ومستقلة محسوبة بنموذج Dixon-Coles + Elo على مباريات حقيقية فقط. تعرف علينا وعلى كيفية تمويلنا.', h1: 'من نحن', body: `<p class="mt-3 text-zinc-700">XWhiz موقع مستقل لتوقعات كرة القدم. يحلل نموذجنا كل يوم مباريات حقيقية وينشر احتمالات 1X2 وأكثر/أقل من 2.5 وBTTS والنتيجة الأكثر احتمالًا — مجانًا، دون حساب ودون مباريات مختلَقة.</p><h2 class="mt-6 text-xl font-extrabold">من يدير XWhiz</h2><p class="mt-2 text-zinc-700">يدير XWhiz فريق بيانات XWhiz الذي يبني ويشغّل منظومة التوقعات: جمع البيانات ونموذج Dixon-Coles + Elo وهذا الموقع. المسؤولية التحريرية للفريق ككل، ولا ننشر توقعات مجهولة المصدر.</p><h2 class="mt-6 text-xl font-extrabold">كيف نموّل الموقع</h2><p class="mt-2 text-zinc-700">XWhiz مجاني ومموّل بالعمولة. قد تحتوي الصفحات على روابط تابعة لشركة Melbet معلنة دائمًا. إذا سجلت عبرها قد نحصل على عمولة دون تكلفة إضافية عليك. لا تغيّر هذه الإيرادات أي توقع إطلاقًا.</p><h2 class="mt-6 text-xl font-extrabold">مبادئنا</h2><ul class="mt-2 list-disc pl-5 text-zinc-700 space-y-1"><li>مباريات حقيقية فقط — لا مباريات أو نتائج مختلَقة أبدًا.</li><li>احتمالات لا وعود — كل توقع يعرض درجة ثقته.</li><li>18+ فقط — العب بمسؤولية. راجع صفحة <a class="underline font-semibold" href="/ar/safer-gambling/">اللعب الآمن</a>.</li></ul>` }
  },
  methodology: {
    en: { title: 'Prediction methodology | Dixon-Coles + Elo — XWhiz', desc: 'How XWhiz predictions work: Elo ratings, Dixon-Coles Poisson expected goals, score-matrix probabilities for 1X2, Over/Under 2.5, BTTS and correct score. Updated daily.', h1: 'Prediction methodology', body: `<p class="mt-3 text-zinc-700">Each match is evaluated as an independent event. Team strength comes from Elo-style ratings blended with real league standings (attack and defence per game vs the league average). Expected goals feed a Dixon-Coles adjusted Poisson model, which produces a full 0–6 goal score matrix.</p><ul class="mt-3 list-disc pl-5 text-zinc-700 space-y-1"><li><strong>1X2:</strong> home/draw/away probabilities summed from the matrix.</li><li><strong>Over/Under 2.5 &amp; BTTS:</strong> derived from the same matrix, not separate formulas.</li><li><strong>Correct score:</strong> the matrix argmax — the single most probable scoreline — so scores vary naturally.</li><li><strong>Odds shown:</strong> fair odds (100 ÷ probability), not bookmaker prices.</li></ul><h2 class="mt-6 text-xl font-extrabold">What the model cannot see</h2><p class="mt-2 text-zinc-700">Late injuries, suspensions, rotation, weather and motivation are not in the numbers. Treat every pick as a probability estimate with stated confidence — never a guarantee of profit. Predictions refresh daily at 06:00 UTC.</p>` },
    fr: { title: 'Méthodologie | Dixon-Coles + Elo — XWhiz', desc: 'Comment fonctionnent les pronostics XWhiz : classements Elo, buts attendus de Poisson Dixon-Coles, matrice des scores pour 1N2, Plus/Moins 2,5, BTTS et score exact. Mis à jour chaque jour.', h1: 'Méthodologie des pronostics', body: `<p class="mt-3 text-zinc-700">Chaque match est évalué comme un événement indépendant. La force des équipes vient de notes de type Elo combinées aux vrais classements (attaque et défense par match par rapport à la moyenne du championnat). Les buts attendus alimentent un modèle de Poisson ajusté Dixon-Coles, qui produit une matrice complète des scores de 0 à 6 buts.</p><ul class="mt-3 list-disc pl-5 text-zinc-700 space-y-1"><li><strong>1N2 :</strong> probabilités domicile/nul/extérieur sommées depuis la matrice.</li><li><strong>Plus/Moins 2,5 et BTTS :</strong> issus de la même matrice, pas de formules séparées.</li><li><strong>Score exact :</strong> l'argmax de la matrice — le score unique le plus probable — d'où une variété naturelle.</li><li><strong>Cotes affichées :</strong> cotes équitables (100 ÷ probabilité), pas des cotes bookmaker.</li></ul><h2 class="mt-6 text-xl font-extrabold">Ce que le modèle ne voit pas</h2><p class="mt-2 text-zinc-700">Blessures de dernière minute, suspensions, turnover, météo et motivation ne sont pas dans les chiffres. Considérez chaque pronostic comme une estimation de probabilité avec sa confiance affichée — jamais une garantie de gain. Actualisation chaque jour à 06h00 UTC.</p>` },
    ar: { title: 'المنهجية | Dixon-Coles + Elo — XWhiz', desc: 'كيف تعمل توقعات XWhiz: تصنيفات Elo والأهداف المتوقعة بنموذج Dixon-Coles ومصفوفة النتائج لاحتمالات 1X2 وأكثر/أقل من 2.5 وBTTS والنتيجة الصحيحة. تُحدَّث يوميًا.', h1: 'منهجية التوقعات', body: `<p class="mt-3 text-zinc-700">تُقيَّم كل مباراة كحدث مستقل. تأتي قوة الفرق من تصنيفات بأسلوب Elo ممزوجة بترتيب الدوري الحقيقي (الهجوم والدفاع لكل مباراة مقارنة بمتوسط الدوري). تغذي الأهداف المتوقعة نموذج Dixon-Coles الذي ينتج مصفوفة كاملة للنتائج من 0 إلى 6 أهداف.</p><ul class="mt-3 list-disc pl-5 text-zinc-700 space-y-1"><li><strong>1X2:</strong> احتمالات الفوز والتعادل والخسارة محسوبة من المصفوفة.</li><li><strong>أكثر/أقل من 2.5 وBTTS:</strong> من المصفوفة نفسها وليس معادلات منفصلة.</li><li><strong>النتيجة الصحيحة:</strong> أعلى احتمال في المصفوفة — لذا تتنوع النتائج طبيعيًا.</li><li><strong>الاحتمالات المعروضة:</strong> عادلة (100 ÷ الاحتمال) وليست أسعار مراهنات.</li></ul><h2 class="mt-6 text-xl font-extrabold">ما لا يراه النموذج</h2><p class="mt-2 text-zinc-700">الإصابات المتأخرة والإيقافات والمداورة والطقس والدوافع ليست في الأرقام. تعامل مع كل توقع كتقدير احتمالي بدرجة ثقة معلنة — وليس ضمانًا للربح. تُحدَّث التوقعات يوميًا الساعة 06:00 بتوقيت غرينتش.</p>` }
  },
  contact: {
    en: { title: 'Contact XWhiz', desc: 'Contact the XWhiz Data Team: corrections, data issues and feedback via GitHub issues.', h1: 'Contact us', body: `<p class="mt-3 text-zinc-700">Questions, corrections or data issues? The fastest route is a public GitHub issue so the whole team sees it:</p><p class="mt-4"><a class="bg-zinc-900 text-white font-bold px-6 py-3 rounded-full inline-block" href="https://github.com/akikoatik-glitch/xxxxxxxxxxxxxxx/issues" target="_blank" rel="noopener nofollow">Open a GitHub issue →</a></p><p class="mt-4 text-sm text-zinc-500">Please include the page URL and what looks wrong (score, kickoff time, team name). We review issues on working days. 18+ content — no betting advice for minors.</p>` },
    fr: { title: 'Contacter XWhiz', desc: 'Contactez l\'équipe XWhiz : corrections, problèmes de données et retours via GitHub.', h1: 'Nous contacter', body: `<p class="mt-3 text-zinc-700">Une question, une correction ou un problème de données ? Le plus rapide est d'ouvrir un ticket GitHub public pour que toute l'équipe le voie :</p><p class="mt-4"><a class="bg-zinc-900 text-white font-bold px-6 py-3 rounded-full inline-block" href="https://github.com/akikoatik-glitch/xxxxxxxxxxxxxxx/issues" target="_blank" rel="noopener nofollow">Ouvrir un ticket GitHub →</a></p><p class="mt-4 text-sm text-zinc-500">Indiquez l'URL de la page et ce qui semble faux (score, horaire, nom d'équipe). Nous traitons les tickets les jours ouvrés. Contenu 18+ — aucun conseil de pari aux mineurs.</p>` },
    ar: { title: 'اتصل بنا — XWhiz', desc: 'تواصل مع فريق XWhiz: التصحيحات ومشاكل البيانات والملاحظات عبر GitHub.', h1: 'اتصل بنا', body: `<p class="mt-3 text-zinc-700">سؤال أو تصحيح أو مشكلة في البيانات؟ أسرع طريق هي فتح تذكرة عامة على GitHub ليراها الفريق كله:</p><p class="mt-4"><a class="bg-zinc-900 text-white font-bold px-6 py-3 rounded-full inline-block" href="https://github.com/akikoatik-glitch/xxxxxxxxxxxxxxx/issues" target="_blank" rel="noopener nofollow">فتح تذكرة على GitHub ←</a></p><p class="mt-4 text-sm text-zinc-500">يرجى ذكر رابط الصفحة وما يبدو خاطئًا (النتيجة، موعد البداية، اسم الفريق). نراجع التذاكر في أيام العمل. محتوى 18+ — لا نصائح مراهنة للقاصرين.</p>` }
  },
  privacy: {
    en: { title: 'Privacy Policy | XWhiz', desc: 'XWhiz privacy policy: no accounts, minimal data, analytics and affiliate cookies explained.', h1: 'Privacy Policy', body: `<p class="mt-3 text-zinc-700">XWhiz requires no account and collects no personal data directly. What exists:</p><ul class="mt-3 list-disc pl-5 text-zinc-700 space-y-1"><li><strong>Server logs:</strong> our host (Vercel) processes standard technical logs (IP, user agent) to serve pages securely.</li><li><strong>Analytics:</strong> only if enabled, minimal page-view statistics with no cross-site tracking.</li><li><strong>Affiliate links:</strong> clicking a Melbet link takes you to their site, which applies its own cookie and privacy policy.</li><li><strong>News images:</strong> loaded from ESPN's CDN, which may log requests per its policy.</li></ul><p class="mt-3 text-zinc-700">We never sell data. Questions: use our <a class="underline font-semibold" href="/contact/">contact page</a>. Last updated: September 2026.</p>` },
    fr: { title: 'Politique de confidentialité | XWhiz', desc: 'Confidentialité XWhiz : aucun compte, données minimales, cookies d\'analyse et d\'affiliation expliqués.', h1: 'Politique de confidentialité', body: `<p class="mt-3 text-zinc-700">XWhiz ne demande aucun compte et ne collecte directement aucune donnée personnelle. Ce qui existe :</p><ul class="mt-3 list-disc pl-5 text-zinc-700 space-y-1"><li><strong>Journaux serveur :</strong> notre hébergeur (Vercel) traite des journaux techniques standards (IP, user agent) pour servir les pages en sécurité.</li><li><strong>Analyse :</strong> uniquement si activée, des statistiques minimales de pages vues, sans suivi intersites.</li><li><strong>Liens affiliés :</strong> cliquer sur un lien Melbet vous mène vers leur site, soumis à sa propre politique de cookies et de confidentialité.</li><li><strong>Images d'actus :</strong> chargées depuis le CDN d'ESPN, qui peut journaliser les requêtes selon sa politique.</li></ul><p class="mt-3 text-zinc-700">Nous ne vendons jamais de données. Questions : voir notre page <a class="underline font-semibold" href="/fr/contact/">contact</a>. Dernière mise à jour : septembre 2026.</p>` },
    ar: { title: 'سياسة الخصوصية | XWhiz', desc: 'سياسة خصوصية XWhiz: لا حسابات، حد أدنى من البيانات، وشرح ملفات التحليل والعمولة.', h1: 'سياسة الخصوصية', body: `<p class="mt-3 text-zinc-700">لا يتطلب XWhiz أي حساب ولا يجمع أي بيانات شخصية مباشرة. الموجود:</p><ul class="mt-3 list-disc pl-5 text-zinc-700 space-y-1"><li><strong>سجلات الخادم:</strong> يعالج مضيفنا (Vercel) سجلات تقنية معيارية (IP ووكيل المستخدم) لتقديم الصفحات بأمان.</li><li><strong>التحليلات:</strong> فقط عند تفعيلها، إحصاءات مشاهدات بسيطة دون تتبع عبر المواقع.</li><li><strong>روابط العمولة:</strong> النقر على رابط Melbet ينقلك إلى موقعهم الذي تطبق عليه سياسته الخاصة.</li><li><strong>صور الأخبار:</strong> تُحمَّل من شبكة ESPN وقد تسجل الطلبات وفق سياستها.</li></ul><p class="mt-3 text-zinc-700">لا نبيع البيانات أبدًا. للأسئلة: راجع صفحة <a class="underline font-semibold" href="/ar/contact/">اتصل بنا</a>. آخر تحديث: سبتمبر 2026.</p>` }
  },
  terms: {
    en: { title: 'Terms of Use | XWhiz', desc: 'XWhiz terms: information only, 18+, no liability for betting decisions, affiliate disclosure.', h1: 'Terms of Use', body: `<ul class="mt-3 list-disc pl-5 text-zinc-700 space-y-1"><li><strong>Information only:</strong> predictions are statistical analysis for information and entertainment — not financial or betting advice, and not a promise of profit.</li><li><strong>18+:</strong> content is intended for adults only. Never bet more than you can afford to lose.</li><li><strong>No liability:</strong> we accept no responsibility for decisions or losses arising from use of this site.</li><li><strong>Affiliates:</strong> some links (e.g. Melbet) are affiliate links, clearly labelled; we may earn a commission at no cost to you.</li><li><strong>Data:</strong> fixtures, scores and news come from public sports data and may contain errors; corrections via the <a class="underline font-semibold" href="/contact/">contact page</a>.</li></ul><p class="mt-3 text-zinc-700">By using XWhiz you accept these terms. Last updated: September 2026.</p>` },
    fr: { title: 'Conditions d\'utilisation | XWhiz', desc: 'Conditions XWhiz : information uniquement, 18+, aucune responsabilité sur les paris, affiliation déclarée.', h1: 'Conditions d\'utilisation', body: `<ul class="mt-3 list-disc pl-5 text-zinc-700 space-y-1"><li><strong>Information uniquement :</strong> les pronostics sont une analyse statistique à but informatif et ludique — ni conseil financier, ni conseil de pari, ni promesse de gain.</li><li><strong>18+ :</strong> contenu réservé aux adultes. Ne misez jamais plus que ce que vous pouvez perdre.</li><li><strong>Responsabilité :</strong> nous déclinons toute responsabilité pour les décisions ou pertes liées à l'utilisation du site.</li><li><strong>Affiliation :</strong> certains liens (ex. Melbet) sont affiliés et signalés ; nous pouvons percevoir une commission sans coût pour vous.</li><li><strong>Données :</strong> matchs, scores et actus viennent de données sportives publiques et peuvent comporter des erreurs ; corrections via la page <a class="underline font-semibold" href="/fr/contact/">contact</a>.</li></ul><p class="mt-3 text-zinc-700">En utilisant XWhiz, vous acceptez ces conditions. Dernière mise à jour : septembre 2026.</p>` },
    ar: { title: 'شروط الاستخدام | XWhiz', desc: 'شروط XWhiz: معلومات فقط، 18+، لا مسؤولية عن قرارات المراهنة، إفصاح عن العمولة.', h1: 'شروط الاستخدام', body: `<ul class="mt-3 list-disc pl-5 text-zinc-700 space-y-1"><li><strong>معلومات فقط:</strong> التوقعات تحليل إحصائي لأغراض المعلومات والترفيه — ليست نصيحة مالية ولا وعدًا بالربح.</li><li><strong>18+:</strong> المحتوى للبالغين فقط. لا تراهن بأكثر مما تتحمل خسارته.</li><li><strong>لا مسؤولية:</strong> لا نتحمل أي مسؤولية عن القرارات أو الخسائر الناتجة عن استخدام الموقع.</li><li><strong>العمولة:</strong> بعض الروابط (مثل Melbet) تابعة ومعلنة، وقد نحصل على عمولة دون تكلفة عليك.</li><li><strong>البيانات:</strong> المباريات والنتائج والأخبار من بيانات رياضية عامة وقد تحتوي أخطاء؛ للتصحيح عبر صفحة <a class="underline font-semibold" href="/ar/contact/">اتصل بنا</a>.</li></ul><p class="mt-3 text-zinc-700">باستخدامك XWhiz فأنت تقبل هذه الشروط. آخر تحديث: سبتمبر 2026.</p>` }
  },
  'safer-gambling': {
    en: { title: 'Safer gambling | 18+ — XWhiz', desc: 'Safer gambling: 18+, set limits, recognise the signs, and where to get free help (BeGambleAware, GamStop).', h1: 'Safer gambling', body: `<p class="mt-3 text-zinc-700">Our predictions never guarantee profit. Betting should always be entertainment you can afford — never a way to make money.</p><ul class="mt-3 list-disc pl-5 text-zinc-700 space-y-1"><li><strong>18+ only.</strong> Never gamble if underage.</li><li><strong>Set limits</strong> on deposits, losses and time — before you start.</li><li><strong>Never chase losses.</strong> Stop when the fun stops.</li><li><strong>Keep balance:</strong> gambling should not affect bills, sleep or relationships.</li></ul><h2 class="mt-6 text-xl font-extrabold">Free, confidential help</h2><ul class="mt-2 list-disc pl-5 text-zinc-700 space-y-1"><li><a class="underline font-semibold" href="https://www.begambleaware.org" target="_blank" rel="nofollow noopener">BeGambleAware.org</a> — advice and support, 24/7.</li><li><a class="underline font-semibold" href="https://www.gamstop.co.uk" target="_blank" rel="nofollow noopener">GamStop</a> — free self-exclusion from UK betting sites.</li><li><a class="underline font-semibold" href="https://www.gamblingtherapy.org" target="_blank" rel="nofollow noopener">Gambling Therapy</a> — global multilingual support.</li></ul>` },
    fr: { title: 'Jeu responsable | 18+ — XWhiz', desc: 'Jeu responsable : 18+, fixez des limites, reconnaissez les signaux et où trouver de l\'aide gratuite (BeGambleAware, GamStop).', h1: 'Jeu responsable', body: `<p class="mt-3 text-zinc-700">Nos pronostics ne garantissent jamais de gain. Le pari doit rester un divertissement que vous pouvez vous offrir — jamais un moyen de gagner de l'argent.</p><ul class="mt-3 list-disc pl-5 text-zinc-700 space-y-1"><li><strong>18+ uniquement.</strong> Ne jouez jamais si vous êtes mineur.</li><li><strong>Fixez des limites</strong> de dépôts, de pertes et de temps — avant de commencer.</li><li><strong>Ne courez jamais après vos pertes.</strong> Arrêtez quand le plaisir s'arrête.</li><li><strong>Gardez l'équilibre :</strong> le jeu ne doit affecter ni factures, ni sommeil, ni relations.</li></ul><h2 class="mt-6 text-xl font-extrabold">Aide gratuite et confidentielle</h2><ul class="mt-2 list-disc pl-5 text-zinc-700 space-y-1"><li><a class="underline font-semibold" href="https://www.begambleaware.org" target="_blank" rel="nofollow noopener">BeGambleAware.org</a> — conseils et soutien, 24h/24.</li><li><a class="underline font-semibold" href="https://www.gamstop.co.uk" target="_blank" rel="nofollow noopener">GamStop</a> — auto-exclusion gratuite des sites de paris britanniques.</li><li><a class="underline font-semibold" href="https://www.gamblingtherapy.org" target="_blank" rel="nofollow noopener">Gambling Therapy</a> — soutien mondial multilingue.</li></ul>` },
    ar: { title: 'اللعب الآمن | 18+ — XWhiz', desc: 'اللعب الآمن: 18+، ضع حدودًا، تعرف على العلامات، وأين تجد مساعدة مجانية (BeGambleAware وGamStop).', h1: 'اللعب الآمن', body: `<p class="mt-3 text-zinc-700">توقعاتنا لا تضمن الربح أبدًا. يجب أن تبقى المراهنة ترفيهًا تقدر عليه — وليست وسيلة لكسب المال.</p><ul class="mt-3 list-disc pl-5 text-zinc-700 space-y-1"><li><strong>18+ فقط.</strong> لا تقامر أبدًا إذا كنت قاصرًا.</li><li><strong>ضع حدودًا</strong> للإيداع والخسارة والوقت — قبل أن تبدأ.</li><li><strong>لا تطارد الخسائر أبدًا.</strong> توقف عندما تتوقف المتعة.</li><li><strong>حافظ على التوازن:</strong> يجب ألا تؤثر المقامرة على الفواتير أو النوم أو العلاقات.</li></ul><h2 class="mt-6 text-xl font-extrabold">مساعدة مجانية وسرية</h2><ul class="mt-2 list-disc pl-5 text-zinc-700 space-y-1"><li><a class="underline font-semibold" href="https://www.begambleaware.org" target="_blank" rel="nofollow noopener">BeGambleAware.org</a> — نصائح ودعم على مدار الساعة.</li><li><a class="underline font-semibold" href="https://www.gamstop.co.uk" target="_blank" rel="nofollow noopener">GamStop</a> — استبعاد ذاتي مجاني من مواقع المراهنة البريطانية.</li><li><a class="underline font-semibold" href="https://www.gamblingtherapy.org" target="_blank" rel="nofollow noopener">Gambling Therapy</a> — دعم عالمي متعدد اللغات.</li></ul>` }
  }
};
const LEGAL_LABEL = {
  en: { about: 'About us', methodology: 'Methodology', contact: 'Contact', privacy: 'Privacy', terms: 'Terms', 'safer-gambling': 'Safer gambling' },
  fr: { about: 'À propos', methodology: 'Méthodologie', contact: 'Contact', privacy: 'Confidentialité', terms: 'Conditions', 'safer-gambling': 'Jeu responsable' },
  ar: { about: 'من نحن', methodology: 'المنهجية', contact: 'اتصل بنا', privacy: 'الخصوصية', terms: 'الشروط', 'safer-gambling': 'اللعب الآمن' }
};

function legalPage(loc, type) {
  const L = (LEGAL[type] && LEGAL[type][loc]) || LEGAL[type].en;
  const label = (LEGAL_LABEL[loc] && LEGAL_LABEL[loc][type]) || type;
  const url = `${SITE}${pageUrl(loc, { type })}`;
  const dateISO = todayISO();
  const body = `
<main class="max-w-3xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { label }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${esc(L.h1)}</h1>
<p class="mt-2 text-xs text-zinc-400">By XWhiz Data Team · Updated ${esc(dateISO)} · Model Dixon-Coles v3</p>
<div class="mt-4 leading-relaxed">${L.body}</div>
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: L.title, desc: L.desc, page: { type }, canonical: url, body, ogType: 'article', publishedTime: dateISO,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'Article', headline: L.h1, datePublished: dateISO, dateModified: dateISO, author: { '@type': 'Organization', name: 'XWhiz Data Team', url: SITE }, publisher: { '@type': 'Organization', name: 'XWhiz', logo: { '@type': 'ImageObject', url: `${SITE}/logo.png` } }, image: OG_IMG, mainEntityOfPage: url, isAccessibleForFree: true, description: L.desc },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: HOME_LABEL[loc], item: `${SITE}${pageUrl(loc, { type: 'home' })}` }, { '@type': 'ListItem', position: 2, name: label, item: url }] }
    ]
  });
}

function searchPage(loc) {
  const idx = buildSearchIndex(loc);  const body = `
<main class="max-w-3xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { label: tR(loc, 'nav.search') }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${tR(loc, 'search.title')}</h1>
<div class="mt-5 relative"><input id="sq" type="search" class="w-full border border-zinc-200 rounded-2xl px-5 py-4 text-sm outline-none focus:border-brand-600" placeholder="${tR(loc, 'search.placeholder')}" autocomplete="off"></div>
<div id="sr"></div>
<script>window.XW_INDEX=${safeJson(idx)};
var COUNT_TMPL=${safeJson(tR(loc, 'search.count'))};</script>
<script>
(function(){
var I=window.XW_INDEX,inp=document.getElementById('sq'),out=document.getElementById('sr'),EMPTY=${safeJson(tR(loc, 'search.empty'))},NO=${safeJson(tR(loc, 'search.no'))},CNT=COUNT_TMPL;
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
function norm(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function render(q){var needle=norm(q).trim();out.innerHTML='';if(needle.length<2){out.innerHTML='<p class="mt-3 text-sm text-zinc-500">'+esc(EMPTY)+'</p>';return}var all=[].concat(I.pages.map(function(x){return{x:x,u:x.u,t:1}}),I.matches.map(function(x){return{x:x,u:x.u,t:2}}),I.news.map(function(x){return{x:x,u:x.u,t:3}}));var hits=all.filter(function(o){return norm(o.x.t+' '+(o.x.d||'')).indexOf(needle)>-1}).slice(0,30);if(!hits.length){out.innerHTML='<p class="mt-3 text-sm text-zinc-500">'+esc(NO.replace('{q}',q))+'</p>';return}var h='<p class="mt-3 text-xs text-zinc-400">'+esc(CNT.replace('{n}',hits.length))+'</p>';hits.forEach(function(o){h+='<a href="'+o.u+'" class="block border border-zinc-200 rounded-2xl p-4 mt-2 hover:bg-zinc-50"><div class="font-bold text-sm">'+esc(o.x.t)+'</div><div class="mt-1 text-xs text-zinc-500">'+esc(o.x.d||'')+'</div></a>'});out.innerHTML=h}
inp.addEventListener('input',function(){render(inp.value)});if(location.search){var q=new URLSearchParams(location.search).get('q');if(q){inp.value=q;render(q)}}
})();
</script>
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${tR(loc, 'search.title')} | XWhiz`, desc: tR(loc, 'search.meta'), page: { type: 'search' },
    canonical: `${SITE}${pageUrl(loc, { type: 'search' })}`, body, noindex: true
  });
}

function notFoundPage(loc) {
  const body = `
<main class="max-w-3xl mx-auto px-4 md:px-6 py-16 text-center">
<h1 class="text-3xl md:text-4xl font-black tracking-tight">${tR(loc, 'notFound.title')}</h1>
<p class="mt-3 text-zinc-600">${tR(loc, 'notFound.body')}</p>
<div class="mt-8 flex justify-center gap-4 text-sm"><a href="${pageUrl(loc, { type: 'home' })}" class="bg-zinc-900 text-white px-6 py-3 rounded-full">${tR(loc, 'notFound.home')}</a><a href="${pageUrl(loc, { type: 'predIndex' })}" class="bg-zinc-100 px-6 py-3 rounded-full">${tR(loc, 'notFound.predictions')}</a></div>
</main>`;
  return shell(loc, {
    title: `404 — ${tR(loc, 'notFound.title')} | XWhiz`, desc: 'Page not found', page: { type: '404' }, noindex: true, body,
    canonical: `${SITE}${pageUrl(loc, { type: 'home' })}`
  });
}

// ---- sitemap & robots & search index ----
function buildSitemap() {
  const entries = [];
  // Track which teams/leagues are thin (no predictions/upcoming/finished) so we
  // can EXCLUDE them from the sitemap instead of pointing crawlers at empty pages.
  const thinTeams = new Set();
  const thinLeagues = new Set();
  for (const [slug, name] of TEAMS) {
    const inPred = MATCHES.some(m => m.home === name || m.away === name);
    const inFix = [...UPCOMING, ...TODAY, ...TOMORROW].some(m => homeName(m) === name || awayName(m) === name);
    const inRes = YESTERDAY.some(m => homeName(m) === name || awayName(m) === name);
    if (!inPred && !inFix && !inRes) thinTeams.add(slug);
  }
  for (const [slug, lg] of LEAGUES) {
    const inPred = MATCHES.some(m => m.league === lg.name);
    const inFix = [...UPCOMING, ...TODAY, ...TOMORROW].some(m => compName(m) === lg.name);
    const inRes = (YESTERDAY.concat(TODAY)).some(m => compName(m) === lg.name);
    if (!inPred && !inFix && !inRes) thinLeagues.add(slug);
  }
  const add = (page, freq, pri) => {
    for (const ll of LOCALES) {
      // Drop thin team/league pages from the sitemap entirely.
      if (page.type === 'team' && thinTeams.has(page.arg)) continue;
      if (page.type === 'league' && thinLeagues.has(page.arg)) continue;
      entries.push({ ll, page, href: `${SITE}${pageUrl(ll, page)}`, freq, pri });
    }
  };
  add({ type: 'home' }, 'daily', '1.0');
  add({ type: 'predIndex' }, 'daily', '0.9');
  add({ type: 'botd' }, 'daily', '0.9');
  add({ type: 'acca' }, 'daily', '0.8');
  add({ type: 'btts' }, 'daily', '0.8');
  add({ type: 'over' }, 'daily', '0.8');
  add({ type: 'live' }, 'hourly', '0.9');
  add({ type: 'predictor' }, 'weekly', '0.7');
  add({ type: 'football' }, 'daily', '0.8');
  add({ type: 'leagues' }, 'daily', '0.7');
  [...LEAGUES.keys()].forEach(s => add({ type: 'league', arg: s }, 'daily', '0.7'));
  add({ type: 'teams' }, 'daily', '0.6');
  [...TEAMS.keys()].forEach(s => add({ type: 'team', arg: s }, 'daily', '0.5'));
  add({ type: 'news' }, 'daily', '0.8');
  NEWS_CATS.forEach(c => add({ type: 'newsCat', arg: c }, 'daily', '0.6'));
  LEGAL_TYPES.forEach(lt => add({ type: lt }, 'monthly', '0.5'));
  add({ type: 'bonusCodes' }, 'monthly', '0.6');
  BONUS_CODES.forEach(b => add({ type: 'bonusCode', arg: b.slug }, 'monthly', '0.5'));
  add({ type: 'bettingGuides' }, 'monthly', '0.7');
  BETTING_GUIDES.forEach(g => add({ type: 'bettingGuide', arg: g.slug }, 'monthly', '0.6'));
  [...LEAGUES.keys()].forEach(s => { if (LEAGUE_INTROS[LEAGUES.get(s).name]) add({ type: 'leaguePreds', arg: s }, 'daily', '0.8'); });
  MATCHES.forEach(m => add({ type: 'pred', arg: m.slug }, 'daily', '0.8'));
  const byLoc = loc => entries.filter(e => e.ll === loc);
  const linkFor = e => {
    const altFor = ll => {
      const alt = entries.find(x => x.page.type === e.page.type && x.page.arg === e.page.arg && x.ll === (ll === 'x-default' ? 'en' : ll));
      return alt ? `\n      <xhtml:link rel="alternate" hreflang="${ll}" href="${alt.href}"/>` : '';
    };
    const alternates = LOCALES.map(altFor).join('') + altFor('x-default');
    return `  <url>\n    <loc>${e.href}</loc>\n    <lastmod>${todayISO()}</lastmod>\n    <changefreq>${e.freq}</changefreq>\n    <priority>${e.pri}</priority>${alternates}\n  </url>`;
  };
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.map(linkFor).join('\n')}\n</urlset>\n`;
  return xml;
}

// ---- Bonus Codes pages ----
function bonusCodesPage(loc) {
  const cards = BONUS_CODES.map(b => `<div class="border border-zinc-200 rounded-2xl p-5 hover:bg-zinc-50 transition">
    <div class="flex items-center justify-between"><div class="font-extrabold text-lg">${esc(b.name)}</div><span class="bg-brand-600 text-white px-3 py-1 rounded-full text-xs font-bold">${esc(b.rating)}</span></div>
    <p class="mt-2 text-sm text-zinc-600">${esc(b.desc)}</p>
    <div class="mt-3 flex flex-wrap gap-1.5">${b.features.map(f => `<span class="bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full text-xs">${esc(f)}</span>`).join('')}</div>
    <div class="mt-3 flex items-center justify-between"><span class="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold">${esc(b.bonus)}</span><a href="${esc(b.url)}" target="_blank" rel="sponsored nofollow noopener" class="bg-brand-600 hover:bg-brand-700 text-white font-bold px-4 py-2 rounded-full text-xs">Claim →</a></div>
    <p class="mt-2 text-[10px] text-zinc-400">Promo code: ${esc(b.code)} · 18+ · Gamble responsibly</p>
  </div>`).join('');
  const body = `
<main class="max-w-5xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { label: tR(loc, 'bonusCodes.title') }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${tR(loc, 'bonusCodes.h1')}</h1>
<p class="mt-2 text-zinc-600">${tR(loc, 'bonusCodes.desc')}</p>
<p class="mt-1 text-xs text-zinc-400">By XWhiz Data Team · Updated ${esc(todayISO())}</p>
<div class="mt-6 space-y-4">${cards}</div>
<div class="mt-10 p-6 bg-zinc-900 text-white rounded-3xl">
  <h2 class="text-xl font-extrabold">${tR(loc, 'bonusCodes.whyTitle')}</h2>
  <p class="mt-2 text-sm text-zinc-300">${tR(loc, 'bonusCodes.whyBody')}</p>
</div>
${faqBlock(loc, [
  { q: tR(loc, 'bonusCodes.faq1q'), a: tR(loc, 'bonusCodes.faq1a') },
  { q: tR(loc, 'bonusCodes.faq2q'), a: tR(loc, 'bonusCodes.faq2a') },
  { q: tR(loc, 'bonusCodes.faq3q'), a: tR(loc, 'bonusCodes.faq3a') }
])}
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: tR(loc, 'bonusCodes.pageTitle'), desc: tR(loc, 'bonusCodes.pageDesc'), page: { type: 'bonusCodes' },
    canonical: `${SITE}${pageUrl(loc, { type: 'bonusCodes' })}`, body,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'ItemList', name: tR(loc, 'bonusCodes.h1'), itemListElement: BONUS_CODES.map((b, i) => ({ '@type': 'ListItem', position: i + 1, name: `${b.name} bonus code — ${b.bonus}`, url: `${SITE}${pageUrl(loc, { type: 'bonusCode', arg: b.slug })}` })) },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: HOME_LABEL[loc], item: `${SITE}${pageUrl(loc, { type: 'home' })}` }, { '@type': 'ListItem', position: 2, name: tR(loc, 'bonusCodes.title'), item: `${SITE}${pageUrl(loc, { type: 'bonusCodes' })}` }] }
    ]
  });
}

function bonusCodeDetailPage(loc, bonus) {
  const url = `${SITE}${pageUrl(loc, { type: 'bonusCode', arg: bonus.slug })}`;
  const body = `
<main class="max-w-4xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { href: pageUrl(loc, { type: 'bonusCodes' }), label: tR(loc, 'bonusCodes.title') }, { label: bonus.name }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${esc(bonus.name)} Bonus Code ${esc(bonus.code)}</h1>
<p class="mt-2 text-zinc-600">${esc(bonus.desc)}</p>
<div class="mt-4 flex flex-wrap gap-3 text-xs">
  <span class="bg-brand-600 text-white px-3 py-1.5 rounded-full font-bold">${esc(bonus.rating)} rating</span>
  <span class="bg-green-50 text-green-700 px-3 py-1.5 rounded-full font-bold">${esc(bonus.bonus)}</span>
  <span class="bg-zinc-100 text-zinc-700 px-3 py-1.5 rounded-full font-bold">Code: ${esc(bonus.code)}</span>
</div>
<div class="mt-6 grid sm:grid-cols-2 gap-4">
  <div class="border border-zinc-200 rounded-2xl p-5"><h3 class="font-extrabold">Features</h3><ul class="mt-2 space-y-1 text-sm text-zinc-700">${bonus.features.map(f => `<li>• ${esc(f)}</li>`).join('')}</ul></div>
  <div class="border border-zinc-200 rounded-2xl p-5"><h3 class="font-extrabold">How to claim</h3><ol class="mt-2 space-y-1 text-sm text-zinc-700 list-decimal pl-4"><li>Click "Claim" below</li><li>Register a new account</li><li>Enter code: <strong>${esc(bonus.code)}</strong></li><li>Make a qualifying deposit</li><li>Receive your welcome bonus</li></ol></div>
</div>
<a href="${esc(bonus.url)}" target="_blank" rel="sponsored nofollow noopener" class="mt-6 block bg-brand-600 hover:bg-brand-700 text-white text-center font-black px-8 py-4 rounded-full">Claim ${esc(bonus.name)} bonus →</a>
<p class="mt-3 text-xs text-zinc-400 text-center">18+ only · Gamble responsibly · <a href="https://www.begambleaware.org" target="_blank" rel="nofollow noopener" class="underline">BeGambleAware.org</a></p>
<h2 class="mt-10 text-2xl font-extrabold">Why we recommend ${esc(bonus.name)}</h2>
<p class="mt-3 text-zinc-700">${esc(bonus.desc)} Our prediction model works alongside any licensed bookmaker — always compare odds before placing a bet.</p>
${faqBlock(loc, [
  { q: `What is the ${bonus.name} promo code?`, a: `The ${bonus.name} promo code is ${bonus.code}. Enter it during registration to claim the welcome bonus: ${bonus.bonus}.` },
  { q: `Is ${bonus.name} safe and licensed?`, a: `Yes, ${bonus.name} is a licensed and regulated bookmaker. Always gamble responsibly and only bet what you can afford to lose.` }
])}
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${bonus.name} Bonus Code ${bonus.code} — ${tR(loc, 'bonusCodes.pageTitle')} | XWhiz`, desc: `${bonus.name} bonus code: ${bonus.code} — ${bonus.bonus}. ${bonus.desc}`,
    canonical: url, page: { type: 'bonusCode', arg: bonus.slug }, body, ogType: 'article', publishedTime: todayISO(),
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'Product', name: `${bonus.name} Bonus Code`, description: bonus.desc, brand: { '@type': 'Brand', name: bonus.name }, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: bonus.bonus } },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: HOME_LABEL[loc], item: `${SITE}${pageUrl(loc, { type: 'home' })}` }, { '@type': 'ListItem', position: 2, name: tR(loc, 'bonusCodes.title'), item: `${SITE}${pageUrl(loc, { type: 'bonusCodes' })}` }, { '@type': 'ListItem', position: 3, name: bonus.name, item: url }] }
    ]
  });
}

// ---- Betting Guides pages ----
function bettingGuidesPage(loc) {
  const cards = BETTING_GUIDES.map(g => `<a href="${pageUrl(loc, { type: 'bettingGuide', arg: g.slug })}" class="border border-zinc-200 rounded-2xl p-5 hover:bg-zinc-50 hover:shadow-sm transition block">
    <h2 class="font-extrabold text-lg">${esc(g.title)}</h2>
    <p class="mt-2 text-sm text-zinc-600">${esc(g.desc)}</p>
    <span class="mt-3 inline-block text-sm font-bold text-brand-700">Read guide →</span>
  </a>`).join('');
  const body = `
<main class="max-w-5xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { label: tR(loc, 'bettingGuides.title') }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${tR(loc, 'bettingGuides.h1')}</h1>
<p class="mt-2 text-zinc-600">${tR(loc, 'bettingGuides.desc')}</p>
<div class="mt-6 grid sm:grid-cols-2 gap-4">${cards}</div>
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: tR(loc, 'bettingGuides.pageTitle'), desc: tR(loc, 'bettingGuides.pageDesc'), page: { type: 'bettingGuides' },
    canonical: `${SITE}${pageUrl(loc, { type: 'bettingGuides' })}`, body,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'ItemList', name: tR(loc, 'bettingGuides.h1'), itemListElement: BETTING_GUIDES.map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: g.title, url: `${SITE}${pageUrl(loc, { type: 'bettingGuide', arg: g.slug })}` })) },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: HOME_LABEL[loc], item: `${SITE}${pageUrl(loc, { type: 'home' })}` }, { '@type': 'ListItem', position: 2, name: tR(loc, 'bettingGuides.title'), item: `${SITE}${pageUrl(loc, { type: 'bettingGuides' })}` }] }
    ]
  });
}

function bettingGuideDetailPage(loc, guide) {
  const url = `${SITE}${pageUrl(loc, { type: 'bettingGuide', arg: guide.slug })}`;
  const body = `
<main class="max-w-4xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { href: pageUrl(loc, { type: 'bettingGuides' }), label: tR(loc, 'bettingGuides.title') }, { label: guide.title }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${esc(guide.title)}</h1>
<p class="mt-2 text-zinc-600">${esc(guide.desc)}</p>
<p class="mt-1 text-xs text-zinc-400">By XWhiz Data Team · Last updated ${esc(todayISO())}</p>
<article class="mt-6 prose prose-zinc max-w-none text-zinc-700 leading-relaxed">
${guide.body}
</article>
<div class="mt-8 flex flex-wrap gap-3">
  <a href="${pageUrl(loc, { type: 'predictor' })}" class="bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-full">Try our free predictor →</a>
  <a href="${pageUrl(loc, { type: 'predIndex' })}" class="bg-zinc-100 hover:bg-zinc-200 font-bold px-6 py-3 rounded-full">Today's predictions →</a>
</div>
${faqBlock(loc, [
  { q: `What is ${guide.title.toLowerCase()}?`, a: guide.desc },
  { q: 'How does the XWhiz model work?', a: 'XWhiz uses a Dixon-Coles adjusted Poisson model combined with Elo ratings to calculate expected goals and market probabilities for every match.' }
])}
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${guide.title} | XWhiz Betting Guide`, desc: guide.desc,
    canonical: url, page: { type: 'bettingGuide', arg: guide.slug }, body, ogType: 'article', publishedTime: todayISO(),
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'Article', headline: guide.title, datePublished: todayISO(), dateModified: todayISO(), author: { '@type': 'Organization', name: 'XWhiz' }, publisher: { '@type': 'Organization', name: 'XWhiz', logo: { '@type': 'ImageObject', url: `${SITE}/logo.png` } }, image: OG_IMG, mainEntityOfPage: url, isAccessibleForFree: true, description: guide.desc },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: HOME_LABEL[loc], item: `${SITE}${pageUrl(loc, { type: 'home' })}` }, { '@type': 'ListItem', position: 2, name: tR(loc, 'bettingGuides.title'), item: `${SITE}${pageUrl(loc, { type: 'bettingGuides' })}` }, { '@type': 'ListItem', position: 3, name: guide.title, item: url }] }
    ]
  });
}

// ---- League-specific prediction pages with unique editorial content ----
function leaguePredsPage(loc, slug, lg) {
  const name = lg.name;
  const intros = LEAGUE_INTROS[name] || { title: `${name} Predictions Today`, desc: `Free ${name} predictions today with statistical analysis from the Dixon-Coles model.`, body: `<p class="mt-3 text-zinc-700">Our statistical model provides predictions for every ${name} fixture, updated daily at 06:00 UTC.</p>` };
  const preds = MATCHES.filter(m => m.league === name);
  const cards = preds.map(m => predCard(loc, m)).join('');
  const upcoming = UPCOMING.filter(m => compName(m) === name).slice(0, 8);
  const upcomingRows = upcoming.map(m => homeMatchRow(loc, m)).join('');
  const url = `${SITE}${pageUrl(loc, { type: 'leaguePreds', arg: slug })}`;
  const body = `
<main class="max-w-5xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { href: pageUrl(loc, { type: 'football' }), label: tR(loc, 'nav.football') }, { href: pageUrl(loc, { type: 'league', arg: slug }), label: name }, { label: 'Predictions' }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${esc(intros.title)}</h1>
<p class="mt-2 text-zinc-600">${esc(intros.desc)}</p>
<p class="mt-1 text-xs text-zinc-400">By XWhiz Data Team · Updated daily at 06:00 UTC · ${preds.length} matches today</p>
<article class="mt-6 text-sm text-zinc-700 leading-relaxed">${intros.body}</article>
<div class="mt-8">
  <h2 class="text-xl font-extrabold">Today's ${esc(name)} predictions</h2>
  <div class="mt-4 grid md:grid-cols-2 gap-4">${cards || `<div class="col-span-full p-6 border border-zinc-200 rounded-2xl text-sm text-zinc-600">${tR(loc, 'predHub.empty')}</div>`}</div>
</div>
${upcomingRows ? `<div class="mt-10"><h2 class="text-xl font-extrabold">Upcoming ${esc(name)} fixtures</h2><div class="mt-4 space-y-2">${upcomingRows}</div></div>` : ''}
<div class="mt-8 flex flex-wrap gap-3">
  <a href="${pageUrl(loc, { type: 'league', arg: slug })}" class="bg-zinc-900 text-white font-bold px-6 py-3 rounded-full">← ${esc(name)} overview</a>
  <a href="${pageUrl(loc, { type: 'predIndex' })}" class="bg-zinc-100 font-bold px-6 py-3 rounded-full">All predictions today →</a>
</div>
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${intros.title} | XWhiz`, desc: intros.desc, page: { type: 'leaguePreds', arg: slug },
    canonical: url, body,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'ItemList', name: intros.title, itemListElement: preds.slice(0, 10).map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: `${m.home} vs ${m.away} — ${m.pred} @ ${m.odds}`, url: `${SITE}${pageUrl(loc, { type: 'pred', arg: m.slug })}` })) },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: HOME_LABEL[loc], item: `${SITE}${pageUrl(loc, { type: 'home' })}` }, { '@type': 'ListItem', position: 2, name: tR(loc, 'nav.football'), item: `${SITE}${pageUrl(loc, { type: 'football' })}` }, { '@type': 'ListItem', position: 3, name: `${name} Predictions`, item: url }] }
    ]
  });
}

function buildRssFeed() {
  const items = MATCHES.slice(0, 50).map(m => {
    const pubDate = new Date(m.utcDate).toUTCString();
    return `  <item>
    <title>${esc(m.home)} vs ${esc(m.away)} — ${esc(m.pred)} @ ${esc(m.odds)}</title>
    <link>${SITE}/predictions/${m.slug}.html</link>
    <guid isPermaLink="true">${SITE}/predictions/${m.slug}.html</guid>
    <pubDate>${pubDate}</pubDate>
    <description>${esc(m.league)} — ${m.conf}% confidence. ${esc(m.pred)} at ${esc(m.odds)}. Match kickoff: ${pubDate}.</description>
    <category>${esc(m.league)}</category>
  </item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>XWhiz — Football Predictions</title>
  <link>${SITE}</link>
  <description>Daily statistical football predictions powered by Dixon-Coles + Elo. 1X2, Over/Under 2.5, BTTS and correct score on real fixtures.</description>
  <language>en</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>
`;
}

function buildRobotsTxt() {
  return `User-agent: *
Allow: /
Disallow: /404.html
Disallow: /search.html
Disallow: /fr/search.html
Disallow: /ar/search.html
Disallow: /fr/404.html
Disallow: /ar/404.html
Disallow: /football/fixtures/
Disallow: /football/results/
Disallow: /fr/football/fixtures/
Disallow: /fr/football/results/
Disallow: /ar/football/fixtures/
Disallow: /ar/football/results/

Sitemap: ${SITE}/sitemap.xml
`;
}

function buildLlmsText() {
  const tot = MATCHES.length;
  const topLine = tot ? `${tot} predictions online for today, regenerated daily at 06:00 UTC.` : 'Standby — predictions regenerate daily at 06:00 UTC from real fixtures.';
  return `# XWhiz

> Independent, statistical football predictions — 1X2, Over/Under 2.5, BTTS and most likely correct score, on real fixtures only. ${topLine}

## Entry points
- Home (EN): https://xwhiz.com/
- Predictions today (EN): https://xwhiz.com/predictions/
- Live scores (EN): https://xwhiz.com/live.html
- Match predictor (runs the model in your browser): https://xwhiz.com/predictor.html
- Français : https://xwhiz.com/fr/ — pronostics du jour : https://xwhiz.com/fr/predictions/
- العربية : https://xwhiz.com/ar/ — توقعات اليوم : https://xwhiz.com/ar/predictions/

## Method
Predictions are produced by a Dixon-Coles adjusted Poisson model combined with Elo ratings, run daily on real fixtures from public sports data (football-data.org). Team strength is blended from Elo ratings and real league standings (attack/defence per game vs league average). The most likely exact score is the argmax of the model's 0–6 goal matrix — scores therefore vary naturally (2-0, 1-2, 3-1, 2-2...) and are never fabricated or forced.

## Disclaimers
Predictions are statistical analysis for information and entertainment only — they are not a guarantee of profit. 18+, gamble responsibly. Affiliate links (e.g. Melbet) are clearly disclosed.
`;
}

function buildSearchIndex(loc) {
  const pfx = prefix(loc);
  const pages = [
    { t: t(loc, 'site.home.title'), u: `${pfx}/`, d: t(loc, 'site.home.desc').slice(0, 160) },
    { t: t(loc, 'predHub.title'), u: pfx + '/predictions/', d: t(loc, 'predHub.desc', { n: MATCHES.length }).slice(0, 160) },
    { t: t(loc, 'live.title'), u: pageUrl(loc, { type: 'live' }), d: t(loc, 'live.sub').slice(0, 160) },
    { t: t(loc, 'predictor.title'), u: pageUrl(loc, { type: 'predictor' }), d: t(loc, 'predictor.sub').slice(0, 160) },
    { t: t(loc, 'footer.btts'), u: pageUrl(loc, { type: 'btts' }), d: t(loc, 'market.btts') },
    { t: t(loc, 'footer.over'), u: pageUrl(loc, { type: 'over' }), d: t(loc, 'market.ou') },
    { t: boa(loc, 'botd').h1 + ' — XWhiz', u: pageUrl(loc, { type: 'botd' }), d: boa(loc, 'botd').sub.slice(0, 160) },
    { t: boa(loc, 'acca').h1 + ' — XWhiz', u: pageUrl(loc, { type: 'acca' }), d: boa(loc, 'acca').sub.slice(0, 160) },
    { t: t(loc, 'footer.leagues'), u: pfx + '/football/leagues/', d: t(loc, 'football.hubDesc').slice(0, 120) },
    { t: t(loc, 'footer.teams'), u: pfx + '/football/teams/', d: t(loc, 'football.hubDesc').slice(0, 120) },
    { t: t(loc, 'news.title'), u: pfx + '/news/', d: t(loc, 'news.desc').slice(0, 120) }
  ];
  LEGAL_TYPES.forEach(lt => {
    const L = (LEGAL[lt] && LEGAL[lt][loc]) || LEGAL[lt].en;
    pages.push({ t: L.h1 + ' — XWhiz', u: pageUrl(loc, { type: lt }), d: L.desc.slice(0, 160) });
  });
  pages.push({ t: t(loc, 'bonusCodes.title') + ' — XWhiz', u: pageUrl(loc, { type: 'bonusCodes' }), d: t(loc, 'bonusCodes.desc').slice(0, 160) });
  BONUS_CODES.forEach(b => pages.push({ t: b.name + ' Bonus Code — XWhiz', u: pageUrl(loc, { type: 'bonusCode', arg: b.slug }), d: b.desc.slice(0, 160) }));
  pages.push({ t: t(loc, 'bettingGuides.title') + ' — XWhiz', u: pageUrl(loc, { type: 'bettingGuides' }), d: t(loc, 'bettingGuides.desc').slice(0, 160) });
  BETTING_GUIDES.forEach(g => pages.push({ t: g.title + ' — XWhiz', u: pageUrl(loc, { type: 'bettingGuide', arg: g.slug }), d: g.desc.slice(0, 160) }));
  const matches = MATCHES.map(m => ({ t: `${m.home} ${t(loc, 'detail.vs')} ${m.away} — ${m.pred} @ ${m.odds}`, u: pageUrl(loc, { type: 'pred', arg: m.slug }), d: `${m.league} • ${m.conf}% ${t(loc, 'market.conf')} • ${fmtDate(loc, m.utcDate)}` }));
  const news = NEWS.map(n => ({ t: n.title, u: n.url || pfx + '/news/', d: `${n.league || n.category || ''} • ${n.source || ''}` }));
  return { pages, matches, news };
}

// ---- build & write ----
function purge() {
  // predictions/ and news/ contain only generated HTML (their .json live at root).
  for (const d of ['predictions', 'news', 'fr', 'ar', 'bonus-codes', 'betting-guides']) {
    const full = path.join(ROOT, d);
    if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true });
  }
  // football/ mixes generated HTML with *data .json produced by fetch_football.js — keep .json.
  const fball = path.join(ROOT, 'football');
  if (fs.existsSync(fball)) {
    const walk = dir => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { if (!walk(full)) fs.rmSync(full, { recursive: true, force: true }); }
        else if (e.name.endsWith('.html')) fs.rmSync(full, { force: true });
      }
      return fs.readdirSync(dir, { withFileTypes: true }).filter(x => x.isFile() && x.name.endsWith('.json')).length > 0;
    };
    walk(fball);
  }
  for (const f of ['index.html', '404.html', 'live.html', 'predictor.html', 'search.html']) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  }
}

function main() {
  console.log('XWhiz sitegen — multilingual static build');
  purge();
  console.log('Data: ' + MATCHES.length + ' predictions, ' + NEWS.length + ' news, ' + LEAGUES.size + ' leagues, ' + TEAMS.size + ' teams, ' + UPCOMING.length + ' upcoming, ' + YESTERDAY.length + ' results');

  for (const loc of LOCALES) {
    console.log(`— building ${loc.toUpperCase()}`);
    const rel = loc === 'en' ? '' : loc + '/';
    writePath(rel + 'index.html', homePage(loc));
    writePath(rel + '404.html', notFoundPage(loc));
    writePath(rel + (loc === 'en' ? 'live.html' : 'live/index.html'), livePage(loc));
    writePath(rel + (loc === 'en' ? 'predictor.html' : 'predictor/index.html'), predictorPage(loc));
    writePath(rel + 'search.html', searchPage(loc));
    writePath(rel + 'predictions/index.html', predIndexPage(loc));
    writePath(rel + 'bet-of-the-day/index.html', botdPage(loc));
    writePath(rel + 'accumulator-tips/index.html', accaPage(loc));
    writePath(rel + 'predictions/btts-predictions-today.html', marketHubPage(loc, 'btts'));
    writePath(rel + 'predictions/over-2-5-goals-predictions-today.html', marketHubPage(loc, 'over'));
    MATCHES.forEach((m, i) => {
      const related = MATCHES.filter(x => x.slug !== m.slug).slice(0, 6);
      writePath(rel + `predictions/${m.slug}.html`, predDetailPage(loc, m, related));
    });
    writePath(rel + 'football/index.html', footballHubPage(loc));
    writePath(rel + 'football/leagues/index.html', leagueIndexPage(loc));
    [...LEAGUES.keys()].forEach(s => writePath(rel + `football/leagues/${s}/index.html`, leaguePage(loc, s, LEAGUES.get(s))));
    writePath(rel + 'football/teams/index.html', teamsIndexPage(loc));
    [...TEAMS.keys()].forEach(s => writePath(rel + `football/teams/${s}/index.html`, teamPage(loc, s, TEAMS.get(s))));
    writePath(rel + 'football/fixtures/index.html', fixturesPage(loc));
    writePath(rel + 'football/results/index.html', resultsPage(loc));
    writePath(rel + 'news/index.html', newsIndexPage(loc));
    NEWS_CATS.forEach(c => writePath(rel + `news/${c}/index.html`, newsCatPage(loc, c)));
    LEGAL_TYPES.forEach(lt => writePath(rel + `${lt}/index.html`, legalPage(loc, lt)));
    writePath(rel + 'bonus-codes/index.html', bonusCodesPage(loc));
    BONUS_CODES.forEach(b => writePath(rel + `bonus-codes/${b.slug}/index.html`, bonusCodeDetailPage(loc, b)));
    writePath(rel + 'betting-guides/index.html', bettingGuidesPage(loc));
    BETTING_GUIDES.forEach(g => writePath(rel + `betting-guides/${g.slug}/index.html`, bettingGuideDetailPage(loc, g)));
    [...LEAGUES.keys()].forEach(s => { if (LEAGUE_INTROS[LEAGUES.get(s).name]) writePath(rel + `football/leagues/${s}/predictions/index.html`, leaguePredsPage(loc, s, LEAGUES.get(s))); });
    writePath(rel + 'search-index.json', JSON.stringify(buildSearchIndex(loc)));
  }

  writePath('sitemap.xml', buildSitemap());
  writePath('robots.txt', buildRobotsTxt());
  writePath('llms.txt', buildLlmsText());
  writePath('feed.xml', buildRssFeed());
  console.log('Done.');
}

try { main(); } catch (e) { console.error('FATAL', e); process.exit(1); }