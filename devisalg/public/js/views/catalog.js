// Catalog: products & services
export const title = () => window.t('Produits & Services', 'المنتجات والخدمات');

export async function render() {
  let [prod, serv] = await Promise.all([api('/business/products'), api('/business/services')]);
  const t = window.t;

  function listItem(type, arr) {
    if (!arr.length) return emptyState('🏷️', t('Aucun', 'لا يوجد'), t('Ajoutez un élément pour que l\'IA réponde avec vos prix.', 'أضف عنصراً ليجيب الذكاء الاصطناعي بأسعارك.'));
    return arr.map((p) => `
      <div class="nav-link" style="margin:0;border-radius:0;border-bottom:1px solid var(--surface-2);gap:12px">
        <div class="grow">
          <span class="bold">${esc(p.name)}</span>
          ${p.description ? `<span class="muted small" style="display:block">${esc(p.description)}</span>`:''}
        </div>
        <span class="bold">${money(p.unit_price)}</span>
        <span class="badge ${p.active?'badge-green':'badge-gray'}">${p.active ? t('Actif','نشط') : t('Inactif','غير نشط')}</span>
        <button class="btn btn-ghost btn-sm" onclick="editItem('${type}',${p.id})">✏️</button>
        <button class="btn btn-danger-ghost btn-sm" onclick="delItem('${type}',${p.id})">🗑</button>
      </div>`).join('');
  }

  return `
    <div class="row between wrap mb-12">
      <div class="bold">${t('Votre catalogue', 'قائمتك')} — ${t('c\'est avec ça que l\'IA répond', 'بهذا يجيب الذكاء الاصطناعي')}</div>
      <div class="row gap-8">
        <button class="btn btn-outline" onclick="addItem('product')">+ ${t('Produit', 'منتج')}</button>
        <button class="btn btn-primary" onclick="addItem('service')">+ ${t('Service', 'خدمة')}</button>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div style="padding:14px 16px;border-bottom:1px solid var(--border)" class="bold">📦 ${t('Produits', 'المنتجات')}</div>
        ${listItem('product', prod)}
      </div>
      <div class="card">
        <div style="padding:14px 16px;border-bottom:1px solid var(--border)" class="bold">🛠️ ${t('Services', 'الخدمات')}</div>
        ${listItem('service', serv)}
      </div>
    </div>
  `;
}

export async function after() {
  window.addItem = (type) => {
    window.openModal(`
      <h3>+ ${type === 'product' ? window.t('Produit', 'منتج') : window.t('Service', 'خدمة')}</h3>
      <div class="field"><label>${window.t('Nom', 'الاسم')}</label><input id="i-name" class="input"></div>
      <div class="field"><label>${window.t('Description', 'الوصف')}</label><textarea id="i-desc" class="textarea"></textarea></div>
      <div class="field"><label>${window.t('Prix unitaire (DA)', 'السعر الوحدة (دج)')}</label><input id="i-price" class="input" type="number" min="0"></div>
      <button class="btn btn-primary btn-block" onclick="saveItem('${type}')">${window.t('Ajouter', 'إضافة')}</button>`);
    window.saveItem = async (t) => {
      const body = { name: document.getElementById('i-name').value.trim(), description: document.getElementById('i-desc').value.trim(), unit_price: parseFloat(document.getElementById('i-price').value) || 0 };
      if (!body.name) return toast('Nom requis', 'error');
      const path = t === 'product' ? '/business/products' : '/business/services';
      try { await api(path, { method: 'POST', body }); toast('Ajouté!'); closeModal(); navigate('/app/facturation'); }
      catch (e) { toast(e.message, 'error'); }
    };
  };
  window.editItem = async (type, id) => {
    const list = await api(type === 'product' ? '/business/products' : '/business/services');
    const it = list.find((x) => x.id === id);
    window.openModal(`<h3>✏️ ${window.t('Modifier', 'تعديل')}</h3>
      <div class="field"><label>${window.t('Nom', 'الاسم')}</label><input id="i-name" class="input" value="${esc(it.name)}"></div>
      <div class="field"><label>${window.t('Description', 'الوصف')}</label><textarea id="i-desc" class="textarea">${esc(it.description||'')}</textarea></div>
      <div class="field"><label>${window.t('Prix unitaire (DA)', 'السعر (دج)')}</label><input id="i-price" class="input" type="number" value="${it.unit_price}"></div>
      <label class="row gap-8 small mb-8"><input type="checkbox" id="i-active" ${it.active?'checked':''}> ${window.t('Actif', 'نشط')}</label>
      <button class="btn btn-primary btn-block" onclick="updateItem('${type}',${id})">${window.t('Enregistrer', 'حفظ')}</button>`);
    window.updateItem = async (t, pid) => {
      const body = { name: document.getElementById('i-name').value.trim(), description: document.getElementById('i-desc').value.trim(), unit_price: parseFloat(document.getElementById('i-price').value) || 0, active: document.getElementById('i-active').checked?1:0 };
      const path = t === 'product' ? '/business/products/' + pid : '/business/services/' + pid;
      try { await api(path, { method: 'PUT', body }); toast('Enregistré!'); closeModal(); navigate('/app/facturation'); }
      catch (e) { toast(e.message, 'error'); }
    };
  };
  window.delItem = async (type, id) => {
    if (!confirm('Supprimer ?')) return;
    const path = type === 'product' ? '/business/products/' + id : '/business/services/' + id;
    try { await api(path, { method: 'DELETE' }); toast('Supprimé'); navigate('/app/facturation'); }
    catch (e) { toast(e.message, 'error'); }
  };
}
