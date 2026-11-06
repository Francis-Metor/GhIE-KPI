const mongoose = require('mongoose');

let supported; // cached after first check
let warned = false;

// Transactions need a replica set (MongoDB Atlas always has one; a plain local mongod does not).
async function transactionsSupported() {
  if (supported !== undefined) return supported;
  const info = await mongoose.connection.db.admin().command({ hello: 1 });
  supported = Boolean(info.setName) || info.msg === 'isdbgrid';
  return supported;
}

/**
 * Run `fn(session)` inside a transaction when the deployment supports it.
 * Without support, `fn(null)` runs without one: unique indexes still prevent duplicates,
 * but a crash between two writes could leave them inconsistent. Pass `session` to every query inside `fn`.
 */
async function runInTransaction(fn) {
  if (!(await transactionsSupported())) {
    if (!warned) { console.warn('[db] Transactions are not supported on this MongoDB deployment; running without one.'); warned = true; }
    return fn(null);
  }
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await fn(session); });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { runInTransaction, transactionsSupported };
