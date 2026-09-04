export default async function () {
  const orders = await API.fetch('/api/orders');
  const currency = API.business.currency || 'DA';

  return {
    html: `
      <div class="section-header">
        <div><h1 class="section-title">Commandes</h1><p class="section-subtitle">${orders.length} commande(s)</p></div>
        <select class="form-select" id="statusFilter" style="width:auto">
          <option value="">Tous les statuts</option>
          <option value="new">Nouveau</option>
          <option value="confirmed">Confirmé</option>
          <option value="preparing">En préparation</option>
          <option value="shipped">Expédié</option>
          <option value="delivered">Livré</option>
          <option value="cancelled">Annulé</option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Numéro</th><th>Client</th><th>Wilaya</th><th>Total</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody id="ordersBody">
            ${orders.length === 0 ? '<tr><td colspan="7" style="text-align:center;color:var(--gray);padding:40px">Aucune commande</td></tr>' : ''}
            ${orders.map(o => `
              <tr data-status="${o.status}">
                <td><a data-navigate="/app/order/${o.id}" style="color:var(--blue);font-weight:600;cursor:pointer">${o.number}</a></td>
                <td>${o.customer_name || '—'}</td>
                <td>${o.customer_wilaya || '—'}</td>
                <td><strong>${money(o.total, currency)}</strong></td>
                <td><span class="badge ${badgeClass(o.status)}">${statusLabel(o.status)}</span></td>
                <td style="font-size:13px;color:var(--gray)">${timeAgo(o.created_at)}</td>
                <td>
                  <select class="form-select status-change" data-id="${o.id}" style="width:auto;padding:4px 8px;font-size:12px">
                    ${['new','confirmed','preparing','shipped','delivered','cancelled'].map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${statusLabel(s)}</option>`).join('')}
                  </select>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `,
    init(root) {
      root.querySelectorAll('.status-change').forEach(sel => {
        sel.addEventListener('change', async () => {
          await API.fetch(`/api/orders/${sel.dataset.id}/status`, {
            method: 'PATCH', body: JSON.stringify({ status: sel.value })
          });
          const badge = sel.closest('tr').querySelector('.badge');
          badge.className = `badge ${badgeClass(sel.value)}`;
          badge.textContent = statusLabel(sel.value);
        });
      });

      const filter = root.querySelector('#statusFilter');
      if (filter) {
        filter.addEventListener('change', () => {
          const val = filter.value;
          root.querySelectorAll('#ordersBody tr').forEach(tr => {
            if (!val || tr.dataset.status === val) tr.style.display = '';
            else tr.style.display = 'none';
          });
        });
      }
    },
  };
}
