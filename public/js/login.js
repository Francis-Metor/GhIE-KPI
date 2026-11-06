const form = document.getElementById('loginForm');
const msg = document.getElementById('msg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.className = 'msg';
  msg.textContent = 'Signing in...';
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    const data = await api(form.dataset.endpoint, {
      method: 'POST',
      body: { email: form.email.value, reference: form.reference.value, next: new URLSearchParams(location.search).get('next') || '' },
    });
    location.href = data.redirect;
  } catch (err) {
    msg.className = 'msg err';
    msg.textContent = err.message;
    button.disabled = false;
  }
});
