import cors from '@fastify/cors';
import Fastify from 'fastify';

import { assetRoutes } from './routes/assets.js';
import { designRoutes } from './routes/designs.js';
import { healthRoutes } from './routes/health.js';

export async function buildServer() {
  const isDev = process.env['NODE_ENV'] !== 'production';
  const app = Fastify({
    logger: isDev
      ? { level: 'info', transport: { target: 'pino/file', options: { destination: 1 } } }
      : true,
  });

  await app.register(cors, {
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(healthRoutes);
  await app.register(designRoutes, { prefix: '/api' });
  await app.register(assetRoutes, { prefix: '/api' });

  app.setNotFoundHandler(async (_request, reply) => {
    await reply.status(404).send({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  app.setErrorHandler(async (error: { statusCode?: number; message: string }, _request, reply) => {
    app.log.error(error);
    const status = typeof error.statusCode === 'number' ? error.statusCode : 500;
    const message =
      process.env['NODE_ENV'] === 'production' ? 'Internal server error' : error.message;
    await reply.status(status).send({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  });

  return app;
}
