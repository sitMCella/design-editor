import type { FastifyInstance } from 'fastify';
import type { Asset } from '../types/index.js';

export async function assetRoutes(app: FastifyInstance): Promise<void> {
  // GET /assets — list all assets
  app.get('/assets', async (_request, reply) => {
    const assets: Asset[] = [];
    await reply.status(200).send({ ok: true, data: assets });
  });

  // GET /assets/:id — get a single asset
  app.get<{ Params: { id: string } }>('/assets/:id', async (request, reply) => {
    const { id } = request.params;
    await reply
      .status(404)
      .send({ ok: false, error: { code: 'NOT_FOUND', message: `Asset ${id} not found` } });
  });

  // POST /assets — upload an asset
  app.post('/assets', async (_request, reply) => {
    await reply.status(501).send({
      ok: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Asset upload not yet implemented' },
    });
  });
}
