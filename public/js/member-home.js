document.getElementById('signOut').addEventListener('click', () => signOut('/auth/login.html'));
const date = (value) => value ? new Date(value).toLocaleString() : '—';
const points = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const empty = (message, columns) => `<tr><td colspan="${columns}" class="muted">${message}</td></tr>`;

function imageUrlForBrowser(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    const fileMatch = url.pathname.match(/^\/file\/d\/([^/]+)/);
    if (url.hostname === 'drive.google.com' && fileMatch) {
      return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileMatch[1])}`;
    }
    return url.href;
  } catch {
    return '';
  }
}

(async () => {
  try {
    const portal = await api('/api/member/portal');
    const { member, summary } = portal;
    document.getElementById('hello').textContent = `Welcome, ${member.fullName}`;
    document.getElementById('who').textContent = member.email || '';
    const profileImage = document.getElementById('profileImage');
    const imageNotice = document.getElementById('imageNotice');
    const imageUrl = imageUrlForBrowser(member.profileImageUrl);
    if (imageUrl) {
      profileImage.src = imageUrl;
      profileImage.hidden = false;
      profileImage.addEventListener('error', () => {
        profileImage.hidden = true;
        imageNotice.textContent = 'Profile image could not be loaded.';
        imageNotice.hidden = false;
      }, { once: true });
    }
    const rows = [['Reference number', member.memberId], ['Department', member.department], ['Email', member.email]];
    document.getElementById('profile').innerHTML = rows.filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
    document.getElementById('summaryCards').innerHTML = [
      ['Total points', points(summary.totalPoints)], ['Point transactions', summary.transactionCount], ['Accepted attendance', summary.attendanceCount],
    ].map(([label, value]) => `<div class="summary-card"><span>${label}</span><strong>${value}</strong></div>`).join('');
    const max = Math.max(...summary.categoryTotals.map((item) => item.points), 0);
    document.getElementById('categorySummary').innerHTML = summary.categoryTotals.length ? summary.categoryTotals.map((item) => `<div class="bar-row"><div class="bar-label"><span>${esc(item.name)}</span><strong>${points(item.points)}</strong></div><div class="bar-track"><i style="width:${max ? Math.max(3, item.points / max * 100) : 0}%"></i></div></div>`).join('') : '<p class="muted">No points have been recorded yet.</p>';
    document.getElementById('attendanceSummary').innerHTML = `<p><strong>${summary.attendanceCount}</strong> accepted attendance record${summary.attendanceCount === 1 ? '' : 's'}.</p><p class="muted">Rejected attempts are shown below for your reference.</p>`;
    document.getElementById('transactionRows').innerHTML = portal.transactions.map((transaction) => `<tr><td>${esc(date(transaction.createdAt))}</td><td>${esc(transaction.activity?.title || '—')}</td><td>${esc(transaction.criterionSnapshot?.categoryName || '—')}</td><td>${esc(transaction.kind)}</td><td>${esc(transaction.reason || '—')}</td><td>${points(transaction.points)}</td></tr>`).join('') || empty('No point transactions yet.', 6);
    document.getElementById('attendanceRows').innerHTML = portal.attendance.map((record) => `<tr><td>${esc(date(record.submittedAt))}</td><td>${esc(record.activity?.title || '—')}</td><td><span class="pill ${record.result === 'accepted' ? '' : 'off'}">${esc(record.result)}</span></td><td>${record.distanceMeters == null ? '—' : `${points(record.distanceMeters)} m`}</td><td>${esc(record.rejectionReason || (record.result === 'accepted' ? 'Attendance accepted' : '—'))}</td></tr>`).join('') || empty('No attendance history yet.', 5);
  } catch (err) {
    if (err.status === 401 || err.status === 403) location.href = '/auth/login.html';
    else document.getElementById('hello').textContent = err.message;
  }
})();
