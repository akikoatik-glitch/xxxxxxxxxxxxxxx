// Plan / billing view
export const title = () => window.t('Mon offre', 'اشتراكي');

export async function render() {
  let d;
  try { d = await api('/plan'); }
  catch (e) { return `<div class="empty">⚠️ ${esc(e.message)}</div>`; }
  const t = window.t;
  const current = d.plan;

  function planCard(key) {
    const p = d.plans[key];
    const active = key === current;
    return `
      <div class="card" style="padding:20px;${active ? 'border-color:var(--brand);box-shadow:0 0 0 2px var(--brand-soft)' : ''}">
        <div class="between row"><b>${esc(p.label)}</b>${active ? `<span class="badge badge-brand">${t('Actuel', 'الحالي')}</span>`:''}</div>
        <div class="bold" style="font-size:26px;margin:10px 0">${p.price_monthly === 0 ? t('Gratuit', 'مجاني') : money(p.price_monthly) + '/mois'}</div>
        <ul class="small" style="padding-left:16px;line-height:1.9">
          <li>${p.max_devis === -1 ? t('Devis illimités', 'عروض أسعار غير محدودة') : p.max_devis + ' ' + t('devis', 'عروض')}</li>
          <li>${p.max_invoices === -1 ? t('Factures illimitées', 'فواتير غير محدودة') : p.max_invoices + ' ' + t('factures', 'فواتير')}</li>
          <li>${p.ai_assistant ? `${t('Assistant IA', 'مساعد ذكي')} (${p.max_ai_messages_per_month === -1 ? t('illimité', 'غير محدود') : p.max_ai_messages_per_month + '/mois'})` : '-'}</li>
          <li>${p.pdf ? t('PDF professionnels', 'PDF احترافية') : '-'}</li>
          <li>${p.whatsapp ? t('Automatisation WhatsApp', 'أتمتة واتساب') : '-'}</li>
          <li>${p.reminders ? t('Rappels automatiques', 'تذكيرات تلقائية') : '-'}</li>
        </ul>
      </div>`;
  }

  return `
    <div class="bold mb-12">💎 ${t('Mon offre', 'اشتراكي')}</div>
    <div class="card" style="padding:16px;margin-bottom:14px">
      <div class="between row wrap">
        <div><b>${t('Statut', 'الحالة')}:</b> <span class="badge ${current==='pro'?'badge-brand':'badge-gray'}">${esc(d.plans[current].label)}</span></div>
        <div class="small muted">${t('Devis utilisés', 'عروض السعر المستخدمة')}: ${d.usage.devis} / ${d.limits.max_devis===-1?'∞':d.limits.max_devis} · ${t('Factures', 'فواتير')}: ${d.usage.invoices} / ${d.limits.max_invoices===-1?'∞':d.limits.max_invoices}</div>
      </div>
    </div>
    <div class="grid-2">
      ${planCard('free')}
      ${planCard('pro')}
    </div>
    <div class="card mt-12" style="padding:16px;background:var(--amber-soft)">
      <b class="small">⚠️ ${t('La souscription en ligne sera activée via un paiement réel (Chargily/CINTER). Aucun paiement simulé ici.', 'سيتم تفعيل الاشتراك عبر دفع حقيقي (Chargily/CINTER). لا يوجد دفع محاكى هنا.')}</b>
    </div>
  `;
}
