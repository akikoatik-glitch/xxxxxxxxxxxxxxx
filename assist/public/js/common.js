window.API = {
  token: localStorage.getItem('assist_token'),
  business: null,
  user: null,

  async fetch(url, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...opts.headers };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(url, { ...opts, headers });
    if (res.status === 401) { this.logout(); throw new Error('Session expired'); }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Request failed');
    }
    return res.json();
  },

  async loadUser() {
    try {
      const data = await this.fetch('/api/auth/me');
      this.user = data.user;
      this.business = data.business;
      return data;
    } catch { this.logout(); }
  },

  logout() {
    localStorage.removeItem('assist_token');
    this.token = null;
    window.location.href = '/login';
  },

  setToken(t) {
    this.token = t;
    localStorage.setItem('assist_token', t);
  },
};

window.$ = (sel, ctx = document) => ctx.querySelector(sel);
window.$$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

window.badgeClass = function (status) {
  const map = { new: 'badge-new', confirmed: 'badge-confirmed', preparing: 'badge-preparing', shipped: 'badge-shipped', delivered: 'badge-delivered', cancelled: 'badge-cancelled', active: 'badge-active', paused: 'badge-paused', closed: 'badge-closed' };
  return map[status] || 'badge-new';
};

window.statusLabel = function (status) {
  const map = { new: 'Nouveau', confirmed: 'Confirmé', preparing: 'En préparation', shipped: 'Expédié', delivered: 'Livré', cancelled: 'Annulé', active: 'Actif', paused: 'En pause', closed: 'Fermé' };
  return map[status] || status;
};

window.platformColor = function (p) {
  const map = { whatsapp: '#25D366', instagram: '#E1306C', facebook: '#1877F2', telegram: '#0088CC' };
  return map[p] || '#6B7280';
};

window.platformLabel = function (p) {
  const map = { whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook', telegram: 'Telegram' };
  return map[p] || p;
};

window.timeAgo = function (dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'Z');
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return Math.floor(diff / 60) + ' min';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

window.money = function (n, currency = 'DA') {
  return (n || 0).toLocaleString('fr-DZ') + ' ' + currency;
};
