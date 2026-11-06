// Normalization policy (see docs/DECISIONS.md). Keep these pure so they are easy to unit test.

const stripDiacritics = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Member ID: remove all whitespace, uppercase. "ab 123" and "AB123" are the same member. */
function normalizeMemberId(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/g, '').toUpperCase();
}

/** Full name for comparison: no accents, no . , ' marks, single spaces, lowercase. */
function normalizeName(value) {
  return stripDiacritics(String(value ?? '').normalize('NFKC'))
    .toLowerCase()
    .replace(/[.,'\u2019]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Generic lookup key for names such as categories: trimmed, single spaces, lowercase. */
function normalizeKey(value) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

module.exports = { normalizeMemberId, normalizeName, normalizeKey };
