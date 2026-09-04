export default async function () {
  const convs = await API.fetch('/api/conversations');
  const grouped = { whatsapp: [], instagram: [], facebook: [], telegram: [] };
  convs.forEach(c => { if (grouped[c.platform]) grouped[c.platform].push(c); });

  return `
    <div class="section-header">
      <div><h1 class="section-title">Boîte de réception</h1><p class="section-subtitle">${convs.length} conversation(s)</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <select class="form-select" id="platformFilter" style="width:auto">
          <option value="">Toutes les plateformes</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="telegram">Telegram</option>
        </select>
      </div>
    </div>
    <div class="conv-layout" style="height:calc(100vh - 180px)">
      <div class="conv-list" id="convList">
        ${convs.length === 0 ? '<div class="empty-state" style="padding:40px"><div class="empty-icon">📬</div><h3>Aucune conversation</h3><p>Les messages de vos clients apparaîtront ici</p></div>' : ''}
        ${convs.map(c => `
          <div class="conv-item" data-id="${c.id}" data-navigate="/app/conversation/${c.id}">
            <div class="conv-avatar" style="background:${platformColor(c.platform)}">
              ${(c.customer_name || 'C')[0].toUpperCase()}
            </div>
            <div class="conv-info">
              <div class="conv-name">${c.customer_name || 'Client'}</div>
              <div class="conv-preview">${platformLabel(c.platform)} · ${statusLabel(c.status)}</div>
            </div>
            <div class="conv-meta">
              <span class="conv-time">${timeAgo(c.updated_at)}</span>
              <span class="badge badge-sm ${c.ai_mode ? 'badge-active' : 'badge-paused'}">${c.ai_mode ? 'IA' : '👤'}</span>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="conv-main hidden" id="convMain">
        <div class="empty-state"><div class="empty-icon">💬</div><h3>Sélectionnez une conversation</h3></div>
      </div>
    </div>
  `;
}
