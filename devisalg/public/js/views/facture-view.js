// Facture detail with payment tracking and reminders toggle
export const title = () => window.t('Facture', 'فاتورة');

export async function render(id) {
  let f;
  try { f = await api('/invoices/' + id); }
  catch (e) { return `<div class="empty">⚠️ ${esc(e.message)}</div>`; }
  const t = window.t;
  const cust = f.customer || {};
  const name = f.customer_name || cust.name || t('Client', 'زبون');
  const phone = f.customer_phone || cust.phone || '';
  const remaining = Number((f.total || 0) - (f.paid_amount || 0));

  const itemsHtml = f.items.map((it, i) => `
    <tr><td>${i+1}</td><td>${esc(it.name)}</td><td>${it.quantity}</td><td>${money(it.unit_price)}</td><td>${money(it.total)}</td></tr>`
  ).join('') || '<tr><td colspan="5" class="muted">—</td></tr>';

  const payHist = (f.payments && f.payments.length)
    ? f.payments.map((p) => `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--surface-2)"><span class="small">${esc((p.paid_at||'').slice(0,10))} · ${esc(p.method)}</span><span class="bold small">-${money(p.amount)}</span></div>`).join('')
    : '<div class="muted small">' + t('Aucun paiement enregistré.', 'لا توجد دفعات مسجلة.') + '</div>';

  return `
    <button class="btn btn-ghost btn-sm mb-12" onclick="navigate('/app/factures')">← ${t('Retour', 'رجوع')}</button>
    <div class="row between wrap">
      <div>
        <div class="row gap-8"><span class="bold" style="font-size:20px">🧾 ${esc(f.number)}</span> ${statusBadge(f.status)}</div>
        <div class="muted small">${esc(name)} · ${esc(phone)} · ${t('Créée le', 'أُنشئت في')} ${esc((f.created_at||'').slice(0,10))}</div>
      </div>
      <div class="row gap-8 mt-8 wrap">
        <button class="btn btn-outline btn-sm" onclick="genPdf()">⬇️ ${t('PDF', 'PDF')}</button>
        <button class="btn btn-green btn-sm" onclick="mark('paid')">✓ ${t('Marquer payée', 'تسجيل كمدفوعة')}</button>
        <button class="btn btn-amber-ghost btn-sm" onclick="recordPayment()">💳 ${t('Enregistrer un paiement', 'تسجيل دفعة')}</button>
      </div>
    </div>

    <div class="grid-2 mt-12">
      <div class="card" style="overflow:hidden;grid-column:1/-1">
        <table class="table">
          <thead><tr><th>#</th><th>${t('Description', 'الوصف')}</th><th>Qté</th><th>P.U.</th><th>Total</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div style="padding:16px" class="grid-2">
          <div>
            <div class="row between"><span class="muted">${t('Sous-total', 'المجموع الفرعي')}</span><span>${money(f.subtotal)}</span></div>
            ${f.discount ? `<div class="row between"><span class="muted">${t('Remise', 'الخصم')}</span><span>-${money(f.discount)}</span></div>`:''}
            ${f.tax ? `<div class="row between"><span class="muted">TVA (${f.tax_rate}%)</span><span>${money(f.tax)}</span></div>`:''}
            <div class="row between bold" style="font-size:18px;margin-top:8px"><span>${t('Total', 'المجموع')}</span><span>${money(f.total)}</span></div>
          </div>
          <div>
            <div class="small muted">${t('Notes', 'ملاحظات')}</div>
            <div class="small">${esc(f.notes || '-')}</div>
            ${f.due_date ? `<div class="small mt-8 m"><span class="muted">${t('Échéance', 'الاستحقاق')}:</span> ${esc(f.due_date)}</div>`:''}
          </div>
        </div>
      </div>

      <div class="card" style="padding:16px">
        <div class="bold mb-8">💳 ${t('Paiement', 'الدفع')}</div>
        <div class="row between"><span class="muted">${t('Total', 'المجموع')}</span><span>${money(f.total)}</span></div>
        <div class="row between"><span class="muted">${t('Payé', 'مدفوع')}</span><span class="bold" style="color:var(--green)">${money(f.paid_amount)}</span></div>
        <div class="row between" style="margin-top:4px"><span class="muted">${t('Reste', 'باقي')}</span><span class="bold" style="color:${remaining>0?'var(--red)':'var(--green)'}">${money(remaining)}</span></div>
        <hr style="border:none;border-top:1px solid var(--border);margin:12px 0">
        <div class="bold small mb-8">${t('Historique des paiements', 'سجل الدفعات')}</div>
        ${payHist}
        <div class="mt-12">
          <label class="row gap-8 small"><input type="checkbox" id="reminders-cb" ${f.reminders_enabled?'checked':''} onchange="toggleReminders()"> ${t('Activer les rappels automatiques', 'تفعيل التذكيرات التلقائية')}</label>
        </div>
      </div>

      <div class="card" style="padding:16px">
        <div class="bold mb-8">${t('Statut', 'الحالة')}</div>
        <div class="row gap-8 wrap">
          <button class="btn btn-outline btn-sm" onclick="mark('sent')">${t('Envoyée', 'أُرسلت')}</button>
          <button class="btn btn-green btn-sm" onclick="mark('paid')">✓ ${t('Payée', 'مدفوعة')}</button>
          <button class="btn btn-amber-ghost btn-sm" onclick="mark('unpaid')">${t('Non payée', 'غير مدفوعة')}</button>
          <button class="btn btn-outline btn-sm" onclick="mark('overdue')">${t('En retard', 'متأخرة')}</button>
          <button class="btn btn-danger-ghost btn-sm" onclick="mark('cancelled')">${t('Annulée', 'ملغاة')}</button>
        </div>
        <div id="result" class="mt-12"></div>
      </div>
    </div>
  `;
}

