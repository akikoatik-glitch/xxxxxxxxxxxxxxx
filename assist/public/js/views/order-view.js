export default async function (params) {
  const order = await API.fetch(`/api/orders/${params.id}`);
  const currency = API.business.currency || 'DA';
  let items = [];
  try { items = JSON.parse(order.products_json || '[]'); } catch {}

  return {
    html: `
      <div class="section-header">
        <div>
          <h1 class="section-title" style="font-size:18px;display:flex;align-items:center;gap:8px">
            <a class="btn-ghost" data-navigate="/app/orders" style="padding:4px 8px">←</a>
            ${order.number}
            <span class="badge ${badgeClass(order.status)}">${statusLabel(order.status)}</span>
          </h1>
          <p class="section-subtitle">Créée ${timeAgo(order.created_at)}</p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" id="genPdf">📄 Générer PDF</button>
          <select class="form-select" id="statusSelect" style="width:auto;padding:6px 12px;font-size:13px">
            ${['new','confirmed','preparing','shipped','delivered','cancelled'].map(s => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${statusLabel(s)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-2">
        <div class="card">
          <h3 style="font-size:16px;margin-bottom:16px">👤 Client</h3>
          <div style="font-size:14px;display:flex;flex-direction:column;gap:8px">
            <div><strong>Nom :</strong> ${order.customer_name || '—'}</div>
            <div><strong>Téléphone :</strong> ${order.customer_phone || '—'}</div>
            <div><strong>Adresse :</strong> ${order.customer_address || '—'}</div>
            <div><strong>Wilaya :</strong> ${order.customer_wilaya || '—'}</div>
            <div><strong>Commune :</strong> ${order.customer_commune || '—'}</div>
          </div>
        </div>
        <div class="card">
          <h3 style="font-size:16px;margin-bottom:16px">📦 Produits</h3>
          <table style="width:100%">
            <thead><tr><th>Produit</th><th style="text-align:center">Qté</th><th style="text-align:right">Prix</th></tr></thead>
            <tbody>
              ${items.map(i => `<tr><td>${i.name}</td><td style="text-align:center">${i.qty || 1}</td><td style="text-align:right">${money((i.price||0)*(i.qty||1), currency)}</td></tr>`).join('')}
            </tbody>
          </table>
          <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px"><span>Sous-total</span><span>${money(order.subtotal, currency)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px"><span>Livraison</span><span>${money(order.delivery_cost, currency)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:700;color:var(--blue)"><span>Total</span><span>${money(order.total, currency)}</span></div>
          </div>
        </div>
      </div>
      <div class="card" style="margin-top:20px">
        <h3 style="font-size:16px;margin-bottom:12px">📋 Détails</h3>
        <div class="grid grid-3" style="font-size:14px;gap:12px">
          <div><strong>Paiement :</strong> ${order.payment_method || '—'}</div>
          <div><strong>Livraison :</strong> ${order.delivery_method || '—'}</div>
          <div><strong>Notes :</strong> ${order.notes || '—'}</div>
        </div>
        ${order.pdf_path ? `<div style="margin-top:12px"><a href="/data/${order.pdf_path}" target="_blank" class="btn btn-outline btn-sm">📄 Voir le PDF</a></div>` : ''}
        <div id="pdfStatus" style="margin-top:8px;font-size:13px;color:var(--gray)"></div>
      </div>
    `,
    init(root) {
      root.querySelector('#statusSelect').addEventListener('change', async (e) => {
        await API.fetch(`/api/orders/${params.id}/status`, {
          method: 'PATCH', body: JSON.stringify({ status: e.target.value })
        });
        const badge = root.querySelector('.badge');
        badge.className = `badge ${badgeClass(e.target.value)}`;
        badge.textContent = statusLabel(e.target.value);
      });

      root.querySelector('#genPdf').addEventListener('click', async () => {
        const status = root.querySelector('#pdfStatus');
        status.textContent = 'Génération du PDF…';
        try {
          const res = await API.fetch(`/api/orders/${params.id}/pdf`, { method: 'POST' });
          status.innerHTML = `<a href="/data/${res.pdf_path}" target="_blank" style="color:var(--blue)">📄 Télécharger le PDF</a>`;
        } catch (e) {
          status.textContent = 'Erreur: ' + e.message;
        }
      });
    },
  };
}
