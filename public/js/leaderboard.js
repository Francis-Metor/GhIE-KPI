let leaderboard;
const filter = document.getElementById('categoryFilter');
const message = document.getElementById('leaderboardMsg');
const load = async () => {
  try {
    leaderboard = await api(`/api/leaderboard${filter.value ? `?category=${encodeURIComponent(filter.value)}` : ''}`);
    filter.innerHTML = `<option value="">Overall</option>${leaderboard.categories.map((category) => `<option value="${esc(category.id)}">${esc(category.name)}</option>`).join('')}`;
    filter.value = leaderboard.category || '';
    document.getElementById('leaderboardHead').innerHTML = `<tr><th>Rank</th>${leaderboard.publicFields.includes('fullName') ? '<th>Member</th>' : ''}${leaderboard.publicFields.includes('memberId') ? '<th>Member ID</th>' : ''}${leaderboard.publicFields.includes('department') ? '<th>Department</th>' : ''}${leaderboard.publicFields.includes('profileImageUrl') ? '<th>Profile</th>' : ''}${leaderboard.publicFields.includes('totalPoints') ? '<th>Points</th>' : ''}</tr>`;
    document.getElementById('leaderboardRows').innerHTML = leaderboard.rows.map((row) => `<tr><td>${row.rank}</td>${row.fullName === undefined ? '' : `<td>${esc(row.fullName)}</td>`}${row.memberId === undefined ? '' : `<td>${esc(row.memberId)}</td>`}${row.department === undefined ? '' : `<td>${esc(row.department)}</td>`}${row.profileImageUrl === undefined ? '' : `<td><img class="leaderboard-avatar" src="${esc(row.profileImageUrl)}" alt="" /></td>`}${row.totalPoints === undefined ? '' : `<td><strong>${Number(row.totalPoints).toLocaleString()}</strong></td>`}</tr>`).join('') || '<tr><td colspan="6" class="muted">No published rankings.</td></tr>';
    message.textContent = '';
  } catch (error) {
    message.className = 'msg err';
    message.textContent = error.message;
  }
};
filter.addEventListener('change', load);
load();
