const settingsForm = document.getElementById('settingsForm');
const settingsMsg = document.getElementById('settingsMsg');
const say = (text, ok) => { settingsMsg.className = `msg ${ok ? 'ok' : 'err'}`; settingsMsg.textContent = text; };
async function load() {
  const { values } = await api('/api/admin/settings');
  Object.entries(values).forEach(([key, value]) => { if (settingsForm.elements[key]) settingsForm.elements[key].value = value; });
}
settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try { await api('/api/admin/settings', { method: 'PATCH', body: Object.fromEntries(new FormData(settingsForm)) }); say('Settings saved.', true); } catch (error) { say(error.message, false); }
});
load().catch((error) => say(error.message, false));
