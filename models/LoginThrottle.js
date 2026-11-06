const mongoose = require('mongoose');

// Counts failed sign-in attempts per window. Keys are hashes, so no email or IP address is stored.
// MongoDB deletes each document automatically once `expiresAt` passes.
const throttleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'loginThrottles' }
);
throttleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.LoginThrottle || mongoose.model('LoginThrottle', throttleSchema);
