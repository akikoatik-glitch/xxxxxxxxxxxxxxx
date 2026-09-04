export default async function () {
  const d = await API.fetch('/api/dashboard');
  const biz = API.business;
  const currency = biz.currency || 'DA';

  return `
    <div class="section-header">
      <div><h1 class="section-title">Aperçu</h1><p class="section-subtitle">Tableau de bord — ${biz.name}</p></div>
    </div>

    <div class="grid grid-4" style="margin-bottom:24px">
      <div class="card stat-card glass">
        <div class="stat-aura"></div>
        <div class="stat-icon">💬</div>
        <div class="stat-value">${d.activeConversations}</div>
        <div class="stat-label">Conversations actives</div>
      </div>
      <div class="card stat-card glass">
        <div class="stat-aura" style="background:rgba(34,197,94,0.08)"></div>
        <div class="stat-icon">📦</div>
        <div class="stat-value">${d.totalOrders}</div>
        <div class="stat-label">Total commandes</div>
      </div>
      <div class="card stat-card glass">
        <div class="stat-aura" style="background:rgba(139,92,246,0.08)"></div>
        <div class="stat-icon">💰</div>
        <div class="stat-value">${money(d.revenue, currency)}</div>
        <div class="stat-label">Revenu total</div>
      </div>
      <div class="card stat-card glass">
        <div class="stat-aura" style="background:rgba(245,158,11,0.08)"></div>
        <div class="stat-icon">👥</div>
        <div class="stat-value">${d.totalCustomers}</div>
        <div class="stat-label">Clients</div>
      </div>
    </div>

    <div class="grid grid-4" style="margin-bottom:32px">
      <div class="card" style="padding:16px">
        <div style="font-size:13px;color:var(--gray)">Aujourd'hui</div>
        <div style="font-size:22px;font-weight:700;font-family:Outfit,sans-serif">${d.ordersToday} commandes</div>
      </div>
      <div class="card" style="padding:16px">
        <div style="font-size:13px;color:var(--gray)">Cette semaine</div>
        <div style="font-size:22px;font-weight:700;font-family:Outfit,sans-serif">${d.ordersWeek} commandes</div>
      </div>
      <div class="card" style="padding:16px">
        <div style="font-size:13px;color:var(--gray)">Ce mois</div>
        <div style="font-size:22px;font-weight:700;font-family:Outfit,sans-serif">${money(d.revenueMonth, currency)}</div>
      </div>
      <div class="card" style="padding:16px">
        <div style="font-size:13px;color:var(--gray)">En attente</div>
        <div style="font-size:22px;font-weight:700;font-family:Outfit,sans-serif;color:var(--orange)">${d.pendingOrders}</div>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="font-size:16px">🤖 Performance IA</h3>
        </div>
        <div class="grid grid-3" style="gap:12px">
          <div style="text-align:center;padding:12px;background:var(--bg);border-radius:12px">
            <div style="font-size:28px;font-weight:800;font-family:Outfit;color:var(--blue)">${d.aiStats.responseRate}%</div>
            <div style="font-size:12px;color:var(--gray)">Taux de réponse</div>
          </div>
          <div style="text-align:center;padding:12px;background:var(--bg);border-radius:12px">
            <div style="font-size:28px;font-weight:800;font-family:Outfit">${d.aiStats.aiResponses}</div>
            <div style="font-size:12px;color:var(--gray)">Réponses IA</div>
          </div>
          <div style="text-align:center;padding:12px;background:var(--bg);border-radius:12px">
            <div style="font-size:28px;font-weight:800;font-family:Outfit">${d.aiEnabledConversations}</div>
            <div style="font-size:12px;color:var(--gray)">IA activée</div>
          </div>
        </div>
        <div style="margin-top:16px">
          <div style="font-size:13px;color:var(--gray);margin-bottom:8px">Plateformes</div>
          ${d.platformStats.map(p => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:14px;font-weight:500">${platformLabel(p.type)}</span>
              <span>
                <span class="badge ${p.connected ? 'badge-connected' : 'badge-disconnected'}">${p.connected ? 'Connecté' : 'Déconnecté'}</span>
                <span style="font-size:12px;color:var(--gray);margin-left:8px">${p.message_count} msg</span>
              </span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="font-size:16px">Commandes récentes</h3>
          <a class="btn-ghost btn-sm" data-navigate="/app/orders">Voir tout →</a>
        </div>
        ${d.recentOrders.length === 0 ? '<p style="color:var(--gray);font-size:14px;text-align:center;padding:24px">Aucune commande pour le moment</p>' : ''}
        ${d.recentOrders.map(o => `
          <div class="conv-item" data-navigate="/app/order/${o.id}" style="cursor:pointer">
            <div style="flex:1">
              <div style="font-size:14px;font-weight:600">${o.number}</div>
              <div style="font-size:12px;color:var(--gray)">${o.customer_name || 'Client'}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:14px;font-weight:600">${money(o.total, currency)}</div>
              <span class="badge ${badgeClass(o.status)}">${statusLabel(o.status)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
