import type { FastifyInstance } from 'fastify';
import { sql } from '../lib/db.js';
import type { Project, CanvasElement } from '../types/index.js';

type ProjectRow = {
  id: string;
  name: string;
  canvas: { elements: CanvasElement[] };
  created_at: Date;
  updated_at: Date;
};

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    canvas: row.canvas,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  // POST /projects — create a new project
  app.post<{ Body: { id?: unknown; name?: unknown } }>('/projects', async (request, reply) => {
    const { id, name } = request.body ?? {};
    if (typeof id !== 'string' || !id.trim()) {
      return reply
        .status(400)
        .send({ ok: false, error: { code: 'INVALID_BODY', message: 'id is required' } });
    }
    if (typeof name !== 'string' || !name.trim()) {
      return reply
        .status(400)
        .send({ ok: false, error: { code: 'INVALID_BODY', message: 'name is required' } });
    }

    const existing = await sql<{ id: string }[]>`SELECT id FROM project WHERE id = ${id}`;
    if (existing.length > 0) {
      return reply
        .status(409)
        .send({ ok: false, error: { code: 'CONFLICT', message: 'Project already exists' } });
    }

    const [row] = await sql<ProjectRow[]>`
      INSERT INTO project (id, name)
      VALUES (${id.trim()}, ${name.trim()})
      RETURNING id, name, canvas, created_at, updated_at
    `;

    return reply.status(201).send({ ok: true, data: toProject(row!) });
  });

  // GET /projects/:id — load a project
  app.get<{ Params: { id: string } }>('/projects/:id', async (request, reply) => {
    const { id } = request.params;
    const [row] = await sql<ProjectRow[]>`
      SELECT id, name, canvas, created_at, updated_at
      FROM project
      WHERE id = ${id}
    `;
    if (!row) {
      return reply
        .status(404)
        .send({ ok: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }
    return reply.status(200).send({ ok: true, data: toProject(row) });
  });

  // PATCH /projects/:id — auto-save canvas and/or name
  app.patch<{
    Params: { id: string };
    Body: { name?: unknown; canvas?: unknown };
  }>('/projects/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, canvas } = request.body ?? {};

    const newName = typeof name === 'string' && name.trim().length > 0 ? name.trim() : null;
    const newCanvas = canvas !== null && typeof canvas === 'object' ? canvas : null;

    if (!newName && !newCanvas) {
      return reply.status(400).send({
        ok: false,
        error: { code: 'INVALID_BODY', message: 'Provide name, canvas, or both' },
      });
    }

    // Fetch current row first so we can fall back to existing values
    const [current] = await sql<{ name: string; canvas: unknown }[]>`
      SELECT name, canvas FROM project WHERE id = ${id}
    `;
    if (!current) {
      return reply
        .status(404)
        .send({ ok: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }

    const canvasJson = JSON.stringify(newCanvas ?? current.canvas);
    const [row] = await sql<{ id: string; name: string; updated_at: Date }[]>`
      UPDATE project
      SET name = ${newName ?? current.name},
          canvas = ${canvasJson}::jsonb,
          updated_at = now()
      WHERE id = ${id}
      RETURNING id, name, updated_at
    `;

    return reply.status(200).send({
      ok: true,
      data: { id: row!.id, name: row!.name, updatedAt: row!.updated_at.toISOString() },
    });
  });
}
