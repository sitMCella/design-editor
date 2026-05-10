import type { FastifyInstance } from 'fastify';

import { sql } from '../lib/db.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    try {
      await sql`SELECT 1`;
      await reply.status(200).send({ ok: true, data: { status: 'healthy', db: 'connected' } });
    } catch {
      await reply.status(503).send({ ok: false, data: { status: 'unhealthy', db: 'unreachable' } });
    }
  });
}
