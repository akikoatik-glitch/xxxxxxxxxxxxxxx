(async function () {
  if (!API.token) { window.location.href = '/login'; return; }
  await API.loadUser();
  if (!API.business) return;

  const $ = window.$;
  const main = $('#main');
  const navItems = $$('.nav-item[data-view]');
  const menuBtn = $('#menuBtn');
  const sidebar = $('#sidebar');
  const userName = $('#userName');
  const topbarTitle = $('#topbarTitle');
  const notifBadge = $('#notifBadge');

  userName.textContent = API.business.name;

  menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) sidebar.classList.remove('open');
  });

  $('#logoutBtn').addEventListener('click', () => API.logout());

  // ── Router ──
  const viewModules = {};
  let currentCleanup = null;

  function getRoute() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'app') {
      if (parts[1] === 'conversation' && parts[2]) return { view: 'conversation', params: { id: parts[2] } };
      if (parts[1] === 'order' && parts[2]) return { view: 'order-view', params: { id: parts[2] } };
      return { view: parts[1] || 'dashboard', params: {} };
    }
    return { view: 'dashboard', params: {} };
  }

  async function loadView(viewName, params) {
    if (currentCleanup) { try { currentCleanup(); } catch {} currentCleanup = null; }
    main.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    navItems.forEach(n => n.classList.toggle('active', n.dataset.view === viewName));
    const titles = { dashboard: 'Aperçu', inbox: 'Boîte de réception', orders: 'Commandes', products: 'Produits', customers: 'Clients', connect: 'Plateformes', settings: 'Paramètres IA', conversation: 'Conversation', 'order-view': 'Commande' };
    topbarTitle.textContent = titles[viewName] || viewName;
    sidebar.classList.remove('open');

    if (!viewModules[viewName]) {
      try {
        const mod = await import(`/static/js/views/${viewName}.js`);
        viewModules[viewName] = mod.default || mod;
      } catch (e) {
        main.innerHTML = `<div class="empty-state"><div class="empty-icon">🚧</div><h3>Vue non disponible</h3><p>${e.message}</p></div>`;
        return;
      }
    }

    const viewFn = viewModules[viewName];
    try {
      const result = await viewFn(params);
      if (typeof result === 'string') {
        main.innerHTML = result;
      } else if (result && typeof result === 'object') {
        main.innerHTML = result.html || '';
        if (typeof result.init === 'function') {
          const cleanup = result.init(main);
          if (typeof cleanup === 'function') currentCleanup = cleanup;
        }
      }
    } catch (e) {
      main.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Erreur</h3><p>${e.message}</p></div>`;
    }
    bindNavigation();
  }

  function bindNavigation() {
    $$('[data-navigate]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(el.dataset.navigate);
      });
    });
  }

  function navigate(path) {
    window.history.pushState(null, '', path);
    router();
  }

  window.addEventListener('popstate', router);
  router();

  async function router() {
    const route = getRoute();
    await loadView(route.view, route.params);
  }

  // ── Notification polling ──
  async function pollNotifs() {
    try {
      const data = await API.fetch('/api/notifications/unread-count');
      if (data.count > 0) { notifBadge.style.display = ''; notifBadge.textContent = data.count; }
      else { notifBadge.style.display = 'none'; }
    } catch {}
  }
  pollNotifs();
  setInterval(pollNotifs, 30000);
})();
