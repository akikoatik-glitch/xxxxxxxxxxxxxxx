// Factures list
export const title = () => window.t('Factures', 'الفواتير');

export async function render() {
  const status = new URLSearchParams(location.search).get('status') || '';
  let rows;
  try { rows = await api('/invoices' + (status ? '?status=' + status : '')); }
  catch (e) { return `<div class="empty">⚠️ ${esc(e.message)}</div>`; }
  const t = window.t;

  const filters = ['', 'paid', 'unpaid', 'overdue'].map((s) => {
    const label = { '': t('Toutes', 'الكل'), paid: t('Payées', 'مدفوعة'), unpaid: t('Non payées', 'غير مدفوعة'), overdue: t('En retard', 'متأخرة') }[s];
    return `<button class="btn ${status === s ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="location.href='/app/factures${s ? '?status=' + s : ''}'">${esc(label)}</button>`;
  }).join('');

  if (!rows.length) {
    return `
      <div class="row gap-8 mb-12 wrap">${filters}</div>
      <div class="card" style="padding:24px;text-align:center">
        <div class="emoji" style="font-size:44px">🧾</div>
        <h3>${t('Aucune facture', 'لا توجد فواتير')}</h3>
        <p class="muted">${t('Créez une facture ou convertissez un Devis accepté.', 'أنشئ فاتورة أو حوّل عرض سعر مقبولاً.')}</p>
        <div class="row gap-8 mt-12" style="justify-content:center">
          <button class="btn btn-primary" onclick="navigate('/app/factures/new')">🧾 ${t('Nouvelle facture', 'فاتورة جديدة')}</button>
          <button class="btn btn-outline" onclick="navigate('/app/devis')">📄 ${t('Depuis un Devis', 'من عرض سعر')}</button>
        </div>
      </div>`;
  }

  const items = rows.map((f) => `
    <a class="nav-link" style="margin:0;border-radius:0;border-bottom:1px solid var(--surface-2);gap:12px" href="/app/factures/${f.id}" onclick="navigate('/app/factures/${f.id}')">
      <div class="grow">
        <span class="bold">${esc(f.number)}</span><br>
        <span class="muted small">${esc(f.customer_name || (f.customer && f.customer.name) || t('Client', 'زبون'))}</span>
      </div>
      ${f.status === 'paid' ? `<span class="small">${t('Payé', 'مدفوع')}</span>` : `<span class="bold">${money(f.total - f.paid_amount)}</span>`}
      ${statusBadge(f.status)}
      <span class="small muted">${esc((f.created_at||'').slice(0,10))}</span>
    </a>`).join('');

  return `
    <div class="row between wrap mb-12">
      <div class="row gap-8 wrap">${filters}</div>
      <button class="btn btn-primary" onclick="navigate('/app/factures/new')">+ ${t('Nouvelle', 'جديدة')}</button>
    </div>
    <div class="card" style="overflow:hidden">${items}</div>
  `;
}
