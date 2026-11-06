const scoringMsg = document.getElementById('scoringMsg');
const scoringSay = (text, ok) => { scoringMsg.className = `msg ${ok ? 'ok' : 'err'}`; scoringMsg.textContent = text; };
async function loadScoring() {
  const { categories, criteria } = await api('/api/admin/scoring');
  document.getElementById('criterionCategory').innerHTML = categories.filter((item) => item.isActive).map((item) => `<option value="${esc(item._id)}">${esc(item.name)}</option>`).join('');
  document.getElementById('categoryRows').innerHTML = categories.map((item) => `<div class="manage-row"><span><strong>${esc(item.name)}</strong> <span class="muted small">${item.isActive ? 'active' : 'inactive'}</span></span><span><button class="quiet" data-category-id="${esc(item._id)}" data-active="${item.isActive}">${item.isActive ? 'Deactivate' : 'Activate'}</button></span></div>`).join('');
  document.getElementById('criterionRows').innerHTML = criteria.map((item) => `<div class="manage-row"><span><strong>${esc(item.name)}</strong><br><span class="muted small">${esc(item.category?.name || 'Unknown')} · ${esc(item.points)} points · ${esc(item.awardMethod)}</span></span><button class="quiet" data-criterion-id="${esc(item._id)}" data-active="${item.isActive}">${item.isActive ? 'Deactivate' : 'Activate'}</button></div>`).join('');
}
document.getElementById('categoryForm').addEventListener('submit', async (event) => { event.preventDefault(); try { await api('/api/admin/scoring/categories', { method: 'POST', body: Object.fromEntries(new FormData(event.target)) }); event.target.reset(); scoringSay('Category created.', true); await loadScoring(); } catch (err) { scoringSay(err.message, false); } });
document.getElementById('criterionForm').addEventListener('submit', async (event) => { event.preventDefault(); try { await api('/api/admin/scoring/criteria', { method: 'POST', body: Object.fromEntries(new FormData(event.target)) }); event.target.reset(); scoringSay('Criterion created.', true); await loadScoring(); } catch (err) { scoringSay(err.message, false); } });
document.querySelector('.content-grid').addEventListener('click', async (event) => {
  const { categoryId, criterionId, active } = event.target.dataset;
  if (!categoryId && !criterionId) return;
  try { await api(`/api/admin/scoring/${categoryId ? `categories/${categoryId}` : `criteria/${criterionId}`}`, { method: 'PATCH', body: { isActive: active !== 'true' } }); await loadScoring(); scoringSay('Status updated.', true); } catch (err) { scoringSay(err.message, false); }
});
loadScoring().catch((err) => scoringSay(err.message, false));
