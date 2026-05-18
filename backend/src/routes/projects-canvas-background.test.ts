/**
 * Backend unit tests for feature 20 — Canvas Background Colour.
 *
 * The backend stores the canvas JSONB verbatim, so `backgroundColor` is persisted
 * inside `canvas` alongside `elements` with no schema change required.
 *
 * Covered ACs:
 *  AC10 — PATCH persists `backgroundColor` inside the `canvas` JSON column
 *  AC11 — GET /api/projects/:id returns `backgroundColor` exactly as saved,
 *          including the 'transparent' sentinel value
 *  AC12 — Designs saved before this feature (no `backgroundColor` in canvas)
 *          load correctly — the backend returns the canvas as-is without error
 *  AC17 — Changing `backgroundColor` does not affect canvas elements;
 *          elements are returned verbatim alongside the new background colour
 *  AC18 — Multiple designs maintain independent `backgroundColor` values
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../server.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the canvas argument passed to the UPDATE call (second SQL call in PATCH). */
function extractCanvasFromPatch(): Record<string, unknown> | undefined {
  const updateCall = mockSql.mock.calls[1];
  const args = (updateCall?.slice(1) ?? []) as unknown[];
  return args.find(
    (a): a is Record<string, unknown> =>
      a !== null && typeof a === 'object' && ('elements' in a || 'backgroundColor' in a),
  );
}

/** Mock PATCH: SELECT current row + UPDATE RETURNING. */
function mockPatchSuccess(
  projectId: string,
  currentCanvas: Record<string, unknown> = { elements: [] },
) {
  mockSql
    .mockResolvedValueOnce([{ name: 'Design', canvas: currentCanvas }])
    .mockResolvedValueOnce([{ id: projectId, name: 'Design', updated_at: new Date() }]);
}

