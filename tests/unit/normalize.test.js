const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMemberId, normalizeName, normalizeKey } = require('../../lib/validation/normalize');

test('member ID ignores case and whitespace', () => {
  assert.equal(normalizeMemberId('  ab 123 '), 'AB123');
  assert.equal(normalizeMemberId('AB123'), normalizeMemberId('ab123'));
  assert.equal(normalizeMemberId(null), '');
});

test('name normalization ignores case, accents, punctuation and spacing', () => {
  assert.equal(normalizeName('  Ama   MENSAH '), 'ama mensah');
  assert.equal(normalizeName('José  O\u2019Brien.'), 'jose obrien');
});

test('similar but different names stay different', () => {
  assert.notEqual(normalizeName('Ama Mensah'), normalizeName('Ama Mensa'));
});

test('key normalization', () => {
  assert.equal(normalizeKey('  Key   Contribution '), 'key contribution');
});
