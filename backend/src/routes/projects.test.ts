import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../server.js';

// vi.hoisted ensures these mocks are available when vi.mock factories run
const { mockSql } = vi.hoisted(() => {
  const fn = vi.fn();
  return {
    mockSql: Object.assign(fn, {
      end: vi.fn().mockResolvedValue(undefined),
      json: vi.fn((v: unknown) => v),
    }),
  };
});

vi.mock('../lib/db.js', () => ({ sql: mockSql }));
vi.mock('../lib/migrate.js', () => ({ migrate: vi.fn().mockResolvedValue(undefined) }));

type App = Awaited<ReturnType<typeof buildServer>>;

describe('Project routes', () => {
  let app: App;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSql.end.mockResolvedValue(undefined);
    app = await buildServer();
  });

  afterEach(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // GET /api/projects — list all projects
  // ---------------------------------------------------------------------------

  describe('GET /api/projects', () => {
    it('returns an empty array when no projects exist', async () => {
      mockSql.mockResolvedValueOnce([]);

      const response = await app.inject({ method: 'GET', url: '/api/projects' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ ok: boolean; data: unknown[] }>();
      expect(body.ok).toBe(true);
      expect(body.data).toEqual([]);
    });

    it('returns project summaries ordered by most recently updated', async () => {
      const now = new Date('2026-05-10T10:07:00Z');
      const earlier = new Date('2026-05-09T08:00:00Z');
      mockSql.mockResolvedValueOnce([
        { id: 'p1', name: 'Recent', element_count: 3, created_at: earlier, updated_at: now },
        { id: 'p2', name: 'Older', element_count: 0, created_at: earlier, updated_at: earlier },
      ]);

      const response = await app.inject({ method: 'GET', url: '/api/projects' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ ok: boolean; data: { id: string; elementCount: number }[] }>();
      expect(body.data).toHaveLength(2);
      expect(body.data[0]).toMatchObject({ id: 'p1', elementCount: 3 });
      expect(body.data[1]).toMatchObject({ id: 'p2', elementCount: 0 });
    });

    it('defaults elementCount to 0 when jsonb_array_length returns null', async () => {
      mockSql.mockResolvedValueOnce([
        {
          id: 'p1',
          name: 'Design',
          element_count: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const response = await app.inject({ method: 'GET', url: '/api/projects' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { elementCount: number }[] }>();
      expect(body.data[0]).toMatchObject({ elementCount: 0 });
    });

    it('does not include the canvas field in the response', async () => {
      mockSql.mockResolvedValueOnce([
        {
          id: 'p1',
          name: 'Design',
          element_count: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const response = await app.inject({ method: 'GET', url: '/api/projects' });

      const body = response.json<{ data: Record<string, unknown>[] }>();
      expect(body.data[0]).not.toHaveProperty('canvas');
    });

    it('returns createdAt and updatedAt as ISO strings', async () => {
      const created = new Date('2026-05-01T09:00:00Z');
      const updated = new Date('2026-05-10T10:07:00Z');
      mockSql.mockResolvedValueOnce([
        { id: 'p1', name: 'Design', element_count: 0, created_at: created, updated_at: updated },
      ]);

      const response = await app.inject({ method: 'GET', url: '/api/projects' });

      const body = response.json<{ data: { createdAt: string; updatedAt: string }[] }>();
      expect(body.data[0]).toMatchObject({
        createdAt: '2026-05-01T09:00:00.000Z',
        updatedAt: '2026-05-10T10:07:00.000Z',
      });
    });

    it('requires no authentication', async () => {
      mockSql.mockResolvedValueOnce([]);
      const response = await app.inject({ method: 'GET', url: '/api/projects' });
      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).not.toBe(403);
    });

    // Feature 08 — arrow elements are counted like any other element
    it('reflects arrow element count in elementCount (feat08)', async () => {
      mockSql.mockResolvedValueOnce([
        {
          id: 'proj-arrow',
          name: 'Arrow Design',
          element_count: 3,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const response = await app.inject({ method: 'GET', url: '/api/projects' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ ok: boolean; data: { id: string; elementCount: number }[] }>();
      expect(body.data[0]).toMatchObject({ id: 'proj-arrow', elementCount: 3 });
    });

    it('returns 500 INTERNAL_ERROR when the database throws (AC6)', async () => {
      mockSql.mockRejectedValueOnce(new Error('DB connection lost'));

      const response = await app.inject({ method: 'GET', url: '/api/projects' });

      expect(response.statusCode).toBe(500);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('returns all projects when more than 6 exist — no server-side cap (AC16)', async () => {
      const base = new Date('2026-05-10T10:00:00Z');
      const rows = Array.from({ length: 9 }, (_, i) => ({
        id: `proj-${String(i + 1)}`,
        name: `Design ${String(i + 1)}`,
        element_count: i,
        created_at: base,
        updated_at: new Date(base.getTime() + i * 60_000),
      }));
      mockSql.mockResolvedValueOnce(rows);

      const response = await app.inject({ method: 'GET', url: '/api/projects' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ ok: boolean; data: unknown[] }>();
      expect(body.data).toHaveLength(9);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/projects — AC1, AC12
  // ---------------------------------------------------------------------------

  describe('POST /api/projects', () => {
    it('creates a project with empty canvas and returns 201 (AC1)', async () => {
      const now = new Date('2026-05-10T10:00:00Z');
      mockSql
        .mockResolvedValueOnce([]) // SELECT check — no existing project
        .mockResolvedValueOnce([
          {
            id: 'abc123',
            name: 'My Design',
            canvas: { elements: [] },
            created_at: now,
            updated_at: now,
          },
        ]); // INSERT RETURNING

      const response = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { id: 'abc123', name: 'My Design' },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json<{ ok: boolean; data: unknown }>();
      expect(body.ok).toBe(true);
      expect(body.data).toMatchObject({
        id: 'abc123',
        name: 'My Design',
        canvas: { elements: [] },
        createdAt: '2026-05-10T10:00:00.000Z',
        updatedAt: '2026-05-10T10:00:00.000Z',
      });
    });

    it('returns 400 INVALID_BODY when id is missing (AC1)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'My Design' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_BODY');
    });

    it('returns 400 INVALID_BODY when name is missing (AC1)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { id: 'abc123' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_BODY');
    });

    it('returns 400 INVALID_BODY when id is blank (AC1)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { id: '   ', name: 'My Design' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_BODY');
    });

    it('returns 409 CONFLICT when project id already exists (AC1)', async () => {
      mockSql.mockResolvedValueOnce([{ id: 'abc123' }]); // SELECT returns existing row

      const response = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { id: 'abc123', name: 'My Design' },
      });

      expect(response.statusCode).toBe(409);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('requires no authentication (AC12)', async () => {
      // Request with no auth headers must not be rejected with 401 or 403
      mockSql.mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          id: 'noauth1',
          name: 'Design',
          canvas: { elements: [] },
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { id: 'noauth1', name: 'Design' },
      });

      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).not.toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/projects/:id — AC3, AC4, AC12
  // ---------------------------------------------------------------------------

  describe('GET /api/projects/:id', () => {
    it('returns the project with full canvas (AC3)', async () => {
      const canvas = {
        elements: [
          {
            id: 't1',
            type: 'text',
            x: 560,
            y: 320,
            width: 160,
            height: 40,
            rotation: 0,
            opacity: 1,
            locked: false,
            content: 'Hello world',
            fontSize: 16,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 'bold',
            fontStyle: 'italic',
            color: '#111827',
            align: 'left',
          },
        ],
      };

      mockSql.mockResolvedValueOnce([
        {
          id: 'abc123',
          name: 'My Design',
          canvas,
          created_at: new Date('2026-05-10T10:00:00Z'),
          updated_at: new Date('2026-05-10T10:05:00Z'),
        },
      ]);

      const response = await app.inject({ method: 'GET', url: '/api/projects/abc123' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ ok: boolean; data: { canvas: unknown } }>();
      expect(body.ok).toBe(true);
      expect(body.data).toMatchObject({
        id: 'abc123',
        name: 'My Design',
        canvas,
        createdAt: '2026-05-10T10:00:00.000Z',
        updatedAt: '2026-05-10T10:05:00.000Z',
      });
    });

    it('returns all text element properties intact (AC3)', async () => {
      const textElement = {
        id: 'el1',
        type: 'text',
        x: 100,
        y: 200,
        width: 300,
        height: 50,
        rotation: 0,
        opacity: 0.8,
        locked: false,
        content: 'Styled text',
        fontSize: 24,
        fontFamily: 'Georgia, serif',
        fontWeight: 'bold',
        fontStyle: 'italic',
        color: '#FF0000',
        align: 'center',
      };

      mockSql.mockResolvedValueOnce([
        {
          id: 'proj1',
          name: 'Test',
          canvas: { elements: [textElement] },
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj1' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        ok: boolean;
        data: { canvas: { elements: (typeof textElement)[] } };
      }>();
      expect(body.data.canvas.elements[0]).toEqual(textElement);
    });

    it('returns canvas exactly as saved — simulates page refresh (AC4)', async () => {
      // Simulate: PATCH saves a canvas, then GET returns it verbatim
      const savedCanvas = {
        elements: [
          {
            id: 'img1',
            type: 'image',
            x: 480,
            y: 240,
            width: 320,
            height: 240,
            rotation: 0,
            opacity: 1,
            locked: false,
            src: '/api/assets/xyz789/content',
            objectFit: 'cover',
          },
        ],
      };

      mockSql.mockResolvedValueOnce([
        {
          id: 'proj2',
          name: 'Saved',
          canvas: savedCanvas,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj2' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ ok: boolean; data: { canvas: typeof savedCanvas } }>();
      expect(body.data.canvas).toEqual(savedCanvas);
    });

    // Feature 08 — ArrowElement round-trip via GET
    it('returns all arrow element properties intact (feat08)', async () => {
      const arrowElement = {
        id: 'arrow-1',
        type: 'arrow',
        x: 540,
        y: 355,
        width: 200,
        height: 10,
        rotation: 0,
        opacity: 1,
        locked: false,
        stroke: '#111827',
        strokeWidth: 2,
        arrowHead: 'end',
      };

      mockSql.mockResolvedValueOnce([
        {
          id: 'proj-arrow',
          name: 'Arrow Design',
          canvas: { elements: [arrowElement] },
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-arrow' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        ok: boolean;
        data: { canvas: { elements: (typeof arrowElement)[] } };
      }>();
      expect(body.data.canvas.elements[0]).toEqual(arrowElement);
    });

    it('returns a canvas with mixed element types including an arrow (feat08)', async () => {
      const elements = [
        {
          id: 'text-1',
          type: 'text',
          x: 100,
          y: 100,
          width: 160,
          height: 40,
          rotation: 0,
          opacity: 1,
          locked: false,
          content: 'Hello',
          fontSize: 16,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#111827',
          align: 'left',
        },
        {
          id: 'arrow-1',
          type: 'arrow',
          x: 540,
          y: 355,
          width: 200,
          height: 10,
          rotation: 0,
          opacity: 1,
          locked: false,
          stroke: '#111827',
          strokeWidth: 2,
          arrowHead: 'end',
        },
      ];

      mockSql.mockResolvedValueOnce([
        {
          id: 'proj-mixed',
          name: 'Mixed Design',
          canvas: { elements },
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-mixed' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        ok: boolean;
        data: { canvas: { elements: typeof elements } };
      }>();
      expect(body.data.canvas.elements).toHaveLength(2);
      expect(body.data.canvas.elements[0].type).toBe('text');
      expect(body.data.canvas.elements[1].type).toBe('arrow');
    });

    it('returns 404 NOT_FOUND when project does not exist (AC3)', async () => {
      mockSql.mockResolvedValueOnce([]); // no rows

      const response = await app.inject({ method: 'GET', url: '/api/projects/missing' });

      expect(response.statusCode).toBe(404);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 500 INTERNAL_ERROR when the database throws (AC13)', async () => {
      mockSql.mockRejectedValueOnce(new Error('query timeout'));

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj1' });

      expect(response.statusCode).toBe(500);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('requires no authentication (AC12)', async () => {
      mockSql.mockResolvedValueOnce([
        {
          id: 'proj3',
          name: 'Unprotected',
          canvas: { elements: [] },
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj3' });

      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).not.toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/projects/:id — AC2, AC12
  // ---------------------------------------------------------------------------

  describe('PATCH /api/projects/:id', () => {
    it('saves canvas state and returns updated metadata (AC2)', async () => {
      const canvas = { elements: [{ id: 'el1', type: 'text', content: 'Updated' }] };
      const updatedAt = new Date('2026-05-10T10:07:30Z');

      mockSql
        .mockResolvedValueOnce([{ name: 'My Design', canvas: { elements: [] } }]) // SELECT current
        .mockResolvedValueOnce([{ id: 'abc123', name: 'My Design', updated_at: updatedAt }]); // UPDATE RETURNING

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/abc123',
        payload: { canvas },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        ok: boolean;
        data: { id: string; name: string; updatedAt: string };
      }>();
      expect(body.ok).toBe(true);
      expect(body.data).toMatchObject({
        id: 'abc123',
        name: 'My Design',
        updatedAt: '2026-05-10T10:07:30.000Z',
      });
    });

    it('saves name and returns updated metadata (AC2)', async () => {
      const updatedAt = new Date('2026-05-10T10:08:00Z');

      mockSql
        .mockResolvedValueOnce([{ name: 'Old Name', canvas: { elements: [] } }])
        .mockResolvedValueOnce([{ id: 'abc123', name: 'Renamed Design', updated_at: updatedAt }]);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/abc123',
        payload: { name: 'Renamed Design' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ ok: boolean; data: { name: string } }>();
      expect(body.ok).toBe(true);
      expect(body.data.name).toBe('Renamed Design');
    });

    it('saves all text element properties to the canvas JSONB column (AC2)', async () => {
      const canvas = {
        elements: [
          {
            id: 'el1',
            type: 'text',
            x: 560,
            y: 320,
            width: 160,
            height: 40,
            rotation: 0,
            opacity: 1,
            locked: false,
            content: 'Hello',
            fontSize: 18,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fontStyle: 'italic',
            color: '#333333',
            align: 'center',
          },
        ],
      };

      mockSql
        .mockResolvedValueOnce([{ name: 'Design', canvas: { elements: [] } }])
        .mockResolvedValueOnce([{ id: 'proj1', name: 'Design', updated_at: new Date() }]);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj1',
        payload: { canvas },
      });

      expect(response.statusCode).toBe(200);
      // Verify the SQL UPDATE was called with the canvas object containing all properties.
      // postgres.js receives plain objects (not JSON strings) as interpolated values.
      const updateCall = mockSql.mock.calls[1];
      const sqlArgs = updateCall?.slice(1) as unknown[];
      const canvasArg = sqlArgs.find(
        (a): a is { elements: Record<string, unknown>[] } =>
          a !== null && typeof a === 'object' && 'elements' in (a as Record<string, unknown>),
      );
      expect(canvasArg?.elements[0]).toMatchObject({
        fontWeight: 'bold',
        fontStyle: 'italic',
        align: 'center',
      });
    });

    // Feature 08 — ArrowElement persistence via PATCH
    it('saves all arrow element properties to the canvas JSONB column (feat08)', async () => {
      const canvas = {
        elements: [
          {
            id: 'arrow-1',
            type: 'arrow',
            x: 540,
            y: 355,
            width: 200,
            height: 10,
            rotation: 0,
            opacity: 1,
            locked: false,
            stroke: '#111827',
            strokeWidth: 2,
            arrowHead: 'end',
          },
        ],
      };

      mockSql
        .mockResolvedValueOnce([{ name: 'Design', canvas: { elements: [] } }])
        .mockResolvedValueOnce([{ id: 'proj-arrow', name: 'Design', updated_at: new Date() }]);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-arrow',
        payload: { canvas },
      });

      expect(response.statusCode).toBe(200);
      // Verify the SQL UPDATE received the full arrow element structure
      const updateCall = mockSql.mock.calls[1];
      const sqlArgs = updateCall?.slice(1) as unknown[];
      const canvasArg = sqlArgs.find(
        (a): a is { elements: Record<string, unknown>[] } =>
          a !== null && typeof a === 'object' && 'elements' in (a as Record<string, unknown>),
      );
      expect(canvasArg?.elements[0]).toMatchObject({
        type: 'arrow',
        stroke: '#111827',
        strokeWidth: 2,
        arrowHead: 'end',
      });
    });

    it('saves a canvas with both text and arrow elements (feat08)', async () => {
      const canvas = {
        elements: [
          {
            id: 'text-1',
            type: 'text',
            x: 100,
            y: 100,
            width: 160,
            height: 40,
            rotation: 0,
            opacity: 1,
            locked: false,
            content: 'Label',
            fontSize: 16,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 'normal',
            fontStyle: 'normal',
            color: '#111827',
            align: 'left',
          },
          {
            id: 'arrow-1',
            type: 'arrow',
            x: 540,
            y: 355,
            width: 200,
            height: 10,
            rotation: 0,
            opacity: 1,
            locked: false,
            stroke: '#111827',
            strokeWidth: 2,
            arrowHead: 'end',
          },
        ],
      };

      mockSql
        .mockResolvedValueOnce([{ name: 'Design', canvas: { elements: [] } }])
        .mockResolvedValueOnce([{ id: 'proj-mixed', name: 'Design', updated_at: new Date() }]);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-mixed',
        payload: { canvas },
      });

      expect(response.statusCode).toBe(200);
      const updateCall = mockSql.mock.calls[1];
      const sqlArgs = updateCall?.slice(1) as unknown[];
      const canvasArg = sqlArgs.find(
        (a): a is { elements: Record<string, unknown>[] } =>
          a !== null && typeof a === 'object' && 'elements' in (a as Record<string, unknown>),
      );
      expect(canvasArg?.elements).toHaveLength(2);
      expect(canvasArg?.elements[0]).toMatchObject({ type: 'text' });
      expect(canvasArg?.elements[1]).toMatchObject({ type: 'arrow' });
    });

    it('returns 400 INVALID_BODY when no valid field is provided (AC2)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/abc123',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_BODY');
    });

    it('returns 404 NOT_FOUND when project does not exist (AC2)', async () => {
      mockSql.mockResolvedValueOnce([]); // SELECT returns nothing

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/missing',
        payload: { name: 'New Name' },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('requires no authentication (AC12)', async () => {
      mockSql
        .mockResolvedValueOnce([{ name: 'Design', canvas: { elements: [] } }])
        .mockResolvedValueOnce([{ id: 'proj1', name: 'Design', updated_at: new Date() }]);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj1',
        payload: { name: 'Updated' },
      });

      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).not.toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple independent designs — AC11
  // ---------------------------------------------------------------------------

  describe('Multiple independent designs (AC11)', () => {
    it('each project maintains its own independent canvas state', async () => {
      const canvasA = { elements: [{ id: 'a1', type: 'text', content: 'Design A' }] };
      const canvasB = { elements: [{ id: 'b1', type: 'text', content: 'Design B' }] };

      // GET project A
      mockSql.mockResolvedValueOnce([
        {
          id: 'projA',
          name: 'Design A',
          canvas: canvasA,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
      const respA = await app.inject({ method: 'GET', url: '/api/projects/projA' });
      expect(respA.statusCode).toBe(200);
      const bodyA = respA.json<{ data: { canvas: typeof canvasA } }>();
      expect(bodyA.data.canvas).toEqual(canvasA);

      // GET project B
      mockSql.mockResolvedValueOnce([
        {
          id: 'projB',
          name: 'Design B',
          canvas: canvasB,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
      const respB = await app.inject({ method: 'GET', url: '/api/projects/projB' });
      expect(respB.statusCode).toBe(200);
      const bodyB = respB.json<{ data: { canvas: typeof canvasB } }>();
      expect(bodyB.data.canvas).toEqual(canvasB);

      // Canvases are independent
      expect(bodyA.data.canvas).not.toEqual(bodyB.data.canvas);
    });

    it('a newly created project is listable with elementCount 0 (AC14)', async () => {
      const now = new Date('2026-05-11T09:00:00Z');
      const id = 'fresh-proj';
      const name = 'Brand New Design';

      // POST /api/projects
      mockSql
        .mockResolvedValueOnce([]) // SELECT — no duplicate
        .mockResolvedValueOnce([
          { id, name, canvas: { elements: [] }, created_at: now, updated_at: now },
        ]); // INSERT RETURNING
      const postResp = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { id, name },
      });
      expect(postResp.statusCode).toBe(201);

      // GET /api/projects — backend includes the new project with elementCount: 0
      mockSql.mockResolvedValueOnce([
        { id, name, element_count: 0, created_at: now, updated_at: now },
      ]);
      const listResp = await app.inject({ method: 'GET', url: '/api/projects' });

      expect(listResp.statusCode).toBe(200);
      const body = listResp.json<{ data: { id: string; name: string; elementCount: number }[] }>();
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({ id, name, elementCount: 0 });
    });

    it('creating two projects with different ids both succeed (AC11)', async () => {
      const now = new Date();

      // Project 1
      mockSql
        .mockResolvedValueOnce([]) // no existing
        .mockResolvedValueOnce([
          {
            id: 'proj1',
            name: 'Design 1',
            canvas: { elements: [] },
            created_at: now,
            updated_at: now,
          },
        ]);
      const resp1 = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { id: 'proj1', name: 'Design 1' },
      });
      expect(resp1.statusCode).toBe(201);

      // Project 2
      mockSql
        .mockResolvedValueOnce([]) // no existing
        .mockResolvedValueOnce([
          {
            id: 'proj2',
            name: 'Design 2',
            canvas: { elements: [] },
            created_at: now,
            updated_at: now,
          },
        ]);
      const resp2 = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { id: 'proj2', name: 'Design 2' },
      });
      expect(resp2.statusCode).toBe(201);

      const body1 = resp1.json<{ data: { id: string } }>();
      const body2 = resp2.json<{ data: { id: string } }>();
      expect(body1.data.id).toBe('proj1');
      expect(body2.data.id).toBe('proj2');
    });
  });
});
