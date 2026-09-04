export default async function (params) {
  const data = await API.fetch(`/api/conversations/${params.id}`);
  const conv = data;
  const messages = data.messages || [];
  const currency = API.business.currency || 'DA';

  return {
    html: `
      <div class="section-header">
        <div>
          <h1 class="section-title" style="font-size:18px;display:flex;align-items:center;gap:8px">
            <a class="btn-ghost" data-navigate="/app/inbox" style="padding:4px 8px">←</a>
            ${conv.customer_name || 'Client'}
            <span class="badge badge-sm ${badgeClass(conv.status)}">${statusLabel(conv.status)}</span>
            <span class="badge badge-sm ${conv.ai_mode ? 'badge-active' : 'badge-closed'}">${conv.ai_mode ? '🤖 IA active' : '👤 Humain'}</span>
          </h1>
          <p class="section-subtitle">${platformLabel(conv.platform)} · Créé ${timeAgo(conv.created_at)}</p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" id="toggleAI">${conv.ai_mode ? 'Désactiver IA' : 'Activer IA'}</button>
          <select class="form-select" id="statusSelect" style="width:auto;padding:6px 12px;font-size:13px">
            <option value="active" ${conv.status === 'active' ? 'selected' : ''}>Actif</option>
            <option value="paused" ${conv.status === 'paused' ? 'selected' : ''}>En pause</option>
            <option value="closed" ${conv.status === 'closed' ? 'selected' : ''}>Fermé</option>
          </select>
        </div>
      </div>
      <div class="conv-layout" style="height:calc(100vh - 160px)">
        <div class="conv-list" id="convInfoPanel" style="padding:20px;overflow-y:auto">
          <h3 style="font-size:14px;margin-bottom:12px">Informations client</h3>
          <div style="font-size:13px;color:var(--gray);display:flex;flex-direction:column;gap:8px">
            <div>👤 <strong>${conv.customer_name || '—'}</strong></div>
            <div>📞 ${conv.customer_phone || '—'}</div>
            <div>📧 ${conv.customer_email || '—'}</div>
            <div>📍 ${conv.customer_address || '—'}</div>
            <div>🏙 ${conv.customer_wilaya || '—'}</div>
          </div>
          ${conv.order_id ? `
            <div style="margin-top:16px;padding:12px;background:rgba(0,132,255,0.06);border-radius:12px">
              <div style="font-size:13px;font-weight:600">📦 Commande liée</div>
              <a data-navigate="/app/order/${conv.order_id}" style="font-size:14px;color:var(--blue);font-weight:600;cursor:pointer">Voir la commande →</a>
            </div>
          ` : ''}
        </div>
        <div class="conv-main">
          <div class="conv-messages" id="msgList">
            ${messages.map(m => `
              <div class="msg msg-${m.sender}">
                <div style="font-size:10px;opacity:0.6;margin-bottom:2px">${m.sender === 'customer' ? (conv.customer_name || 'Client') : m.sender === 'ai' ? '🤖 Assist.' : m.sender === 'owner' ? '👤 Vous' : '⚙️ Système'}</div>
                ${m.body}
              </div>
            `).join('')}
            ${messages.length === 0 ? '<div class="empty-state" style="padding:40px"><p>Aucun message</p></div>' : ''}
          </div>
          <div class="conv-input-bar">
            <input class="conv-input" id="msgInput" placeholder="Tapez votre message…" autocomplete="off">
            <button class="btn btn-primary btn-sm" id="sendBtn">Envoyer</button>
          </div>
        </div>
      </div>
    `,
    init(root) {
      const msgList = root.querySelector('#msgList');
      const msgInput = root.querySelector('#msgInput');
      const sendBtn = root.querySelector('#sendBtn');
      const toggleAI = root.querySelector('#toggleAI');
      const statusSelect = root.querySelector('#statusSelect');

      msgList.scrollTop = msgList.scrollHeight;

      async function sendMessage() {
        const text = msgInput.value.trim();
        if (!text) return;
        msgInput.value = '';
        const msgEl = document.createElement('div');
        msgEl.className = 'msg msg-owner';
        msgEl.innerHTML = `<div style="font-size:10px;opacity:0.6;margin-bottom:2px">👤 Vous</div>${text}`;
        msgList.appendChild(msgEl);
        msgList.scrollTop = msgList.scrollHeight;
        try {
          await API.fetch(`/api/conversations/${params.id}/send`, { method: 'POST', body: JSON.stringify({ body: text }) });
        } catch (e) { console.error(e); }
      }

      sendBtn.addEventListener('click', sendMessage);
      msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });

      toggleAI.addEventListener('click', async () => {
        const currentMode = toggleAI.textContent.includes('Désactiver') ? false : true;
        const newMode = !currentMode;
        await API.fetch(`/api/conversations/${params.id}/ai-mode`, { method: 'PATCH', body: JSON.stringify({ enabled: newMode }) });
        toggleAI.textContent = newMode ? 'Désactiver IA' : 'Activer IA';
      });

      statusSelect.addEventListener('change', async () => {
        await API.fetch(`/api/conversations/${params.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: statusSelect.value }) });
      });
    },
  };
}
