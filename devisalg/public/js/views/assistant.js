// AI Assistant configuration
export const title = () => window.t('Assistant IA', 'المساعد الذكي');

export async function render() {
  let s;
  try { s = await api('/ai'); }
  catch (e) { return `<div class="empty">⚠️ ${esc(e.message)}</div>`; }
  const t = window.t;
  const faqs = (() => { try { return JSON.parse(s.faqs || '[]'); } catch { return []; } })();
  const rules = (() => { try { return JSON.parse(s.eskalate_rules || '{}'); } catch { return {}; } })();

  const faqHtml = faqs.length
    ? faqs.map((f, i) => `<div class="card" style="padding:12px;margin-bottom:8px"><div class="between row gap-8"><b class="small">${esc(f.q)}</b><button class="btn btn-danger-ghost btn-sm" onclick="delFaq(${i})">✕</button></div><p class="small muted" style="margin:4px 0 0">${esc(f.a)}</p></div>`).join('')
    : `<div class="muted small">${t('Aucune question fréquente. Ajoutez-en pour que l\'IA réponde automatiquement.', 'لا توجد أسئلة شائعة. أضفها ليجيب الذكاء الاصطناعي تلقائياً.')}</div>`;

  const catalogHtml = (s.catalog.products.length || s.catalog.services.length)
    ? `<div class="card" style="padding:12px">
        ${s.catalog.products.map((p) => `<div class="row between" style="padding:4px 0"><span class="small">${esc(p.name)}</span><span class="small bold">${money(p.unit_price)}</span></div>`).join('')}
        ${s.catalog.services.map((p) => `<div class="row between" style="padding:4px 0"><span class="small">${esc(p.name)}</span><span class="small bold">${money(p.unit_price)}</span></div>`).join('')}
        <a class="btn btn-ghost btn-sm mt-8" href="/app/facturation" onclick="navigate('/app/facturation')">+ ${t('Gérer mon catalogue', 'إدارة قائمتي')}</a>
      </div>`
    : `<div class="card" style="padding:12px;background:var(--amber-soft)">
        <b class="small">⚠️ ${t('Ajoutez vos produits/services et leurs prix pour que l\'IA puisse répondre avec vos vrais tarifs.', 'أضف منتجاتك/خدماتك وأسعارها حتى يجيب الذكاء الاصطناعي بأسعارك الحقيقية.')}</b>
        <a class="btn btn-outline btn-sm mt-8" href="/app/facturation" onclick="navigate('/app/facturation')">+ ${t('Ajouter maintenant', 'أضف الآن')}</a>
      </div>`;

  return `
    <div class="row between wrap mb-12">
      <div class="bold">🤖 ${t('Assistant IA', 'المساعد الذكي')}</div>
      <label class="row gap-8"><input type="checkbox" id="ai-enabled" ${s.enabled?'checked':''} onchange="saveEnabled()"> <span class="bold">${s.enabled ? t('Activé', 'مفعّل') : t('Désactivé', 'معطّل')}</span></label>
    </div>

    <div class="grid-2">
      <div class="card" style="padding:18px">
        <div class="bold mb-12">🛒 ${t('Votre catalogue', 'قائمتك')}</div>
        <p class="small muted">${t('L\'IA ne répond qu\'avec ces prix.', 'لا يجيب الذكاء الاصطناعي إلا بهذه الأسعار.')}</p>
        ${catalogHtml}
      </div>

      <div class="card" style="padding:18px">
        <div class="bold mb-12">🎭 ${t('Personnalité & langue', 'الشخصية واللغة')}</div>
        <div class="field">
          <label>${t('Langue de réponse', 'لغة الرد')}</label>
          <select id="ai-language" class="select">
            <option value="darija_fr" ${s.language==='darija_fr'?'selected':''}>${t('Darija + Français', 'الدارجة + الفرنسية')}</option>
            <option value="ar" ${s.language==='ar'?'selected':''}>${t('Arabe', 'العربية')}</option>
            <option value="fr" ${s.language==='fr'?'selected':''}>${t('Français', 'الفرنسية')}</option>
          </select>
        </div>
        <div class="field">
          <label>${t('Personnalité / style', 'الشخصية / الأسلوب')}</label>
          <textarea id="ai-personality" class="textarea">${esc(s.personality || '')}</textarea>
          <div class="form-hint">${t('Ex: "Sois poli, rapide, utilise des emojis, parle en darija algérienne."', 'مثال: "كن مهذباً وسريعاً، استخدم الرموز التعبيرية، تكلم بالدارجة الجزائرية."')}</div>
        </div>
        <div class="field">
          <label>${t('Message de bienvenue', 'رسالة الترحيب')}</label>
          <textarea id="ai-greeting" class="textarea">${esc(s.greeting || '')}</textarea>
        </div>
        <button class="btn btn-primary" onclick="saveAI()">${t('Enregistrer', 'حفظ')}</button>
      </div>
    </div>

    <div class="grid-2 mt-12">
      <div class="card" style="padding:18px">
        <div class="between row mb-12"><div class="bold">❓ ${t('Questions fréquentes (FAQ)', 'الأسئلة الشائعة')}</div><button class="btn btn-outline btn-sm" onclick="addFaq()">+ ${t('Ajouter', 'إضافة')}</button></div>
        ${faqHtml}
      </div>

      <div class="card" style="padding:18px">
        <div class="bold mb-12">🛡️ ${t('Quand l\'IA vous contacte', 'متى يتصل بك الذكاء الاصطناعي')}</div>
        <label class="row gap-8 mb-8 small"><input type="checkbox" id="rw-price" ${rules.price==='owner'?'checked':''}> ${t('Me demander avant de donner un prix', 'اطلب مني قبل إعطاء سعر')}</label>
        <label class="row gap-8 mb-8 small"><input type="checkbox" id="rw-offcatalog" ${rules.off_catalog?'checked':''}> ${t('M\'avertir quand un client demande un prix hors catalogue', 'أعلمني عندما يطلب زبون سعراً خارج القائمة')}</label>
        <div class="field mt-8">
          <label>${t('Rappeler après (jours non payés)', 'تذكير بعد (أيام بدون دفع)')}</label>
          <input id="rw-reminder-days" class="input" type="number" value="${rules.reminder_days || 7}">
        </div>
        <div class="field">
          <label>${t('Message de rappel', 'رسالة التذكير')}</label>
          <textarea id="rw-reminder-msg" class="textarea">${esc(rules.reminder_message || 'سلام، حبيت غير نذكرك بلي الفاتورة ما زالت ما تخلصتش. إذا تحتاج أي معلومة رانا هنا.')}</textarea>
          <div class="form-hint">${t('Utilisez #NUM pour le numéro de la facture.', 'استخدم #NUM لرقم الفاتورة.')}</div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="saveRules()">${t('Enregistrer les règles', 'حفظ القواعد')}</button>
      </div>
    </div>

    <div class="card mt-12" style="padding:18px">
      <div class="bold mb-8">🧪 ${t('Tester l\'assistant', 'جرّب المساعد')}</div>
      <div class="row gap-8">
        <input id="test-text" class="input" placeholder="${t('Salem, ch7al tdir installation climatisation?', 'سلام، شحال تدير تركيب كليماتيزور؟')}">
        <button class="btn btn-primary" onclick="testAI()">${t('Tester', 'جرّب')}</button>
      </div>
      <div id="test-result" class="mt-12"></div>
    </div>
  `;
}

