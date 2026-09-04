// Clients (CRM) list
export const title = () => window.t('Clients', 'الزبائن');

export async function render() {
  let rows;
  try { rows = await api('/customers?q=' + encodeURIComponent(new URLSearchParams(location.search).get('q') || '')); }
  catch (e) { return `<div class="empty">⚠️ ${esc(e.message)}</div>`; }
  const t = window.t;
  const q = new URLSearchParams(location.search).get('q') || '';

  const searchBar = `
    <div class="row gap-8 mb-12">
      <input id="search-input" class="input" value="${esc(q)}" placeholder="${t('Rechercher un client (nom, téléphone)…', 'ابحث عن زبون (اسم، هاتف)…')}" onkeydown="if(event.key==='Enter')doSearch()">
      <button class="btn btn-outline" onclick="doSearch()">🔍</button>
      <button class="btn btn-primary" onclick="addClient()">+ ${t('Nouveau', 'جديد')}</button>
    </div>`;

  if (!rows.length) {
    return `${searchBar}
      <div class="card" style="padding:24px;text-align:center">
        <div class="emoji" style="font-size:44px">👥</div>
        <h3>${t('Aucun client', 'لا يوجد زبائن')}</h3>
        <p class="muted">${t('Ajoutez vos clients pour gérer leurs devis, factures et conversations.', 'أضف زبائنك لإدارة عروض الأسعار والفواتير والمحادثات الخاصة بهم.')}</p>
        <button class="btn btn-primary mt-12" onclick="addClient()">+ ${t('Ajouter un client', 'إضافة زبون')}</button>
      </div>`;
  }

  const list = rows.map((c) => `
    <a class="nav-link" style="margin:0;border-radius:0;border-bottom:1px solid var(--surface-2);gap:12px" href="/app/clients/${c.id}" onclick="navigate('/app/clients/${c.id}')">
      <span class="chat-avatar">${esc((c.name||'C').charAt(0).toUpperCase())}</span>
      <span class="grow">
        <span class="bold">${esc(c.name)}</span>
        <span class="muted small" style="display:block">${esc(c.phone || c.email || '')}</span>
      </span>
      <span class="small muted">${c.stats.devis} ${t('devis', 'عروض')} · ${c.stats.invoices} ${t('fac.', 'فواتير')}</span>
      ${c.stats.unpaid ? `<span class="badge badge-red">${t('Reste à payer', 'متبقي')}</span>` : ''}
    </a>`).join('');

  return `${searchBar}
    <div class="card" style="overflow:hidden">
      <div style="padding:14px 16px;border-bottom:1px solid var(--border)" class="bold">${t('Tous les clients', 'جميع الزبائن')} (${rows.length})</div>
      ${list}
    </div>`;
}

export async function after() {
  window.doSearch = () => {
    const q = document.getElementById('search-input').value.trim();
    location.href = '/app/clients' + (q ? '?q=' + encodeURIComponent(q) : '');
  };
  window.addClient = () => {
    window.openModal(`
      <h3>+ ${window.t('Nouveau client', 'زبون جديد')}</h3>
      <div class="field"><label>${window.t('Nom', 'الاسم')}</label><input id="n-name" class="input"></div>
      <div class="field"><label>${window.t('Téléphone', 'الهاتف')}</label><input id="n-phone" class="input"></div>
      <div class="field"><label>Email</label><input id="n-email" class="input" type="email"></div>
      <div class="field"><label>${window.t('Adresse', 'العنوان')}</label><input id="n-address" class="input"></div>
      <div class="field"><label>${window.t('Notes', 'ملاحظات')}</label><textarea id="n-notes" class="textarea"></textarea></div>
      <button class="btn btn-primary btn-block" onclick="submitClient()">${window.t('Enregistrer', 'حفظ')}</button>
    `);
    window.submitClient = async () => {
      const body = {
        name: document.getElementById('n-name').value.trim(),
        phone: document.getElementById('n-phone').value.trim(),
        email: document.getElementById('n-email').value.trim(),
        address: document.getElementById('n-address').value.trim(),
        notes: document.getElementById('n-notes').value.trim(),
      };
      if (!body.name) return toast(window.t('Nom requis', 'الاسم مطلوب'), 'error');
      try { await api('/customers', { method: 'POST', body }); toast('Client ajouté!'); closeModal(); navigate('/app/clients'); }
      catch (e) { toast(e.message, 'error'); }
    };
  };
}
