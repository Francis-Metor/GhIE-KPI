const mongoose = require('mongoose');
const { MONGODB_URI, isProduction } = require('../config/env');

mongoose.set('strictQuery', true);

// The connection promise is cached on `global` so serverless hosts (Vercel) reuse it between invocations.
const cache = global.__clubpointMongo || (global.__clubpointMongo = { promise: null });

async function connectDB() {
  if (!MONGODB_URI) throw new Error('MONGODB_URI is not set. Add it to your environment variables.');
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(MONGODB_URI, {
        autoIndex: !isProduction, // in production create indexes deliberately with `npm run db:sync`
        serverSelectionTimeoutMS: 8000,
      })
      .catch((err) => { cache.promise = null; throw err; });
  }
  await cache.promise;
  return mongoose;
}

async function disconnectDB() {
  await mongoose.disconnect();
  cache.promise = null;
}

module.exports = { connectDB, disconnectDB };
