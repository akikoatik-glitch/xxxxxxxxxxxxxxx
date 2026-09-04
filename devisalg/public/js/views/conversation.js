// Conversation detail (WhatsApp-style chat)
export const title = () => window.t('Conversation', 'محادثة');

export async function render(id) {
  let data;
  try { data = await api('/conversations/' + id); }
  catch (e) { return `<div class="empty">⚠️ ${esc(e.message)}</div>`; }
  const t = window.t;

  const bubbles = data.messages.map((m) => {
    const align = m.sender === 'customer' ? 'right' : (m.sender === 'system' ? 'system' : 'left');
    const senderLabel = {
      customer: data.customer ? data.customer.name : t('Client', 'زبون'),
      ai: '🤖 IA',
      owner: t('Vous', 'أنت'),
      system: 'Système',
    }[m.sender] || m.sender;
    return `
      <div class="msg-row ${align}">
        <div>
          <div class="bubble">${esc(m.body)}</div>
          <div class="msg-meta">${esc(senderLabel)} · ${esc((m.created_at || '').slice(0, 16))}</div>
        </div>
      </div>`;
  }).join('');

  const aiMode = data.ai_enabled ? t('IA activée', 'الذكاء مفعّل') : t('IA en pause', 'الذكاء متوقف');

  return `
    <div class="chat-container">
      <div class="chat-header">
        <span class="chat-avatar">${esc((data.customer ? data.customer.name : 'C').charAt(0).toUpperCase())}</span>
        <div class="grow">
          <div class="bold">${esc(data.customer ? data.customer.name : t('Client', 'زبون'))}</div>
          <div class="small muted">${esc((data.customer && data.customer.phone) || '')} · ${esc(aiMode)}</div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="toggleAi()">${data.ai_enabled ? t('Pause IA', 'إيقاف الذكاء') : t('Reprendre IA', 'تشغيل الذكاء')}</button>
      </div>

      <div class="only-owner-control">
        <button class="btn btn-primary btn-sm" onclick="createDevisFromConversation()">📄 ${t('Créer un Devis depuis cette conversation', 'إنشاء عرض سعر من هذه المحادثة')}</button>
        <button class="btn btn-outline btn-sm" onclick="openClient()">👤 ${t('Voir client', 'عرض الزبون')}</button>
      </div>

      <div class="chat-messages" id="chat-scroll">${bubbles}</div>

      <div class="chat-input">
        <div class="row">
          <input id="owner-msg" class="input" placeholder="${t('Écrivez un message… (ce message sera envoyé au client via WhatsApp si connecté)', 'اكتب رسالة… (ستُرسل للزبون عبر واتساب إذا كان متصلاً)')}" onkeydown="if(event.key==='Enter')sendOwner()">
          <button class="btn btn-primary" onclick="sendOwner()">➤</button>
        </div>
        <div class="form-hint mt-8">${t('Vous prenez le contrôle quand vous envoyez un message. L\'IA reste en pause dans cette conversation.', 'تتحكم أنت عندما ترسل رسالة. يبقى الذكاء متوقفاً في هذه المحادثة.')}</div>
      </div>
    </div>
  `;
}

export async function after(id) {
  const convId = id;
  window._convId = convId;

  window.toggleAi = async () => {
    const data = window._convData || {};
    const cur = data.ai_enabled;
    try {
      await api('/conversations/' + convId + '/ai', { method: 'PUT', body: { enabled: !cur } });
      toast(!cur ? 'IA activée' : 'IA en pause');
      navigate('/app/messages/' + convId);
    } catch (e) { toast(e.message, 'error'); }
  };

  window.sendOwner = async () => {
    const el = document.getElementById('owner-msg');
    const body = el.value.trim();
    if (!body) return;
    try {
      await api('/conversations/' + convId + '/message', { method: 'POST', body: { body } });
      el.value = '';
      toast('Message envoyé.');
      // reload
      const fresh = await api('/conversations/' + convId);
      window._convData = fresh;
      renderChat(fresh);
    } catch (e) { toast(e.message, 'error'); }
  };

  window.openClient = () => {
    const cust = window._convData && window._convData.customer;
    if (cust && cust.id) navigate('/app/clients/' + cust.id);
    else toast('Pas de client associé', 'info');
  };

  window.createDevisFromConversation = async () => {
    try {
      const ex = await api('/conversations/' + convId + '/extract', { method: 'POST', body: {} });
      // stash extracted data globally for the devis-new view
      sessionStorage.setItem('devisPrefill', JSON.stringify({
        customer: ex.customer,
        items: ex.suggested_items,
        conversation_id: Number(convId),
        quantity: ex.quantity,
      }));
      navigate('/app/devis/new');
    } catch (e) { toast(e.message, 'error'); }
  };

  // load initial
  const data = await api('/conversations/' + convId);
  window._convData = data;
  scrollBottom();
}

function renderChat(data) {
  const t = window.t;
  const bubbles = data.messages.map((m) => {
    const align = m.sender === 'customer' ? 'right' : 'left';
    const senderLabel = { customer: data.customer ? data.customer.name : 'Client', ai: '🤖 IA', owner: t('Vous', 'أنت'), system: 'Système' }[m.sender] || m.sender;
    return `<div class="msg-row ${align}"><div><div class="bubble">${esc(m.body)}</div><div class="msg-meta">${esc(senderLabel)} · ${esc((m.created_at || '').slice(0,16))}</div></div></div>`;
  }).join('');
  const scroll = document.getElementById('chat-scroll');
  if (scroll) scroll.innerHTML = bubbles;
  scrollBottom();
}

function scrollBottom() {
  const sc = document.getElementById('chat-scroll');
  if (sc) sc.scrollTop = sc.scrollHeight;
}
