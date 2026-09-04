// Shared document editor (Devis/Facture form) with live totals + actions.
// Usage: docEditor({ kind: 'devis' | 'facture', prefill, onSave })

export function docEditor({ kind, prefill = {}, onSaved, backPath }) {
  const t = window.t;
  const items = (prefill.items && prefill.items.length ? prefill.items : [{ name: '', quantity: 1, unit_price: 0 }]);
  const isDevis = kind === 'devis';
  const kindLabel = isDevis ? t('Devis', 'عرض سعر') : t('Facture', 'فاتورة');

  return `
    <button class="btn btn-ghost btn-sm mb-12" onclick="navigate('${backPath}')">← ${t('Retour', 'رجوع')}</button>
    <div class="bold" style="font-size:20px">${isDevis ? '📄' : '🧾'} ${t('Créer un ' + kindLabel, 'إنشاء ' + (isDevis ? 'عرض سعر' : 'فاتورة'))}</div>

    <div class="card mt-12" style="padding:18px">
      <div class="bold mb-12">👤 ${t('Client', 'الزبون')}</div>
      <div class="grid-2">
        <div class="field">
          <label>${t('Nom', 'الاسم')}</label>
          <input id="doc-customer-name" class="input" value="${esc(prefill.customer ? prefill.customer.name : '')}" placeholder="${t('Nom du client', 'اسم الزبون')}">
        </div>
        <div class="field">
          <label>${t('Téléphone', 'الهاتف')}</label>
          <input id="doc-customer-phone" class="input" value="${esc(prefill.customer ? prefill.customer.phone : '')}" placeholder="${t('06…', '06…')}">
        </div>
      </div>
      <div class="field">
        <label>${t('Ou choisir un client existant', 'أو اختر زبوناً موجوداً')}</label>
        <select id="doc-customer-select" class="select" onchange="pickCustomer()">
          <option value="">—</option>
        </select>
      </div>
    </div>

    <div class="card mt-12" style="padding:18px">
      <div class="between row mb-12">
        <span class="bold">🧾 ${t('Articles', 'البنود')}</span>
        <button class="btn btn-outline btn-sm" onclick="addItem()">+ ${t('Ajouter une ligne', 'إضافة سطر')}</button>
      </div>
      <div id="items-wrap"></div>
    </div>

    <div class="card mt-12" style="padding:18px">
      <div class="bold mb-12">🧮 ${t('Totaux', 'المجموع')}</div>
      <div class="grid-2">
        <div class="field">
          <label>${t('Remise (DA)', 'الخصم (دج)')}</label>
          <input id="doc-discount" type="number" class="input" value="0" min="0" oninput="recalc()">
        </div>
        <div class="field">
          <label>${t('TVA (%)', 'ضريبة (%)')}</label>
          <input id="doc-tax" type="number" class="input" value="0" min="0" step="0.1" oninput="recalc()">
        </div>
        ${isDevis ? `
        <div class="field">
          <label>${t('Validité (jours)', 'الصلاحية (أيام)')}</label>
          <input id="doc-validity" type="number" class="input" value="14" min="1">
        </div>` : `
        <div class="field">
          <label>${t('Échéance', 'الاستحقاق')}</label>
          <input id="doc-due" type="date" class="input">
        </div>`}
      </div>
      <div class="field">
        <label>${t('Notes', 'ملاحظات')}</label>
        <textarea id="doc-notes" class="textarea" placeholder="${t('Ex: Prix valable 14 jours, installation comprise…', 'مثال: السعر صالح 14 يوماً، التركيب مشمول…')}"></textarea>
      </div>
    </div>

    <div class="card mt-12" style="padding:18px">
      <div class="row between">
        <div>
          <div class="muted small">${t('Total', 'المجموع')}</div>
          <div class="bold" style="font-size:22px" id="doc-total">0 DA</div>
        </div>
        <div class="row gap-8 wrap">
          <button class="btn btn-outline" onclick="generatePdf()">⬇️ ${t('Générer le PDF', 'توليد PDF')}</button>
          <button class="btn btn-green" onclick="sendWhatsapp()">📱 ${t('Envoyer WhatsApp', 'إرسال واتساب')}</button>
          <button class="btn btn-primary" onclick="saveDoc()">💾 ${t('Enregistrer', 'حفظ')}</button>
        </div>
      </div>
      <div id="pdf-result" class="mt-12"></div>
    </div>
  `;
}

