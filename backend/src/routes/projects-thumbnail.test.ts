import { Readable } from 'node:stream';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../server.js';

// ---------------------------------------------------------------------------
// Hoisted mocks (must exist before vi.mock factories execute)
// ---------------------------------------------------------------------------

const { mockSql, mockMkdir, mockStat, mockWriteFile, mockCreateReadStream } = vi.hoisted(() => {
  const sqlFn = vi.fn();
  return {
    mockSql: Object.assign(sqlFn, {
      end: vi.fn().mockResolvedValue(undefined),
      json: vi.fn((v: unknown) => v),
    }),
    mockMkdir: vi.fn().mockResolvedValue(undefined),
    mockStat: vi.fn().mockResolvedValue({}),
    mockWriteFile: vi.fn().mockResolvedValue(undefined),
    mockCreateReadStream: vi.fn(),
  };
});

vi.mock('../lib/db.js', () => ({ sql: mockSql }));
vi.mock('../lib/migrate.js', () => ({ migrate: vi.fn().mockResolvedValue(undefined) }));
vi.mock('node:fs/promises', () => ({ mkdir: mockMkdir, stat: mockStat, writeFile: mockWriteFile }));
vi.mock('node:fs', () => ({ createReadStream: mockCreateReadStream }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a valid multipart/form-data buffer with a single `file` field.
 * Returns the boundary string and the body Buffer so the caller can set the
 * Content-Type header correctly.
 */
function makeMultipartBody(
  content: Buffer,
  mimeType: string,
  filename = 'thumbnail.jpg',
): { boundary: string; body: Buffer } {
  const boundary = '----TestBoundary12345';
  const CRLF = '\r\n';
  const parts: Buffer[] = [
    Buffer.from(
      `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
        `Content-Type: ${mimeType}${CRLF}` +
        CRLF,
    ),
    content,
    Buffer.from(`${CRLF}--${boundary}--${CRLF}`),
  ];
  return { boundary, body: Buffer.concat(parts) };
}

/** A minimal valid JPEG: just under 512 KB. */
const smallJpeg = Buffer.alloc(1024, 0xff); // 1 KB, filled with 0xff (JPEG-like)

/** A buffer that exceeds the 512 KB limit. */
const oversizedFile = Buffer.alloc(513 * 1024, 0xab); // 513 KB

type App = Awaited<ReturnType<typeof buildServer>>;

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Project thumbnail routes', () => {
  let app: App;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Safe defaults — every mock resolves successfully unless overridden per-test
    mockSql.end.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
    mockStat.mockResolvedValue({});
    mockWriteFile.mockResolvedValue(undefined);
    mockCreateReadStream.mockReturnValue(Readable.from(['fake jpeg bytes']));

    app = await buildServer();
  });

  afterEach(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // GET /api/projects — thumbnailUrl field (AC7)
  // ---------------------------------------------------------------------------

  describe('GET /api/projects — thumbnailUrl field', () => {
    it('includes thumbnailUrl: "/api/projects/{id}/thumbnail" when thumbnail file exists (AC7)', async () => {
      const now = new Date('2026-05-10T10:07:00Z');

      // SQL returns one row
      mockSql.mockResolvedValueOnce([
        { id: 'proj1', name: 'My Design', element_count: 2, created_at: now, updated_at: now },
      ]);
      // stat resolves → file exists
      mockStat.mockResolvedValueOnce({});

      const response = await app.inject({ method: 'GET', url: '/api/projects' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        ok: boolean;
        data: { id: string; thumbnailUrl: string | null }[];
      }>();
      expect(body.ok).toBe(true);
      expect(body.data[0]?.thumbnailUrl).toBe('/api/projects/proj1/thumbnail');
    });

    it('includes thumbnailUrl: null when thumbnail file does not exist (AC7)', async () => {
      const now = new Date('2026-05-10T10:07:00Z');

      mockSql.mockResolvedValueOnce([
        { id: 'proj2', name: 'No Thumb', element_count: 0, created_at: now, updated_at: now },
      ]);
      // stat rejects with ENOENT → file missing
      mockStat.mockRejectedValueOnce(
        Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' }),
      );

      const response = await app.inject({ method: 'GET', url: '/api/projects' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        ok: boolean;
        data: { id: string; thumbnailUrl: string | null }[];
      }>();
      expect(body.ok).toBe(true);
      expect(body.data[0]?.thumbnailUrl).toBeNull();
    });

    it('returns correct thumbnailUrl for each project independently (AC14)', async () => {
      const now = new Date('2026-05-10T10:07:00Z');

      // Two rows: first has a thumbnail, second does not
      mockSql.mockResolvedValueOnce([
        { id: 'proj-a', name: 'Design A', element_count: 3, created_at: now, updated_at: now },
        { id: 'proj-b', name: 'Design B', element_count: 1, created_at: now, updated_at: now },
      ]);

      // toProjectSummary calls stat concurrently via Promise.all, one per row
      // proj-a: file exists
      mockStat.mockResolvedValueOnce({});
      // proj-b: file missing
      mockStat.mockRejectedValueOnce(
        Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' }),
      );

      const response = await app.inject({ method: 'GET', url: '/api/projects' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        ok: boolean;
        data: { id: string; thumbnailUrl: string | null }[];
      }>();
      expect(body.data).toHaveLength(2);

      const projA = body.data.find((d) => d.id === 'proj-a');
      const projB = body.data.find((d) => d.id === 'proj-b');

      expect(projA?.thumbnailUrl).toBe('/api/projects/proj-a/thumbnail');
      expect(projB?.thumbnailUrl).toBeNull();
    });

    it('returns thumbnailUrl: null for all projects when no thumbnails exist (AC7)', async () => {
      const now = new Date();

      mockSql.mockResolvedValueOnce([
        { id: 'p1', name: 'D1', element_count: 0, created_at: now, updated_at: now },
        { id: 'p2', name: 'D2', element_count: 0, created_at: now, updated_at: now },
      ]);

      // Both stat calls reject
      mockStat
        .mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
        .mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      const response = await app.inject({ method: 'GET', url: '/api/projects' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { thumbnailUrl: string | null }[] }>();
      expect(body.data[0]?.thumbnailUrl).toBeNull();
      expect(body.data[1]?.thumbnailUrl).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/projects/:id/thumbnail — stream thumbnail (AC8, AC9)
  // ---------------------------------------------------------------------------

  describe('GET /api/projects/:id/thumbnail', () => {
    it('returns the JPEG with Content-Type: image/jpeg and Cache-Control: no-cache (AC8)', async () => {
      // Project exists
      mockSql.mockResolvedValueOnce([{ id: 'proj1' }]);
      // Thumbnail file exists
      mockStat.mockResolvedValueOnce({});
      mockCreateReadStream.mockReturnValue(Readable.from(['jpeg content']));

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj1/thumbnail',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('image/jpeg');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.body).toBe('jpeg content');
    });

    it('returns 404 NOT_FOUND when the thumbnail file does not exist (AC9)', async () => {
      // Project exists
      mockSql.mockResolvedValueOnce([{ id: 'proj1' }]);
      // Thumbnail file missing
      mockStat.mockRejectedValueOnce(
        Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' }),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj1/thumbnail',
      });

      expect(response.statusCode).toBe(404);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 NOT_FOUND when the project does not exist', async () => {
      // Project not found
      mockSql.mockResolvedValueOnce([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/nonexistent/thumbnail',
      });

      expect(response.statusCode).toBe(404);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/projects/:id/thumbnail — upload thumbnail (AC10, AC11)
  // ---------------------------------------------------------------------------

  describe('POST /api/projects/:id/thumbnail', () => {
    it('returns 204 No Content on successful upload', async () => {
      // Project exists
      mockSql.mockResolvedValueOnce([{ id: 'proj1' }]);
      // UPDATE thumbnail_url
      mockSql.mockResolvedValueOnce([]);

      const { boundary, body } = makeMultipartBody(smallJpeg, 'image/jpeg');
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects/proj1/thumbnail',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        body,
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
    });

    it('writes the file to disk and updates the project on successful upload', async () => {
      mockSql.mockResolvedValueOnce([{ id: 'proj1' }]);
      mockSql.mockResolvedValueOnce([]);

      const { boundary, body } = makeMultipartBody(smallJpeg, 'image/jpeg');
      await app.inject({
        method: 'POST',
        url: '/api/projects/proj1/thumbnail',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        body,
      });

      expect(mockMkdir).toHaveBeenCalledOnce();
      expect(mockWriteFile).toHaveBeenCalledOnce();
      // Filename must use the predictable thumb_{id}.jpg pattern
      const writeArgs = mockWriteFile.mock.calls[0] as [string, Buffer];
      expect(writeArgs[0]).toMatch(/thumb_proj1\.jpg$/);
      // SQL UPDATE must have been called
      expect(mockSql).toHaveBeenCalledTimes(2); // SELECT + UPDATE
    });

    it('returns 400 INVALID_FILE when a non-JPEG file is uploaded (AC10)', async () => {
      // Project exists
      mockSql.mockResolvedValueOnce([{ id: 'proj1' }]);

      const pngContent = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
      const { boundary, body } = makeMultipartBody(pngContent, 'image/png', 'thumb.png');
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects/proj1/thumbnail',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        body,
      });

      expect(response.statusCode).toBe(400);
      const respBody = response.json<{ ok: boolean; error: { code: string } }>();
      expect(respBody.ok).toBe(false);
      expect(respBody.error.code).toBe('INVALID_FILE');
    });

    it('returns 400 INVALID_FILE when a text/plain file is uploaded (AC10)', async () => {
      mockSql.mockResolvedValueOnce([{ id: 'proj1' }]);

      const { boundary, body } = makeMultipartBody(
        Buffer.from('hello world'),
        'text/plain',
        'file.txt',
      );
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects/proj1/thumbnail',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        body,
      });

      expect(response.statusCode).toBe(400);
      const respBody = response.json<{ ok: boolean; error: { code: string } }>();
      expect(respBody.ok).toBe(false);
      expect(respBody.error.code).toBe('INVALID_FILE');
    });

    it('returns 400 TOO_LARGE when file exceeds 512 KB (AC11)', async () => {
      // Project exists
      mockSql.mockResolvedValueOnce([{ id: 'proj1' }]);

      const { boundary, body } = makeMultipartBody(oversizedFile, 'image/jpeg');
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects/proj1/thumbnail',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        body,
      });

      expect(response.statusCode).toBe(400);
      const respBody = response.json<{ ok: boolean; error: { code: string } }>();
      expect(respBody.ok).toBe(false);
      expect(respBody.error.code).toBe('TOO_LARGE');
    });

    it('returns 404 NOT_FOUND when the project does not exist', async () => {
      // Project not found
      mockSql.mockResolvedValueOnce([]);

      const { boundary, body } = makeMultipartBody(smallJpeg, 'image/jpeg');
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects/nonexistent/thumbnail',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        body,
      });

      expect(response.statusCode).toBe(404);
      const respBody = response.json<{ ok: boolean; error: { code: string } }>();
      expect(respBody.ok).toBe(false);
      expect(respBody.error.code).toBe('NOT_FOUND');
    });

    it('does not write to disk when the project does not exist', async () => {
      mockSql.mockResolvedValueOnce([]); // project not found

      const { boundary, body } = makeMultipartBody(smallJpeg, 'image/jpeg');
      await app.inject({
        method: 'POST',
        url: '/api/projects/nonexistent/thumbnail',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        body,
      });

      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple independent thumbnails (AC14)
  // ---------------------------------------------------------------------------

  describe('Multiple designs have independent thumbnails (AC14)', () => {
    it('each project has its own thumbnail URL derived from its id', async () => {
      const now = new Date('2026-05-10T10:00:00Z');

      // List with two projects — both have thumbnails
      mockSql.mockResolvedValueOnce([
        { id: 'design-alpha', name: 'Alpha', element_count: 1, created_at: now, updated_at: now },
        { id: 'design-beta', name: 'Beta', element_count: 2, created_at: now, updated_at: now },
      ]);
      // Both stat calls resolve → thumbnails exist
      mockStat.mockResolvedValueOnce({}).mockResolvedValueOnce({});

      const response = await app.inject({ method: 'GET', url: '/api/projects' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        ok: boolean;
        data: { id: string; thumbnailUrl: string | null }[];
      }>();
      expect(body.data).toHaveLength(2);

      const alpha = body.data.find((d) => d.id === 'design-alpha');
      const beta = body.data.find((d) => d.id === 'design-beta');

      expect(alpha?.thumbnailUrl).toBe('/api/projects/design-alpha/thumbnail');
      expect(beta?.thumbnailUrl).toBe('/api/projects/design-beta/thumbnail');
      // The URLs must be distinct
      expect(alpha?.thumbnailUrl).not.toBe(beta?.thumbnailUrl);
    });

    it('uploading a thumbnail for one project does not affect another', async () => {
      // Upload thumbnail for proj-1
      mockSql.mockResolvedValueOnce([{ id: 'proj-1' }]); // SELECT for proj-1
      mockSql.mockResolvedValueOnce([]); // UPDATE proj-1

      const { boundary: b1, body: body1 } = makeMultipartBody(smallJpeg, 'image/jpeg');
      const resp1 = await app.inject({
        method: 'POST',
        url: '/api/projects/proj-1/thumbnail',
        headers: { 'content-type': `multipart/form-data; boundary=${b1}` },
        body: body1,
      });
      expect(resp1.statusCode).toBe(204);

      // Upload thumbnail for proj-2 independently
      mockSql.mockResolvedValueOnce([{ id: 'proj-2' }]); // SELECT for proj-2
      mockSql.mockResolvedValueOnce([]); // UPDATE proj-2

      const { boundary: b2, body: body2 } = makeMultipartBody(smallJpeg, 'image/jpeg');
      const resp2 = await app.inject({
        method: 'POST',
        url: '/api/projects/proj-2/thumbnail',
        headers: { 'content-type': `multipart/form-data; boundary=${b2}` },
        body: body2,
      });
      expect(resp2.statusCode).toBe(204);

      // writeFile must have been called twice, once per project, with distinct paths
      expect(mockWriteFile).toHaveBeenCalledTimes(2);
      const [path1] = mockWriteFile.mock.calls[0] as [string];
      const [path2] = mockWriteFile.mock.calls[1] as [string];
      expect(path1).toMatch(/thumb_proj-1\.jpg$/);
      expect(path2).toMatch(/thumb_proj-2\.jpg$/);
      expect(path1).not.toBe(path2);
    });

    it('streaming thumbnail for one project does not affect another (AC14)', async () => {
      // Stream thumbnail for proj-a
      mockSql.mockResolvedValueOnce([{ id: 'proj-a' }]);
      mockStat.mockResolvedValueOnce({});
      mockCreateReadStream.mockReturnValueOnce(Readable.from(['thumb-a']));

      const respA = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-a/thumbnail',
      });
      expect(respA.statusCode).toBe(200);
      expect(respA.body).toBe('thumb-a');

      // Stream thumbnail for proj-b
      mockSql.mockResolvedValueOnce([{ id: 'proj-b' }]);
      mockStat.mockResolvedValueOnce({});
      mockCreateReadStream.mockReturnValueOnce(Readable.from(['thumb-b']));

      const respB = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-b/thumbnail',
      });
      expect(respB.statusCode).toBe(200);
      expect(respB.body).toBe('thumb-b');

      // Thumbnails are independent
      expect(respA.body).not.toBe(respB.body);
    });
  });
});