export async function after() {
  window.saveEnabled = async () => {
    const enabled = document.getElementById('ai-enabled').checked ? 1 : 0;
    try { await api('/ai', { method: 'PUT', body: { enabled } }); toast(enabled ? 'Assistant activé!' : 'Assistant désactivé'); }
    catch (e) { toast(e.message, 'error'); }
  };
  window.saveAI = async () => {
    try {
      await api('/ai', { method: 'PUT', body: {
        language: document.getElementById('ai-language').value,
        personality: document.getElementById('ai-personality').value,
        greeting: document.getElementById('ai-greeting').value,
      }});
      toast('Enregistré!');
    } catch (e) { toast(e.message, 'error'); }
  };
  window.addFaq = () => {
    window.openModal(`<h3>+ ${window.t('Ajouter une FAQ', 'إضافة سؤال شائع')}</h3>
      <div class="field"><label>${window.t('Question', 'السؤال')}</label><input id="fq-q" class="input"></div>
      <div class="field"><label>${window.t('Réponse', 'الجواب')}</label><textarea id="fq-a" class="textarea"></textarea></div>
      <button class="btn btn-primary btn-block" onclick="submitFaq()">${window.t('Ajouter', 'إضافة')}</button>`);
    window.submitFaq = async () => {
      const s = await api('/ai');
      const faqs = JSON.parse(s.faqs || '[]');
      faqs.push({ q: document.getElementById('fq-q').value.trim(), a: document.getElementById('fq-a').value.trim() });
      await api('/ai', { method: 'PUT', body: { faqs } });
      toast('FAQ ajoutée!'); closeModal(); navigate('/app/assistant');
    };
  };
  window.delFaq = async (i) => {
    const s = await api('/ai');
    const faqs = JSON.parse(s.faqs || '[]');
    faqs.splice(i, 1);
    await api('/ai', { method: 'PUT', body: { faqs } });
    navigate('/app/assistant');
  };
  window.saveRules = async () => {
    const rules = {
      price: document.getElementById('rw-price').checked ? 'owner' : 'auto',
      off_catalog: document.getElementById('rw-offcatalog').checked,
      reminder_days: parseInt(document.getElementById('rw-reminder-days').value) || 7,
      reminder_message: document.getElementById('rw-reminder-msg').value,
    };
    try { await api('/ai', { method: 'PUT', body: { eskalate_rules: rules } }); toast('Règles enregistrées!'); }
    catch (e) { toast(e.message, 'error'); }
  };
  window.testAI = async () => {
    const text = document.getElementById('test-text').value.trim();
    if (!text) return toast('Écrivez un message.', 'error');
    const res = await api('/ai/test', { method: 'POST', body: { text } });
    let html = '';
    if (res.reply) html += `<div class="card" style="padding:12px;background:var(--brand-soft)"><b>🤖 IA:</b><p>${esc(res.reply)}</p></div>`;
    html += `<div class="small muted mt-8">${window.t('Intention', 'نية')}: ${esc(res.intent)} · ${window.t('Escalade', 'تصعيد')}: ${res.escalate ? 'Oui' : 'Non'} ${res.reason ? '(' + esc(res.reason) + ')' : ''}</div>`;
    if (res.extracted) html += `<div class="small mt-8">${window.t('Détecté', 'المكتشف')}: ${esc(res.extracted.item)} × ${res.extracted.qty} = ${money(res.extracted.subtotal)}</div>`;
    if (res.catalog && res.catalog.matched) html += `<div class="small mt-8 muted">${window.t('Correspond au produit', 'يطابق المنتج')}: ${esc(res.catalog.matched.name)} (${money(res.catalog.matched.unit_price)})</div>`;
    document.getElementById('test-result').innerHTML = html;
  };
}
