const awardMsg = document.getElementById('awardMsg');
const awardSay = (text, ok) => { awardMsg.className = `msg ${ok ? 'ok' : 'err'}`; awardMsg.textContent = text; };
let options = { members: [], criteria: [], transactions: [] };
const selectedBulk = new Map();
const memberLabel = (member) => `${member.fullName} (${member.memberId})`;
const memberMatches = (query) => {
  const search = query.trim().toLowerCase();
  if (!search) return [];
  return options.members.filter((member) => `${member.fullName} ${member.memberId}`.toLowerCase().includes(search)).slice(0, 20);
};
const renderIndividualMatches = () => {
  const matches = memberMatches(document.getElementById('individualSearch').value);
  document.getElementById('individualMatches').innerHTML = matches.map((member) =>
    `<button type="button" class="search-match" data-individual-id="${esc(member._id)}">${esc(memberLabel(member))}</button>`).join('');
};
const renderBulkMatches = () => {
  const matches = memberMatches(document.getElementById('bulkSearch').value);
  document.getElementById('bulkMatches').innerHTML = matches.map((member) =>
    `<label class="member-check"><input type="checkbox" data-bulk-id="${esc(member._id)}" ${selectedBulk.has(member._id) ? 'checked' : ''} /> <span>${esc(memberLabel(member))}</span></label>`).join('');
};
const renderBulkSelected = () => {
  const target = document.getElementById('bulkSelected');
  target.innerHTML = selectedBulk.size ? [...selectedBulk.values()].map((member) =>
    `<span class="selected-chip">${esc(memberLabel(member))}<button type="button" data-remove-bulk="${esc(member._id)}" aria-label="Remove ${esc(member.fullName)}">×</button></span>`).join('') : '<p class="muted small">No members selected.</p>';
};
async function loadAwards() {
  options = await api('/api/admin/scoring/awards/options');
  const criterionOptions = options.criteria.map((criterion) => `<option value="${esc(criterion._id)}">${esc(criterion.name)} (${esc(criterion.points)} points)</option>`).join('');
  document.getElementById('individualCriterion').innerHTML = criterionOptions;
  document.getElementById('bulkCriterion').innerHTML = criterionOptions;
  document.getElementById('adjustTransaction').innerHTML = options.transactions.map((transaction) => `<option value="${esc(transaction._id)}">${esc(transaction.member?.fullName || 'Unknown member')} · ${esc(transaction.points)} points · ${esc(transaction.kind)} · ${new Date(transaction.createdAt).toLocaleString()}</option>`).join('');
  document.getElementById('ledgerRows').innerHTML = options.transactions.map((transaction) => `<div class="manage-row"><span><strong>${esc(transaction.member?.fullName || 'Unknown member')}</strong><br><span class="muted small">${esc(transaction.points)} points · ${esc(transaction.kind)} · ${esc(transaction.reason || 'No note')}</span></span></div>`).join('') || '<p class="muted">No ledger entries yet.</p>';
  renderIndividualMatches();
  renderBulkMatches();
  renderBulkSelected();
}
document.getElementById('individualSearch').addEventListener('input', renderIndividualMatches);
document.getElementById('bulkSearch').addEventListener('input', renderBulkMatches);
document.getElementById('individualMatches').addEventListener('click', (event) => {
  const member = options.members.find((item) => item._id === event.target.dataset.individualId);
  if (!member) return;
  document.getElementById('individualMember').value = member._id;
  document.getElementById('individualSearch').value = memberLabel(member);
  document.getElementById('individualSelected').textContent = `Selected: ${memberLabel(member)}`;
  document.getElementById('individualMatches').innerHTML = '';
});
document.getElementById('bulkMatches').addEventListener('change', (event) => {
  const member = options.members.find((item) => item._id === event.target.dataset.bulkId);
  if (!member) return;
  if (event.target.checked) selectedBulk.set(member._id, member);
  else selectedBulk.delete(member._id);
  renderBulkSelected();
});
document.getElementById('bulkSelected').addEventListener('click', (event) => {
  const id = event.target.dataset.removeBulk;
  if (!id) return;
  selectedBulk.delete(id);
  renderBulkMatches();
  renderBulkSelected();
});
document.getElementById('individualForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try { await api('/api/admin/scoring/awards', { method: 'POST', body: Object.fromEntries(new FormData(event.target)) }); awardSay('Points awarded.', true); event.target.reset(); await loadAwards(); } catch (err) { awardSay(err.message, false); }
});
document.getElementById('bulkForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try { const form = event.target; const body = Object.fromEntries(new FormData(form)); body.memberIds = [...selectedBulk.keys()]; if (!body.memberIds.length) throw new Error('Select at least one member.'); await api('/api/admin/scoring/awards/bulk', { method: 'POST', body }); awardSay(`Bulk award applied to ${body.memberIds.length} members.`, true); selectedBulk.clear(); form.reset(); await loadAwards(); } catch (err) { awardSay(err.message, false); }
});
document.getElementById('adjustForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try { const body = Object.fromEntries(new FormData(event.target)); const endpoint = body.kind === 'reverse' ? 'reverse' : 'correct'; await api(`/api/admin/scoring/awards/${endpoint}`, { method: 'POST', body }); awardSay(body.kind === 'reverse' ? 'Transaction reversed.' : 'Correction recorded.', true); event.target.reset(); await loadAwards(); } catch (err) { awardSay(err.message, false); }
});
loadAwards().catch((err) => awardSay(err.message, false));
