/**
 * Auth middleware — verifies Bearer JWT on protected routes.
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    jwtPayload?: { userId: string; email: string };
  }
}

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.slice(7);
  try {
    req.jwtPayload = verifyToken(token);
  } catch {
    return reply.status(401).send({ error: 'Token is invalid or expired' });
  }
}
