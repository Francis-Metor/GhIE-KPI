const adminMsg = document.getElementById('msg');
const adminSay = (text, ok) => { adminMsg.className = `msg ${ok ? 'ok' : 'err'}`; adminMsg.textContent = text; };
async function loadAdmins() {
  const { admins, currentUserId } = await api('/api/admin/admins');
  document.getElementById('adminRows').innerHTML = admins.map((admin) => {
    const self = admin._id === currentUserId;
    const next = admin.status === 'active' ? 'disabled' : 'active';
    return `<tr><td>${esc(admin.displayName)}${self ? ' <span class="muted small">(you)</span>' : ''}</td><td>${esc(admin.email)}</td><td><span class="pill ${admin.status === 'active' ? '' : 'off'}">${esc(admin.status)}</span></td><td class="small muted">${admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : 'Never'}</td><td>${self ? '' : `<button class="quiet" data-id="${esc(admin._id)}" data-status="${next}">${next === 'disabled' ? 'Disable' : 'Enable'}</button>`}<button class="quiet" data-id="${esc(admin._id)}" data-reset="1">Reset reference</button></td></tr>`;
  }).join('');
}
document.getElementById('adminRows').addEventListener('click', async (event) => {
  const { id, status, reset } = event.target.dataset;
  if (!id) return;
  try {
    if (reset) { const reference = prompt('New reference number:'); if (!reference) return; await api(`/api/admin/admins/${id}/reference`, { method: 'PUT', body: { reference } }); adminSay('Reference updated.', true); }
    else { await api(`/api/admin/admins/${id}/status`, { method: 'PATCH', body: { status } }); adminSay('Administrator status updated.', true); }
    await loadAdmins();
  } catch (err) { adminSay(err.message, false); }
});
document.getElementById('addForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try { const form = event.target; await api('/api/admin/admins', { method: 'POST', body: Object.fromEntries(new FormData(form)) }); form.reset(); adminSay('Administrator added.', true); await loadAdmins(); } catch (err) { adminSay(err.message, false); }
});
loadAdmins().catch((err) => adminSay(err.message, false));
