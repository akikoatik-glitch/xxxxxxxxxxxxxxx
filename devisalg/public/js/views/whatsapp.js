// WhatsApp integration setup view
export const title = () => window.t('WhatsApp', 'واتساب');

export async function render() {
  let w;
  try { w = await api('/integrations/whatsapp'); }
  catch (e) { return `<div class="empty">⚠️ ${esc(e.message)}</div>`; }
  const t = window.t;

  const connectedBlock = `
    <div class="card" style="padding:20px;text-align:center">
      <div style="font-size:44px">✅</div>
      <h3>${t('WhatsApp connecté', 'واتساب متصل')}</h3>
      <p class="muted">${t('Vos clients peuvent vous contacter et l\'IA répond automatiquement.', 'يمكن لزبائنك التواصل معك ويجيب الذكاء الاصطناعي تلقائياً.')}</p>
      ${w.config ? `<div class="small muted">Phone ID: ${esc(w.config.phoneNumberId || '')} · ${w.config.hasToken ? t('Token enregistré', 'الرمز محفوظ') : ''}</div>` : ''}
      <div class="mt-12"><button class="btn btn-danger-ghost" onclick="disconnectWa()">${t('Déconnecter', 'قطع الاتصال')}</button></div>
    </div>

    <div class="card mt-12" style="padding:18px">
      <div class="bold mb-8">🧪 ${t('Tester l\'envoi', 'جرّب الإرسال')}</div>
      <div class="row gap-8">
        <input id="test-number" class="input" placeholder="${t('Téléphone (ex: 0550… )', 'الهاتف (مثال: 0550…)')}">
        <button class="btn btn-primary" onclick="testWa()">${t('Envoyer un test', 'إرسال تجريبي')}</button>
      </div>
    </div>

    <div class="card mt-12" style="padding:18px">
      <div class="bold mb-8">🔗 ${t('Votre webhook', 'الويب هوك')}</div>
      <p class="small muted">${t('Collez cette URL dans le champ "Callback URL" de Meta et utilisez le token ci-dessous comme "Verify Token".', 'ألصق هذا الرابط في حقل "Callback URL" في Meta واستخدم الرمز أدناه كـ "Verify Token".')}</p>
      <div class="card" style="padding:12px;background:var(--surface-2)">
        <code id="webhook-url" style="word-break:break-all">${esc(location.origin + '/whatsapp/webhook')}</code>
        <button class="btn btn-ghost btn-sm mt-8" onclick="copyWebhook()">📋 ${t('Copier l\'URL', 'نسخ الرابط')}</button>
      </div>
    </div>`;

  const setupBlock = `
    <div class="card" style="padding:20px">
      <div style="font-size:40px">📱</div>
      <h3>${t('Connecter WhatsApp Business', 'ربط واتساب للأعمال')}</h3>
      <p class="small muted">${t('Suivez ces étapes simples pour recevoir et répondre aux messages de vos clients automatiquement avec l\'IA.', 'اتبع هذه الخطوات البسيطة لاستقبال رسائل زبائنك والرد عليها تلقائياً بالذكاء الاصطناعي.')}</p>

      <ol class="small" style="line-height:1.9;padding-left:18px">
        <li>${t('Créez un compte gratuit sur', 'أنشئ حساباً مجانياً على')} <b>developers.facebook.com</b></li>
        <li>${t('Créez une application → ajoutez le produit "WhatsApp"', 'أنشئ تطبيقاً ← أضف منتج "واتساب"')}</li>
        <li>${t('Connectez votre numéro WhatsApp Business (un abonnement WhatsApp Business API est requis)', 'اربط رقم واتساب للأعمال (يلزم اشتراك في واجهة واتساب للأعمال)')}</li>
        <li>${t('Copiez le "System User Access Token" et le "Phone Number ID"', 'انسخ "System User Access Token" و "Phone Number ID"')}</li>
        <li>${t('Collez-les ci-dessous (ils restent sur le serveur, jamais exposés)', 'ألصقهما أدناه (يبقيان على الخادم ولا يُكشفان أبداً)')}</li>
      </ol>
    </div>

    <div class="card mt-12" style="padding:18px">
      <div class="bold mb-12">${t('Vos clés WhatsApp', 'مفاتيح واتساب')}</div>
      <div class="field"><label>Token (System User Access Token)</label><input id="w-token" class="input" type="password" placeholder="EAAG…"></div>
      <div class="field"><label>Phone Number ID</label><input id="w-pnid" class="input" placeholder="1234567890"></div>
      <div class="field"><label>Verify Token (webhook)</label><input id="w-vtok" class="input" placeholder="${t('Invitez votre propre secret', 'اختر رمزاً سرياً خاصاً بك')}"></div>
      <button class="btn btn-primary" onclick="saveWa()">${t('Enregistrer et connecter', 'حفظ والاتصال')}</button>
      <div id="wa-result" class="mt-12"></div>
    </div>

    <div class="card mt-12" style="padding:18px">
      <div class="bold mb-8">🔗 ${t('Votre webhook', 'الويب هوك')}</div>
      <p class="small muted">${t('Après connexion, ajoutez cette URL dans Meta et le Verify Token ci-dessus.', 'بعد الاتصال، أضف هذا الرابط في Meta ورمز التحقق أعلاه.')}</p>
      <div class="card" style="padding:12px;background:var(--surface-2)">
        <code style="word-break:break-all">${esc(location.origin + '/whatsapp/webhook')}</code>
        <button class="btn btn-ghost btn-sm mt-8" onclick="copyWebhook()">📋 ${t('Copier', 'نسخ')}</button>
      </div>
    </div>

    <div class="card mt-12" style="padding:18px;background:var(--amber-soft)">
      <b class="small">⚠️ ${t('Sans connexion WhatsApp, le simulateur de messages dans l\'onglet "Messages" vous permet de tester le flux complet.', 'بدون ربط واتساب، يمكنك اختبار التدفق الكامل عبر محاكي الرسائل في تبويب "الرسائل".')}</b>
    </div>`;

  return w.connected ? connectedBlock : setupBlock;
}

export async function after() {
  window.copyWebhook = () => {
    const url = location.origin + '/whatsapp/webhook';
    navigator.clipboard.writeText(url).then(() => toast('URL copiée!'));
  };
  window.saveWa = async () => {
    const token = document.getElementById('w-token').value.trim();
    const phoneNumberId = document.getElementById('w-pnid').value.trim();
    const verifyToken = document.getElementById('w-vtok').value.trim();
    if (!token || !phoneNumberId) return toast('Token et Phone Number ID requis.', 'error');
    try {
      await api('/integrations/whatsapp', { method: 'POST', body: { token, phoneNumberId, verifyToken } });
      toast('WhatsApp connecté!');
      navigate('/app/whatsapp');
    } catch (e) { toast(e.message, 'error'); }
  };
  window.testWa = async () => {
    const to = document.getElementById('test-number').value.trim();
    if (!to) return toast('Numéro requis.', 'error');
    try { await api('/integrations/whatsapp/test', { method: 'POST', body: { to } }); toast('Message envoyé!'); }
    catch (e) { toast(e.message, 'error'); }
  };
  window.disconnectWa = async () => {
    if (!confirm('Déconnecter WhatsApp ?')) return;
    try { await api('/integrations/whatsapp', { method: 'DELETE' }); toast('Déconnecté.'); navigate('/app/whatsapp'); }
    catch (e) { toast(e.message, 'error'); }
  };
}