export function attachDocEditor({ kind, prefill = {}, onSaved, backPath, onSaveOverride }) {
  const t = window.t;

  // Query customer list for the select
  api('/customers').then((custs) => {
    const sel = document.getElementById('doc-customer-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">—</option>' + custs.map((c) => `<option value="${c.id}">${esc(c.name)}${c.phone ? ' · ' + esc(c.phone) : ''}</option>`).join('');
    if (prefill.customer && prefill.customer.id) sel.value = prefill.customer.id;
    if (prefill.customer && (prefill.customer.name || prefill.customer.phone)) {
      document.getElementById('doc-customer-name').value = prefill.customer.name || '';
      document.getElementById('doc-customer-phone').value = prefill.customer.phone || '';
    }
  }).catch(() => {});

  // Render initial items
  window.addItem = () => {
    const wrap = document.getElementById('items-wrap');
    const row = itemRow({ name: '', quantity: 1, unit_price: 0 });
    wrap.insertAdjacentHTML('beforeend', row);
  };

  window.pickCustomer = () => {
    const sel = document.getElementById('doc-customer-select');
    const chosen = sel.options[sel.selectedIndex];
    if (sel.value) {
      // fetch full customer
      api('/customers/' + sel.value).then((c) => {
        document.getElementById('doc-customer-name').value = c.name || '';
        document.getElementById('doc-customer-phone').value = c.phone || '';
        sessionStorage.setItem('chosenCust', JSON.stringify({ id: c.id, name: c.name, phone: c.phone }));
      }).catch(() => {});
    }
    void chosen;
  };

  window.removeItem = (btn) => { btn.closest('.item-row').remove(); recalc(); };

  // Render the prefill items into the wrap
  const wrap = document.getElementById('items-wrap');
  let html = '';
  for (const it of items) {
    html += itemRow(it);
  }
  wrap.innerHTML = html;
  recalc();

  // Fill notes/validity from prefill if any
  const prefill = window.DOC_PREFILL || prefill;
  if (prefill.conversation_id && prefill.quantity) {
    // suggestion banner
  }

  function itemRow(it) {
    return `
      <div class="item-row" style="display:grid;grid-template-columns:1fr 70px 100px 40px;gap:8px;margin-bottom:8px">
        <input class="input item-name" value="${esc(it.name || '')}" placeholder="${t('Produit / Service', 'منتج / خدمة')}" oninput="recalc()">
        <input class="input item-qty" type="number" value="${it.quantity || 1}" min="0.5" step="0.5" oninput="recalc()">
        <input class="input item-price" type="number" value="${it.unit_price || 0}" min="0" oninput="recalc()">
        <button class="btn btn-danger-ghost btn-sm" onclick="removeItem(this)">✕</button>
      </div>`;
  }

  window.recalc = () => {
    const rows = document.querySelectorAll('.item-row');
    let subtotal = 0;
    rows.forEach((r) => {
      const qty = parseFloat(r.querySelector('.item-qty').value) || 0;
      const price = parseFloat(r.querySelector('.item-price').value) || 0;
      subtotal += qty * price;
    });
    const discount = parseFloat(document.getElementById('doc-discount').value) || 0;
    const taxRate = parseFloat(document.getElementById('doc-tax').value) || 0;
    const afterDiscount = Math.max(0, subtotal - Math.min(discount, subtotal));
    const tax = afterDiscount * taxRate / 100;
    const total = afterDiscount + tax;
    document.getElementById('doc-total').textContent = money(total);
    window._docCalc = { subtotal, discount: Math.min(discount, subtotal), taxRate, tax, total };
  };

  function collect() {
    const rows = document.querySelectorAll('.item-row');
    const itemsArr = [];
    rows.forEach((r) => {
      const name = r.querySelector('.item-name').value.trim();
      const qty = parseFloat(r.querySelector('.item-qty').value) || 1;
      const price = parseFloat(r.querySelector('.item-price').value) || 0;
      if (name) itemsArr.push({ name, quantity: qty, unit_price: price });
    });
    const chose = (() => { try { return JSON.parse(sessionStorage.getItem('chosenCust') || 'null'); } catch { return null; } })();
    const customerId = document.getElementById('doc-customer-select').value || (chose ? chose.id : null);
    return {
      customer_id: customerId || null,
      customer_name: document.getElementById('doc-customer-name').value.trim(),
      customer_phone: document.getElementById('doc-customer-phone').value.trim(),
      items: itemsArr,
      discount: parseFloat(document.getElementById('doc-discount').value) || 0,
      tax_rate: parseFloat(document.getElementById('doc-tax').value) || 0,
      notes: document.getElementById('doc-notes').value.trim(),
      ...(isDevis() ? { validity_days: parseInt(document.getElementById('doc-validity').value) || 14 } : { due_date: document.getElementById('doc-due').value || null }),
      ...(prefill.conversation_id ? { conversation_id: prefill.conversation_id } : {}),
    };
  }

  function isDevis() { return kind === 'devis'; }

  window.saveDoc = async () => {
    const payload = collect();
    if (!payload.items.length) return toast(t('Ajoutez au moins un article.', 'أضف سطراً واحداً على الأقل.'), 'error');
    const path = isDevis() ? '/devis' : '/invoices';
    try {
      const res = await api(path, { method: 'POST', body: payload });
      toast(t('Enregistré avec succès!', 'تم الحفظ بنجاح!'));
      if (onSaved) onSaved(res);
      else navigate(backPath);
    } catch (e) { toast(e.message, 'error'); }
  };

  window.generatePdf = async () => {
    // First ensure saved (create if needed), then generate pdf
    const payload = collect();
    if (!payload.items.length) return toast(t('Ajoutez au moins un article.', 'أضف سطراً واحداً على الأقل.'), 'error');
    let id = sessionStorage.getItem(kind + '_lastid');
    if (!id) {
      const path = isDevis() ? '/devis' : '/invoices';
      try {
        const res = await api(path, { method: 'POST', body: payload });
        id = res.id;
        sessionStorage.setItem(kind + '_lastid', id);
      } catch (e) { toast(e.message, 'error'); return; }
    }
    try {
      const res = await api(`/${kind === 'devis' ? 'devis' : 'invoices'}/${id}/pdf`, { method: 'POST', body: {} });
      document.getElementById('pdf-result').innerHTML = `
        <div class="row gap-8 mt-12">
          <a class="btn btn-green btn-sm" href="${res.url}" target="_blank">⬇️ ${t('Télécharger le PDF', 'تحميل PDF')}</a>
        </div>`;
      toast(t('PDF généré!', 'تم توليد PDF!'));
    } catch (e) { toast(e.message, 'error'); }
  };

  window.sendWhatsapp = async () => {
    // Save then send via WhatsApp (needs number)
    const payload = collect();
    if (!payload.customer_phone) return toast(t('Ajoutez le téléphone du client pour envoyer sur WhatsApp.', 'أضف هاتف الزبون للإرسال عبر واتساب.'), 'error');
    if (!payload.items.length) return toast(t('Ajoutez au moins un article.', 'أضف سطراً واحداً على الأقل.'), 'error');
    let id = sessionStorage.getItem(kind + '_lastid');
    if (!id) {
      const path = isDevis() ? '/devis' : '/invoices';
      const res = await api(path, { method: 'POST', body: payload });
      id = res.id;
      sessionStorage.setItem(kind + '_lastid', id);
    }
    // generate pdf
    try {
      await api(`/${kind === 'devis' ? 'devis' : 'invoices'}/${id}/pdf`, { method: 'POST', body: {} });
    } catch (e) {}
    // Check WhatsApp connected
    const wa = await api('/integrations/whatsapp');
    if (!wa.connected) {
      toast(t('WhatsApp non connecté. Ajoutez le dans la page WhatsApp.', 'واتساب غير متصل. أضفه في صفحة واتساب.'), 'info');
      navigate('/app/whatsapp');
      return;
    }
    try {
      const r = await api('/integrations/whatsapp/send-document', { method: 'POST', body: { id, kind, to: payload.customer_phone } });
      toast(t('Devis envoyé via WhatsApp!', 'تم إرسال عرض السعر عبر واتساب!'));
    } catch (e) { toast(e.message, 'error'); }
  };
}
