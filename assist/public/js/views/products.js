export default async function () {
  const products = await API.fetch('/api/products');
  const currency = API.business.currency || 'DA';

  return {
    html: `
      <div class="section-header">
        <div><h1 class="section-title">Produits</h1><p class="section-subtitle">${products.length} produit(s)</p></div>
        <button class="btn btn-primary" id="addProduct">+ Ajouter</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nom</th><th>Catégorie</th><th>Prix</th><th>Stock</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            ${products.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:var(--gray);padding:40px">Aucun produit. Ajoutez votre premier produit !</td></tr>' : ''}
            ${products.map(p => `
              <tr>
                <td><strong>${p.name}</strong><br><span style="font-size:12px;color:var(--gray)">${(p.description || '').slice(0, 60)}</span></td>
                <td>${p.category || '—'}</td>
                <td><strong>${money(p.unit_price, currency)}</strong></td>
                <td>${p.stock >= 0 ? p.stock : '∞'}</td>
                <td><span class="badge ${p.active ? 'badge-active' : 'badge-cancelled'}">${p.active ? 'Actif' : 'Inactif'}</span></td>
                <td>
                  <button class="btn btn-ghost btn-sm edit-product" data-id="${p.id}" data-name="${p.name}" data-desc="${(p.description||'').replace(/"/g,'&quot;')}" data-price="${p.unit_price}" data-stock="${p.stock}" data-cat="${p.category}">✏️</button>
                  <button class="btn btn-ghost btn-sm delete-product" data-id="${p.id}" style="color:var(--red)">🗑</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div id="productModal" style="display:none;position:fixed;inset:0;z-index:100;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);backdrop-filter:blur(4px)">
        <div class="card" style="width:480px;max-width:90vw;padding:32px">
          <h2 style="font-size:18px;margin-bottom:20px" id="modalTitle">Ajouter un produit</h2>
          <form id="productForm">
            <input type="hidden" id="editId" value="">
            <div class="form-group"><label>Nom</label><input class="form-input" id="pName" required></div>
            <div class="form-group"><label>Description</label><textarea class="form-textarea" id="pDesc"></textarea></div>
            <div class="grid grid-2">
              <div class="form-group"><label>Prix (${currency})</label><input class="form-input" id="pPrice" type="number" step="0.01" required></div>
              <div class="form-group"><label>Stock (-1 = illimité)</label><input class="form-input" id="pStock" type="number" value="-1"></div>
            </div>
            <div class="form-group"><label>Catégorie</label><input class="form-input" id="pCat" value="general"></div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
              <button type="button" class="btn btn-outline" id="closeModal">Annuler</button>
              <button type="submit" class="btn btn-primary">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>
    `,
    init(root) {
      const modal = root.querySelector('#productModal');
      const form = root.querySelector('#productForm');
      const title = root.querySelector('#modalTitle');

      function openModal(data) {
        modal.style.display = 'flex';
        if (data) {
          title.textContent = 'Modifier le produit';
          root.querySelector('#editId').value = data.id;
          root.querySelector('#pName').value = data.name;
          root.querySelector('#pDesc').value = data.description || '';
          root.querySelector('#pPrice').value = data.price;
          root.querySelector('#pStock').value = data.stock;
          root.querySelector('#pCat').value = data.category;
        } else {
          title.textContent = 'Ajouter un produit';
          form.reset();
          root.querySelector('#editId').value = '';
        }
      }

      root.querySelector('#addProduct').addEventListener('click', () => openModal(null));
      root.querySelector('#closeModal').addEventListener('click', () => modal.style.display = 'none');
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

      root.querySelectorAll('.edit-product').forEach(btn => {
        btn.addEventListener('click', () => openModal(btn.dataset));
      });

      root.querySelectorAll('.delete-product').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Supprimer ce produit ?')) return;
          await API.fetch(`/api/products/${btn.dataset.id}`, { method: 'DELETE' });
          window.location.reload();
        });
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = root.querySelector('#editId').value;
        const body = {
          name: root.querySelector('#pName').value,
          description: root.querySelector('#pDesc').value,
          unit_price: parseFloat(root.querySelector('#pPrice').value) || 0,
          stock: parseInt(root.querySelector('#pStock').value) || -1,
          category: root.querySelector('#pCat').value || 'general',
        };
        if (editId) {
          await API.fetch(`/api/products/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
        } else {
          await API.fetch('/api/products', { method: 'POST', body: JSON.stringify(body) });
        }
        window.location.reload();
      });
    },
  };
}
