const importMsg = document.getElementById('importMsg');
const importSay = (text, ok) => { importMsg.className = `msg ${ok ? 'ok' : 'err'}`; importMsg.textContent = text; };
const memberListMsg = document.getElementById('memberListMsg');
const editForm = document.getElementById('memberEditForm');
const editMsg = document.getElementById('memberEditMsg');
let page = 1;
let pages = 1;

const say = (element, text, ok) => { element.className = `msg ${ok ? 'ok' : 'err'}`; element.textContent = text; };

async function loadColumns() {
  const { columns } = await api('/api/admin/members/import/columns');
  document.getElementById('memberColumns').innerHTML = columns.map((column) => `<span class="column-chip">${esc(column.label)}${column.required ? ' <strong>(required)</strong>' : ''}</span>`).join('');
}

async function loadMembers() {
  const form = document.getElementById('memberSearchForm');
  const params = new URLSearchParams({ search: form.elements.search.value, status: form.elements.status.value, page, limit: 25 });
  try {
    const result = await api(`/api/admin/members?${params}`);
    pages = result.pagination.pages || 1;
    document.getElementById('memberPage').textContent = `Page ${result.pagination.page} of ${pages} (${result.pagination.total} members)`;
    document.getElementById('previousMembers').disabled = page <= 1;
    document.getElementById('nextMembers').disabled = page >= pages;
    document.getElementById('memberRows').innerHTML = result.members.map((member) => `<tr><td>${esc(member.memberId)}</td><td>${esc(member.fullName)}</td><td>${esc(member.department || '—')}</td><td>${esc(member.email || '—')}</td><td>${esc(member.phone || '—')}</td><td><span class="pill ${member.status === 'active' ? '' : 'off'}">${esc(member.status)}</span></td><td><button type="button" class="quiet edit-member" data-member-id="${esc(member.id)}">Edit</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">No members found.</td></tr>';
    document.querySelectorAll('.edit-member').forEach((button) => button.addEventListener('click', () => openEditor(result.members.find((member) => member.id === button.dataset.memberId))));
    say(memberListMsg, '', true);
  } catch (error) { say(memberListMsg, error.message, false); }
}

function openEditor(member) {
  if (!member) return;
  document.getElementById('memberEditor').hidden = false;
  Object.entries(member).forEach(([key, value]) => { if (editForm.elements[key]) editForm.elements[key].value = value || ''; });
  editForm.elements.id.value = member.id;
  editForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.getElementById('memberSearchForm').addEventListener('submit', (event) => { event.preventDefault(); page = 1; loadMembers(); });
document.getElementById('previousMembers').addEventListener('click', () => { if (page > 1) { page -= 1; loadMembers(); } });
document.getElementById('nextMembers').addEventListener('click', () => { if (page < pages) { page += 1; loadMembers(); } });
document.getElementById('cancelMemberEdit').addEventListener('click', () => { document.getElementById('memberEditor').hidden = true; editForm.reset(); });
editForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = editForm.elements.id.value;
  const body = Object.fromEntries(new FormData(editForm));
  delete body.id;
  try {
    await api(`/api/admin/members/${encodeURIComponent(id)}`, { method: 'PATCH', body });
    say(editMsg, 'Member updated.', true);
    await loadMembers();
  } catch (error) { say(editMsg, error.message, false); }
});

document.getElementById('memberImportForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = document.getElementById('memberFile').files[0];
  if (!file) return;
  try {
    const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1] || ''); reader.onerror = () => reject(new Error('The selected file could not be read.')); reader.readAsDataURL(file); });
    const result = await api('/api/admin/members/import/upload', { method: 'POST', body: { fileName: file.name, data } });
    importSay(`Imported ${result.counts.totalRows} rows: ${result.counts.created} created and ${result.counts.updated} updated.`, true); event.target.reset(); loadMembers();
  } catch (err) { importSay(err.message, false); }
});

Promise.all([loadColumns(), loadMembers()]).catch((err) => importSay(err.message, false));
