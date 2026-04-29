/**
 * Postgres connection pool — F2.
 * Configured for Neon Postgres (serverless) with idle-connection resilience.
 */
import pg from 'pg';
const { Pool } = pg;

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL is required');

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000,        // close idle connections after 30s (Neon drops at ~5 min)
  connectionTimeoutMillis: 10_000,   // give Neon cold-start up to 10s to connect
});

// CRITICAL: without this handler, a broken idle connection causes an unhandled
// 'error' event that crashes the Node process — the root cause of "Load failed".
pool.on('error', (err) => {
  console.error('pg pool background error (non-fatal):', err.message);
});
