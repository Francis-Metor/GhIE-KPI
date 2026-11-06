const adminNav = [
  ['Dashboard', '/admin/index.html'],
  ['Administration', '/admin/administration.html'],
  ['Members', '/admin/members.html'],
  ['Scoring', '/admin/scoring.html'],
  ['Awards', '/admin/awards.html'],
  ['Analytics', '/admin/analytics.html'],
  ['Leaderboard', '/admin/leaderboard.html'],
  ['Reports', '/admin/reports.html'],
  ['Settings', '/admin/settings.html'],
  ['Activities', '/admin/activities.html'],
  ['QR sessions', '/admin/qr-sessions.html'],
];

const shell = document.getElementById('adminShell');
if (shell) {
  const current = location.pathname;
  shell.innerHTML = `<aside class="sidebar" id="sidebar">
    <a class="brand" href="/admin/index.html">ClubPoint <span>Admin</span></a>
    <nav aria-label="Admin navigation">${adminNav.map(([label, href]) =>
      `<a class="${current === href ? 'active' : ''}" href="${href}">${label}</a>`).join('')}</nav>
    <div class="sidebar-bottom"><span id="who" class="sidebar-user"></span><button class="sidebar-signout" id="signOut">Sign out</button></div>
  </aside>
  <div class="mobile-bar"><button id="menuToggle" aria-label="Open menu">Menu</button><strong>ClubPoint Admin</strong></div>
  <div class="sidebar-backdrop" id="sidebarBackdrop"></div>`;
  const closeMenu = () => document.body.classList.remove('menu-open');
  document.getElementById('menuToggle').addEventListener('click', () => document.body.classList.toggle('menu-open'));
  document.getElementById('sidebarBackdrop').addEventListener('click', closeMenu);
  document.querySelectorAll('.sidebar a').forEach((link) => link.addEventListener('click', closeMenu));
  document.getElementById('signOut').addEventListener('click', () => signOut('/admin/login.html'));
}

async function loadAdminIdentity() {
  try {
    const { admins, currentUserId } = await api('/api/admin/admins');
    const me = admins.find((admin) => admin._id === currentUserId);
    const who = document.getElementById('who');
    if (who) who.textContent = me ? me.email : '';
  } catch (err) {
    if (err.status === 401 || err.status === 403) location.href = '/admin/login.html';
    else throw err;
  }
}

loadAdminIdentity();
