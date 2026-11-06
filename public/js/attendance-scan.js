const status = document.getElementById('scanStatus');
const details = document.getElementById('scanDetails');
const token = new URLSearchParams(location.search).get('token');
const next = `${location.pathname}?${new URLSearchParams(location.search).toString()}`;
const say = (text, ok) => { status.className = `msg ${ok ? 'ok' : 'err'}`; status.textContent = text; };

async function checkSession() {
  if (!token) throw new Error('This QR code does not contain an attendance token.');
  const result = await api(`/api/attendance/sessions/validate/${encodeURIComponent(token)}`);
  document.getElementById('scanInfo').innerHTML = `<dt>Activity</dt><dd>${esc(result.activity?.title || 'Attendance')}</dd><dt>Venue</dt><dd>${esc(result.venue?.name || 'Club venue')}</dd><dt>Available until</dt><dd>${new Date(result.expiresAt).toLocaleString()}</dd>`;
  details.hidden = false;
  const auth = await api('/api/auth/me').catch(() => null);
  if (auth?.user?.role === 'member') {
    document.getElementById('signIn').textContent = 'Submit attendance';
    document.getElementById('signIn').href = '#submit';
    document.getElementById('signIn').addEventListener('click', submitAttendance);
  } else {
    document.getElementById('signIn').href = `/auth/login.html?next=${encodeURIComponent(next)}`;
  }
  say('This QR session is valid. Sign in to continue.', true);
}

async function submitAttendance(event) {
  event.preventDefault();
  say('Requesting your location...', true);
  if (!navigator.geolocation) return say('This device does not support GPS location.', false);
  navigator.geolocation.getCurrentPosition(async (position) => {
    try {
      const result = await api('/api/attendance/sessions/submit', {
        method: 'POST',
        body: {
          token,
          location: { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy },
        },
      });
      say(result.duplicate ? 'Attendance was already recorded for this session.' : `Attendance recorded. ${result.points} points awarded.`, true);
      document.getElementById('signIn').hidden = true;
    } catch (err) { say(err.message, false); }
  }, () => say('Location permission is required to submit attendance.', false), { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
}

checkSession().catch((err) => say(err.message, false));
