import { Readable } from 'node:stream';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../server.js';

// ---------------------------------------------------------------------------
// Hoisted mocks (must exist before vi.mock factories execute)
// ---------------------------------------------------------------------------

const { mockSql, mockMkdir, mockStat, mockCreateWriteStream, mockCreateReadStream, mockPipeline } =
  vi.hoisted(() => {
    const sqlFn = vi.fn();
    return {
      mockSql: Object.assign(sqlFn, { end: vi.fn().mockResolvedValue(undefined) }),
      mockMkdir: vi.fn().mockResolvedValue(undefined),
      mockStat: vi.fn().mockResolvedValue({}),
      mockCreateWriteStream: vi.fn().mockReturnValue({ destroy: vi.fn() }),
      mockCreateReadStream: vi.fn(),
      mockPipeline: vi.fn().mockImplementation(async (genFn: () => AsyncGenerator<Uint8Array>) => {
        // Consume the generator so sizeBytes accumulates inside the route
        for await (const chunk of genFn()) {
          void chunk;
        }
      }),
    };
  });

vi.mock('../lib/db.js', () => ({ sql: mockSql }));
vi.mock('../lib/migrate.js', () => ({ migrate: vi.fn().mockResolvedValue(undefined) }));
vi.mock('node:fs/promises', () => ({ mkdir: mockMkdir, stat: mockStat }));
vi.mock('node:fs', () => ({
  createWriteStream: mockCreateWriteStream,
  createReadStream: mockCreateReadStream,
}));
vi.mock('node:stream/promises', () => ({ pipeline: mockPipeline }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeImageResponse(mimeType = 'image/jpeg', chunks: Uint8Array[] = [new Uint8Array(1024)]) {
  let chunkIndex = 0;
  const reader = {
    read: vi.fn().mockImplementation(() => {
      if (chunkIndex < chunks.length) {
        return { done: false, value: chunks[chunkIndex++] };
      }
      return { done: true, value: undefined };
    }),
    cancel: vi.fn().mockResolvedValue(undefined),
  };

  return {
    ok: true,
    status: 200,
    body: { getReader: vi.fn().mockReturnValue(reader) },
    headers: { get: (h: string) => (h === 'content-type' ? mimeType : null) },
  };
}

type App = Awaited<ReturnType<typeof buildServer>>;

describe('Asset routes', () => {
  let app: App;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSql.end.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
    mockStat.mockResolvedValue({});
    mockCreateWriteStream.mockReturnValue({ destroy: vi.fn() });
    mockPipeline.mockImplementation(async (genFn: () => AsyncGenerator<Uint8Array>) => {
      for await (const chunk of genFn()) {
        void chunk;
      }
    });
    app = await buildServer();
  });

  afterEach(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // POST /api/assets/fetch — AC5, AC6, AC8, AC9, AC12
  // ---------------------------------------------------------------------------

  describe('POST /api/assets/fetch', () => {
    it('returns 400 INVALID_URL when url is not a string', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/assets/fetch',
        payload: { url: 123, name: 'img.jpg' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_URL');
    });

    it('returns 400 INVALID_URL when url is malformed', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/assets/fetch',
        payload: { url: 'not-a-url', name: 'img.jpg' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_URL');
    });

    it('returns 400 INVALID_URL when url protocol is not http/https', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/assets/fetch',
        payload: { url: 'ftp://example.com/image.jpg', name: 'img.jpg' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_URL');
    });

    it('returns 502 FETCH_FAILED on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const response = await app.inject({
        method: 'POST',
        url: '/api/assets/fetch',
        payload: { url: 'https://example.com/photo.jpg', name: 'photo.jpg' },
      });

      expect(response.statusCode).toBe(502);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('FETCH_FAILED');

      vi.unstubAllGlobals();
    });

    it('returns 502 FETCH_FAILED when origin returns non-2xx status', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, body: null }));

      const response = await app.inject({
        method: 'POST',
        url: '/api/assets/fetch',
        payload: { url: 'https://example.com/photo.jpg', name: 'photo.jpg' },
      });

      expect(response.statusCode).toBe(502);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('FETCH_FAILED');

      vi.unstubAllGlobals();
    });

    it('returns 400 NOT_AN_IMAGE when content-type is not image/* (AC8)', async () => {
      const nonImageResponse = {
        ok: true,
        status: 200,
        body: {
          cancel: vi.fn().mockResolvedValue(undefined),
          getReader: vi.fn(),
        },
        headers: { get: (h: string) => (h === 'content-type' ? 'text/html' : null) },
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(nonImageResponse));

      const response = await app.inject({
        method: 'POST',
        url: '/api/assets/fetch',
        payload: { url: 'https://example.com/page.html', name: 'page.html' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('NOT_AN_IMAGE');

      vi.unstubAllGlobals();
    });

    it('returns 400 NOT_AN_IMAGE for application/octet-stream content-type (AC8)', async () => {
      const binaryResponse = {
        ok: true,
        status: 200,
        body: {
          cancel: vi.fn().mockResolvedValue(undefined),
          getReader: vi.fn(),
        },
        headers: {
          get: (h: string) => (h === 'content-type' ? 'application/octet-stream' : null),
        },
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(binaryResponse));

      const response = await app.inject({
        method: 'POST',
        url: '/api/assets/fetch',
        payload: { url: 'https://example.com/file.bin', name: 'file.bin' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('NOT_AN_IMAGE');

      vi.unstubAllGlobals();
    });

    it('returns 400 TOO_LARGE when response exceeds 10 MB (AC9)', async () => {
      // A single chunk larger than 10 MB
      const oversizedChunk = new Uint8Array(11 * 1024 * 1024);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(makeImageResponse('image/jpeg', [oversizedChunk])),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/assets/fetch',
        payload: { url: 'https://example.com/huge.jpg', name: 'huge.jpg' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('TOO_LARGE');

      vi.unstubAllGlobals();
    });

    it('returns 400 TOO_LARGE when cumulative chunks exceed 10 MB (AC9)', async () => {
      // Two chunks that together exceed 10 MB
      const chunk1 = new Uint8Array(6 * 1024 * 1024); // 6 MB
      const chunk2 = new Uint8Array(5 * 1024 * 1024); // 5 MB — total 11 MB
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(makeImageResponse('image/jpeg', [chunk1, chunk2])),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/assets/fetch',
        payload: { url: 'https://example.com/big.jpg', name: 'big.jpg' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('TOO_LARGE');

      vi.unstubAllGlobals();
    });

    it('downloads and stores an image, returns 201 with local URL (AC5, AC6)', async () => {
      const imageChunk = new Uint8Array(1024); // 1 KB
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(makeImageResponse('image/jpeg', [imageChunk])),
      );

      const createdAt = new Date('2026-05-10T10:06:00Z');
      mockSql.mockResolvedValueOnce([
        {
          id: 'xyz789',
          name: 'photo.jpg',
          original_url: 'https://example.com/photo.jpg',
          storage_path: 'xyz789.jpg',
          mime_type: 'image/jpeg',
          size_bytes: 1024,
          created_at: createdAt,
        },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/assets/fetch',
        payload: { url: 'https://example.com/photo.jpg', name: 'photo.jpg' },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json<{
        ok: boolean;
        data: {
          id: string;
          name: string;
          originalUrl: string;
          url: string;
          mimeType: string;
          sizeBytes: number;
          createdAt: string;
        };
      }>();
      expect(body.ok).toBe(true);
      expect(body.data.url).toBe('/api/assets/xyz789/content');
      // originalUrl is included in the asset record (AC6: provenance stored in DB)
      expect(body.data.originalUrl).toBe('https://example.com/photo.jpg');
      expect(body.data.mimeType).toBe('image/jpeg');
      expect(body.data.sizeBytes).toBe(1024);
      expect(body.data.createdAt).toBe('2026-05-10T10:06:00.000Z');

      vi.unstubAllGlobals();
    });

    it('local asset URL uses /api/assets/:id/content format (AC5)', async () => {
      const imageChunk = new Uint8Array(512);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(makeImageResponse('image/png', [imageChunk])),
      );

      mockSql.mockResolvedValueOnce([
        {
          id: 'assetABC',
          name: 'logo.png',
          original_url: 'https://cdn.example.com/logo.png',
          storage_path: 'assetABC.png',
          mime_type: 'image/png',
          size_bytes: 512,
          created_at: new Date(),
        },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/assets/fetch',
        payload: { url: 'https://cdn.example.com/logo.png', name: 'logo.png' },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json<{ data: { url: string } }>();
      expect(body.data.url).toMatch(/^\/api\/assets\/[^/]+\/content$/);

      vi.unstubAllGlobals();
    });

    it('requires no authentication (AC12)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));

      const response = await app.inject({
        method: 'POST',
        url: '/api/assets/fetch',
        payload: { url: 'https://example.com/photo.jpg', name: 'photo.jpg' },
      });

      // Should fail for a non-auth reason (502), not 401/403
      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).not.toBe(403);

      vi.unstubAllGlobals();
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/assets/:id/content — AC7, AC12
  // ---------------------------------------------------------------------------

  describe('GET /api/assets/:id/content', () => {
    it('streams the image with correct Content-Type and cache headers (AC7)', async () => {
      mockSql.mockResolvedValueOnce([{ storage_path: 'xyz789.jpg', mime_type: 'image/jpeg' }]);
      mockStat.mockResolvedValue({}); // file exists
      mockCreateReadStream.mockReturnValue(Readable.from(['fake image bytes']));

      const response = await app.inject({ method: 'GET', url: '/api/assets/xyz789/content' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('image/jpeg');
      expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
      expect(response.body).toBe('fake image bytes');
    });

    it('streams a PNG image with correct Content-Type (AC7)', async () => {
      mockSql.mockResolvedValueOnce([{ storage_path: 'abc.png', mime_type: 'image/png' }]);
      mockStat.mockResolvedValue({});
      mockCreateReadStream.mockReturnValue(Readable.from(['png data']));

      const response = await app.inject({ method: 'GET', url: '/api/assets/abc/content' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('image/png');
    });

    it('returns 404 NOT_FOUND when asset record does not exist (AC7)', async () => {
      mockSql.mockResolvedValueOnce([]); // no asset row

      const response = await app.inject({
        method: 'GET',
        url: '/api/assets/nonexistent/content',
      });

      expect(response.statusCode).toBe(404);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 NOT_FOUND when file is missing from disk (AC7)', async () => {
      mockSql.mockResolvedValueOnce([{ storage_path: 'lost.jpg', mime_type: 'image/jpeg' }]);
      mockStat.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      const response = await app.inject({
        method: 'GET',
        url: '/api/assets/lost/content',
      });

      expect(response.statusCode).toBe(404);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('requires no authentication (AC12)', async () => {
      mockSql.mockResolvedValueOnce([]); // no asset — but should fail with 404 not 401/403

      const response = await app.inject({
        method: 'GET',
        url: '/api/assets/anyid/content',
      });

      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).not.toBe(403);
    });
  });
});
