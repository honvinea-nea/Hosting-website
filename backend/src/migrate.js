'use strict';

require('dotenv').config({ quiet: true });

const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('./database');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [734921804]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS shoply_schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    const directory = path.join(__dirname, '..', 'database');
    const migrations = (await fs.readdir(directory)).filter(name => /^\d+_[\w-]+\.sql$/.test(name)).sort();
    for (const name of migrations) {
      const applied = await client.query('SELECT 1 FROM shoply_schema_migrations WHERE name = $1', [name]);
      if (applied.rowCount) {
        console.log(`${name} already applied.`);
        continue;
      }
      const sql = await fs.readFile(path.join(directory, name), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO shoply_schema_migrations (name) VALUES ($1)', [name]);
      console.log(`Applied ${name}.`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(error => {
  console.error('Database migration failed.', error);
  process.exitCode = 1;
});
