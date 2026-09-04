// Business settings / profile
export const title = () => window.t('Paramètres', 'الإعدادات');

export async function render() {
  let b;
  try { b = await api('/business/profile'); }
  catch (e) { return `<div class="empty">⚠️ ${esc(e.message)}</div>`; }
  const t = window.t;

  return `
    <div class="bold mb-12">⚙️ ${t('Paramètres du commerce', 'إعدادات المحل')}</div>

    <div class="card" style="padding:18px">
      <div class="bold mb-12">🏪 ${t('Informations', 'المعلومات')}</div>
      <div class="grid-2">
        <div class="field"><label>${t('Nom du commerce', 'اسم المحل')}</label><input id="s-name" class="input" value="${esc(b.name)}"></div>
        <div class="field"><label>${t('Description', 'الوصف')}</label><input id="s-desc" class="input" value="${esc(b.description||'')}"></div>
        <div class="field"><label>${t('Téléphone', 'الهاتف')}</label><input id="s-phone" class="input" value="${esc(b.phone||'')}"></div>
        <div class="field"><label>Email</label><input id="s-email" class="input" value="${esc(b.email||'')}"></div>
        <div class="field"><label>${t('Adresse', 'العنوان')}</label><input id="s-address" class="input" value="${esc(b.address||'')}"></div>
        <div class="field"><label>${t('Heures d\'ouverture', 'ساعات العمل')}</label><input id="s-hours" class="input" value="${esc(b.opening_hours||'')}" placeholder="Lun-Sam 8h-18h"></div>
        <div class="field"><label>${t('Infos livraison', 'معلومات التوصيل')}</label><input id="s-delivery" class="input" value="${esc(b.delivery_info||'')}"></div>
        <div class="field"><label>${t('Méthodes de paiement', 'طرق الدفع')}</label><input id="s-payment" class="input" value="${esc(b.payment_methods||'')}" placeholder="Espèces, CCP, BaridiMob"></div>
      </div>
      <button class="btn btn-primary" onclick="saveProfile()">${t('Enregistrer', 'حفظ')}</button>
    </div>

    <div class="card mt-12" style="padding:18px">
      <div class="bold mb-12">🖼️ ${t('Logo du commerce', 'شعار المحل')}</div>
      <p class="small muted">${t('Le logo apparaît sur vos Devis et Factures PDF.', 'يظهر الشعار في عروض الأسعار والفواتير.')}</p>
      ${b.logo_path ? `<div class="small">${t('Logo chargé', 'تم تحميل الشعار')}: ${esc(b.logo_path)}</div>` : ''}
      <input type="file" id="logo-file" accept="image/png,image/jpeg,image/webp,image/gif" class="mt-8" style="font-size:14px">
      <button class="btn btn-outline btn-sm mt-8" onclick="uploadLogo()">${t('Téléverser le logo', 'رفع الشعار')}</button>
    </div>

    <div class="card mt-12" style="padding:18px">
      <div class="bold mb-12">📊 ${t('Mon offre', 'العرض الخاص بي')}</div>
      <button class="btn btn-outline" onclick="navigate('/app/forfait')">${t('Voir mon plan', 'عرض باقتي')}</button>
    </div>
  `;
}

export async function after() {
  window.saveProfile = async () => {
    const body = {
      name: document.getElementById('s-name').value.trim(),
      description: document.getElementById('s-desc').value.trim(),
      phone: document.getElementById('s-phone').value.trim(),
      email: document.getElementById('s-email').value.trim(),
      address: document.getElementById('s-address').value.trim(),
      opening_hours: document.getElementById('s-hours').value.trim(),
      delivery_info: document.getElementById('s-delivery').value.trim(),
      payment_methods: document.getElementById('s-payment').value.trim(),
    };
    try { await api('/business/profile', { method: 'PUT', body }); toast('Enregistré!'); }
    catch (e) { toast(e.message, 'error'); }
  };
  window.uploadLogo = async () => {
    const file = document.getElementById('logo-file').files[0];
    if (!file) return toast('Choisissez un fichier', 'error');
    const fd = new FormData();
    fd.append('logo', file);
    try {
      const res = await fetch('/api/business/logo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast('Logo chargé!'); navigate('/app/parametres');
    } catch (e) { toast(e.message, 'error'); }
  };
}
