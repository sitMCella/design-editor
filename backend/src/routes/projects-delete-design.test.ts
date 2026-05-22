import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../server.js';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockSql, mockStat, mockUnlink } = vi.hoisted(() => {
  const sqlFn = vi.fn();
  return {
    mockSql: Object.assign(sqlFn, {
      end: vi.fn().mockResolvedValue(undefined),
      json: vi.fn((v: unknown) => v),
    }),
    mockStat: vi.fn().mockResolvedValue({}),
    mockUnlink: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../lib/db.js', () => ({ sql: mockSql }));
vi.mock('../lib/migrate.js', () => ({ migrate: vi.fn().mockResolvedValue(undefined) }));
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  stat: mockStat,
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: mockUnlink,
}));
vi.mock('node:fs', () => ({ createReadStream: vi.fn() }));

// ---------------------------------------------------------------------------

type App = Awaited<ReturnType<typeof buildServer>>;

describe('DELETE /api/projects/:id (feature 24 — delete design)', () => {
  let app: App;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSql.end.mockResolvedValue(undefined);
    mockStat.mockResolvedValue({});
    mockUnlink.mockResolvedValue(undefined);
    app = await buildServer();
  });

  afterEach(async () => {
    await app.close();
  });

  // -------------------------------------------------------------------------
  // Happy path — AC6, AC8, AC10
  // -------------------------------------------------------------------------

  it('returns 204 No Content when the project exists (AC6, AC8)', async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 'proj-1' }]) // SELECT — project found
      .mockResolvedValueOnce([]); // DELETE

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/projects/proj-1',
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
  });

  it('calls DELETE on the project table row (AC8, AC10)', async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 'proj-2' }]) // SELECT
      .mockResolvedValueOnce([]); // DELETE

    await app.inject({ method: 'DELETE', url: '/api/projects/proj-2' });

    // Second SQL call must be the DELETE statement
    const deleteCalls = mockSql.mock.calls;
    expect(deleteCalls.length).toBeGreaterThanOrEqual(2);
    const deleteRaw = deleteCalls[1];
    // postgres.js tagged template → first arg is the TemplateStringsArray
    const sqlText = (deleteRaw?.[0] as string[] | undefined)?.join('') ?? '';
    expect(sqlText.toLowerCase()).toContain('delete');
  });

  it('attempts to remove the thumbnail file after deleting the row', async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 'proj-3' }])
      .mockResolvedValueOnce([]);

    await app.inject({ method: 'DELETE', url: '/api/projects/proj-3' });

    expect(mockUnlink).toHaveBeenCalledOnce();
    const unlinkedPath = mockUnlink.mock.calls[0]?.[0] as string;
    expect(unlinkedPath).toContain('thumb_proj-3.jpg');
  });

  it('returns 204 and skips silently when the thumbnail file does not exist', async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 'proj-no-thumb' }])
      .mockResolvedValueOnce([]);
    // Simulate the file not being present
    mockUnlink.mockRejectedValueOnce(
      Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' }),
    );

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/projects/proj-no-thumb',
    });

    expect(response.statusCode).toBe(204);
  });

  // -------------------------------------------------------------------------
  // 404 — project not found
  // -------------------------------------------------------------------------

  it('returns 404 NOT_FOUND when the project does not exist', async () => {
    mockSql.mockResolvedValueOnce([]); // SELECT — no rows

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/projects/missing-id',
    });

    expect(response.statusCode).toBe(404);
    const body = response.json<{ ok: boolean; error: { code: string } }>();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('does not call DELETE on the database when the project is not found', async () => {
    mockSql.mockResolvedValueOnce([]); // SELECT — project absent

    await app.inject({ method: 'DELETE', url: '/api/projects/ghost' });

    // Only the SELECT should have been called — no DELETE
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('does not attempt to remove the thumbnail when the project is not found', async () => {
    mockSql.mockResolvedValueOnce([]);

    await app.inject({ method: 'DELETE', url: '/api/projects/ghost' });

    expect(mockUnlink).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Independence — AC12
  // -------------------------------------------------------------------------

  it('deleting one project does not affect another project (AC12)', async () => {
    // Delete project A
    mockSql
      .mockResolvedValueOnce([{ id: 'proj-a' }])
      .mockResolvedValueOnce([]);

    const deleteResp = await app.inject({
      method: 'DELETE',
      url: '/api/projects/proj-a',
    });
    expect(deleteResp.statusCode).toBe(204);

    // Project B is still retrievable
    const canvasB = { elements: [{ id: 'el1', type: 'text', content: 'Still here' }] };
    mockSql.mockResolvedValueOnce([
      {
        id: 'proj-b',
        name: 'Design B',
        canvas: canvasB,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    const getResp = await app.inject({ method: 'GET', url: '/api/projects/proj-b' });
    expect(getResp.statusCode).toBe(200);
    const body = getResp.json<{ data: { canvas: typeof canvasB } }>();
    expect(body.data.canvas).toEqual(canvasB);
  });

  // -------------------------------------------------------------------------
  // No authentication required
  // -------------------------------------------------------------------------

  it('requires no authentication', async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 'proj-noauth' }])
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/projects/proj-noauth',
    });

    expect(response.statusCode).not.toBe(401);
    expect(response.statusCode).not.toBe(403);
  });

  // -------------------------------------------------------------------------
  // GET /api/projects — deleted project absent from the list (AC8, AC10)
  // -------------------------------------------------------------------------

  it('the deleted project does not appear in the subsequent project list (AC8, AC10)', async () => {
    // Delete
    mockSql
      .mockResolvedValueOnce([{ id: 'proj-gone' }])
      .mockResolvedValueOnce([]);

    await app.inject({ method: 'DELETE', url: '/api/projects/proj-gone' });

    // Subsequent list returns only the surviving project (backend returns what DB has)
    mockSql.mockResolvedValueOnce([
      {
        id: 'proj-survives',
        name: 'Survivor',
        element_count: 2,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    const listResp = await app.inject({ method: 'GET', url: '/api/projects' });
    expect(listResp.statusCode).toBe(200);
    const body = listResp.json<{ data: { id: string }[] }>();
    expect(body.data.every((p) => p.id !== 'proj-gone')).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ id: 'proj-survives' });
  });

  it('GET /api/projects/:id returns 404 after deletion (AC10)', async () => {
    // Delete
    mockSql
      .mockResolvedValueOnce([{ id: 'proj-del' }])
      .mockResolvedValueOnce([]);

    await app.inject({ method: 'DELETE', url: '/api/projects/proj-del' });

    // Attempt to load the now-deleted project
    mockSql.mockResolvedValueOnce([]); // SELECT returns no rows

    const getResp = await app.inject({ method: 'GET', url: '/api/projects/proj-del' });
    expect(getResp.statusCode).toBe(404);
    const body = getResp.json<{ ok: boolean; error: { code: string } }>();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
