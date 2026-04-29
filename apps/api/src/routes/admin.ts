/**
 * Admin routes — user management. Requires is_admin = true on the requesting account.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../db.js';
import { verifyToken } from '../auth.js';

async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT is_admin FROM users WHERE id = $1',
        [payload.userId],
      );
      if (result.rows.length === 0 || !result.rows[0].is_admin) {
        return reply.status(403).send({ error: 'Admin access required' });
      }
      req.jwtPayload = payload;
    } finally {
      client.release();
    }
  } catch {
    return reply.status(401).send({ error: 'Token is invalid or expired' });
  }
}

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/admin/users — list all accounts
  app.get('/api/v1/admin/users', { preHandler: requireAdmin }, async (_req, _reply) => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, email, name, created_at, is_active, is_admin
         FROM users
         ORDER BY created_at ASC`,
      );
      return result.rows.map((row: any) => ({
        id: String(row.id),
        email: row.email as string,
        name: (row.name as string | null) ?? '',
        createdAt: (row.created_at as Date).toISOString(),
        isActive: (row.is_active as boolean) ?? true,
        isAdmin: (row.is_admin as boolean) ?? false,
      }));
    } finally {
      client.release();
    }
  });

  // PATCH /api/v1/admin/users/:id/active — set is_active
  app.patch<{ Params: { id: string } }>(
    '/api/v1/admin/users/:id/active',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const { id } = req.params;
      const body = req.body as { isActive?: boolean };
      if (typeof body.isActive !== 'boolean') {
        return reply.status(400).send({ error: 'isActive (boolean) required' });
      }
      const client = await pool.connect();
      try {
        const result = await client.query(
          'UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
          [body.isActive, id],
        );
        if ((result.rowCount ?? 0) === 0) {
          return reply.status(404).send({ error: 'User not found' });
        }
        return reply.send({ success: true });
      } finally {
        client.release();
      }
    },
  );

  // PATCH /api/v1/admin/users/:id/admin — set is_admin (last-admin protected)
  app.patch<{ Params: { id: string } }>(
    '/api/v1/admin/users/:id/admin',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const { id } = req.params;
      const body = req.body as { isAdmin?: boolean };
      if (typeof body.isAdmin !== 'boolean') {
        return reply.status(400).send({ error: 'isAdmin (boolean) required' });
      }
      const client = await pool.connect();
      try {
        if (!body.isAdmin) {
          // Protect: cannot remove admin if this would leave zero admins
          const countResult = await client.query(
            'SELECT COUNT(*) FROM users WHERE is_admin = true AND id != $1',
            [id],
          );
          const remainingAdmins = parseInt(String(countResult.rows[0].count), 10);
          if (remainingAdmins === 0) {
            return reply.status(400).send({ error: 'Cannot remove the last admin' });
          }
        }
        const result = await client.query(
          'UPDATE users SET is_admin = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
          [body.isAdmin, id],
        );
        if ((result.rowCount ?? 0) === 0) {
          return reply.status(404).send({ error: 'User not found' });
        }
        return reply.send({ success: true });
      } finally {
        client.release();
      }
    },
  );

  // DELETE /api/v1/admin/users/:id — hard-delete user + all data (last-admin protected, password required)
  app.delete<{ Params: { id: string } }>(
    '/api/v1/admin/users/:id',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const { id } = req.params;
      const body = req.body as { password?: string };
      if (!body.password) {
        return reply.status(400).send({ error: 'Admin password required' });
      }
      const client = await pool.connect();
      try {
        // Verify admin's own password before allowing deletion
        const adminResult = await client.query(
          'SELECT password_hash FROM users WHERE id = $1',
          [req.jwtPayload!.userId],
        );
        if (adminResult.rows.length === 0) {
          return reply.status(403).send({ error: 'Admin not found' });
        }
        const { default: bcrypt } = await import('bcryptjs');
        const validPw = await bcrypt.compare(body.password, adminResult.rows[0].password_hash as string);
        if (!validPw) {
          return reply.status(401).send({ error: 'Incorrect password' });
        }
        // Fetch target user
        const targetResult = await client.query('SELECT is_admin FROM users WHERE id = $1', [id]);
        if (targetResult.rows.length === 0) {
          return reply.status(404).send({ error: 'User not found' });
        }
        // Last-admin protection
        if (targetResult.rows[0].is_admin) {
          const countResult = await client.query(
            'SELECT COUNT(*) FROM users WHERE is_admin = true AND id != $1',
            [id],
          );
          const remainingAdmins = parseInt(String(countResult.rows[0].count), 10);
          if (remainingAdmins === 0) {
            return reply.status(400).send({ error: 'Cannot delete the last admin' });
          }
        }
        // Cascade delete all user data
        for (const table of ['huntlog_weapons', 'huntlog_ammo', 'huntlog_locations', 'huntlog_sessions', 'huntlog_dogs']) {
          await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [id]);
        }
        await client.query('DELETE FROM users WHERE id = $1', [id]);
        return reply.status(204).send();
      } finally {
        client.release();
      }
    },
  );
}
