/**
 * Data CRUD routes — Postgres-backed. F2.
 * All routes require a valid JWT (userId must match token).
 * Weapons, ammunition, locations support soft-delete (archive).
 * Sessions support hard delete.
 */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

type Params = { userId: string };
type ParamsWithId = { userId: string; id: string };

function forbidden(reply: any): void {
  reply.status(403).send({ error: 'Forbidden' });
}

function assertOwner(req: any, userId: string, reply: any): boolean {
  if (req.jwtPayload?.userId !== userId) {
    forbidden(reply);
    return false;
  }
  return true;
}

// Retry helper: catches stale-connection errors and retries once with a fresh connection.
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const msg = err?.message ?? '';
    const isConnectionError =
      msg.includes('Connection terminated') ||
      msg.includes('connection terminated') ||
      msg.includes('ECONNRESET') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('Client has encountered a connection error') ||
      msg.includes('sorry, too many clients');
    if (isConnectionError) {
      console.warn('DB connection error, retrying once:', msg);
      return fn();
    }
    throw err;
  }
}

async function insertEntity(
  table: string,
  userId: string,
  id: string,
  data: unknown,
): Promise<void> {
  return withRetry(async () => {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO ${table} (id, user_id, data) VALUES ($1, $2, $3)`,
        [id, userId, JSON.stringify(data)],
      );
    } finally {
      client.release();
    }
  });
}

async function updateEntity(
  table: string,
  userId: string,
  id: string,
  data: unknown,
): Promise<boolean> {
  return withRetry(async () => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE ${table} SET data = $1, updated_at = NOW()
         WHERE id = $2 AND user_id = $3`,
        [JSON.stringify(data), id, userId],
      );
      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  });
}

async function deleteEntity(
  table: string,
  userId: string,
  id: string,
): Promise<void> {
  return withRetry(async () => {
    const client = await pool.connect();
    try {
      await client.query(
        `DELETE FROM ${table} WHERE id = $1 AND user_id = $2`,
        [id, userId],
      );
    } finally {
      client.release();
    }
  });
}

async function archiveEntity(
  table: string,
  userId: string,
  id: string,
): Promise<boolean> {
  return withRetry(async () => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE ${table}
         SET data = data || '{"archived": true}'::jsonb, updated_at = NOW()
         WHERE id = $1 AND user_id = $2`,
        [id, userId],
      );
      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  });
}

async function unarchiveEntity(
  table: string,
  userId: string,
  id: string,
): Promise<boolean> {
  return withRetry(async () => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE ${table}
         SET data = data - 'archived', updated_at = NOW()
         WHERE id = $1 AND user_id = $2`,
        [id, userId],
      );
      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  });
}

async function countWeaponSessionRefs(userId: string, weaponId: string): Promise<number> {
  return withRetry(async () => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT COUNT(*) FROM huntlog_sessions WHERE user_id = $1 AND data->'weaponIds' ? $2`,
        [userId, weaponId],
      );
      return parseInt((result.rows[0] as any).count, 10);
    } finally {
      client.release();
    }
  });
}

async function countAmmoSessionRefs(userId: string, ammoId: string): Promise<number> {
  return withRetry(async () => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT COUNT(*) FROM huntlog_sessions WHERE user_id = $1 AND data->'ammunitionIds' ? $2`,
        [userId, ammoId],
      );
      return parseInt((result.rows[0] as any).count, 10);
    } finally {
      client.release();
    }
  });
}

