'use strict';

require('dotenv').config({ quiet: true });

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL must be configured before starting the Shoply admin API.');
}
if (process.env.NODE_ENV === 'production' && process.env.PGSSLMODE !== 'require') {
  throw new Error('PGSSLMODE=require is required for PostgreSQL connections in production.');
}

const pool = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_SIZE) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: true } : undefined
});

pool.on('error', error => {
  console.error('Unexpected PostgreSQL pool error.', error);
});

module.exports = pool;
