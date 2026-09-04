export default async function () {
  const aiSettings = await API.fetch('/api/ai-settings');
  const biz = await API.fetch('/api/business');

  return {
    html: `
      <div class="section-header">
        <div><h1 class="section-title">Paramètres IA & Business</h1><p class="section-subtitle">Configurez votre agent intelligent et votre entreprise</p></div>
      </div>
      <div class="tabs" id="settingsTabs">
        <button class="tab active" data-tab="ai">🤖 Agent IA</button>
        <button class="tab" data-tab="business">🏢 Business</button>
        <button class="tab" data-tab="test">🧪 Tester l'IA</button>
      </div>
      <div id="tab-ai" class="tab-panel">
        <div class="card">
          <form id="aiForm">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
              <div>
                <h3 style="font-size:16px">Agent IA</h3>
                <p style="font-size:13px;color:var(--gray)">Activez ou désactivez l'assistant automatique</p>
              </div>
              <button type="button" class="toggle ${aiSettings.enabled ? 'on' : ''}" id="aiToggle"></button>
            </div>
            <input type="hidden" id="aiEnabled" value="${aiSettings.enabled ? '1' : '0'}">
            <div class="form-group">
              <label>Langue par défaut</label>
              <select class="form-select" id="aiLang">
                <option value="auto" ${aiSettings.language === 'auto' ? 'selected' : ''}>Automatique</option>
                <option value="fr" ${aiSettings.language === 'fr' ? 'selected' : ''}>Français</option>
                <option value="ar" ${aiSettings.language === 'ar' ? 'selected' : ''}>Arabe</option>
                <option value="en" ${aiSettings.language === 'en' ? 'selected' : ''}>Anglais</option>
              </select>
            </div>
            <div class="form-group">
              <label>Message d'accueil personnalisé</label>
              <textarea class="form-textarea" id="aiGreeting" rows="3">${aiSettings.greeting || ''}</textarea>
            </div>
            <div class="form-group">
              <label>Personnalité de l'IA</label>
              <textarea class="form-textarea" id="aiPersonality" rows="3">${aiSettings.personality || ''}</textarea>
            </div>
            <div class="form-group">
              <label>Instructions personnalisées</label>
              <textarea class="form-textarea" id="aiInstructions" rows="4">${aiSettings.custom_instructions || ''}</textarea>
            </div>
            <div class="form-group">
              <label>Mots-clés d'escalade (séparés par virgule)</label>
              <input class="form-input" id="aiEscalation" value='${JSON.parse(aiSettings.escalation_keywords || '[]').join(', ')}'>
            </div>
            <div class="form-group">
              <label>FAQ (une paire par ligne : question | réponse)</label>
              <textarea class="form-textarea" id="aiFaqs" rows="6">${JSON.parse(aiSettings.faqs || '[]').map(f => f.q + ' | ' + f.a).join('\n')}</textarea>
            </div>
            <button type="submit" class="btn btn-primary">Enregistrer les paramètres IA</button>
          </form>
        </div>
      </div>
      <div id="tab-business" class="tab-panel" style="display:none">
        <div class="card">
          <form id="bizForm">
            <h3 style="font-size:16px;margin-bottom:20px">Informations du business</h3>
            <div class="form-group"><label>Nom</label><input class="form-input" id="bizName" value="${biz.name || ''}"></div>
            <div class="form-group"><label>Description</label><textarea class="form-textarea" id="bizDesc">${biz.description || ''}</textarea></div>
            <div class="grid grid-2">
              <div class="form-group"><label>Téléphone</label><input class="form-input" id="bizPhone" value="${biz.phone || ''}"></div>
              <div class="form-group"><label>Email</label><input class="form-input" id="bizEmail" value="${biz.email || ''}"></div>
            </div>
            <div class="form-group"><label>Adresse</label><input class="form-input" id="bizAddress" value="${biz.address || ''}"></div>
            <div class="form-group"><label>Horaires d'ouverture</label><input class="form-input" id="bizHours" value="${biz.opening_hours || ''}"></div>
            <div class="form-group"><label>Informations de livraison</label><textarea class="form-textarea" id="bizDelivery">${biz.delivery_info || ''}</textarea></div>
            <div class="form-group"><label>Devise</label><input class="form-input" id="bizCurrency" value="${biz.currency || 'DZD'}"></div>
            <div class="form-group"><label>Methods de paiement (JSON)</label><input class="form-input" id="bizPayment" value='${biz.payment_methods || '[]'}'></div>
            <button type="submit" class="btn btn-primary">Enregistrer le business</button>
          </form>
        </div>
      </div>
      <div id="tab-test" class="tab-panel" style="display:none">
        <div class="card">
          <h3 style="font-size:16px;margin-bottom:16px">🧪 Tester votre agent IA</h3>
          <p style="font-size:13px;color:var(--gray);margin-bottom:20px">Envoyez un message test pour voir comment l'IA répond.</p>
          <div id="testChat" style="min-height:200px;border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;max-height:400px;overflow-y:auto;background:var(--bg)">
            <div style="color:var(--gray);text-align:center;padding:24px">Envoyez un message pour tester…</div>
          </div>
          <div style="display:flex;gap:8px">
            <input class="form-input" id="testInput" placeholder="Bonjour, je veux commander…" style="flex:1">
            <button class="btn btn-primary" id="testSend">Envoyer</button>
          </div>
        </div>
      </div>
    `,
    init(root) {
      const tabs = root.querySelectorAll('.tab');
      const panels = root.querySelectorAll('.tab-panel');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('active'));
          panels.forEach(p => p.style.display = 'none');
          tab.classList.add('active');
          const panel = root.querySelector('#tab-' + tab.dataset.tab);
          if (panel) panel.style.display = '';
        });
      });

      const aiToggle = root.querySelector('#aiToggle');
      const aiEnabled = root.querySelector('#aiEnabled');
      aiToggle.addEventListener('click', () => {
        aiToggle.classList.toggle('on');
        aiEnabled.value = aiToggle.classList.contains('on') ? '1' : '0';
      });

      root.querySelector('#aiForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const faqLines = root.querySelector('#aiFaqs').value.split('\n').filter(l => l.includes('|')).map(l => {
          const [q, ...a] = l.split('|');
          return { q: q.trim(), a: a.join('|').trim() };
        });
        const esc = root.querySelector('#aiEscalation').value.split(',').map(s => s.trim()).filter(Boolean);
        await API.fetch('/api/ai-settings', {
          method: 'PUT',
          body: JSON.stringify({
            enabled: aiEnabled.value === '1',
            language: root.querySelector('#aiLang').value,
            greeting: root.querySelector('#aiGreeting').value,
            personality: root.querySelector('#aiPersonality').value,
            custom_instructions: root.querySelector('#aiInstructions').value,
            escalation_keywords: esc,
            faqs: faqLines,
          }),
        });
        alert('Paramètres IA enregistrés !');
      });

      root.querySelector('#bizForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await API.fetch('/api/business', {
          method: 'PUT',
          body: JSON.stringify({
            name: root.querySelector('#bizName').value,
            description: root.querySelector('#bizDesc').value,
            phone: root.querySelector('#bizPhone').value,
            email: root.querySelector('#bizEmail').value,
            address: root.querySelector('#bizAddress').value,
            opening_hours: root.querySelector('#bizHours').value,
            delivery_info: root.querySelector('#bizDelivery').value,
            currency: root.querySelector('#bizCurrency').value,
            payment_methods: root.querySelector('#bizPayment').value,
          }),
        });
        alert('Business enregistré !');
      });

      const testChat = root.querySelector('#testChat');
      const testInput = root.querySelector('#testInput');
      const testSend = root.querySelector('#testSend');

      async function sendTest() {
        const text = testInput.value.trim();
        if (!text) return;
        testInput.value = '';
        if (testChat.querySelector('[style*="text-align:center"]')) testChat.innerHTML = '';
        testChat.innerHTML += `<div class="msg msg-customer" style="margin-bottom:8px;padding:8px 12px;border-radius:10px;background:#F3F4F6;font-size:13px"><strong>Vous :</strong> ${text}</div>`;
        testChat.innerHTML += `<div class="msg" style="margin-bottom:8px;padding:8px 12px;border-radius:10px;background:rgba(0,132,255,0.06);font-size:13px"><strong>🤖 IA :</strong> <span id="testPending">En cours…</span></div>`;
        testChat.scrollTop = testChat.scrollHeight;
        try {
          const res = await API.fetch('/api/ai-settings/test', { method: 'POST', body: JSON.stringify({ message: text }) });
          const pending = testChat.querySelector('#testPending');
          if (pending) pending.textContent = res.result || 'Pas de réponse.';
        } catch (e) {
          const pending = testChat.querySelector('#testPending');
          if (pending) pending.textContent = 'Erreur: ' + e.message;
        }
        testChat.scrollTop = testChat.scrollHeight;
      }

      testSend.addEventListener('click', sendTest);
      testInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendTest(); });
    },
  };
}
