/**
 * Feedback routes — user-submitted feedback with admin read/delete.
 */
import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export async function registerFeedbackRoutes(app: FastifyInstance): Promise<void> {

  // POST /api/feedback — submit feedback (any logged-in user)
  app.post('/api/feedback', { preHandler: requireAuth }, async (req, reply) => {
    const userId = (req as any).jwtPayload?.userId;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
    const body = req.body as { title?: string; body?: string };
    const title = body.title?.trim();
    if (!title) return reply.status(400).send({ error: 'title is required' });
    const bodyText = body.body?.trim() || null;
    const client = await pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO feedback (user_id, title, body) VALUES ($1, $2, $3) RETURNING id, title, body, created_at',
        [parseInt(userId, 10), title, bodyText],
      );
      return reply.status(201).send(result.rows[0]);
    } finally {
      client.release();
    }
  });

  // GET /api/feedback — list all feedback with user info (admin only)
  app.get('/api/feedback', { preHandler: requireAuth }, async (req, reply) => {
    const userId = (req as any).jwtPayload?.userId;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
    const client = await pool.connect();
    try {
      const adminCheck = await client.query('SELECT is_admin FROM users WHERE id = $1', [parseInt(userId, 10)]);
      if (!adminCheck.rows[0]?.is_admin) return reply.status(403).send({ error: 'Forbidden' });
      const result = await client.query(
        `SELECT f.id, f.title, f.body, f.created_at, u.name AS user_name, u.email AS user_email
         FROM feedback f
         JOIN users u ON u.id = f.user_id
         ORDER BY f.created_at DESC`,
      );
      return { feedback: result.rows };
    } finally {
      client.release();
    }
  });

  // DELETE /api/feedback/:id — delete feedback (admin only)
  app.delete<{ Params: { id: string } }>(
    '/api/feedback/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const userId = (req as any).jwtPayload?.userId;
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
      const { id } = req.params;
      const client = await pool.connect();
      try {
        const adminCheck = await client.query('SELECT is_admin FROM users WHERE id = $1', [parseInt(userId, 10)]);
        if (!adminCheck.rows[0]?.is_admin) return reply.status(403).send({ error: 'Forbidden' });
        await client.query('DELETE FROM feedback WHERE id = $1', [parseInt(id, 10)]);
        return reply.status(204).send();
      } finally {
        client.release();
      }
    },
  );
}
