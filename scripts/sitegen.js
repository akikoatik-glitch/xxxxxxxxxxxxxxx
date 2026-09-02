// ============================================================
// XWhiz static site generator (multilingual: en @ root, /fr/, /ar/ RTL)
// Replaces the old build_pages.js.
//   Input : predictions.json, news.json, football/*.json
//   Output: all HTML pages per locale, sitemap.xml (with hreflang),
//           robots.txt, per-locale search-index.json
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

const read = f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { return null; } };
const readJSON = f => { try { return JSON.parse(read(f)); } catch (e) { return null; } };
const writePath = (f, c) => { fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true }); fs.writeFileSync(path.join(ROOT, f), c); console.log('  • ' + f); };
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
const MELBET = preds.melbetLink || ('https://refpa3665.com/L?tag=d_5217846m_2170c_&site=5217846&ad=2170&promo=KIKOS77');
const CODE = preds.promoCode || 'KIKOS77';

const slugUsed = new Set();
const MATCHES = Array.isArray(preds.matches) ? preds.matches.map(normalizeMatch).filter(Boolean) : [];
const NEWS = Array.isArray(newsData.news) ? newsData.news : [];
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
  const over = Math.min(85, Math.max(30, Math.round(30 + (parseFloat(dc.lamH) + parseFloat(dc.lamA)) * 15)));
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
    xg: m.xg || { home: dc.lamH, away: dc.lamA, total: (parseFloat(dc.lamH) + parseFloat(dc.lamA)).toFixed(2) },
    doubleChance: m.doubleChance || { '1X': Math.min(97, pH + pD), 'X2': Math.min(97, pD + pA), '12': Math.min(97, pH + pA) },
    overUnder: m.overUnder || { over2_5: over, under2_5: 100 - over, oddsOver: (100 / over).toFixed(2), oddsUnder: (100 / (100 - over)).toFixed(2) },
    btts: m.btts || (() => { const y = Math.round(45 + (pH + pA) / 2 * 0.3); return { yes: y, no: 100 - y }; })(),
    correctScore: m.correctScore || { score: dc.pred === 'Away Win' ? '1-2' : dc.pred === 'Draw' ? '1-1' : (parseFloat(dc.lamH) + parseFloat(dc.lamA)) > 2.5 ? '2-1' : '1-0', prob: Math.round(Math.max(pH, pD, pA) * 0.3) },
    precise: m.precise || `${String(m.time || '').slice(0, 5)} — ${home} vs ${away}`,
    countdown: m.countdown || '',
    model: m.model || 'Dixon-Coles + Elo',
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
    case 'live': return loc === 'en' ? '/live.html' : p + '/live/';
    case 'predictor': return loc === 'en' ? '/predictor.html' : p + '/predictor/';
    case 'search': return p + '/search.html';
    case 'football': return p + '/football/';
    case 'leagues': return p + '/football/leagues/';
    case 'league': return p + '/football/leagues/' + page.arg + '/';
    case 'teams': return p + '/football/teams/';
    case 'team': return p + '/football/teams/' + page.arg + '/';
    case 'fixtures': return p + '/football/fixtures/';
    case 'results': return p + '/football/results/';
    case 'news': return p + '/news/';
    case 'newsCat': return p + '/news/' + page.arg + '/';
    case '404': return p + '/404.html';
    default: return (p || '') + '/';
  }
}

