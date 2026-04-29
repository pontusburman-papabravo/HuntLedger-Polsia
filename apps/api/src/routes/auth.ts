/**
 * Auth routes — register + login. F2.
 * Rate-limited: max 10 attempts per 5-minute window per IP.
 */
import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../auth.js';

// Simple in-memory rate limiter (reset on restart — intentional for edge-case recovery)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_MAX = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = `auth:${ip}`;
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_MAX) return false;
  entry.count++;
  return true;
}

// Clean up stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitMap) {
    if (now > v.resetAt) rateLimitMap.delete(k);
  }
}, 10 * 60 * 1000);

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/auth/register
  app.post('/api/v1/auth/register', async (req, reply) => {
    const ip = req.ip ?? 'unknown';
    if (!checkRateLimit(ip)) {
      return reply.status(429).send({ error: 'Too many attempts. Try again in 5 minutes.' });
    }

    const body = req.body as { email?: string; name?: string; password?: string };
    const { email, name, password } = body;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      return reply.status(400).send({ error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const client = await pool.connect();
    try {
      const existing = await client.query(
        'SELECT id FROM users WHERE LOWER(email) = $1',
        [normalizedEmail],
      );
      if (existing.rows.length > 0) {
        return reply.status(409).send({ error: 'Email already in use' });
      }

      const hash = await hashPassword(password);
      const result = await client.query(
        `INSERT INTO users (email, name, password_hash, role)
         VALUES ($1, $2, $3, 'hunter')
         RETURNING id, email, name, created_at`,
        [normalizedEmail, name ?? null, hash],
      );
      const row = result.rows[0];
      const user = {
        id: String(row.id),
        email: row.email as string,
        name: (row.name as string | null) ?? '',
        createdAt: (row.created_at as Date).toISOString(),
        isAdmin: false,
      };
      const token = signToken({ userId: user.id, email: user.email });
      return reply.status(201).send({ token, user });
    } finally {
      client.release();
    }
  });

  // POST /api/v1/auth/login
  app.post('/api/v1/auth/login', async (req, reply) => {
    const ip = req.ip ?? 'unknown';
    if (!checkRateLimit(ip)) {
      return reply.status(429).send({ error: 'Too many attempts. Try again in 5 minutes.' });
    }

    const body = req.body as { email?: string; password?: string };
    const { email, password } = body;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT id, email, name, password_hash, created_at, is_active, is_admin FROM users WHERE LOWER(email) = $1',
        [normalizedEmail],
      );
      if (result.rows.length === 0) {
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      const row = result.rows[0];
      const valid = await verifyPassword(password, (row.password_hash as string) ?? '');
      if (!valid) {
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      if (row.is_active === false) {
        return reply.status(403).send({ error: 'Account is disabled' });
      }

      const user = {
        id: String(row.id),
        email: row.email as string,
        name: (row.name as string | null) ?? '',
        createdAt: (row.created_at as Date).toISOString(),
        isAdmin: (row.is_admin as boolean) ?? false,
      };
      const token = signToken({ userId: user.id, email: user.email });
      return reply.send({ token, user });
    } finally {
      client.release();
    }
  });

  // DELETE /api/v1/users/me — self-delete: cascade all user data then remove account (password required)
  app.delete('/api/v1/users/me', async (req, reply) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    const token = authHeader.slice(7);
    let userId: string;
    try {
      const payload = verifyToken(token);
      userId = payload.userId;
    } catch {
      return reply.status(401).send({ error: 'Token is invalid or expired' });
    }
    const body = req.body as { password?: string };
    if (!body.password) {
      return reply.status(400).send({ error: 'Password required' });
    }
    const client = await pool.connect();
    try {
      const userResult = await client.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId],
      );
      if (userResult.rows.length === 0) {
        return reply.status(404).send({ error: 'User not found' });
      }
      const validPw = await verifyPassword(body.password, userResult.rows[0].password_hash as string);
      if (!validPw) {
        return reply.status(401).send({ error: 'Incorrect password' });
      }
      // Cascade delete all user data
      for (const table of ['huntlog_weapons', 'huntlog_ammo', 'huntlog_locations', 'huntlog_sessions', 'huntlog_dogs']) {
        await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
      }
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
      return reply.status(204).send();
    } finally {
      client.release();
    }
  });
}
