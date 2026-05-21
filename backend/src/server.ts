import cors from '@fastify/cors';
import Fastify from 'fastify';

import { sql } from './lib/db.js';
import { migrate } from './lib/migrate.js';
import { assetRoutes } from './routes/assets.js';
import { healthRoutes } from './routes/health.js';
import { projectRoutes } from './routes/projects.js';

export async function buildServer() {
  const isDev = process.env.NODE_ENV !== 'production';
  // 50 MB body limit: locally-uploaded images are stored as base64 data URLs
  // in the canvas JSON, which can easily exceed Fastify's default 1 MB limit.
  const app = Fastify({
    logger: isDev
      ? { level: 'info', transport: { target: 'pino/file', options: { destination: 1 } } }
      : true,
    bodyLimit: 50 * 1024 * 1024,
  });

  await migrate();

  // Register error/not-found handlers before route plugins so encapsulated
  // plugin scopes inherit them (Fastify v5 scoping requirement).
  app.setNotFoundHandler((_request, reply) => {
    void reply.status(404).send({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  app.setErrorHandler((error: { statusCode?: number; message: string }, _request, reply) => {
    app.log.error(error);
    const status = typeof error.statusCode === 'number' ? error.statusCode : 500;
    const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message;
    void reply.status(status).send({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.addHook('onClose', async () => {
    await sql.end();
  });

  await app.register(healthRoutes);
  await app.register(projectRoutes, { prefix: '/api' });
  await app.register(assetRoutes, { prefix: '/api' });

  return app;
}
