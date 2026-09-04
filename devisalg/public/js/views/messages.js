// Messages list view
export const title = () => window.t('Messages', 'الرسائل');

export async function render() {
  let rows;
  try { rows = await api('/conversations'); }
  catch (e) { return `<div class="empty">⚠️ ${esc(e.message)}</div>`; }
  const t = window.t;

  if (!rows.length) {
    return `
      <div class="card" style="padding:20px">
        ${emptyState('💬', t('Aucune conversation', 'لا توجد محادثات'), t('Les messages de vos clients (via WhatsApp ou le simulateur) apparaîtront ici.', 'رسائل زبائنك (عبر واتساب أو المحاكي) ستظهر هنا.'))}
        <div class="card" style="margin-top:16px;padding:16px;background:var(--brand-soft)">
        <div class="bold">${t('Tester l\'assistant IA', 'جرّب المساعد الذكي')}</div>
        <p class="small">${t('Envoyez un message comme un client pour voir l\'IA répondre avec vos vrais prix.', 'أرسل رسالة كمثل زبون لترى كيف يجيب الذكاء الاصطناعي بأسعارك الحقيقية.')}</p>
        <input id="sim-text" class="input" placeholder="${t('Salem, ch7al tdir installation climatisation?', 'سلام، شحال تدير تركيب كليماتيزور؟')}">
        <div class="row gap-8 mt-8">
          <input id="sim-name" class="input" placeholder="${t('Nom client (optionnel)', 'اسم الزبون (اختياري)')}">
          <input id="sim-phone" class="input" placeholder="${t('Téléphone', 'الهاتف')}">
        </div>
        <button class="btn btn-primary mt-12" onclick="simulate()">${t('Envoyer le message', 'إرسال الرسالة')}</button>
        </div>
      </div>`;
  }

  const list = rows.map((c) => `
    <a class="nav-link" style="margin:0;border-radius:0;border-bottom:1px solid var(--surface-2);gap:12px" href="/app/messages/${c.id}" onclick="navigate('/app/messages/${c.id}')">
      <span class="chat-avatar" style="width:42px;height:42px;font-size:15px">${esc((c.customer_name || 'C').charAt(0).toUpperCase())}</span>
      <span class="grow">
        <span class="bold">${esc(c.customer_name || c.customer_phone || t('Client', 'زبون'))}</span>
        <span class="muted" style="display:block;font-size:12px">${esc((c.last_message || '').slice(0, 46))}</span>
      </span>
      <span class="small muted">${esc((c.updated_at || '').slice(11, 16))}</span>
      <span class="badge ${c.ai_enabled ? 'badge-brand' : 'badge-gray'}">${c.ai_enabled ? 'IA' : t('M', 'يدوي')}</span>
    </a>`).join('');

  return `
    <div class="card" style="overflow:hidden">
      <div style="padding:16px;border-bottom:1px solid var(--border)" class="between row">
        <span class="bold">${t('Conversations', 'المحادثات')} (${rows.length})</span>
        <button class="btn btn-primary btn-sm" onclick="simulate()">+ ${t('Tester l\'IA', 'جرّب الذكاء الاصطناعي')}</button>
      </div>
      <div id="sim-panel" style="display:none;padding:16px;background:var(--brand-soft);border-bottom:1px solid var(--border)">
        <div class="bold">${t('Simuler un message client', 'محاكاة رسالة زبون')}</div>
        <input id="sim-text" class="input mt-8" placeholder="Salem, ch7al tdir installation climatisation?">
        <div class="row gap-8 mt-8 wrap">
          <input id="sim-name" class="input" style="flex:1;min-width:140px" placeholder="${t('Nom client (optionnel)', 'اسم الزبون (اختياري)')}">
          <input id="sim-phone" class="input" style="flex:1;min-width:140px" placeholder="${t('Téléphone', 'الهاتف')}">
          <button class="btn btn-primary" onclick="simulateSend()">${t('Envoyer', 'إرسال')}</button>
        </div>
      </div>
      ${list}
    </div>
  `;
}

export async function after() {
  window.simulate = () => {
    const panel = document.getElementById('sim-panel');
    if (panel) { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; }
  };
  window.simulateSend = async () => {
    const text = document.getElementById('sim-text').value.trim();
    const name = document.getElementById('sim-name').value.trim();
    const phone = document.getElementById('sim-phone').value.trim();
    if (!text) return toast('Écrivez un message.', 'error');
    try {
      const res = await api('/conversations/simulate', { method: 'POST', body: { text, customerName: name, phone } });
      toast('Message envoyé. L\'IA a répondu.');
      navigate('/app/messages' + (res.conv ? '/' + res.conv.id : ''));
    } catch (e) { toast(e.message, 'error'); }
  };
}
