export const title = () => window.t('Devis', 'عرض السعر');

export async function render(id) {
  let d;
  try { d = await api('/devis/' + id); }
  catch (e) { return `<div class="empty">⚠️ ${esc(e.message)}</div>`; }
  const t = window.t;
  const customer = d.customer || {};
  const name = d.customer_name || customer.name || t('Client', 'زبون');
  const phone = d.customer_phone || customer.phone || '';

  const itemsHtml = d.items.map((it, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${esc(it.name)}</td>
      <td>${it.quantity}</td>
      <td>${money(it.unit_price)}</td>
      <td>${money(it.total)}</td>
    </tr>`).join('') || '<tr><td colspan="5" class="muted">—</td></tr>';

  return `
    <button class="btn btn-ghost btn-sm mb-12" onclick="navigate('/app/devis')">← ${t('Retour', 'رجوع')}</button>
    <div class="row between wrap">
      <div>
        <div class="row gap-8"><span class="bold" style="font-size:20px">📄 ${esc(d.number)}</span> ${statusBadge(d.status)}</div>
        <div class="muted small">${t('Créé le', 'أُنشئ في')} ${esc((d.created_at||'').slice(0,10))} · ${esc(name)} · ${esc(phone)}</div>
      </div>
      <div class="row gap-8 mt-8 wrap">
        <button class="btn btn-outline btn-sm" onclick="genPdf()">⬇️ ${t('PDF', 'PDF')}</button>
        <button class="btn btn-green btn-sm" onclick="sendWa()">📱 ${t('Envoyer WhatsApp', 'إرسال واتساب')}</button>
        ${d.status !== 'converted' && d.status !== 'accepted' ? `<button class="btn btn-green btn-sm" onclick="mark('accepted')">✓ ${t('Accepter', 'قبول')}</button>` : ''}
        <button class="btn btn-primary btn-sm" onclick="convert()">🧾 ${t('Convertir en Facture', 'تحويل إلى فاتورة')}</button>
      </div>
    </div>

    <div class="card mt-12" style="overflow:hidden">
      <div style="padding:16px;background:linear-gradient(120deg,#0f172a,#7c3aed);color:#fff">
        <div class="bold">${esc(d.businessName || '')}</div>
      </div>
      <table class="table">
        <thead><tr><th>#</th><th>${t('Description', 'الوصف')}</th><th>Qté</th><th>P.U.</th><th>Total</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div style="padding:16px;border-top:1px solid var(--border)" class="grid-2">
        <div>
          <div class="row between"><span class="muted">${t('Sous-total', 'المجموع الفرعي')}</span><span>${money(d.subtotal)}</span></div>
          ${d.discount ? `<div class="row between"><span class="muted">${t('Remise', 'الخصم')}</span><span>-${money(d.discount)}</span></div>` : ''}
          ${d.tax ? `<div class="row between"><span class="muted">TVA (${d.tax_rate}%)</span><span>${money(d.tax)}</span></div>` : ''}
          <div class="row between bold" style="font-size:18px;margin-top:8px"><span>${t('Total', 'المجموع')}</span><span>${money(d.total)}</span></div>
        </div>
        <div>
          <div class="small muted">${t('Notes', 'ملاحظات')}</div>
          <div class="small">${esc(d.notes || '-')}</div>
        </div>
      </div>
    </div>

    <div id="result" class="mt-12"></div>
  `;
}

export async function after(id) {
  const did = id;
  window.genPdf = async () => {
    try {
      const res = await api('/devis/' + did + '/pdf', { method: 'POST', body: {} });
      document.getElementById('result').innerHTML = `<a class="btn btn-green" href="${res.url}" target="_blank">⬇️ ${window.t('Télécharger le PDF', 'تحميل PDF')}</a>`;
      toast('PDF généré!');
    } catch (e) { toast(e.message, 'error'); }
  };
  window.mark = async (status) => {
    try { await api('/devis/' + did + '/status', { method: 'POST', body: { status } }); toast('Mis à jour.'); navigate('/app/devis/' + did); }
    catch (e) { toast(e.message, 'error'); }
  };
  window.convert = async () => {
    try {
      const inv = await api('/devis/' + did + '/convert', { method: 'POST', body: {} });
      toast('Facture créée: ' + inv.number);
      navigate('/app/factures/' + inv.id);
    } catch (e) { toast(e.message, 'error'); }
  };
  window.sendWa = async () => {
    try {
      await api('/devis/' + did + '/pdf', { method: 'POST', body: {} });
      const d = await api('/devis/' + did);
      const to = d.customer_phone || (d.customer && d.customer.phone);
      if (!to) return toast('Ajoutez le téléphone du client.', 'error');
      const r = await api('/integrations/whatsapp/send-document', { method: 'POST', body: { id: did, kind: 'devis', to } });
      toast('Devis envoyé via WhatsApp!');
    } catch (e) { toast(e.message, 'error'); }
  };
}