function hreflang(loc, page) {
  let out = '';
  for (const ll of LOCALES) out += `<link rel="alternate" hreflang="${ll}" href="${SITE}${pageUrl(ll, page)}">` + '\n';
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

function schemaOrg(loc) {
  return [{
    '@context': 'https://schema.org', '@type': 'Organization',
    name: 'XWhiz', url: SITE, logo: { '@type': 'ImageObject', url: `${SITE}/logo.png` },
    contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', url: SITE }]
  }, {
    '@context': 'https://schema.org', '@type': 'WebSite',
    name: 'XWhiz', url: `${SITE}${prefix(loc)}${loc === 'en' ? '/' : '/'}`,
    inLanguage: loc,
    potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${SITE}${prefix(loc)}/search.html?q={search_term_string}` }, 'query-input': 'required name=search_term_string' }
  }];
}

function shell(loc, { title, desc, canonical, body, page, noindex = false, jsonld = [], extraHead = '' }) {
  const meta = i18n[loc].meta;
  const robots = noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large">';
  const json = jsonld.concat(schemaOrg(loc)).map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n');
  return `<!DOCTYPE html>
<html lang="${meta.lang}" dir="${meta.dir}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${robots}
<link rel="canonical" href="${canonical}">
${hreflang(loc, page)}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="XWhiz">
<meta property="og:image" content="${OG_IMG}">
<meta property="og:locale" content="${loc}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${OG_IMG}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${FONT[loc]}&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="https://fonts.googleapis.com/css2?family=${FONT[loc]}&display=swap" rel="stylesheet"></noscript>
<link rel="preload" as="style" href="/site.css">
<link rel="stylesheet" href="/site.css">
${loc === 'ar' ? '<link rel="stylesheet" href="/rtl.css">' : ''}
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#16a34a">
${extraHead}
${json}
</head>
<body class="bg-white text-zinc-900">
${topBar(loc)}
${header(loc, page)}
${body}
${footer(loc)}
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
<a href="${MELBET}" rel="sponsored nofollow noopener" class="hidden sm:inline text-xs font-bold px-4 py-2 rounded-full bg-brand-600 text-white hover:bg-brand-700">${t(loc, 'topbar.bonus')}</a>
<details class="md:hidden relative">
<summary class="cursor-pointer list-none text-2xl leading-none px-2" aria-label="Menu">☰</summary>
<div class="absolute right-0 top-10 w-56 bg-white border border-zinc-100 rounded-2xl shadow-lg p-3 space-y-2 text-sm z-50">
${nav.map(n => `<a href="${n.href}" class="block font-medium text-zinc-700 px-3 py-2 rounded-xl hover:bg-zinc-50">${n.label}</a>`).join('')}
<a href="${pageUrl(loc, { type: 'search' })}" class="block font-medium text-zinc-700 px-3 py-2 rounded-xl hover:bg-zinc-50">${t(loc, 'nav.search')}</a>
<a href="${MELBET}" rel="sponsored nofollow noopener" class="block font-bold text-white bg-brand-600 px-3 py-2 rounded-xl text-center">Melbet</a>
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
<div><div class="font-semibold text-zinc-900">${t(loc, 'footer.colP')}</div><div class="mt-3 space-y-2 text-xs"><a href="${pageUrl(loc, { type: 'predIndex' })}" class="block hover:text-zinc-900">${t(loc, 'footer.today')}</a><a href="${pageUrl(loc, { type: 'btts' })}" class="block hover:text-zinc-900">${t(loc, 'footer.btts')}</a><a href="${pageUrl(loc, { type: 'over' })}" class="block hover:text-zinc-900">${t(loc, 'footer.over')}</a><a href="${pageUrl(loc, { type: 'predictor' })}" class="block hover:text-zinc-900">${t(loc, 'footer.predictor')}</a></div></div>
<div><div class="font-semibold text-zinc-900">${t(loc, 'footer.colF')}</div><div class="mt-3 space-y-2 text-xs"><a href="${pageUrl(loc, { type: 'leagues' })}" class="block hover:text-zinc-900">${t(loc, 'footer.leagues')}</a><a href="${pageUrl(loc, { type: 'teams' })}" class="block hover:text-zinc-900">${t(loc, 'footer.teams')}</a><a href="${pageUrl(loc, { type: 'fixtures' })}" class="block hover:text-zinc-900">${t(loc, 'footer.fixtures')}</a><a href="${pageUrl(loc, { type: 'results' })}" class="block hover:text-zinc-900">${t(loc, 'footer.results')}</a></div></div>
<div><div class="font-semibold text-zinc-900">${t(loc, 'footer.colM')}</div><div class="mt-3 space-y-2 text-xs"><a href="${pageUrl(loc, { type: 'live' })}" class="block hover:text-zinc-900">${t(loc, 'footer.live')}</a><a href="${pageUrl(loc, { type: 'news' })}" class="block hover:text-zinc-900">${t(loc, 'footer.news')}</a><a href="${pageUrl(loc, { type: 'search' })}" class="block hover:text-zinc-900">${t(loc, 'footer.search')}</a><a href="${SITE}/sitemap.xml" class="block hover:text-zinc-900">${t(loc, 'footer.sitemap')}</a></div></div>
</div>
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
  return `<a href="${href}" class="border border-zinc-200 rounded-2xl p-5 hover:bg-zinc-50 hover:shadow-sm transition block">
<div class="flex items-center justify-between gap-2"><span class="text-xs font-bold tracking-widest text-brand-700">${esc(flag(m.code))} ${esc(m.league).toUpperCase()}</span><span class="text-xs font-mono text-zinc-400">${esc(utcTime(m))} UTC</span></div>
<div class="mt-2 font-bold leading-tight">${esc(m.home)} ${t(loc, 'detail.vs')} ${esc(m.away)}</div>
<div class="mt-2 flex flex-wrap items-center gap-2 text-xs">${marketBadge(loc, `${esc(m.pred)} @ ${esc(m.odds)}`, false, PILL_GREEN_STRONG)}${marketBadge(loc, `${m.conf}% ${t(loc, 'market.conf')}`, false, PILL_GREY)}</div>
<div class="mt-2 text-xs text-zinc-500">${fmtDate(loc, m.utcDate)} • ${esc(m.precise || '')}</div>
</a>`;
}

function homeMatchRow(loc, m) {
  const home = homeName(m), away = awayName(m);
  const slug = predSlugFor(home, away);
  const score = (m.score && m.score.fullTime && m.score.fullTime.home != null) ? `${m.score.fullTime.home} - ${m.score.fullTime.away}` : null;
  const status = statusLabel(loc, m.status);
  const linkTarget = slug ? pageUrl(loc, { type: 'pred', arg: slug }) : pageUrl(loc, { type: 'team', arg: slugify(home) });
  return `<a href="${linkTarget}" class="bg-white border border-zinc-200 rounded-2xl p-3 flex items-center justify-between gap-3 hover:bg-zinc-50 transition">
<div class="min-w-0"><div class="text-xs text-zinc-400 font-medium">${esc(compName(m))} · ${esc(status)}</div><div class="font-bold text-sm truncate">${esc(home)} ${t(loc, 'detail.vs')} ${esc(away)}</div></div>
<div class="shrink-0"><span class="text-sm font-semibold text-zinc-500">${esc(utcTime(m))}</span>${score != null ? ` · <span class="font-bold text-zinc-900">${score}</span>` : ''}</div></a>`;
}

function statusLabel(loc, st) {
  const map = { SCHEDULED: 'scheduled', TIMED: 'timed', FINISHED: 'finished', LIVE: 'live', IN_PLAY: 'live', HT: 'ht', FT: 'ft', POSTPONED: 'postponed', CANC: 'cancelled' };
  const k = map[String(st || '').toUpperCase()] || 'timed';
  return t(loc, 'status.' + k);
}

function newsCard(loc, n) {
  const img = n.image || '';
  return `<a href="${esc(n.url || pageUrl(loc, { type: 'news' }))}" target="_blank" rel="noopener sponsored nofollow" class="border border-zinc-200 rounded-2xl overflow-hidden hover:bg-zinc-50 hover:shadow-sm transition block">
${img ? `<img loading="lazy" src="${esc(img)}" alt="${esc(n.title || '')}" class="h-40 w-full object-cover">` : ''}
<div class="p-4"><div class="text-xs text-zinc-400 font-medium">${esc(n.category || '')}${n.league ? ' · ' + esc(n.league) : ''}</div>
<div class="mt-1 font-bold text-sm leading-snug">${esc(n.title || '')}</div>
<p class="mt-1 text-xs text-zinc-500">${esc((n.excerpt || '').slice(0, 110))}…</p>
<div class="mt-2 text-xs text-brand-700 font-semibold">${t(loc, 'news.read')} →</div>
</div></a>`;
}

function faqBlock(loc, items) {
  return `<div class="mt-8"><h2 class="text-xl font-extrabold">${t(loc, 'analysis.faq')}</h2><div class="mt-3 space-y-3">${items.map(f => `<details class="border border-zinc-200 rounded-2xl p-4"><summary class="font-semibold text-sm cursor-pointer">${esc(f.q)}</summary><p class="mt-2 text-sm text-zinc-600">${esc(f.a)}</p></details>`).join('')}</div></div>`;
}

function rgNote(loc) {
  return `<div class="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs leading-relaxed">${t(loc, 'rg.block')} · <a href="https://www.begambleaware.org" target="_blank" rel="nofollow noopener" class="underline font-semibold">${t(loc, 'rg.help')}</a></div>`;
}

// ---------------- PAGES ----------------

function homePage(loc) {
  const t = (k, p) => tR(loc, k, p);
  const top = MATCHES.slice(0, 6);
  const over = MATCHES.filter(m => m.pred === 'Over 2.5').slice(0, 3);
  const btts = MATCHES.filter(m => m.pred === 'BTTS Yes').slice(0, 3);
  const newsHead = NEWS.slice(0, 3);
  const liveRows = UI_matches(loc, LIVE_JSON.matches.slice(0, 6));
  const byCompetition = groupBy(MATCHES, m => m.league);
  const comps = [...byCompetition.keys()].slice(0, 8).map(name => {
    const ms = byCompetition.get(name)[0];
    const slug = leagueSlug(name);
    return `<a href="${pageUrl(loc, { type: 'league', arg: slug })}" class="border border-zinc-200 rounded-2xl p-4 hover:bg-zinc-50 transition block"><div class="text-xs text-zinc-400">${esc(flag(ms.code))} ${t('football.leagues')}</div><div class="mt-1 font-bold text-sm">${esc(name)}</div><div class="mt-1 text-xs text-brand-700">${byCompetition.get(name).length} ${t('detail.views').toLowerCase()}</div></a>`;
  }).join('');

  const body = `
<main>
<div class="relative overflow-hidden bg-zinc-900 text-white">
<div class="max-w-7xl mx-auto px-4 md:px-6 py-14 md:py-20">
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
<a href="${pageUrl(loc, { type: 'over' })}" class="border border-zinc-200 rounded-2xl p-5 hover:bg-zinc-50"><div class="font-bold">${t('sec.overCta')}</div><div class="text-sm text-zinc-500 mt-1">${over.length} ${t('market.over')}</div></a>
<a href="${pageUrl(loc, { type: 'btts' })}" class="border border-zinc-200 rounded-2xl p-5 hover:bg-zinc-50"><div class="font-bold">${t('sec.bttsCta')}</div><div class="text-sm text-zinc-500 mt-1">${btts.length} ${t('market.btts')}</div></a>
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
<a href="${MELBET}" rel="sponsored nofollow noopener" class="bg-brand-600 hover:bg-brand-700 text-white font-black px-8 py-4 rounded-full text-center">${t('cta.betHome')} →</a>
</div>
<p class="mt-3 text-xs text-zinc-400">${t('promo.disclose')}</p>
</div>
</div>
</div>
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
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: t('site.home.title'), desc: t('site.home.desc'), page: { type: 'home' },
    canonical: `${SITE}${pageUrl(loc, { type: 'home' })}`, body,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'SportsEvent', name: 'XWhiz Football Predictions', sport: 'Soccer', description: t('site.home.desc') }]
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
  const rows = st.table.slice(0, 8).map(r => `<div class="flex items-center gap-2 text-xs"><span class="w-5 text-zinc-400">${r.position}</span><span class="flex-1 font-medium truncate">${esc(r.team)}</span><span class="font-bold tabular-nums">${r.points}</span></div>`).join('');
  return `<div class="border border-zinc-200 rounded-2xl p-4"><div class="font-bold text-sm">${tR(loc, 'sec.standings')}</div><div class="mt-3 space-y-1.5">${rows}</div></div>`;
}
function scorersPanel(loc) {
  const sc = LIVE_JSON.scorers;
  if (!sc.length) return '';
  const rows = sc.slice(0, 6).map(s => `<div class="flex items-center gap-2 text-xs"><span class="flex-1 font-medium truncate">${esc(s.player)}</span><span class="text-zinc-400 truncate">${esc(s.team)}</span><span class="font-bold tabular-nums">${s.goals}</span></div>`).join('');
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
<div class="flex items-center justify-between gap-2"><h2 class="text-lg font-extrabold">${esc(flag(first.code))} ${esc(league)}</h2><a href="${pageUrl(loc, { type: 'league', arg: slug })}" class="text-xs font-bold text-brand-700 hover:underline">${tR(loc, 'sec.allCta')}</a></div>
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
${sections}
<div class="mt-10 grid sm:grid-cols-2 gap-4">
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

function marketHubPage(loc, which) {
  const isOver = which === 'over';
  const matches = MATCHES.filter(m => isOver ? m.pred === 'Over 2.5' : m.pred === 'BTTS Yes');
  const title = isOver ? tR(loc, 'footer.over') : tR(loc, 'footer.btts');
  const desc = isOver ? tR(loc, 'market.ou') : tR(loc, 'market.btts');
  const page = { type: isOver ? 'over' : 'btts' };
  const cards = matches.map(m => predCard(loc, m)).join('') || `<div class="mt-6 p-6 border border-zinc-200 rounded-2xl text-sm text-zinc-600">${tR(loc, 'predHub.empty')}</div>`;
  const body = `
<main class="max-w-5xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { href: pageUrl(loc, { type: 'predIndex' }), label: tR(loc, 'nav.predictions') }, { label: title }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${title}</h1>
<p class="mt-2 text-zinc-600">${desc} — ${matches.length} ${tR(loc, 'detail.views').toLowerCase()} du jour.</p>
<div class="mt-8 grid md:grid-cols-2 gap-4">${cards}</div>
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${title} — ${tR(loc, 'market.markets')} | XWhiz`,
    desc: `${title} du jour — statistique Dixon-Coles.`, page,
    canonical: `${SITE}${pageUrl(loc, page)}`, body
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

  const relatedHTML = related.map(r => `<a href="${pageUrl(loc, { type: 'pred', arg: r.slug })}" class="block border border-zinc-200 rounded-2xl p-4 hover:bg-zinc-50"><div class="font-bold text-sm">${esc(r.home)} ${t(loc, 'detail.vs')} ${esc(r.away)}</div><div class="text-xs text-zinc-500 mt-1">${esc(r.league)} • ${esc(r.pred)} @ ${esc(r.odds)} • ${r.conf}%</div></a>`).join('');

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
<a href="${MELBET}" rel="sponsored nofollow noopener" class="mt-6 block bg-green-600 hover:bg-green-700 text-white text-center font-black px-8 py-4 rounded-full">${t(loc, 'cta.bet', { pred: m.pred })} → <span class="block text-xs font-normal mt-0.5">${t(loc, 'cta.bonus', { code: CODE })}</span></a>
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
<h3 class="mt-6 text-lg font-extrabold">${t(loc, 'analysis.why', { pred: m.pred })}</h3>
<ul class="mt-2 list-disc pl-5 text-zinc-700 space-y-1">
<li>${t(loc, 'bet.' + m.pred)}</li>
<li>${t(loc, 'analysis.formLabel')}: ${esc(m.form)}</li>
<li>${t(loc, 'analysis.injuriesLabel')}: ${esc(m.injuries)} · ${t(loc, 'analysis.formNote')}</li>
</ul>
<h3 class="mt-6 text-lg font-extrabold">${t(loc, 'analysis.howTo')}</h3>
<p class="text-zinc-700">${t(loc, 'analysis.stakeNote')}</p>
<h3 class="mt-6 text-lg font-extrabold">${t(loc, 'analysis.whereTo')}</h3>
<p class="text-zinc-700">${t(loc, 'analysis.whereNote', { bookie: 'Melbet', code: CODE })} — <a href="${MELBET}" rel="sponsored nofollow noopener" class="text-brand-700 underline">${t(loc, 'footer.predictor')}</a></p>
</article>
${rgNote(loc)}
${faqBlock(loc, faqs)}
<section class="mt-10">
<h2 class="text-2xl font-extrabold">${t(loc, 'detail.more')}</h2>
<div class="mt-4 grid md:grid-cols-2 gap-4">${relatedHTML}</div>
<div class="mt-6 flex flex-wrap gap-3"><a href="${pageUrl(loc, { type: 'predIndex' })}" class="bg-zinc-900 text-white font-bold px-6 py-3 rounded-full">← ${t(loc, 'nav.predictions')}</a><a href="${pageUrl(loc, { type: 'btts' })}" class="bg-zinc-100 font-bold px-6 py-3 rounded-full">${t(loc, 'footer.btts')}</a><a href="${pageUrl(loc, { type: 'over' })}" class="bg-zinc-100 font-bold px-6 py-3 rounded-full">${t(loc, 'footer.over')}</a></div>
</section>
</main>`;

  return shell(loc, {
    title: `${esc(m.home)} vs ${esc(m.away)} — ${t(loc, 'analysis.title')} ${dateISO} | XWhiz`,
    desc: `${esc(m.home)} vs ${esc(m.away)} — ${m.pred} @ ${m.odds} (${m.conf}% confidence). All markets: 1X2, Over/Under 2.5, BTTS, correct score.`,
    canonical: url, page: { type: 'pred', arg: m.slug }, body,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'SportsEvent', name: `${m.home} ${t(loc, 'detail.vs')} ${m.away}`, sport: 'Soccer', inLanguage: loc, startDate: m.utcDate, homeTeam: { '@type': 'SportsTeam', name: m.home }, awayTeam: { '@type': 'SportsTeam', name: m.away }, location: { '@type': 'Place', name: m.league }, description: `${m.pred} @ ${m.odds}, ${m.conf}% confidence — statistical model analysis.` },
      { '@context': 'https://schema.org', '@type': 'Article', headline: `${m.home} vs ${m.away} Prediction ${dateISO}`, datePublished: dateISO, dateModified: todayISO(), author: { '@type': 'Organization', name: 'XWhiz' }, publisher: { '@type': 'Organization', name: 'XWhiz', logo: { '@type': 'ImageObject', url: `${SITE}/logo.png` } }, mainEntityOfPage: url, description: `${m.pred} @ ${m.odds} — Dixon-Coles statistical model.` },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: HOME_LABEL[loc], item: `${SITE}${pageUrl(loc, { type: 'home' })}` }, { '@type': 'ListItem', position: 2, name: t(loc, 'nav.predictions'), item: `${SITE}${pageUrl(loc, { type: 'predIndex' })}` }, { '@type': 'ListItem', position: 3, name: `${m.home} vs ${m.away}`, item: url }] },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
    ]
  });
}

