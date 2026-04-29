/**
 * Route registration — F2. Delegates to auth + data + admin + password-reset + harvested-animals route modules.
 */
import type { FastifyInstance } from 'fastify';
import { registerAuthRoutes } from './auth.js';
import { registerDataRoutes } from './data.js';
import { registerAdminRoutes } from './admin.js';
import { registerPasswordResetRoutes } from './password-reset.js';
import { registerHarvestedAnimalsRoutes } from './harvested-animals.js';
import { registerFeedbackRoutes } from './feedback.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));
  await registerAuthRoutes(app);
  await registerDataRoutes(app);
  await registerAdminRoutes(app);
  await registerPasswordResetRoutes(app);
  await registerHarvestedAnimalsRoutes(app);
  await registerFeedbackRoutes(app);
}
