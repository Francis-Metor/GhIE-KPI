let report = { categories: [], rows: [], summary: { categoryTotals: [], topMembers: [] } };
const form = document.getElementById('analyticsFilters');
const queryString = () => {
  const params = new URLSearchParams();
  new FormData(form).forEach((value, key) => { if (value) params.set(key, value); });
  return params;
};
const points = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
function renderSummary() {
  const { memberCount, transactionCount, totalPoints } = report.summary;
  document.getElementById('summaryCards').innerHTML = [
    ['Members', memberCount], ['Transactions', transactionCount], ['Total points', points(totalPoints)],
  ].map(([label, value]) => `<div class="summary-card"><span>${label}</span><strong>${value}</strong></div>`).join('');
}
function renderBars(targetId, items, labelKey) {
  const target = document.getElementById(targetId);
  const max = Math.max(...items.map((item) => Number(item.totalPoints) || 0), 0);
  target.innerHTML = items.length ? items.map((item) => {
    const width = max ? Math.max(3, (item.totalPoints / max) * 100) : 0;
    const label = labelKey === 'fullName' ? `${item.fullName} (${item.memberId})` : item.name;
    return `<div class="bar-row"><div class="bar-label"><span>${esc(label)}</span><strong>${points(item.totalPoints)}</strong></div><div class="bar-track"><i style="width:${width}%"></i></div></div>`;
  }).join('') : '<p class="muted">No ledger data for these filters.</p>';
}
function renderTable() {
  document.getElementById('scoreHead').innerHTML = `<tr><th>Member</th><th>Department</th>${report.categories.map((category) => `<th>${esc(category.name)}</th>`).join('')}<th>Total</th><th>Transactions</th></tr>`;
  document.getElementById('scoreBody').innerHTML = report.rows.map((row) => `<tr><td><strong>${esc(row.fullName)}</strong><br><span class="muted small">${esc(row.memberId)}</span></td><td>${esc(row.department)}</td>${report.categories.map((category) => `<td>${points(row.categoryPoints[category.id])}</td>`).join('')}<td><strong>${points(row.totalPoints)}</strong></td><td>${row.transactions}</td></tr>`).join('') || '<tr><td colspan="99" class="muted">No members match these filters.</td></tr>';
}
async function loadReport() {
  const query = queryString();
  try {
    report = await api(`/api/admin/analytics?${query}`);
    const categoryFilter = document.getElementById('categoryFilter');
    const selected = categoryFilter.value;
    categoryFilter.innerHTML = `<option value="">All categories</option>${report.categories.map((category) => `<option value="${esc(category.id)}">${esc(category.name)}</option>`).join('')}`;
    categoryFilter.value = selected;
    renderSummary();
    renderBars('categoryChart', report.summary.categoryTotals, 'name');
    renderBars('memberChart', report.summary.topMembers, 'fullName');
    renderTable();
    document.getElementById('analyticsMsg').textContent = '';
  } catch (error) {
    document.getElementById('analyticsMsg').textContent = error.message;
    document.getElementById('analyticsMsg').className = 'msg err';
  }
}
function exportReport(format) {
  const query = queryString();
  query.set('format', format);
  location.href = `/api/admin/analytics/export?${query}`;
}
form.addEventListener('submit', (event) => { event.preventDefault(); loadReport(); });
document.getElementById('exportCsv').addEventListener('click', () => exportReport('csv'));
document.getElementById('exportXlsx').addEventListener('click', () => exportReport('xlsx'));
loadReport();
