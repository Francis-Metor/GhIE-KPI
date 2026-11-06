const test = require('node:test');
const assert = require('node:assert/strict');
const { distanceMeters } = require('../../services/attendance.service');

test('GPS distance uses geographic coordinates in metres', () => {
  const distance = distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.001 });
  assert.ok(distance > 100 && distance < 115);
});

test('GPS distance is zero for the same coordinates', () => {
  assert.equal(distanceMeters({ latitude: 5.6037, longitude: -0.187 }, { latitude: 5.6037, longitude: -0.187 }), 0);
});