export async function after(id) {
  const fid = id;
  window.genPdf = async () => {
    try {
      const res = await api('/invoices/' + fid + '/pdf', { method: 'POST', body: {} });
      document.getElementById('result').innerHTML = `<a class="btn btn-green btn-sm" href="${res.url}" target="_blank">⬇️ ${window.t('Télécharger PDF', 'تحميل PDF')}</a>`;
      toast('PDF généré!');
    } catch (e) { toast(e.message, 'error'); }
  };
  window.mark = async (status) => {
    try { await api('/invoices/' + fid + '/status', { method: 'POST', body: { status } }); toast('Mis à jour.'); navigate('/app/factures/' + fid); }
    catch (e) { toast(e.message, 'error'); }
  };
  window.toggleReminders = async () => {
    const on = document.getElementById('reminders-cb').checked ? 1 : 0;
    try { await api('/invoices/' + fid, { method: 'PUT', body: { reminders_enabled: on } }); toast(on ? 'Rappels activés' : 'Rappels désactivés'); }
    catch (e) { toast(e.message, 'error'); }
  };
  window.recordPayment = () => {
    window.openModal(`
      <h3>💳 ${window.t('Enregistrer un paiement', 'تسجيل دفعة')}</h3>
      <div class="field"><label>${window.t('Montant (DA)', 'المبلغ (دج)')}</label><input id="pay-amount" class="input" type="number" min="1"></div>
      <div class="field"><label>${window.t('Méthode', 'الطريقة')}</label>
        <select id="pay-method" class="select">
          <option>Espèces</option><option>Virement</option><option>CCP</option><option>BaridiMob</option><option>Autre</option>
        </select>
      </div>
      <div class="field"><label>${window.t('Notes', 'ملاحظات')}</label><input id="pay-notes" class="input"></div>
      <div class="row gap-8"><button class="btn btn-primary btn-block" onclick="submitPay()">${window.t('Enregistrer', 'حفظ')}</button></div>
    `);
    window.submitPay = async () => {
      const amount = parseFloat(document.getElementById('pay-amount').value);
      if (!amount || amount <= 0) return toast('Montant invalide', 'error');
      const method = document.getElementById('pay-method').value;
      const notes = document.getElementById('pay-notes').value;
      try {
        await api('/invoices/' + fid + '/pay', { method: 'POST', body: { amount, method, notes } });
        toast('Paiement enregistré!');
        closeModal();
        navigate('/app/factures/' + fid);
      } catch (e) { toast(e.message, 'error'); }
    };
  };
}
