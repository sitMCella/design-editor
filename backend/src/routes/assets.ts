import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance } from 'fastify';
import { sql } from '../lib/db.js';
import type { Asset } from '../types/index.js';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function assetDir(): string {
  return process.env['ASSET_DIR'] ?? './assets';
}

function toAsset(row: {
  id: string;
  name: string;
  original_url: string | null;
  storage_path: string;
  mime_type: string;
  size_bytes: string | number;
  created_at: Date;
}): Asset {
  return {
    id: row.id,
    name: row.name,
    originalUrl: row.original_url,
    url: `/api/assets/${row.id}/content`,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    createdAt: row.created_at.toISOString(),
  };
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/avif': '.avif',
    'image/bmp': '.bmp',
  };
  return map[mime] ?? '.bin';
}

export async function assetRoutes(app: FastifyInstance): Promise<void> {
  // POST /assets/fetch — download an HTTP image URL and store it locally
  app.post<{ Body: { url?: unknown; name?: unknown } }>(
    '/assets/fetch',
    async (request, reply) => {
      const { url, name } = request.body ?? {};

      if (typeof url !== 'string') {
        return reply
          .status(400)
          .send({ ok: false, error: { code: 'INVALID_URL', message: 'url must be a string' } });
      }

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return reply
          .status(400)
          .send({ ok: false, error: { code: 'INVALID_URL', message: 'url is not a valid URL' } });
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return reply.status(400).send({
          ok: false,
          error: { code: 'INVALID_URL', message: 'url must use http or https' },
        });
      }

      let response: Response;
      try {
        response = await fetch(url);
      } catch {
        return reply
          .status(502)
          .send({ ok: false, error: { code: 'FETCH_FAILED', message: 'Failed to fetch URL' } });
      }

      if (!response.ok || !response.body) {
        return reply.status(502).send({
          ok: false,
          error: { code: 'FETCH_FAILED', message: `Origin responded with ${response.status}` },
        });
      }

      const contentType = response.headers.get('content-type') ?? '';
      const mimeType = contentType.split(';')[0]?.trim() ?? '';
      if (!mimeType.startsWith('image/')) {
        await response.body.cancel();
        return reply.status(400).send({
          ok: false,
          error: { code: 'NOT_AN_IMAGE', message: 'URL did not return an image' },
        });
      }

      const id = crypto.randomUUID();
      const ext = mimeToExt(mimeType);
      const storagePath = `${id}${ext}`;
      const dir = assetDir();
      await mkdir(dir, { recursive: true });
      const filePath = join(dir, storagePath);

      let sizeBytes = 0;
      try {
        const writer = createWriteStream(filePath);
        const reader = response.body.getReader();
        await pipeline(
          async function* () {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              sizeBytes += value.length;
              if (sizeBytes > MAX_BYTES) {
                await reader.cancel();
                throw Object.assign(new Error('TOO_LARGE'), { code: 'TOO_LARGE' });
              }
              yield value;
            }
          },
          writer,
        );
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code === 'TOO_LARGE') {
          return reply.status(400).send({
            ok: false,
            error: { code: 'TOO_LARGE', message: 'Image exceeds 10 MB limit' },
          });
        }
        throw err;
      }

      const assetName = typeof name === 'string' && name.trim() ? name.trim() : parsed.pathname.split('/').pop() ?? id;

      const [row] = await sql<
        {
          id: string;
          name: string;
          original_url: string | null;
          storage_path: string;
          mime_type: string;
          size_bytes: string;
          created_at: Date;
        }[]
      >`
        INSERT INTO asset (id, name, original_url, storage_path, mime_type, size_bytes)
        VALUES (${id}, ${assetName}, ${url}, ${storagePath}, ${mimeType}, ${sizeBytes})
        RETURNING id, name, original_url, storage_path, mime_type, size_bytes, created_at
      `;

      return reply.status(201).send({ ok: true, data: toAsset(row!) });
    },
  );

  // GET /assets/:id/content — stream the stored image file
  app.get<{ Params: { id: string } }>('/assets/:id/content', async (request, reply) => {
    const { id } = request.params;

    const [row] = await sql<
      { storage_path: string; mime_type: string }[]
    >`SELECT storage_path, mime_type FROM asset WHERE id = ${id}`;

    if (!row) {
      return reply
        .status(404)
        .send({ ok: false, error: { code: 'NOT_FOUND', message: 'Asset not found' } });
    }

    const filePath = join(assetDir(), row.storage_path);
    try {
      await stat(filePath);
    } catch {
      return reply
        .status(404)
        .send({ ok: false, error: { code: 'NOT_FOUND', message: 'Asset file not found on disk' } });
    }

    void reply.header('Content-Type', row.mime_type);
    void reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    return reply.send(createReadStream(filePath));
  });
}