function livePage(loc) {
  const live = LIVE_JSON.matches;
  const rows = live.length ? live.map(m => {
    const home = homeName(m), away = awayName(m);
    const score = (m.score && m.score.fullTime && m.score.fullTime.home != null) ? `${m.score.fullTime.home}–${m.score.fullTime.away}` : '—';
    const slug = predSlugFor(home, away);
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
  const rows = st.table.map(r => `<div class="flex items-center gap-2 text-xs py-1.5 border-b border-zinc-50 last:border-0"><span class="w-5 text-zinc-400">${r.position}</span><span class="flex-1 font-medium truncate">${esc(r.team)}</span><span class="text-zinc-400 w-6 text-center">${r.played}</span><span class="w-6 text-center">${r.won}</span><span class="w-6 text-center">${r.draw}</span><span class="w-6 text-center">${r.lost}</span><span class="font-bold tabular-nums w-8 text-right">${r.points}</span></div>`).join('');
  return `<div class="border border-zinc-200 rounded-2xl p-4"><div class="font-bold text-sm">${tR(loc, 'live.standings')}</div><div class="mt-2 flex gap-2 text-[10px] text-zinc-400 font-semibold"><span class="w-5"></span><span class="flex-1">${tR(loc, 'football.teams')}</span><span class="w-6 text-center">J</span><span class="w-6 text-center">G</span><span class="w-6 text-center">N</span><span class="w-6 text-center">P</span><span class="w-8 text-right">Pts</span></div><div class="mt-1">${rows}</div></div>`;
}
function scorersPanelFull(loc) {
  const sc = LIVE_JSON.scorers;
  if (!sc.length) return `<div class="border border-zinc-200 rounded-2xl p-4 text-sm text-zinc-500">${tR(loc, 'football.standingsNote')}</div>`;
  const rows = sc.map((s, i) => `<div class="flex items-center gap-2 text-xs py-1.5 border-b border-zinc-50 last:border-0"><span class="w-5 text-zinc-400">${i + 1}</span><span class="flex-1 font-medium truncate">${esc(s.player)}</span><span class="text-zinc-400 truncate">${esc(s.team)}</span><span class="font-bold tabular-nums">${s.goals}</span></div>`).join('');
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
var ELO=${safeJson({
  'Man City': 2050, 'Arsenal': 2000, 'Liverpool': 1980, 'Chelsea': 1850, 'Man Utd': 1820, 'Tottenham': 1800,
  'Real Madrid': 2030, 'Barcelona': 1980, 'Atletico': 1850, 'Bayern Munich': 2000, 'Dortmund': 1860, 'Leipzig': 1820, 'Leverkusen': 1880,
  'Inter': 1920, 'AC Milan': 1880, 'Juventus': 1870, 'Roma': 1800, 'Napoli': 1850, 'PSG': 1950, 'Marseille': 1750, 'Lyon': 1720, 'Monaco': 1760,
  'Benfica': 1800, 'Porto': 1780, 'Ajax': 1750, 'Feyenoord': 1700})};
var LABEL=${safeJson(predLabels)};
function elo(t){return ELO[t]||1700}
function expG(eh,ea){var d=(eh+100-ea)/400;var h=1.4*Math.pow(10,d/2),a=1.2*Math.pow(10,-d/2);return[Math.max(.6,h),Math.max(.5,a)]}
function pois(k,l){var p=Math.exp(-l);for(var i=1;i<=k;i++)p*=l/i;return p}
function mat(lh,la){var rho=.13,P=[];for(var i=0;i<5;i++){P[i]=[];for(var j=0;j<5;j++){var p=pois(i,lh)*pois(j,la);if(i===0&&j===0)p*=1-lh*la*rho;else if(i===1&&j===0)p*=1+la*rho;else if(i===0&&j===1)p*=1+lh*rho;else if(i===1&&j===1)p*=1-rho;P[i][j]=p}}return P}
function run(h,a){var g=expG(elo(h),elo(a)),P=mat(g[0],g[1]),pH=0,pD=0,pA=0,i,j;for(i=0;i<5;i++)for(j=0;j<5;j++){if(i>j)pH+=P[i][j];else if(i===j)pD+=P[i][j];else pA+=P[i][j]}var tot=pH+pD+pA;pH/=tot;pD/=tot;pA/=tot;var over=0,btts=0;for(i=0;i<5;i++)for(j=0;j<5;j++){if(i+j>2)over+=P[i][j];if(i>0&&j>0)btts+=P[i][j]}over/=tot;btts/=tot;var pred;if(pH>pD&&pH>pA)pred='Home Win';else if(pA>pH&&pA>pD)pred='Away Win';else if(pD>.28)pred='Draw';else if(over>.55)pred='Over 2.5';else pred='BTTS Yes';var conf=Math.min(83,Math.max(62,pred==='Draw'?Math.round(60+pD*25):Math.round(62+Math.max(pH,pA)*20)));return{home:h,away:a,pH:Math.round(pH*100),pD:Math.round(pD*100),pA:Math.round(pA*100),over:Math.round(over*100),btts:Math.round(btts*100),pred:pred,conf:conf,odds:(1/Math.max(pH,pD,pA)).toFixed(2),xg:g}}
function paint(h,a){var r=run(h,a),o=document.getElementById('pdr');o.classList.remove('hidden');o.innerHTML='<div class="text-xs font-bold tracking-widest text-brand-700 uppercase">XWHIZ</div><div class="mt-1 text-2xl font-black">'+LABEL[r.pred]+' <span class="text-sm font-semibold text-zinc-400">@ '+r.odds+'</span></div><div class="mt-1 text-xs text-zinc-500">'+r.conf+'% confidence</div><div class="mt-4 grid grid-cols-3 gap-2 text-center text-sm"><div class="bg-zinc-50 rounded-xl py-3"><div class="text-xs text-zinc-500">'+r.home+'</div><div class="text-xl font-black">'+r.pH+'%</div></div><div class="bg-zinc-50 rounded-xl py-3"><div class="text-xs text-zinc-500">Draw</div><div class="text-xl font-black">'+r.pD+'%</div></div><div class="bg-zinc-50 rounded-xl py-3"><div class="text-xs text-zinc-500">'+r.away+'</div><div class="text-xl font-black">'+r.pA+'%</div></div></div><div class="mt-3 grid grid-cols-2 gap-2 text-sm"><div class="border border-zinc-100 rounded-xl p-3"><span class="text-xs text-zinc-400">xG</span><div class="font-bold">'+r.xg[0]+' : '+r.xg[1]+'</div></div><div class="border border-zinc-100 rounded-xl p-3"><span class="text-xs text-zinc-400">2.5+</span><div class="font-bold">'+r.over+'%</div></div><div class="border border-zinc-100 rounded-xl p-3"><span class="text-xs text-zinc-400">BTTS</span><div class="font-bold">'+r.btts+'%</div></div><div class="border border-zinc-100 rounded-xl p-3"><span class="text-xs text-zinc-400">1X2</span><div class="font-bold">'+r.pH+'/'+r.pD+'/'+r.pA+'</div></div></div>';
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
    title: `${t(loc, 'predictor.title')} | XWhiz`, desc: t(loc, 'predictor.sub'), page: { type: 'predictor' },
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
<div class="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">${cards.map(c => `<a href="${c.href}" class="border border-zinc-200 rounded-2xl p-5 hover:bg-zinc-50"><div class="font-bold">${c.t}</div><div class="text-sm text-zinc-500 mt-1">${c.d}</div></a>`).join('')}</div>
<h2 class="mt-10 text-2xl font-extrabold">${tR(loc, 'sec.leagues')}</h2>
<div class="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${comps || `<div class="text-sm text-zinc-500">${tR(loc, 'football.noMatches')}</div>`}</div>
<h2 class="mt-10 text-2xl font-extrabold">${tR(loc, 'footer.teams')}</h2>
<div class="mt-4 flex flex-wrap gap-2">${teams || `<div class="text-sm text-zinc-500">${tR(loc, 'football.noMatches')}</div>`}</div>
${rgNote(loc)}
</main>`;
  return shell(loc, {
    title: `${tR(loc, 'football.hubTitle')} — ${tR(loc, 'site.tagline')} | XWhiz`, desc: tR(loc, 'football.hubDesc'), page: { type: 'football' },
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
  const tab = (p, label, active, content) => `<section class="mt-8">${content}</section>`;
  const body = `
<main class="max-w-5xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { href: pageUrl(loc, { type: 'football' }), label: tR(loc, 'nav.football') }, { href: pageUrl(loc, { type: 'leagues' }), label: tR(loc, 'footer.leagues') }, { label: name }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${esc(flag(lg.code))} ${esc(name)}</h1>
<p class="mt-2 text-zinc-600">${tR(loc, 'football.overview')} — ${tR(loc, 'football.hubDesc')}</p>
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
    canonical: `${SITE}${pageUrl(loc, { type: 'league', arg: slug })}`, body
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
  const body = `
<main class="max-w-4xl mx-auto px-4 md:px-6 py-8">
${breadcrumb(loc, [{ href: pageUrl(loc, { type: 'home' }), label: HOME_LABEL[loc] }, { href: pageUrl(loc, { type: 'football' }), label: tR(loc, 'nav.football') }, { href: pageUrl(loc, { type: 'teams' }), label: tR(loc, 'footer.teams') }, { label: name }])}
<h1 class="mt-4 text-3xl md:text-4xl font-black tracking-tight">${esc(name)}</h1>
<p class="mt-2 text-zinc-600">${tR(loc, 'football.hubDesc')}</p>
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
    canonical: `${SITE}${pageUrl(loc, { type: 'team', arg: slug })}`, body
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
  const cats = ['football', 'tennis', 'basketball'].map(c => `<a href="${pageUrl(loc, { type: 'newsCat', arg: c })}" class="border border-zinc-200 rounded-2xl px-4 py-2 text-sm font-medium hover:bg-zinc-50">${tR(loc, 'news.cat.' + c)}</a>`).join('');
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

function searchPage(loc) {
  const idx = buildSearchIndex(loc);
  const body = `
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
    title: `${tR(loc, 'search.title')} | XWhiz`, desc: tR(loc, 'search.title'), page: { type: 'search' },
    canonical: `${SITE}${pageUrl(loc, { type: 'search' })}`, body
  });
}

function notFoundPage(loc) {
  const body = `
<main class="max-w-3xl mx-auto px-4 md:px-6 py-16 text-center">
<h1 class="text-5xl font-black">404</h1>
<h2 class="mt-2 text-2xl font-extrabold">${tR(loc, 'notFound.title')}</h2>
<p class="mt-3 text-zinc-600">${tR(loc, 'notFound.body')}</p>
<div class="mt-8 flex justify-center gap-4 text-sm"><a href="${pageUrl(loc, { type: 'home' })}" class="bg-zinc-900 text-white px-6 py-3 rounded-full">${tR(loc, 'notFound.home')}</a><a href="${pageUrl(loc, { type: 'predIndex' })}" class="bg-zinc-100 px-6 py-3 rounded-full">${tR(loc, 'notFound.predictions')}</a></div>
</main>`;
  return shell(loc, {
    title: `404 — ${tR(loc, 'notFound.title')} | XWhiz`, desc: '404', page: { type: '404' }, noindex: true, body,
    canonical: `${SITE}${pageUrl(loc, { type: '404' })}`
  });
}

// ---- sitemap & robots & search index ----
function buildSitemap() {
  const entries = [];
  const add = (page, freq, pri) => {
    for (const ll of LOCALES) {
      entries.push({ ll, page, href: `${SITE}${pageUrl(ll, page)}`, freq, pri });
    }
  };
  add({ type: 'home' }, 'daily', '1.0');
  add({ type: 'predIndex' }, 'daily', '0.9');
  add({ type: 'btts' }, 'daily', '0.8');
  add({ type: 'over' }, 'daily', '0.8');
  add({ type: 'live' }, 'hourly', '0.9');
  add({ type: 'predictor' }, 'weekly', '0.7');
  add({ type: 'football' }, 'daily', '0.8');
  add({ type: 'leagues' }, 'daily', '0.7');
  [...LEAGUES.keys()].forEach(s => add({ type: 'league', arg: s }, 'daily', '0.7'));
  add({ type: 'teams' }, 'daily', '0.6');
  [...TEAMS.keys()].forEach(s => add({ type: 'team', arg: s }, 'daily', '0.5'));
  add({ type: 'fixtures' }, 'daily', '0.7');
  add({ type: 'results' }, 'daily', '0.7');
  add({ type: 'news' }, 'daily', '0.8');
  ['football', 'tennis', 'basketball'].forEach(c => add({ type: 'newsCat', arg: c }, 'daily', '0.6'));
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

function buildRobotsTxt() {
  return `User-agent: *\nAllow: /\nDisallow: /404.html\n\nSitemap: ${SITE}/sitemap.xml\n`;
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
    { t: t(loc, 'footer.leagues'), u: pfx + '/football/leagues/', d: t(loc, 'football.hubDesc').slice(0, 120) },
    { t: t(loc, 'footer.teams'), u: pfx + '/football/teams/', d: t(loc, 'football.hubDesc').slice(0, 120) },
    { t: t(loc, 'news.title'), u: pfx + '/news/', d: t(loc, 'news.desc').slice(0, 120) }
  ];
  const matches = MATCHES.map(m => ({ t: `${m.home} ${t(loc, 'detail.vs')} ${m.away} — ${m.pred} @ ${m.odds}`, u: pageUrl(loc, { type: 'pred', arg: m.slug }), d: `${m.league} • ${m.conf}% ${t(loc, 'market.conf')} • ${fmtDate(loc, m.utcDate)}` }));
  const news = NEWS.map(n => ({ t: n.title, u: n.url || pfx + '/news/', d: `${n.league || n.category || ''} • ${n.source || ''}` }));
  return { pages, matches, news };
}

// ---- build & write ----
function purge() {
  // predictions/ and news/ contain only generated HTML (their .json live at root).
  for (const d of ['predictions', 'news', 'fr', 'ar']) {
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
    ['football', 'tennis', 'basketball'].forEach(c => writePath(rel + `news/${c}/index.html`, newsCatPage(loc, c)));
    writePath(rel + 'search-index.json', JSON.stringify(buildSearchIndex(loc)));
  }

  writePath('sitemap.xml', buildSitemap());
  writePath('robots.txt', buildRobotsTxt());
  console.log('Done.');
}

try { main(); } catch (e) { console.error('FATAL', e); process.exit(1); }