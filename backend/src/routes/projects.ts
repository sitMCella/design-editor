import type { FastifyInstance } from 'fastify';
import { sql } from '../lib/db.js';
import type { Project, ProjectSummary, CanvasElement } from '../types/index.js';

type ProjectRow = {
  id: string;
  name: string;
  canvas: { elements: CanvasElement[] };
  created_at: Date;
  updated_at: Date;
};

type ProjectSummaryRow = {
  id: string;
  name: string;
  element_count: number;
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

function toProjectSummary(row: ProjectSummaryRow): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    elementCount: row.element_count ?? 0,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function projectRoutes(app: FastifyInstance): void {
  // GET /projects — list all projects ordered by most recently updated
  app.get('/projects', async (_request, reply) => {
    const rows = await sql<ProjectSummaryRow[]>`
      SELECT id, name,
             COALESCE(jsonb_array_length(canvas->'elements'), 0) AS element_count,
             created_at, updated_at
      FROM project
      ORDER BY updated_at DESC
    `;
    return reply.status(200).send({ ok: true, data: rows.map(toProjectSummary) });
  });

  // POST /projects — create a new project
  app.post<{ Body: { id?: unknown; name?: unknown } }>('/projects', async (request, reply) => {
    const { id, name } = request.body;
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

    if (!row) throw new Error('INSERT project returned no rows');
    return reply.status(201).send({ ok: true, data: toProject(row) });
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
    const { name, canvas } = request.body;

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

    const canvasValue = (newCanvas ?? current.canvas) as Record<string, unknown>;
    const [row] = await sql<{ id: string; name: string; updated_at: Date }[]>`
      UPDATE project
      SET name = ${newName ?? current.name},
          canvas = ${sql.json(canvasValue)},
          updated_at = now()
      WHERE id = ${id}
      RETURNING id, name, updated_at
    `;

    if (!row) throw new Error('UPDATE project returned no rows');
    return reply.status(200).send({
      ok: true,
      data: { id: row.id, name: row.name, updatedAt: row.updated_at.toISOString() },
    });
  });
}
