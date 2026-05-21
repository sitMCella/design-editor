import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import fastifyMultipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { sql } from '../lib/db.js';
import type { Project, ProjectSummary, CanvasElement } from '../types/index.js';

const MAX_THUMBNAIL_BYTES = 512 * 1024; // 512 KB

function assetDir(): string {
  return process.env.ASSET_DIR ?? './assets';
}

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
  element_count: number | null;
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

async function thumbnailUrl(id: string): Promise<string | null> {
  const dir = assetDir();
  const filePath = join(dir, `thumb_${id}.jpg`);
  try {
    await stat(filePath);
    return `/api/projects/${id}/thumbnail`;
  } catch {
    return null;
  }
}

async function toProjectSummary(row: ProjectSummaryRow): Promise<ProjectSummary> {
  return {
    id: row.id,
    name: row.name,
    elementCount: row.element_count ?? 0,
    thumbnailUrl: await thumbnailUrl(row.id),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  await app.register(fastifyMultipart, { limits: { fileSize: MAX_THUMBNAIL_BYTES } });

  // GET /projects — list all projects ordered by most recently updated
  app.get('/projects', async (_request, reply) => {
    const rows = await sql<ProjectSummaryRow[]>`
      SELECT id, name,
             COALESCE(jsonb_array_length(canvas->'elements'), 0) AS element_count,
             created_at, updated_at
      FROM project
      ORDER BY updated_at DESC
    `;
    const data = await Promise.all(rows.map(toProjectSummary));
    return reply.status(200).send({ ok: true, data });
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

    const [current] = await sql<{ name: string; canvas: unknown }[]>`
      SELECT name, canvas FROM project WHERE id = ${id}
    `;
    if (!current) {
      return reply
        .status(404)
        .send({ ok: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }

    const canvasJSON = sql.json((newCanvas ?? current.canvas) as Parameters<typeof sql.json>[0]);
    const [row] = await sql<{ id: string; name: string; updated_at: Date }[]>`
      UPDATE project
      SET name = ${newName ?? current.name},
          canvas = ${canvasJSON},
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

  // POST /projects/:id/thumbnail — upload or replace the thumbnail
  app.post<{ Params: { id: string } }>('/projects/:id/thumbnail', async (request, reply) => {
    const { id } = request.params;

    const [project] = await sql<{ id: string }[]>`SELECT id FROM project WHERE id = ${id}`;
    if (!project) {
      return reply
        .status(404)
        .send({ ok: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }

    let data: Awaited<ReturnType<typeof request.file>>;
    try {
      data = await request.file();
    } catch (err: unknown) {
      const fsErr = err as { code?: string };
      if (fsErr.code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply
          .status(400)
          .send({ ok: false, error: { code: 'TOO_LARGE', message: 'File exceeds 512 KB limit' } });
      }
      throw err;
    }

    if (!data) {
      return reply
        .status(400)
        .send({ ok: false, error: { code: 'INVALID_FILE', message: 'No file uploaded' } });
    }

    if (data.mimetype !== 'image/jpeg') {
      await data.toBuffer();
      return reply
        .status(400)
        .send({ ok: false, error: { code: 'INVALID_FILE', message: 'File must be image/jpeg' } });
    }

    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
    } catch (err: unknown) {
      const fsErr = err as { code?: string };
      if (fsErr.code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply
          .status(400)
          .send({ ok: false, error: { code: 'TOO_LARGE', message: 'File exceeds 512 KB limit' } });
      }
      throw err;
    }

    if (buffer.length > MAX_THUMBNAIL_BYTES) {
      return reply
        .status(400)
        .send({ ok: false, error: { code: 'TOO_LARGE', message: 'File exceeds 512 KB limit' } });
    }

    const dir = assetDir();
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, `thumb_${id}.jpg`);
    await writeFile(filePath, buffer);

    await sql`
      UPDATE project
      SET thumbnail_url = ${`/api/projects/${id}/thumbnail`},
          updated_at = now()
      WHERE id = ${id}
    `;

    return reply.status(204).send();
  });

  // DELETE /projects/:id — permanently delete a project and its thumbnail
  app.delete<{ Params: { id: string } }>('/projects/:id', async (request, reply) => {
    const { id } = request.params;

    const [project] = await sql<{ id: string }[]>`SELECT id FROM project WHERE id = ${id}`;
    if (!project) {
      return reply
        .status(404)
        .send({ ok: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }

    await sql`DELETE FROM project WHERE id = ${id}`;

    const thumbPath = join(assetDir(), `thumb_${id}.jpg`);
    try {
      const { unlink } = await import('node:fs/promises');
      await unlink(thumbPath);
    } catch {
      // File may not exist — skip silently
    }

    return reply.status(204).send();
  });

  // GET /projects/:id/thumbnail — stream the thumbnail file
  app.get<{ Params: { id: string } }>('/projects/:id/thumbnail', async (request, reply) => {
    const { id } = request.params;

    const [project] = await sql<{ id: string }[]>`SELECT id FROM project WHERE id = ${id}`;
    if (!project) {
      return reply
        .status(404)
        .send({ ok: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }

    const filePath = join(assetDir(), `thumb_${id}.jpg`);
    try {
      await stat(filePath);
    } catch {
      return reply
        .status(404)
        .send({ ok: false, error: { code: 'NOT_FOUND', message: 'Thumbnail not found' } });
    }

    void reply.header('Content-Type', 'image/jpeg');
    void reply.header('Cache-Control', 'no-cache');
    return reply.send(createReadStream(filePath));
  });
}
