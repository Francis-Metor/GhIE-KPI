const mongoose = require('mongoose');

// Allowed range for a configurable radius (spec default is 500 m). Adjust here if the club needs different limits.
const RADIUS_LIMITS = { min: 10, max: 5000 };
const DEFAULT_RADIUS_METERS = 500;

const venueSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Venue name is required.'], trim: true },
    address: { type: String, trim: true, default: '' },
    latitude: { type: Number, required: true, min: [-90, 'Latitude must be between -90 and 90.'], max: [90, 'Latitude must be between -90 and 90.'] },
    longitude: { type: Number, required: true, min: [-180, 'Longitude must be between -180 and 180.'], max: [180, 'Longitude must be between -180 and 180.'] },
    defaultRadiusMeters: {
      type: Number,
      default: DEFAULT_RADIUS_METERS,
      min: [RADIUS_LIMITS.min, `Radius must be at least ${RADIUS_LIMITS.min} m.`],
      max: [RADIUS_LIMITS.max, `Radius must be at most ${RADIUS_LIMITS.max} m.`],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'venues' }
);

venueSchema.index({ isActive: 1, name: 1 });

const Venue = mongoose.models.Venue || mongoose.model('Venue', venueSchema);
Venue.RADIUS_LIMITS = RADIUS_LIMITS;
Venue.DEFAULT_RADIUS_METERS = DEFAULT_RADIUS_METERS;
module.exports = Venue;
