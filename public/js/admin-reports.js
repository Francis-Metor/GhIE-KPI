const filters = document.getElementById('reportFilters');
const dateText = (value) => value ? new Date(value).toLocaleString() : '—';
const pointText = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const query = () => {
  const params = new URLSearchParams();
  new FormData(filters).forEach((value, key) => { if (value) params.set(key, value); });
  return params;
};
const empty = (columns, text) => `<tr><td colspan="${columns}" class="muted">${text}</td></tr>`;
async function load() {
  const params = query();
  const [attendance, scoring, imports, audit] = await Promise.all([
    api(`/api/admin/reports/attendance?${params}`), api(`/api/admin/reports/scoring?${params}`),
    api('/api/admin/reports/imports'), api('/api/admin/reports/audit'),
  ]);
  document.getElementById('attendanceSummary').textContent = `${attendance.count} records · ${attendance.accepted} accepted · ${attendance.rejected} rejected`;
  document.getElementById('scoringSummary').textContent = `${scoring.count} transactions · ${pointText(scoring.totalPoints)} net points`;
  document.getElementById('attendanceRows').innerHTML = attendance.rows.map((row) => `<tr><td>${esc(dateText(row.submittedAt))}</td><td>${esc(row.member?.fullName || '—')}<br><span class="muted small">${esc(row.member?.memberId || '')}</span></td><td>${esc(row.activity?.title || '—')}</td><td><span class="pill ${row.result === 'accepted' ? '' : 'off'}">${esc(row.result)}</span></td><td>${row.distanceMeters == null ? '—' : `${pointText(row.distanceMeters)} m`}</td><td>${esc(row.rejectionReason || 'Accepted')}</td></tr>`).join('') || empty(6, 'No attendance records.') ;
  document.getElementById('scoringRows').innerHTML = scoring.rows.map((row) => `<tr><td>${esc(dateText(row.createdAt))}</td><td>${esc(row.member?.fullName || '—')}</td><td>${esc(row.criterionSnapshot?.categoryName || '—')}</td><td>${esc(row.criterionSnapshot?.criterionName || '—')}</td><td>${esc(row.source)}</td><td>${pointText(row.points)}</td></tr>`).join('') || empty(6, 'No scoring transactions.');
  document.getElementById('importRows').innerHTML = imports.rows.map((row) => `<tr><td>${esc(dateText(row.createdAt))}</td><td>${esc(row.fileName)}</td><td>${esc(row.status)}</td><td>${esc(row.performedBy?.email || '—')}</td><td>${row.counts?.totalRows || 0}</td><td>${row.counts?.created || 0}</td><td>${row.counts?.updated || 0}</td><td>${row.counts?.failed || 0}</td></tr>`).join('') || empty(8, 'No import history.');
  document.getElementById('auditRows').innerHTML = audit.rows.map((row) => `<tr><td>${esc(dateText(row.createdAt))}</td><td>${esc(row.action)}</td><td>${esc(row.actor?.email || row.actorRole || '—')}</td><td>${esc(row.targetType || '—')}</td><td>${esc(row.summary || '')}</td></tr>`).join('') || empty(5, 'No audit entries.');
}
function exportReport(type) { const params = query(); params.set('type', type); location.href = `/api/admin/reports/export?${params}`; }
filters.addEventListener('submit', (event) => { event.preventDefault(); load().catch((error) => { document.getElementById('reportMsg').textContent = error.message; }); });
document.getElementById('attendanceExport').addEventListener('click', () => exportReport('attendance'));
document.getElementById('scoringExport').addEventListener('click', () => exportReport('scoring'));
document.getElementById('importsExport').addEventListener('click', () => exportReport('imports'));
document.getElementById('auditExport').addEventListener('click', () => exportReport('audit'));
load().catch((error) => { document.getElementById('reportMsg').className = 'msg err'; document.getElementById('reportMsg').textContent = error.message; });
