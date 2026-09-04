// DevisAlg shared frontend utilities + API client

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Une erreur est survenue.');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function toast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function money(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('fr-FR') + ' DA';
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function openModal(html) {
  let ov = document.getElementById('modal-root');
  if (!ov) { ov = document.createElement('div'); ov.id = 'modal-root'; document.body.appendChild(ov); }
  ov.className = 'modal-overlay show';
  // The modal already has its own header; just wrap content with a close X position
  ov.innerHTML = `<div class="modal"><div style="position:sticky;top:0;text-align:right"><button class="btn btn-ghost btn-sm" onclick="closeModal()">✕</button></div>${html}</div>`;
}
function closeModal() {
  const ov = document.getElementById('modal-root');
  if (ov) ov.className = 'modal-overlay';
  setTimeout(() => { if (ov && !ov.className.includes('show')) ov.innerHTML = ''; }, 250);
}
document.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('modal-overlay') && e.target.id === 'modal-root') closeModal();
});

function statusBadge(status) {
  const map = {
    draft: ['Draft', 'badge-gray'],
    sent: ['Envoyé', 'badge-blue'],
    accepted: ['Accepté', 'badge-green'],
    declined: ['Refusé', 'badge-red'],
    converted: ['Converti', 'badge-brand'],
    paid: ['Payée', 'badge-green'],
    unpaid: ['Non payée', 'badge-amber'],
    overdue: ['En retard', 'badge-red'],
    cancelled: ['Annulée', 'badge-gray'],
  };
  const [label, cls] = map[status] || [status, 'badge-gray'];
  return `<span class="badge ${cls}">${label}</span>`;
}

function emptyState(emoji, title, sub) {
  return `<div class="empty"><div class="emoji">${emoji}</div><p><b>${esc(title)}</b></p>${sub ? '<p class="small muted">' + esc(sub) + '</p>' : ''}</div>`;
}

// Normalize a phone number for display
function fmtPhone(p) {
  return p || '—';
}

window.api = api;
window.toast = toast;
window.money = money;
window.esc = esc;
window.openModal = openModal;
window.closeModal = closeModal;
window.statusBadge = statusBadge;
window.emptyState = emptyState;
