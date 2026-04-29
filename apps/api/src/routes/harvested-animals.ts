/**
 * Harvested Animals routes — CRUD for huntlog_harvested_animals table.
 * Animals are linked to hunt sessions via session_id (TEXT FK).
 */
import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { randomUUID } from 'crypto';

interface Params   { userId: string }
interface SessionParams { userId: string; sessionId: string }
interface AnimalParams  { userId: string; animalId: string }

function assertOwner(req: any, userId: string, reply: any): boolean {
  if (req.jwtPayload?.userId !== userId) {
    reply.status(403).send({ error: 'Forbidden' });
    return false;
  }
  return true;
}

export async function registerHarvestedAnimalsRoutes(app: FastifyInstance): Promise<void> {

  // GET /api/v1/data/:userId/animals — all animals for CSV export
  app.get<{ Params: Params }>(
    '/api/v1/data/:userId/animals',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT id, session_id, user_id, species, species_custom, sex,
                  estimated_age, carcass_weight, antler_points, shot_placement,
                  trichina_id, facility_id, notes, created_at
           FROM huntlog_harvested_animals
           WHERE user_id = $1
           ORDER BY created_at`,
          [userId],
        );
        return { animals: result.rows };
      } finally {
        client.release();
      }
    },
  );

  // GET /api/v1/data/:userId/animal-counts — count per session_id
  app.get<{ Params: Params }>(
    '/api/v1/data/:userId/animal-counts',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT session_id, COUNT(*)::int AS cnt
           FROM huntlog_harvested_animals
           WHERE user_id = $1
           GROUP BY session_id`,
          [userId],
        );
        const counts: Record<string, number> = {};
        for (const row of result.rows) { counts[row.session_id] = row.cnt; }
        return { counts };
      } finally {
        client.release();
      }
    },
  );

  // GET /api/v1/data/:userId/animals/session/:sessionId — animals for one session
  app.get<{ Params: SessionParams }>(
    '/api/v1/data/:userId/animals/session/:sessionId',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId, sessionId } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT id, session_id, user_id, species, species_custom, sex,
                  estimated_age, carcass_weight, antler_points, shot_placement,
                  trichina_id, facility_id, notes, created_at
           FROM huntlog_harvested_animals
           WHERE user_id = $1 AND session_id = $2
           ORDER BY created_at`,
          [userId, sessionId],
        );
        return { animals: result.rows };
      } finally {
        client.release();
      }
    },
  );

  // POST /api/v1/data/:userId/animals/session/:sessionId — create animal
  app.post<{ Params: SessionParams }>(
    '/api/v1/data/:userId/animals/session/:sessionId',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId, sessionId } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const body = req.body as any;

      if (!body.species) {
        return reply.status(400).send({ error: 'species is required' });
      }
      if (body.species === 'other' && !body.species_custom?.trim()) {
        return reply.status(400).send({ error: 'species_custom is required when species is other' });
      }

      const id = randomUUID();
      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO huntlog_harvested_animals
             (id, session_id, user_id, species, species_custom, sex,
              estimated_age, carcass_weight, antler_points, shot_placement,
              trichina_id, facility_id, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            id, sessionId, userId,
            body.species,
            body.species === 'other' ? (body.species_custom ?? null) : null,
            body.sex ?? null,
            body.estimated_age ?? null,
            body.carcass_weight != null ? Number(body.carcass_weight) : null,
            body.antler_points != null ? Number(body.antler_points) : null,
            body.shot_placement ?? null,
            body.trichina_id ?? null,
            body.facility_id ?? null,
            body.notes ?? null,
          ],
        );
        const row = await client.query(
          `SELECT id, session_id, user_id, species, species_custom, sex,
                  estimated_age, carcass_weight, antler_points, shot_placement,
                  trichina_id, facility_id, notes, created_at
           FROM huntlog_harvested_animals WHERE id = $1`,
          [id],
        );
        return reply.status(201).send(row.rows[0]);
      } finally {
        client.release();
      }
    },
  );

  // PUT /api/v1/data/:userId/animals/:animalId — update animal
  app.put<{ Params: AnimalParams }>(
    '/api/v1/data/:userId/animals/:animalId',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId, animalId } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const body = req.body as any;

      if (!body.species) {
        return reply.status(400).send({ error: 'species is required' });
      }
      if (body.species === 'other' && !body.species_custom?.trim()) {
        return reply.status(400).send({ error: 'species_custom is required when species is other' });
      }

      const client = await pool.connect();
      try {
        const result = await client.query(
          `UPDATE huntlog_harvested_animals
           SET species=$1, species_custom=$2, sex=$3, estimated_age=$4,
               carcass_weight=$5, antler_points=$6, shot_placement=$7,
               trichina_id=$8, facility_id=$9, notes=$10, updated_at=NOW()
           WHERE id=$11 AND user_id=$12`,
          [
            body.species,
            body.species === 'other' ? (body.species_custom ?? null) : null,
            body.sex ?? null,
            body.estimated_age ?? null,
            body.carcass_weight != null ? Number(body.carcass_weight) : null,
            body.antler_points != null ? Number(body.antler_points) : null,
            body.shot_placement ?? null,
            body.trichina_id ?? null,
            body.facility_id ?? null,
            body.notes ?? null,
            animalId,
            userId,
          ],
        );
        if (result.rowCount === 0) return reply.status(404).send({ error: 'Not found' });
        const row = await client.query(
          `SELECT id, session_id, user_id, species, species_custom, sex,
                  estimated_age, carcass_weight, antler_points, shot_placement,
                  trichina_id, facility_id, notes, created_at
           FROM huntlog_harvested_animals WHERE id = $1`,
          [animalId],
        );
        return row.rows[0];
      } finally {
        client.release();
      }
    },
  );

  // DELETE /api/v1/data/:userId/animals/:animalId — delete animal
  app.delete<{ Params: AnimalParams }>(
    '/api/v1/data/:userId/animals/:animalId',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { userId, animalId } = req.params;
      if (!assertOwner(req, userId, reply)) return;
      const client = await pool.connect();
      try {
        await client.query(
          'DELETE FROM huntlog_harvested_animals WHERE id=$1 AND user_id=$2',
          [animalId, userId],
        );
        return reply.status(204).send();
      } finally {
        client.release();
      }
    },
  );
}