/** Mock GET for one project. */
function mockGetSuccess(projectId: string, canvas: Record<string, unknown>) {
  mockSql.mockResolvedValueOnce([
    {
      id: projectId,
      name: 'Design',
      canvas,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);
}

/** A minimal text element for use in test canvases. */
const textElement = {
  id: 'txt-1',
  type: 'text',
  x: 560,
  y: 320,
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
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Canvas Background Colour — project routes (feat20)', () => {
  let app: App;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSql.end.mockResolvedValue(undefined);
    app = await buildServer();
  });

  afterEach(async () => {
    await app.close();
  });

  // =========================================================================
  // AC10 — PATCH persists backgroundColor inside the canvas JSON column
  // =========================================================================

  describe('AC10 — PATCH persists backgroundColor inside canvas JSON', () => {
    it('saves a solid hex backgroundColor alongside elements', async () => {
      mockPatchSuccess('proj-bg-hex');

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-bg-hex',
        payload: {
          canvas: {
            elements: [textElement],
            backgroundColor: '#FFFFFF',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas).toMatchObject({ backgroundColor: '#FFFFFF' });
    });

    it('saves the default grey backgroundColor (#F3F4F6)', async () => {
      mockPatchSuccess('proj-bg-default');

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-bg-default',
        payload: {
          canvas: {
            elements: [],
            backgroundColor: '#F3F4F6',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas).toMatchObject({ backgroundColor: '#F3F4F6' });
    });

    it('saves the transparent sentinel value', async () => {
      mockPatchSuccess('proj-bg-transparent');

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-bg-transparent',
        payload: {
          canvas: {
            elements: [],
            backgroundColor: 'transparent',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas).toMatchObject({ backgroundColor: 'transparent' });
    });

    it('saves backgroundColor alongside multiple element types', async () => {
      const imageElement = {
        id: 'img-1',
        type: 'image',
        x: 480,
        y: 240,
        width: 320,
        height: 240,
        rotation: 0,
        opacity: 1,
        locked: false,
        src: '/api/assets/xyz/content',
        objectFit: 'cover',
      };

      mockPatchSuccess('proj-bg-multi');

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-bg-multi',
        payload: {
          canvas: {
            elements: [textElement, imageElement],
            backgroundColor: '#BAE6FD',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas).toMatchObject({ backgroundColor: '#BAE6FD' });
      expect((canvas?.elements as unknown[]).length).toBe(2);
    });

    it('preserves elements verbatim when saving a new backgroundColor', async () => {
      mockPatchSuccess('proj-bg-preserve');

      await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-bg-preserve',
        payload: {
          canvas: {
            elements: [textElement],
            backgroundColor: '#111827',
          },
        },
      });

      const canvas = extractCanvasFromPatch();
      expect((canvas?.elements as unknown[])[0]).toMatchObject({
        id: 'txt-1',
        type: 'text',
        x: 560,
        y: 320,
        content: 'Hello',
      });
    });

    it('saves backgroundColor as a dark colour (#111827)', async () => {
      mockPatchSuccess('proj-bg-dark');

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-bg-dark',
        payload: {
          canvas: { elements: [], backgroundColor: '#111827' },
        },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas).toMatchObject({ backgroundColor: '#111827' });
    });

    it('saves any valid preset colour from the palette', async () => {
      const presets = [
        '#F3F4F6',
        '#FFFFFF',
        '#E5E7EB',
        '#64748B',
        '#111827',
        '#BAE6FD',
        '#BFDBFE',
        '#C7D2FE',
        '#E9D5FF',
        '#FECDD3',
        '#FDE68A',
        '#A7F3D0',
      ];

      for (const color of presets) {
        vi.clearAllMocks();
        mockSql.end.mockResolvedValue(undefined);
        mockPatchSuccess(`proj-preset-${color.replace('#', '')}`);

        const response = await app.inject({
          method: 'PATCH',
          url: `/api/projects/proj-preset-${color.replace('#', '')}`,
          payload: { canvas: { elements: [], backgroundColor: color } },
        });

        expect(response.statusCode).toBe(200);
        const canvas = extractCanvasFromPatch();
        expect(canvas).toMatchObject({ backgroundColor: color });
      }
    });

    it('returns 200 with id, name, and updatedAt after saving backgroundColor', async () => {
      const updatedAt = new Date('2026-05-18T10:00:00Z');
      mockSql
        .mockResolvedValueOnce([{ name: 'My Design', canvas: { elements: [] } }])
        .mockResolvedValueOnce([{ id: 'proj-bg-resp', name: 'My Design', updated_at: updatedAt }]);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-bg-resp',
        payload: { canvas: { elements: [], backgroundColor: '#FFFFFF' } },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        ok: boolean;
        data: { id: string; name: string; updatedAt: string };
      }>();
      expect(body.ok).toBe(true);
      expect(body.data.id).toBe('proj-bg-resp');
      expect(body.data.updatedAt).toBe(updatedAt.toISOString());
    });
  });

  // =========================================================================
  // AC11 — GET returns backgroundColor exactly as saved, including 'transparent'
  // =========================================================================

  describe('AC11 — GET returns backgroundColor exactly as stored', () => {
    it('returns a solid hex backgroundColor from the canvas', async () => {
      mockGetSuccess('proj-get-hex', {
        elements: [textElement],
        backgroundColor: '#FFFFFF',
      });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-get-hex' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { canvas: { backgroundColor: string } } }>();
      expect(body.data.canvas.backgroundColor).toBe('#FFFFFF');
    });

    it('returns the transparent sentinel string verbatim', async () => {
      mockGetSuccess('proj-get-transparent', {
        elements: [],
        backgroundColor: 'transparent',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-get-transparent',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { canvas: { backgroundColor: string } } }>();
      expect(body.data.canvas.backgroundColor).toBe('transparent');
    });

    it('returns the default grey (#F3F4F6) when that was saved as backgroundColor', async () => {
      mockGetSuccess('proj-get-grey', {
        elements: [],
        backgroundColor: '#F3F4F6',
      });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-get-grey' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { canvas: { backgroundColor: string } } }>();
      expect(body.data.canvas.backgroundColor).toBe('#F3F4F6');
    });

    it('returns elements unchanged alongside the stored backgroundColor', async () => {
      mockGetSuccess('proj-get-elems', {
        elements: [textElement],
        backgroundColor: '#BAE6FD',
      });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-get-elems' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        data: { canvas: { elements: (typeof textElement)[]; backgroundColor: string } };
      }>();
      expect(body.data.canvas.backgroundColor).toBe('#BAE6FD');
      expect(body.data.canvas.elements[0]).toMatchObject({
        id: 'txt-1',
        content: 'Hello',
        x: 560,
        y: 320,
      });
    });

    it('PATCH → GET round-trip preserves backgroundColor exactly', async () => {
      mockPatchSuccess('proj-rt-bg');

      const patchResp = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-rt-bg',
        payload: {
          canvas: { elements: [textElement], backgroundColor: '#E9D5FF' },
        },
      });
      expect(patchResp.statusCode).toBe(200);

      mockGetSuccess('proj-rt-bg', {
        elements: [textElement],
        backgroundColor: '#E9D5FF',
      });

      const getResp = await app.inject({ method: 'GET', url: '/api/projects/proj-rt-bg' });
      expect(getResp.statusCode).toBe(200);
      const body = getResp.json<{ data: { canvas: { backgroundColor: string } } }>();
      expect(body.data.canvas.backgroundColor).toBe('#E9D5FF');
    });

    it('PATCH → GET round-trip preserves the transparent background', async () => {
      mockPatchSuccess('proj-rt-transparent');

      await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-rt-transparent',
        payload: { canvas: { elements: [], backgroundColor: 'transparent' } },
      });

      mockGetSuccess('proj-rt-transparent', {
        elements: [],
        backgroundColor: 'transparent',
      });

      const getResp = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-rt-transparent',
      });
      expect(getResp.statusCode).toBe(200);
      const body = getResp.json<{ data: { canvas: { backgroundColor: string } } }>();
      expect(body.data.canvas.backgroundColor).toBe('transparent');
    });
  });

  // =========================================================================
  // AC12 — Old designs (no backgroundColor in canvas) load without error
  // =========================================================================

  describe('AC12 — designs without backgroundColor in canvas load correctly', () => {
    it('GET succeeds for a design whose canvas has no backgroundColor field', async () => {
      mockGetSuccess('proj-legacy', { elements: [textElement] });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-legacy' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ ok: boolean; data: { canvas: Record<string, unknown> } }>();
      expect(body.ok).toBe(true);
      expect(body.data.canvas.elements).toBeDefined();
    });

    it('GET for a legacy design returns the canvas without a backgroundColor key', async () => {
      mockGetSuccess('proj-legacy-nokey', { elements: [] });

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-legacy-nokey',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { canvas: Record<string, unknown> } }>();
      // The backend returns JSONB verbatim; no backgroundColor means the key is absent
      expect(body.data.canvas).not.toHaveProperty('backgroundColor');
    });

    it('GET for a legacy design with elements returns all elements intact', async () => {
      const elements = [
        { ...textElement, id: 'legacy-txt' },
        {
          id: 'legacy-img',
          type: 'image',
          x: 480,
          y: 240,
          width: 320,
          height: 240,
          rotation: 0,
          opacity: 1,
          locked: false,
          src: '',
          objectFit: 'cover',
        },
      ];

      mockGetSuccess('proj-legacy-elements', { elements });

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-legacy-elements',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        data: { canvas: { elements: { id: string; type: string }[] } };
      }>();
      expect(body.data.canvas.elements).toHaveLength(2);
      expect(body.data.canvas.elements[0]).toMatchObject({ id: 'legacy-txt', type: 'text' });
      expect(body.data.canvas.elements[1]).toMatchObject({ id: 'legacy-img', type: 'image' });
    });

    it('PATCH on a legacy design (no backgroundColor in DB) can add backgroundColor', async () => {
      // The current row in DB has no backgroundColor
      mockSql
        .mockResolvedValueOnce([{ name: 'Legacy', canvas: { elements: [textElement] } }])
        .mockResolvedValueOnce([{ id: 'proj-legacy-add', name: 'Legacy', updated_at: new Date() }]);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-legacy-add',
        payload: {
          canvas: { elements: [textElement], backgroundColor: '#FFFFFF' },
        },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas).toMatchObject({ backgroundColor: '#FFFFFF' });
    });

    it('GET of a project with an empty canvas and no backgroundColor returns ok:true', async () => {
      mockGetSuccess('proj-empty-legacy', { elements: [] });

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-empty-legacy',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ ok: boolean }>();
      expect(body.ok).toBe(true);
    });
  });

  // =========================================================================
  // AC17 — Changing backgroundColor does not affect canvas elements
  // =========================================================================

  describe('AC17 — backgroundColor is independent from canvas elements', () => {
    it('PATCH with only a new backgroundColor preserves the existing elements unchanged', async () => {
      const existingCanvas = {
        elements: [textElement],
        backgroundColor: '#F3F4F6',
      };
      mockSql
        .mockResolvedValueOnce([{ name: 'Design', canvas: existingCanvas }])
        .mockResolvedValueOnce([{ id: 'proj-ac17-a', name: 'Design', updated_at: new Date() }]);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-ac17-a',
        payload: {
          canvas: { elements: [textElement], backgroundColor: '#BAE6FD' },
        },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      // Background colour has changed
      expect(canvas).toMatchObject({ backgroundColor: '#BAE6FD' });
      // Elements are unchanged
      expect((canvas?.elements as unknown[])[0]).toMatchObject({
        id: 'txt-1',
        x: 560,
        y: 320,
        content: 'Hello',
      });
    });

    it('GET returns canvas with distinct elements and backgroundColor fields', async () => {
      const imageElement = {
        id: 'img-ac17',
        type: 'image',
        x: 480,
        y: 240,
        width: 320,
        height: 240,
        rotation: 0,
        opacity: 1,
        locked: false,
        src: '/api/assets/abc/content',
        objectFit: 'cover',
      };

      mockGetSuccess('proj-ac17-get', {
        elements: [textElement, imageElement],
        backgroundColor: '#FDE68A',
      });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-ac17-get' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        data: {
          canvas: {
            elements: { id: string }[];
            backgroundColor: string;
          };
        };
      }>();
      expect(body.data.canvas.backgroundColor).toBe('#FDE68A');
      expect(body.data.canvas.elements).toHaveLength(2);
      expect(body.data.canvas.elements[0]).toMatchObject({ id: 'txt-1' });
      expect(body.data.canvas.elements[1]).toMatchObject({ id: 'img-ac17' });
    });

    it('updating backgroundColor does not appear in the element_count of the list endpoint', async () => {
      // element_count is derived from jsonb_array_length(canvas->'elements')
      // backgroundColor is a sibling key and must not be counted as an element
      mockSql.mockResolvedValueOnce([
        {
          id: 'proj-list-bg',
          name: 'Design',
          element_count: 1, // one text element, not counting backgroundColor
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const response = await app.inject({ method: 'GET', url: '/api/projects' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { id: string; elementCount: number }[] }>();
      expect(body.data[0]).toMatchObject({ id: 'proj-list-bg', elementCount: 1 });
    });

    it('PATCH with transparent backgroundColor preserves element positions', async () => {
      const element = {
        ...textElement,
        x: 1000,
        y: 500,
        content: 'Position check',
      };

      mockPatchSuccess('proj-ac17-pos');

      await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-ac17-pos',
        payload: {
          canvas: { elements: [element], backgroundColor: 'transparent' },
        },
      });

      const canvas = extractCanvasFromPatch();
      expect(canvas).toMatchObject({ backgroundColor: 'transparent' });
      expect((canvas?.elements as unknown[])[0]).toMatchObject({ x: 1000, y: 500 });
    });
  });

  // =========================================================================
  // AC18 — Multiple designs have independent backgroundColor values
  // =========================================================================

  describe('AC18 — multiple designs maintain independent backgroundColor values', () => {
    it('two designs can have different backgroundColor values simultaneously', async () => {
      // GET design A (white background)
      mockGetSuccess('proj-ind-a', {
        elements: [textElement],
        backgroundColor: '#FFFFFF',
      });
      const respA = await app.inject({ method: 'GET', url: '/api/projects/proj-ind-a' });
      const bodyA = respA.json<{ data: { canvas: { backgroundColor: string } } }>();
      expect(bodyA.data.canvas.backgroundColor).toBe('#FFFFFF');

      // GET design B (dark background)
      mockGetSuccess('proj-ind-b', {
        elements: [],
        backgroundColor: '#111827',
      });
      const respB = await app.inject({ method: 'GET', url: '/api/projects/proj-ind-b' });
      const bodyB = respB.json<{ data: { canvas: { backgroundColor: string } } }>();
      expect(bodyB.data.canvas.backgroundColor).toBe('#111827');

      // Confirm they are independent
      expect(bodyA.data.canvas.backgroundColor).not.toBe(bodyB.data.canvas.backgroundColor);
    });

    it('one transparent design and one solid design coexist independently', async () => {
      mockGetSuccess('proj-ind-transp', {
        elements: [],
        backgroundColor: 'transparent',
      });
      const respT = await app.inject({ method: 'GET', url: '/api/projects/proj-ind-transp' });
      const bodyT = respT.json<{ data: { canvas: { backgroundColor: string } } }>();
      expect(bodyT.data.canvas.backgroundColor).toBe('transparent');

      mockGetSuccess('proj-ind-solid', {
        elements: [textElement],
        backgroundColor: '#A7F3D0',
      });
      const respS = await app.inject({ method: 'GET', url: '/api/projects/proj-ind-solid' });
      const bodyS = respS.json<{ data: { canvas: { backgroundColor: string } } }>();
      expect(bodyS.data.canvas.backgroundColor).toBe('#A7F3D0');
    });

    it('PATCH on one design does not affect another design', async () => {
      // PATCH design A to set a new background
      mockPatchSuccess('proj-ind-patch-a');
      const patchResp = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-ind-patch-a',
        payload: { canvas: { elements: [], backgroundColor: '#C7D2FE' } },
      });
      expect(patchResp.statusCode).toBe(200);
      const canvasA = extractCanvasFromPatch();
      expect(canvasA).toMatchObject({ backgroundColor: '#C7D2FE' });

      // GET design B — it retains its own independent backgroundColor
      vi.clearAllMocks();
      mockSql.end.mockResolvedValue(undefined);
      mockGetSuccess('proj-ind-patch-b', {
        elements: [],
        backgroundColor: '#FECDD3',
      });
      const getResp = await app.inject({ method: 'GET', url: '/api/projects/proj-ind-patch-b' });
      const bodyB = getResp.json<{ data: { canvas: { backgroundColor: string } } }>();
      expect(bodyB.data.canvas.backgroundColor).toBe('#FECDD3');
    });

    it('list endpoint returns multiple projects without exposing their backgroundColor', async () => {
      // The list endpoint (GET /api/projects) omits canvas entirely — backgroundColor
      // must not appear in the summary response (it is only in the full project response)
      mockSql.mockResolvedValueOnce([
        {
          id: 'p1',
          name: 'Design A',
          element_count: 2,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'p2',
          name: 'Design B',
          element_count: 0,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const response = await app.inject({ method: 'GET', url: '/api/projects' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: Record<string, unknown>[] }>();
      expect(body.data).toHaveLength(2);
      // backgroundColor is a canvas-level field; it must not appear in project summaries
      expect(body.data[0]).not.toHaveProperty('backgroundColor');
      expect(body.data[1]).not.toHaveProperty('backgroundColor');
      expect(body.data[0]).not.toHaveProperty('canvas');
      expect(body.data[1]).not.toHaveProperty('canvas');
    });

    it('three designs can each have a distinct backgroundColor', async () => {
      const configs = [
        { id: 'proj-three-a', backgroundColor: '#F3F4F6' },
        { id: 'proj-three-b', backgroundColor: 'transparent' },
        { id: 'proj-three-c', backgroundColor: '#111827' },
      ];

      for (const { id, backgroundColor } of configs) {
        mockGetSuccess(id, { elements: [], backgroundColor });
        const resp = await app.inject({ method: 'GET', url: `/api/projects/${id}` });
        expect(resp.statusCode).toBe(200);
        const body = resp.json<{ data: { canvas: { backgroundColor: string } } }>();
        expect(body.data.canvas.backgroundColor).toBe(backgroundColor);
      }
    });
  });
});
