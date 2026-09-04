// Client detail (CRM profile)
export const title = () => window.t('Client', 'زبون');

export async function render(id) {
  let c;
  try { c = await api('/customers/' + id); }
  catch (e) { return `<div class="empty">⚠️ ${esc(e.message)}</div>`; }
  const t = window.t;

  const conversations = c.conversations && c.conversations.length
    ? c.conversations.map((cv) => `
      <a class="nav-link" style="margin:0;border-radius:0;border-bottom:1px solid var(--surface-2)" href="/app/messages/${cv.id}" onclick="navigate('/app/messages/${cv.id}')">
        <span class="grow small">${esc((cv.messages && cv.messages[cv.messages.length-1] && cv.messages[cv.messages.length-1].body || '').slice(0,60))}</span>
        <span class="badge ${cv.ai_enabled?'badge-brand':'badge-gray'}">${cv.ai_enabled?'IA':'M'}</span>
      </a>`).join('')
    : emptyState('💬', t('Aucune conversation', 'لا توجد محادثات'));

  const devisList = c.devis && c.devis.length
    ? c.devis.map((d) => `<a class="nav-link" style="margin:0;border-radius:0;border-bottom:1px solid var(--surface-2)" href="/app/devis/${d.id}" onclick="navigate('/app/devis/${d.id}')"><span class="grow">${esc(d.number)}</span><span>${money(d.total)}</span>${statusBadge(d.status)}</a>`).join('')
    : emptyState('📄', t('Aucun devis', 'لا توجد'));

  const invList = c.invoices && c.invoices.length
    ? c.invoices.map((i) => `<a class="nav-link" style="margin:0;border-radius:0;border-bottom:1px solid var(--surface-2)" href="/app/factures/${i.id}" onclick="navigate('/app/factures/${i.id}')"><span class="grow">${esc(i.number)}</span><span>${money(i.total)}</span>${statusBadge(i.status)}</a>`).join('')
    : emptyState('🧾', t('Aucune facture', 'لا توجد'));

  return `
    <button class="btn btn-ghost btn-sm mb-12" onclick="navigate('/app/clients')">← ${t('Retour', 'رجوع')}</button>
    <div class="card" style="padding:18px">
      <div class="row between wrap">
        <div class="row gap-12">
          <span class="chat-avatar" style="width:56px;height:56px;font-size:22px">${esc((c.name||'C').charAt(0).toUpperCase())}</span>
          <div>
            <div class="bold" style="font-size:20px">${esc(c.name)}</div>
            <div class="muted">${esc(c.phone || '')} ${c.email ? '· ' + esc(c.email) : ''}</div>
            ${c.address ? `<div class="muted small">${esc(c.address)}</div>`:''}
          </div>
        </div>
        <div class="row gap-8 mt-8 wrap">
          <button class="btn btn-primary btn-sm" onclick="navigate('/app/devis/new')">📄 ${t('Nouveau Devis', 'عرض سعر جديد')}</button>
          <button class="btn btn-outline btn-sm" onclick="editClient()">✏️ ${t('Modifier', 'تعديل')}</button>
        </div>
      </div>
      ${c.notes ? `<div class="card" style="margin-top:12px;padding:12px;background:var(--amber-soft)"><div class="small">📝 ${esc(c.notes)}</div></div>`:''}
    </div>

    <div class="grid-2 mt-12" style="grid-template-columns:1fr">
      <div class="card"><div style="padding:14px 16px;border-bottom:1px solid var(--border)" class="bold">💬 ${t('Conversations', 'المحادثات')}</div>${conversations}</div>
    </div>
    <div class="grid-2 mt-12">
      <div class="card"><div style="padding:14px 16px;border-bottom:1px solid var(--border)" class="bold">📄 ${t('Devis', 'عروض الأسعار')}</div>${devisList}</div>
      <div class="card"><div style="padding:14px 16px;border-bottom:1px solid var(--border)" class="bold">🧾 ${t('Factures', 'الفواتير')}</div>${invList}</div>
    </div>
  `;
}

export async function after(id) {
  const cid = id;
  window.editClient = () => {
    window.openModal(`<h3>✏️ ${window.t('Modifier le client', 'تعديل الزبون')}</h3>
      <div class="field"><label>${window.t('Nom', 'الاسم')}</label><input id="n-name" class="input"></div>
      <div class="field"><label>${window.t('Téléphone', 'الهاتف')}</label><input id="n-phone" class="input"></div>
      <div class="field"><label>Email</label><input id="n-email" class="input"></div>
      <div class="field"><label>${window.t('Adresse', 'العنوان')}</label><input id="n-address" class="input"></div>
      <div class="field"><label>${window.t('Notes', 'ملاحظات')}</label><textarea id="n-notes" class="textarea"></textarea></div>
      <button class="btn btn-primary btn-block" onclick="submitEdit()">${window.t('Enregistrer', 'حفظ')}</button>
      <div style="margin-top:10px"><button class="btn btn-danger-ghost btn-block btn-sm" onclick="deleteClient()">${window.t('Supprimer', 'حذف')}</button></div>`);
    api('/customers/' + cid).then((c) => {
      document.getElementById('n-name').value = c.name || '';
      document.getElementById('n-phone').value = c.phone || '';
      document.getElementById('n-email').value = c.email || '';
      document.getElementById('n-address').value = c.address || '';
      document.getElementById('n-notes').value = c.notes || '';
    });
    window.submitEdit = async () => {
      const body = {
        name: document.getElementById('n-name').value.trim(),
        phone: document.getElementById('n-phone').value.trim(),
        email: document.getElementById('n-email').value.trim(),
        address: document.getElementById('n-address').value.trim(),
        notes: document.getElementById('n-notes').value.trim(),
      };
      try { await api('/customers/' + cid, { method: 'PUT', body }); toast('Enregistré'); closeModal(); navigate('/app/clients/' + cid); }
      catch (e) { toast(e.message, 'error'); }
    };
    window.deleteClient = async () => {
      if (!confirm('Supprimer ce client ?')) return;
      try { await api('/customers/' + cid, { method: 'DELETE' }); toast('Client supprimé.'); closeModal(); navigate('/app/clients'); }
      catch (e) { toast(e.message, 'error'); }
    };
  };
}
