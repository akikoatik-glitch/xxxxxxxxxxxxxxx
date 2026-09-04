export default async function () {
  const customers = await API.fetch('/api/customers');

  return `
    <div class="section-header">
      <div><h1 class="section-title">Clients</h1><p class="section-subtitle">${customers.length} client(s)</p></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nom</th><th>Téléphone</th><th>Wilaya</th><th>Plateforme</th><th>Date</th></tr></thead>
        <tbody>
          ${customers.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--gray);padding:40px">Aucun client pour le moment</td></tr>' : ''}
          ${customers.map(c => `
            <tr>
              <td><strong>${c.name || '—'}</strong></td>
              <td>${c.phone || '—'}</td>
              <td>${c.wilaya || '—'}</td>
              <td><span class="badge" style="background:${platformColor(c.platform)}22;color:${platformColor(c.platform)}">${platformLabel(c.platform) || '—'}</span></td>
              <td style="font-size:13px;color:var(--gray)">${timeAgo(c.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
