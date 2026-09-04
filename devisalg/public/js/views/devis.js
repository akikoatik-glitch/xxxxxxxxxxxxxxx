// Devis list view
export const title = () => window.t('Devis', 'عروض الأسعار');

export async function render() {
  let rows;
  try { rows = await api('/devis'); }
  catch (e) { return `<div class="empty">⚠️ ${esc(e.message)}</div>`; }
  const t = window.t;

  if (!rows.length) {
    return `
      <div class="card" style="padding:24px;text-align:center">
        <div class="emoji" style="font-size:44px">📄</div>
        <h3>${t('Aucun devis', 'لا توجد عروض أسعار')}</h3>
        <p class="muted">${t('Créez votre premier devis professionnel en quelques secondes.', 'أنشئ أول عرض سعر احترافي في ثوانٍ.')}</p>
        <button class="btn btn-primary btn-lg mt-12" onclick="navigate('/app/devis/new')">📄 ${t('Créer un Devis', 'إنشاء عرض سعر')}</button>
      </div>`;
  }

  const items = rows.map((d) => `
    <a class="nav-link" style="margin:0;border-radius:0;border-bottom:1px solid var(--surface-2);gap:12px" href="/app/devis/${d.id}" onclick="navigate('/app/devis/${d.id}')">
      <div class="grow">
        <span class="bold">${esc(d.number)}</span>
        <span class="muted small" style="display:block">${esc(d.customer_name || (d.customer && d.customer.name) || t('Client', 'زبون'))}</span>
      </div>
      <span class="bold">${money(d.total)}</span>
      ${statusBadge(d.status)}
      <span class="small muted">${esc((d.created_at || '').slice(0,10))}</span>
    </a>`).join('');

  return `
    <div class="row between mb-12">
      <span class="bold">${t('Tous les devis', 'جميع عروض الأسعار')} (${rows.length})</span>
      <button class="btn btn-primary" onclick="navigate('/app/devis/new')">+ ${t('Nouveau', 'جديد')}</button>
    </div>
    <div class="card" style="overflow:hidden">${items || emptyState('📄', t('Aucun devis', 'لا توجد'))}</div>
  `;
}
