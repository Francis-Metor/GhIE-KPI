const importMsg = document.getElementById('importMsg');
const importSay = (text, ok) => { importMsg.className = `msg ${ok ? 'ok' : 'err'}`; importMsg.textContent = text; };
async function loadColumns() {
  const { columns } = await api('/api/admin/members/import/columns');
  document.getElementById('memberColumns').innerHTML = columns.map((column) => `<span class="column-chip">${esc(column.label)}${column.required ? ' <strong>(required)</strong>' : ''}</span>`).join('');
}
document.getElementById('memberImportForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = document.getElementById('memberFile').files[0];
  if (!file) return;
  try {
    const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1] || ''); reader.onerror = () => reject(new Error('The selected file could not be read.')); reader.readAsDataURL(file); });
    const result = await api('/api/admin/members/import/upload', { method: 'POST', body: { fileName: file.name, data } });
    importSay(`Imported ${result.counts.totalRows} rows: ${result.counts.created} created and ${result.counts.updated} updated.`, true); event.target.reset();
  } catch (err) { importSay(err.message, false); }
});
loadColumns().catch((err) => importSay(err.message, false));
