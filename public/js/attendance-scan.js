const status = document.getElementById('scanStatus');
const details = document.getElementById('scanDetails');
const locationPanel = document.getElementById('locationPanel');
const locationInfo = document.getElementById('locationInfo');
const locationStatus = document.getElementById('locationStatus');
const checkLocation = document.getElementById('checkLocation');
const token = new URLSearchParams(location.search).get('token');
const next = `${location.pathname}?${new URLSearchParams(location.search).toString()}`;
const say = (text, ok) => { status.className = `msg ${ok ? 'ok' : 'err'}`; status.textContent = text; };
let sessionDetails;
let currentLocation;

const distanceMeters = (a, b) => {
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
};

const coordinateLink = (latitude, longitude, label) => `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}" target="_blank" rel="noopener">${label}</a>`;

function renderLocation() {
  const venue = sessionDetails?.venue;
  const allowedRadius = Number(sessionDetails?.allowedRadiusMeters || 500);
  const required = venue && Number.isFinite(Number(venue.latitude)) && Number.isFinite(Number(venue.longitude));
  if (!required) {
    locationInfo.innerHTML = '<p class="muted">The required venue coordinates are not available.</p>';
    return;
  }
  const requiredText = `${Number(venue.latitude).toFixed(6)}, ${Number(venue.longitude).toFixed(6)}`;
  let html = `<dl><dt>Required venue</dt><dd>${esc(requiredText)} (${coordinateLink(venue.latitude, venue.longitude, 'open map')})</dd><dt>Allowed radius</dt><dd>${esc(String(Math.round(allowedRadius)))} m</dd>`;
  if (currentLocation) {
    const distance = Math.round(distanceMeters(currentLocation, venue));
    const withinRadius = distance <= allowedRadius;
    html += `<dt>Your location</dt><dd>${esc(`${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`)} (${coordinateLink(currentLocation.latitude, currentLocation.longitude, 'open map')})</dd><dt>Your GPS accuracy</dt><dd>${esc(`${Math.round(currentLocation.accuracyMeters)} m`)}</dd><dt>Distance from venue</dt><dd>${esc(`${distance} m`)} <span class="pill ${withinRadius ? '' : 'off'}">${withinRadius ? 'within radius' : 'outside radius'}</span></dd>`;
  }
  locationInfo.innerHTML = `${html}</dl>`;
}

function readLocation() {
  if (!navigator.geolocation) {
    locationStatus.className = 'msg err';
    locationStatus.textContent = 'This device does not support GPS location.';
    return;
  }
  locationStatus.className = 'msg ok';
  locationStatus.textContent = 'Requesting your location...';
  navigator.geolocation.getCurrentPosition((position) => {
    currentLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy,
    };
    renderLocation();
    locationStatus.textContent = 'Your location was found. The server will perform the final verification.';
  }, () => {
    locationStatus.className = 'msg err';
    locationStatus.textContent = 'Location permission is required to check your distance from the venue.';
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
}

async function checkSession() {
  if (!token) throw new Error('This QR code does not contain an attendance token.');
  const result = await api(`/api/attendance/sessions/validate/${encodeURIComponent(token)}`);
  sessionDetails = result;
  document.getElementById('scanInfo').innerHTML = `<dt>Activity</dt><dd>${esc(result.activity?.title || 'Attendance')}</dd><dt>Venue</dt><dd>${esc(result.venue?.name || 'Club venue')}</dd><dt>Available until</dt><dd>${new Date(result.expiresAt).toLocaleString()}</dd>`;
  details.hidden = false;
  locationPanel.hidden = false;
  renderLocation();
  checkLocation.addEventListener('click', readLocation);
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
  const submitLocation = currentLocation || await new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition((position) => resolve({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy,
    }), () => resolve(null), { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  });
  if (!submitLocation) return say('Location permission is required to submit attendance.', false);
  try {
    const result = await api('/api/attendance/sessions/submit', {
      method: 'POST',
      body: {
        token,
        location: submitLocation,
      },
    });
    say(result.duplicate ? 'Attendance was already recorded for this session.' : `Attendance recorded. ${result.points} points awarded.`, true);
    document.getElementById('signIn').hidden = true;
  } catch (err) { say(err.message, false); }
}

checkSession().catch((err) => say(err.message, false));
