// Dashboard view
export const title = () => window.t('Tableau de bord', 'لوحة القيادة');

export async function render() {
  let data;
  try {
    data = await api('/dashboard');
  } catch (e) {
    return `<div class="empty"><div class="emoji">📊</div><p><b>Impossible de charger le tableau de bord.</b></p><p class="small muted">${esc(e.message)}</p></div>`;
  }
  const t = window.t;
  const L = window.i18nMap;

  const quickActions = `
    <div class="grid-2" style="margin-bottom:18px">
      <button class="btn btn-primary btn-lg" onclick="navigate('/app/devis/new')">📄 ${t('Créer un Devis', 'إنشاء عرض سعر')}</button>
      <button class="btn btn-outline btn-lg" onclick="navigate('/app/factures/new')">🧾 ${t('Créer une Facture', 'إنشاء فاتورة')}</button>
    </div>`;

  const stats = `
    <div class="stat-grid">
      <div class="card stat-card">
        <div class="stat-label">💰 ${t("Ventes d'aujourd'hui", 'مبيعات اليوم')}</div>
        <div class="stat-value">${money(data.todaySales)}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">⏳ ${t('Factures non payées', 'فواتير غير مدفوعة')}</div>
        <div class="stat-value ${data.unpaid.count ? 'text-2' : ''}">${data.unpaid.count}</div>
        <div class="stat-sub">${money(data.unpaid.total)}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">🔴 ${t('Factures en retard', 'فواتير متأخرة')}</div>
        <div class="stat-value ${data.overdue.count ? '' : 'text-2'}">${data.overdue.count}</div>
        <div class="stat-sub">${money(data.overdue.total)}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">📄 ${t('Devis', 'عروض الأسعار')}</div>
        <div class="stat-value">${data.devis}</div>
        <div class="stat-sub">${data.acceptedDevis} ${t('acceptés', 'مقبولة')}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">🧾 ${t('Factures', 'الفواتير')}</div>
        <div class="stat-value">${data.invoices}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">👥 ${t('Clients', 'الزبائن')}</div>
        <div class="stat-value">${data.customers}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">🤖 ${t('Messages IA (7j)', 'رسائل الذكاء الاصطناعي')}</div>
        <div class="stat-value">${data.aiMessages}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">💬 ${t('Conversations', 'المحادثات')}</div>
        <div class="stat-value">${data.conversations}</div>
      </div>
    </div>`;

  const recentConvs = data.recentConversations && data.recentConversations.length
    ? data.recentConversations.map((c) => `
      <a class="nav-link" style="margin:0;border-radius:0;border-bottom:1px solid var(--surface-2)" href="/app/messages/${c.id}" onclick="navigate('/app/messages/${c.id}')">
        <span class="chat-avatar" style="width:36px;height:36px;font-size:14px">${esc((c.customer_name || 'C').charAt(0).toUpperCase())}</span>
        <span class="grow">
          <span class="bold small">${esc(c.customer_name || c.customer_phone || 'Client')}</span><br>
          <span class="muted" style="font-size:12px">${esc((c.last_message || '').slice(0, 40))}</span>
        </span>
        <span class="badge ${c.ai_enabled ? 'badge-brand' : 'badge-gray'}">${c.ai_enabled ? t('IA', 'ذكاء') : t('Manuel', 'يدوي')}</span>
      </a>`).join('')
    : emptyState('💬', t('Aucune conversation', 'لا توجد محادثات'), t('Vos échanges avec les clients apparaîtront ici.', 'تظهر محادثاتك مع الزبائن هنا.'));

  const recentCustomers = data.recentCustomers && data.recentCustomers.length
    ? data.recentCustomers.map((c) => `
      <a class="nav-link" style="margin:0;border-radius:0;border-bottom:1px solid var(--surface-2)" href="/app/clients/${c.id}" onclick="navigate('/app/clients/${c.id}')">
        <span class="grow bold small">${esc(c.name)}</span>
        <span class="muted small">${esc(c.phone || '')}</span>
      </a>`).join('')
    : emptyState('👥', t('Aucun client', 'لا يوجد زبائن'), t('Ajoutez vos premiers clients.', 'أضف أول زبائنك.'));

  const notifications = data.notifications && data.notifications.length
    ? data.notifications.map((n) => `
      <div style="padding:10px 14px;border-bottom:1px solid var(--surface-2)">
        <div class="bold small">${esc(n.title)}</div>
        <div class="muted small">${esc(n.body || '')}</div>
      </div>`).join('')
    : emptyState('🔔', t('Aucune notification', 'لا توجد إشعارات'));

  return `
    ${quickActions}
    ${stats}

    <div style="display:grid;gap:14px;margin-top:20px" class="grid-2">
      <div class="card">
        <div style="padding:14px 16px;border-bottom:1px solid var(--border)" class="bold">💬 ${t('Conversations récentes', 'أحدث المحادثات')}</div>
        ${recentConvs}
        <div style="padding:10px"><a class="btn btn-ghost btn-sm btn-block" href="/app/messages" onclick="navigate('/app/messages')">${t('Voir tout', 'عرض الكل')}</a></div>
      </div>
      <div>
        <div class="card" style="margin-bottom:14px">
          <div style="padding:14px 16px;border-bottom:1px solid var(--border)" class="bold">👥 ${t('Clients récents', 'أحدث الزبائن')}</div>
          ${recentCustomers}
          <div style="padding:10px"><a class="btn btn-ghost btn-sm btn-block" href="/app/clients" onclick="navigate('/app/clients')">${t('Voir tout', 'عرض الكل')}</a></div>
        </div>
        <div class="card">
          <div style="padding:14px 16px;border-bottom:1px solid var(--border)" class="bold">🔔 ${t('Notifications', 'الإشعارات')}</div>
          ${notifications}
        </div>
      </div>
    </div>

    <div class="card mt-20" style="padding:16px">
      <div class="bold">🤖 ${t('Assistant IA', 'المساعد الذكي')} — ${t('état', 'الحالة')}: ${data.business ? '🚀' : ''}</div>
      <p class="small muted">${t('L\'IA répond à vos clients en Darija/Français, comprend les demandes de prix et prépare les devis. Configurez votre catalogue et vos prix pour qu\'elle réponde avec vos vrais tarifs.', 'يجيب الذكاء الاصطناعي على زبائنك بالدارجة والفرنسية، يفهم طلبات الأسعار ويحضر عروض الأسعار. اضبط قائمة منتجاتك وأسعارك ليجيب بأثمانك الحقيقية.')}</p>
      <a class="btn btn-outline btn-sm" href="/app/assistant" onclick="navigate('/app/assistant')">${t('Configurer l\'assistant', 'اضبط المساعد')}</a>
    </div>
  `;
}
