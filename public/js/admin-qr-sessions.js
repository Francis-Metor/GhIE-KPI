const sessionMsg = document.getElementById('sessionMsg');
const sessionSay = (text, ok) => { sessionMsg.className = `msg ${ok ? 'ok' : 'err'}`; sessionMsg.textContent = text; };
const fmt = (date) => new Date(date).toLocaleString();
let activities = [];

async function loadQrPage() {
  const [{ activities: available }, { sessions }] = await Promise.all([
    api('/api/admin/activities'),
    api('/api/attendance/sessions'),
  ]);
  activities = available;
  document.getElementById('sessionActivity').innerHTML = available.filter((item) => item.status !== 'cancelled')
    .map((item) => `<option value="${esc(item._id)}">${esc(item.title)} — ${fmt(item.startsAt)}</option>`).join('');
  document.getElementById('sessionRows').innerHTML = sessions.map((session) => {
    const expired = new Date(session.expiresAt) <= new Date();
    const state = session.status === 'revoked' ? 'revoked' : expired ? 'expired' : 'active';
    return `<div class="session-row"><span><strong>${esc(session.activity?.title || 'Unknown activity')}</strong><br><span class="muted small">${fmt(session.startsAt)} to ${fmt(session.expiresAt)} · ${state}</span></span>
      ${state === 'active' ? `<button class="quiet" data-revoke="${esc(session._id)}">Revoke</button>` : ''}</div>`;
  }).join('') || '<p class="muted">No QR sessions yet.</p>';
}

document.getElementById('sessionForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const result = await api('/api/attendance/sessions', { method: 'POST', body: Object.fromEntries(new FormData(event.target)) });
    document.getElementById('currentQr').hidden = false;
    document.getElementById('qrTitle').textContent = result.session.activity.title;
    document.getElementById('qrDetails').textContent = `${fmt(result.session.startsAt)} to ${fmt(result.session.expiresAt)} · ${result.session.venue.name || 'Venue'}`;
    document.getElementById('qrImage').src = result.qrDataUrl;
    document.getElementById('downloadQr').href = result.qrDataUrl;
    sessionSay('QR session generated.', true);
    await loadQrPage();
  } catch (err) { sessionSay(err.message, false); }
});

document.getElementById('printQr').addEventListener('click', () => window.print());
document.getElementById('sessionRows').addEventListener('click', async (event) => {
  const id = event.target.dataset.revoke;
  if (!id || !confirm('Revoke this QR session? It will stop working immediately.')) return;
  try {
    await api(`/api/attendance/sessions/${id}/revoke`, { method: 'PATCH', body: {} });
    sessionSay('QR session revoked.', true);
    await loadQrPage();
  } catch (err) { sessionSay(err.message, false); }
});

loadQrPage().catch((err) => sessionSay(err.message, false));
