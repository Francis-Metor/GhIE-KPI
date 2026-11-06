// Small fetch wrapper shared by every page.
async function api(url, { method = 'GET', body } = {}) {
  const init = { method, headers: {}, credentials: 'same-origin' };
  if (method !== 'GET') {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body || {});
  }
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong.');
    err.status = res.status;
    throw err;
  }
  return data;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function signOut(next) {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  location.href = next;
}
