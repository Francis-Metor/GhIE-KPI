const form = document.getElementById('leaderboardForm');
const say = (text, ok) => { const msg = document.getElementById('leaderboardMsg'); msg.className = `msg ${ok ? 'ok' : 'err'}`; msg.textContent = text; };
const localDate = (value) => value ? new Date(value).toISOString().slice(0, 16) : '';
function renderPreview(data) {
  const fields = data.publicFields;
  document.getElementById('previewHead').innerHTML = `<tr><th>Rank</th>${fields.includes('fullName') ? '<th>Member</th>' : ''}${fields.includes('memberId') ? '<th>Member ID</th>' : ''}${fields.includes('department') ? '<th>Department</th>' : ''}${fields.includes('memberType') ? '<th>Member type</th>' : ''}${fields.includes('totalPoints') ? '<th>Points</th>' : ''}</tr>`;
  document.getElementById('previewRows').innerHTML = data.rows.map((row) => `<tr><td>${row.rank}</td>${row.fullName === undefined ? '' : `<td>${esc(row.fullName)}</td>`}${row.memberId === undefined ? '' : `<td>${esc(row.memberId)}</td>`}${row.department === undefined ? '' : `<td>${esc(row.department)}</td>`}${row.memberType === undefined ? '' : `<td>${esc(row.memberType)}</td>`}${row.totalPoints === undefined ? '' : `<td>${row.totalPoints}</td>`}</tr>`).join('') || '<tr><td colspan="6" class="muted">No points recorded.</td></tr>';
}
async function load() {
  const { setting } = await api('/api/admin/leaderboard/settings');
  form.visibility.value = setting.visibility;
  form.publishAt.value = localDate(setting.publishAt);
  form.unpublishAt.value = localDate(setting.unpublishAt);
  form.tieHandling.value = setting.tieHandling;
  form.showCategoryRankings.checked = setting.showCategoryRankings;
  form.querySelectorAll('[name="publicFields"]').forEach((field) => { field.checked = setting.publicFields.includes(field.value); });
  renderPreview(await api('/api/admin/leaderboard/preview'));
}
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = Object.fromEntries(new FormData(form));
    data.publicFields = [...form.querySelectorAll('[name="publicFields"]:checked')].map((field) => field.value);
    data.showCategoryRankings = form.showCategoryRankings.checked;
    await api('/api/admin/leaderboard/settings', { method: 'PATCH', body: data });
    say('Publication settings saved.', true);
    renderPreview(await api('/api/admin/leaderboard/preview'));
  } catch (error) { say(error.message, false); }
});
load().catch((error) => say(error.message, false));
