require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  isProduction,
  PORT: Number(process.env.PORT) || 3000,
  SESSION_SECRET: process.env.SESSION_SECRET || '',
  SESSION_HOURS: Number(process.env.SESSION_HOURS) || 8,
  APP_URL: String(process.env.APP_URL || '').replace(/\/+$/, ''),
  // In production the URI must be provided explicitly; in development a local default is used.
  MONGODB_URI: process.env.MONGODB_URI || (isProduction ? '' : 'mongodb://127.0.0.1:27017/clubpoint'),
};
