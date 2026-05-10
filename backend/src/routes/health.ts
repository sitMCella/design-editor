import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    await reply.status(200).send({ ok: true, data: { status: 'healthy' } });
  });
}
