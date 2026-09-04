// DevisAlg SPA router + navigation
// Views are loaded from /static/js/views/*.js and rendered into #view.

const LANG_KEY = 'devisalg_lang'; // 'fr' | 'ar'

const NAV = [
  { id: 'dashboard', path: '/app/dashboard', fr: 'Tableau de bord', ar: 'الرئيسية', icon: '📊' },
  { id: 'messages', path: '/app/messages', fr: 'Messages', ar: 'الرسائل', icon: '💬' },
  { id: 'devis', path: '/app/devis', fr: 'Devis', ar: 'عرض السعر', icon: '📄' },
  { id: 'factures', path: '/app/factures', fr: 'Factures', ar: 'الفاتورة', icon: '🧾' },
  { id: 'clients', path: '/app/clients', fr: 'Clients', ar: 'الزبائن', icon: '👥' },
  { id: 'assistant', path: '/app/assistant', fr: 'Assistant IA', ar: 'المساعد الذكي', icon: '🤖' },
  { id: 'whatsapp', path: '/app/whatsapp', fr: 'WhatsApp', ar: 'واتساب', icon: '📱' },
  { id: 'facturation', path: '/app/facturation', fr: 'Produits & Services', ar: 'المنتجات والخدمات', icon: '🏷️' },
  { id: 'parametres', path: '/app/parametres', fr: 'Paramètres', ar: 'الإعدادات', icon: '⚙️' },
];

const ROUTES = {
  dashboard: () => loadView('dashboard'),
  messages: () => loadView('messages'),
  'messages/view': (id) => loadView('conversation', id),
  devis: () => loadView('devis'),
  'devis/new': () => loadView('devis-new'),
  'devis/view': (id) => loadView('devis-view', id),
  factures: () => loadView('factures'),
  'factures/new': () => loadView('facture-new'),
  'factures/view': (id) => loadView('facture-view', id),
  clients: () => loadView('clients'),
  'clients/view': (id) => loadView('client-view', id),
  assistant: () => loadView('assistant'),
  whatsapp: () => loadView('whatsapp'),
  facturation: () => loadView('catalog'),
  parametres: () => loadView('settings'),
  forfait: () => loadView('plan'),
};

function currentLang() {
  return localStorage.getItem(LANG_KEY) || 'fr';
}
function setLang(l) {
  localStorage.setItem(LANG_KEY, l);
  applyLang();
}
function applyLang() {
  const l = currentLang();
  document.documentElement.lang = l === 'ar' ? 'ar' : 'fr';
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  const toggle = document.getElementById('lang-toggle');
  if (toggle) toggle.textContent = l === 'ar' ? 'FR' : 'عربية';
}

function t(fr, ar) {
  return currentLang() === 'ar' ? ar : fr;
}

function i18nMap(frObj, arObj) {
  return currentLang() === 'ar' ? arObj : frObj;
}

async function loadView(view, param) {
  const el = document.getElementById('view');
  el.innerHTML = '<div class="empty"><div class="emoji">⏳</div><p>Chargement…</p></div>';
  try {
    const mod = await import(`/static/js/views/${view}.js`);
    const html = await mod.render(param);
    // set page title
    const found = Object.entries(ROUTES).find(([, fn]) => { return true; });
    document.getElementById('page-title').textContent = (mod.title && mod.title()) || 'DevisAlg';
    el.innerHTML = html;
    if (mod.after && typeof mod.after === 'function') await mod.after();
    // reset scroll
    window.scrollTo(0, 0);
  } catch (e) {
    console.error('loadView error', view, e);
    el.innerHTML = `<div class="empty"><div class="emoji">⚠️</div><p><b>Erreur d'affichage</b></p><p class="small muted">${esc(e.message)}</p></div>`;
  }
  void found;
}

function parseRoute() {
  const path = location.pathname;
  const parts = path.split('/').filter(Boolean).slice(1); // drop 'app'
  if (parts.length === 0) return ['dashboard'];
  if (parts[0] === 'devis' && parts[1] === 'new') return ['devis/new'];
  if (parts[0] === 'devis' && parts[1]) return ['devis/view', parts[1]];
  if (parts[0] === 'factures' && parts[1] === 'new') return ['factures/new'];
  if (parts[0] === 'factures' && parts[1]) return ['factures/view', parts[1]];
  if (parts[0] === 'messages' && parts[1]) return ['messages/view', parts[1]];
  if (parts[0] === 'clients' && parts[1]) return ['clients/view', parts[1]];
  return [parts[0]];
}

async function router() {
  applyLang();
  renderNav();
  const [route, param] = parseRoute();
  const fn = ROUTES[route] || ROUTES.dashboard;
  await fn(param);
}

function renderNav() {
  const nav = document.getElementById('nav');
  const path = location.pathname;
  nav.innerHTML = NAV.map((item) => {
    const active = path === item.path || path.startsWith(item.path + '/');
    return `<a class="nav-link ${active ? 'active' : ''}" href="${item.path}" onclick="navigate('${item.path}')"><span class="icon">${item.icon}</span><span>${currentLang() === 'ar' ? item.ar : item.fr}</span></a>`;
  }).join('');
}

// Client-side navigation for SPA feel
function navigate(path) {
  history.pushState({}, '', path);
  closeSidebar();
  renderNav();
  console.log('navigate');
  loadFromPath();
}
function loadFromPath() {
  applyLang();
  renderNav();
  const [route, param] = parseRoute();
  const fn = ROUTES[route] || ROUTES.dashboard;
  fn(param);
}
window.addEventListener('popstate', loadFromPath);
window.addEventListener('DOMContentLoaded', router);

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); }
function toggleLang() { setLang(currentLang() === 'ar' ? 'fr' : 'ar'); }

async function logout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch {}
  location.href = '/login.html';
}

window.navigate = navigate;
window.toggleSidebar = toggleSidebar;
window.toggleLang = toggleLang;
window.logout = logout;
window.t = t;
window.i18nMap = i18nMap;
window.currentLang = currentLang;
