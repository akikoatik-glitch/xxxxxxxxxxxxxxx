export default async function () {
  const platforms = await API.fetch('/api/integrations');
  const platformMeta = {
    whatsapp: { name: 'WhatsApp', icon: 'W', bg: '#25D366', desc: 'Cloud API — Messages et documents automatiques', fields: ['token', 'phoneId', 'verifyToken'] },
    instagram: { name: 'Instagram', icon: 'IG', bg: 'linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)', desc: 'DM — Réponses aux messages privés', fields: ['token', 'verifyToken'] },
    facebook: { name: 'Facebook Messenger', icon: 'f', bg: '#1877F2', desc: 'Page Messenger — Conversations client', fields: ['pageToken', 'verifyToken'] },
    telegram: { name: 'Telegram', icon: 'T', bg: '#0088CC', desc: 'Bot — Messages et documents', fields: ['token'] },
  };
  const fieldLabels = { token: 'API Token', phoneId: 'Phone Number ID', verifyToken: 'Verify Token', pageToken: 'Page Access Token' };

  return {
    html: `
      <div class="section-header">
        <div><h1 class="section-title">Connecter des plateformes</h1><p class="section-subtitle">Configurez vos intégrations de messagerie</p></div>
      </div>
      <div class="platform-grid">
        ${platforms.map(p => {
          const m = platformMeta[p.type] || {};
          const config = JSON.parse(p.config || '{}');
          return `
            <div class="card platform-card">
              <div class="platform-icon-lg" style="background:${m.bg}">${m.icon}</div>
              <div class="platform-details">
                <h3>${m.name}</h3>
                <p>${m.desc}</p>
                <span class="badge ${p.connected ? 'badge-connected' : 'badge-disconnected'}">${p.connected ? '✅ Connecté' : '❌ Déconnecté'}</span>
                ${p.message_count > 0 ? `<span style="font-size:12px;color:var(--gray);margin-left:8px">${p.message_count} messages</span>` : ''}
                <div class="platform-actions" style="margin-top:12px">
                  <button class="btn btn-outline btn-sm configure-platform" data-type="${p.type}">⚙️ Configurer</button>
                  ${p.connected ? `<button class="btn btn-sm disconnect-platform" data-type="${p.type}" style="color:var(--red)">Déconnecter</button>` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div id="configModal" style="display:none;position:fixed;inset:0;z-index:100;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);backdrop-filter:blur(4px)">
        <div class="card" style="width:500px;max-width:90vw;padding:32px">
          <h2 style="font-size:18px;margin-bottom:20px" id="configTitle">Configurer</h2>
          <form id="configForm">
            <input type="hidden" id="cfgType">
            <div id="configFields"></div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
              <button type="button" class="btn btn-outline" id="closeConfig">Annuler</button>
              <button type="submit" class="btn btn-primary">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>
    `,
    init(root) {
      const modal = root.querySelector('#configModal');
      const fieldsDiv = root.querySelector('#configFields');
      const form = root.querySelector('#configForm');

      root.querySelectorAll('.configure-platform').forEach(btn => {
        btn.addEventListener('click', async () => {
          const type = btn.dataset.type;
          const m = platformMeta[type];
          root.querySelector('#cfgType').value = type;
          root.querySelector('#configTitle').textContent = `Configurer ${m.name}`;
          let configData = {};
          try {
            const plats = await API.fetch('/api/integrations');
            const p = plats.find(x => x.type === type);
            if (p) configData = JSON.parse(p.config || '{}');
          } catch {}
          fieldsDiv.innerHTML = m.fields.map(f => `
            <div class="form-group">
              <label>${fieldLabels[f] || f}</label>
              <input class="form-input" name="${f}" value="${configData[f] || ''}" placeholder="${fieldLabels[f] || f}">
            </div>
          `).join('');
          modal.style.display = 'flex';
        });
      });

      root.querySelectorAll('.disconnect-platform').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Déconnecter cette plateforme ?')) return;
          await API.fetch(`/api/integrations/${btn.dataset.type}`, {
            method: 'PUT', body: JSON.stringify({ connected: false })
          });
          window.location.reload();
        });
      });

      root.querySelector('#closeConfig').addEventListener('click', () => modal.style.display = 'none');
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = root.querySelector('#cfgType').value;
        const config = {};
        const inputs = fieldsDiv.querySelectorAll('input');
        inputs.forEach(i => { config[i.name] = i.value; });
        await API.fetch(`/api/integrations/${type}`, {
          method: 'PUT', body: JSON.stringify({ config, connected: true })
        });
        modal.style.display = 'none';
        window.location.reload();
      });
    },
  };
}