async function countLocationSessionRefs(userId: string, locationId: string): Promise<number> {
  return withRetry(async () => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT COUNT(*) FROM huntlog_sessions WHERE user_id = $1 AND data->>'locationId' = $2`,
        [userId, locationId],
      );
      return parseInt((result.rows[0] as any).count, 10);
    } finally {
      client.release();
    }
  });
}

export async function registerDataRoutes(app: FastifyInstance): Promise<void> {
  // ── GET all data ──────────────────────────────────────────────────────────
  app.get<{ Params: Params }>(
    '/api/v1/data/:userId',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId } = req.params;
      if (!assertOwner(req, userId, reply)) return;

      const includeArchived = (req.query as any)?.include_archived === '1';
      const archivedFilter = includeArchived
        ? ''
        : `AND (data->>'archived' IS NULL OR data->>'archived' != 'true')`;

      return withRetry(async () => {
        const client = await pool.connect();
        try {
          const [weapons, ammo, locations, sessions, dogs] = await Promise.all([
            client.query(`SELECT data FROM huntlog_weapons WHERE user_id = $1 ${archivedFilter} ORDER BY created_at`, [userId]),
            client.query(`SELECT data FROM huntlog_ammo    WHERE user_id = $1 ${archivedFilter} ORDER BY created_at`, [userId]),
            client.query(`SELECT data FROM huntlog_locations WHERE user_id = $1 ${archivedFilter} ORDER BY created_at`, [userId]),
            client.query('SELECT data FROM huntlog_sessions WHERE user_id = $1 ORDER BY created_at', [userId]),
            client.query('SELECT data FROM huntlog_dogs    WHERE user_id = $1 ORDER BY created_at', [userId]),
          ]);
          return {
            weapons:    weapons.rows.map((r: any) => r.data),
            ammunition: ammo.rows.map((r: any) => r.data),
            locations:  locations.rows.map((r: any) => r.data),
            sessions:   sessions.rows.map((r: any) => r.data),
            dogs:       dogs.rows.map((r: any) => r.data),
          };
        } finally {
          client.release();
        }
      });
    },
  );

  // ── Weapons ───────────────────────────────────────────────────────────────
  app.post<{ Params: Params }>(
    '/api/v1/data/:userId/weapons',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const weapon = { ...(req.body as object), id: randomUUID(), createdAt: new Date().toISOString() };
      await insertEntity('huntlog_weapons', userId, weapon.id as string, weapon);
      return reply.status(201).send(weapon);
    },
  );

  app.put<{ Params: ParamsWithId }>(
    '/api/v1/data/:userId/weapons/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId, id } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const weapon = { ...(req.body as object), id };
      const ok = await updateEntity('huntlog_weapons', userId, id, weapon);
      if (!ok) return reply.status(404).send({ error: 'Not found' });
      return weapon;
    },
  );

  app.patch<{ Params: ParamsWithId }>(
    '/api/v1/data/:userId/weapons/:id/archive',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId, id } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const ok = await archiveEntity('huntlog_weapons', userId, id);
      if (!ok) return reply.status(404).send({ error: 'Not found' });
      return reply.status(204).send();
    },
  );

  app.patch<{ Params: ParamsWithId }>(
    '/api/v1/data/:userId/weapons/:id/unarchive',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId, id } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const ok = await unarchiveEntity('huntlog_weapons', userId, id);
      if (!ok) return reply.status(404).send({ error: 'Not found' });
      return reply.status(204).send();
    },
  );

  app.delete<{ Params: ParamsWithId }>(
    '/api/v1/data/:userId/weapons/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId, id } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const refs = await countWeaponSessionRefs(userId, id);
      if (refs > 0) {
        return reply.status(409).send({
          error: `Används i ${refs} ${refs === 1 ? 'session' : 'sessioner'}. Radera eller flytta sessionerna till ett annat vapen för att kunna radera.`,
        });
      }
      await deleteEntity('huntlog_weapons', userId, id);
      return reply.status(204).send();
    },
  );

  // ── Ammunition ────────────────────────────────────────────────────────────
  app.post<{ Params: Params }>(
    '/api/v1/data/:userId/ammunition',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const ammo = { ...(req.body as object), id: randomUUID() };
      await insertEntity('huntlog_ammo', userId, ammo.id as string, ammo);
      return reply.status(201).send(ammo);
    },
  );

  app.put<{ Params: ParamsWithId }>(
    '/api/v1/data/:userId/ammunition/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId, id } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const ammo = { ...(req.body as object), id };
      const ok = await updateEntity('huntlog_ammo', userId, id, ammo);
      if (!ok) return reply.status(404).send({ error: 'Not found' });
      return ammo;
    },
  );

  app.patch<{ Params: ParamsWithId }>(
    '/api/v1/data/:userId/ammunition/:id/archive',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId, id } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const ok = await archiveEntity('huntlog_ammo', userId, id);
      if (!ok) return reply.status(404).send({ error: 'Not found' });
      return reply.status(204).send();
    },
  );

  app.patch<{ Params: ParamsWithId }>(
    '/api/v1/data/:userId/ammunition/:id/unarchive',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId, id } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const ok = await unarchiveEntity('huntlog_ammo', userId, id);
      if (!ok) return reply.status(404).send({ error: 'Not found' });
      return reply.status(204).send();
    },
  );

  app.delete<{ Params: ParamsWithId }>(
    '/api/v1/data/:userId/ammunition/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId, id } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const refs = await countAmmoSessionRefs(userId, id);
      if (refs > 0) {
        return reply.status(409).send({
          error: `Används i ${refs} ${refs === 1 ? 'session' : 'sessioner'}. Radera eller flytta sessionerna till annan ammunition för att kunna radera.`,
        });
      }
      await deleteEntity('huntlog_ammo', userId, id);
      return reply.status(204).send();
    },
  );

  // ── Locations ─────────────────────────────────────────────────────────────
  app.post<{ Params: Params }>(
    '/api/v1/data/:userId/locations',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const location = { ...(req.body as object), id: randomUUID() };
      await insertEntity('huntlog_locations', userId, location.id as string, location);
      return reply.status(201).send(location);
    },
  );

  app.put<{ Params: ParamsWithId }>(
    '/api/v1/data/:userId/locations/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId, id } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const location = { ...(req.body as object), id };
      const ok = await updateEntity('huntlog_locations', userId, id, location);
      if (!ok) return reply.status(404).send({ error: 'Not found' });
      return location;
    },
  );

  app.patch<{ Params: ParamsWithId }>(
    '/api/v1/data/:userId/locations/:id/archive',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId, id } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const ok = await archiveEntity('huntlog_locations', userId, id);
      if (!ok) return reply.status(404).send({ error: 'Not found' });
      return reply.status(204).send();
    },
  );

  app.patch<{ Params: ParamsWithId }>(
    '/api/v1/data/:userId/locations/:id/unarchive',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId, id } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const ok = await unarchiveEntity('huntlog_locations', userId, id);
      if (!ok) return reply.status(404).send({ error: 'Not found' });
      return reply.status(204).send();
    },
  );

  app.delete<{ Params: ParamsWithId }>(
    '/api/v1/data/:userId/locations/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId, id } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const refs = await countLocationSessionRefs(userId, id);
      if (refs > 0) {
        return reply.status(409).send({
          error: `Används i ${refs} ${refs === 1 ? 'session' : 'sessioner'}. Radera eller flytta sessionerna till en annan plats för att kunna radera.`,
        });
      }
      await deleteEntity('huntlog_locations', userId, id);
      return reply.status(204).send();
    },
  );

  // ── Sessions ──────────────────────────────────────────────────────────────
  app.post<{ Params: Params }>(
    '/api/v1/data/:userId/sessions',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const session = { ...(req.body as object), id: randomUUID() };
      await insertEntity('huntlog_sessions', userId, session.id as string, session);
      return reply.status(201).send(session);
    },
  );

  app.put<{ Params: ParamsWithId }>(
    '/api/v1/data/:userId/sessions/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId, id } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const session = { ...(req.body as object), id };
      const ok = await updateEntity('huntlog_sessions', userId, id, session);
      if (!ok) return reply.status(404).send({ error: 'Not found' });
      return session;
    },
  );

  app.delete<{ Params: ParamsWithId }>(
    '/api/v1/data/:userId/sessions/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId, id } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      await deleteEntity('huntlog_sessions', userId, id);
      return reply.status(204).send();
    },
  );

  // ── Dogs ──────────────────────────────────────────────────────────────────
  app.post<{ Params: Params }>(
    '/api/v1/data/:userId/dogs',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const dog = { ...(req.body as object), id: randomUUID() };
      await insertEntity('huntlog_dogs', userId, dog.id as string, dog);
      return reply.status(201).send(dog);
    },
  );

  app.put<{ Params: ParamsWithId }>(
    '/api/v1/data/:userId/dogs/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId, id } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const dog = { ...(req.body as object), id };
      const ok = await updateEntity('huntlog_dogs', userId, id, dog);
      if (!ok) return reply.status(404).send({ error: 'Not found' });
      return dog;
    },
  );

  app.delete<{ Params: ParamsWithId }>(
    '/api/v1/data/:userId/dogs/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId, id } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      await deleteEntity('huntlog_dogs', userId, id);
      return reply.status(204).send();
    },
  );
}
