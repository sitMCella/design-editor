import type { FastifyInstance } from 'fastify';
import type { Design } from '../types/index.js';

export async function designRoutes(app: FastifyInstance): Promise<void> {
  // GET /designs — list all designs
  app.get('/designs', async (_request, reply) => {
    const designs: Design[] = [];
    await reply.status(200).send({ ok: true, data: designs });
  });

  // GET /designs/:id — get a single design
  app.get<{ Params: { id: string } }>('/designs/:id', async (request, reply) => {
    const { id } = request.params;
    await reply
      .status(404)
      .send({ ok: false, error: { code: 'NOT_FOUND', message: `Design ${id} not found` } });
  });

  // POST /designs — create a new design
  app.post('/designs', async (_request, reply) => {
    await reply.status(501).send({
      ok: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Design creation not yet implemented' },
    });
  });

  // PATCH /designs/:id — update (auto-save) a design
  app.patch<{ Params: { id: string } }>('/designs/:id', async (request, reply) => {
    const { id } = request.params;
    await reply.status(501).send({
      ok: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: `Design update for ${id} not yet implemented`,
      },
    });
  });

  // DELETE /designs/:id — delete a design
  app.delete<{ Params: { id: string } }>('/designs/:id', async (request, reply) => {
    const { id } = request.params;
    await reply.status(501).send({
      ok: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: `Design deletion for ${id} not yet implemented`,
      },
    });
  });
}
