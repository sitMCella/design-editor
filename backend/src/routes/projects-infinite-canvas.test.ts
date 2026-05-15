/**
 * Backend unit tests for feature 13 — Infinite Canvas.
 *
 * Covered ACs:
 *  AC9  — viewport state (zoom, panX, panY) is never stored in the canvas JSONB column
 *  AC11 — GET /api/projects/:id returns every element at its exact stored world-space
 *          coordinate without modification, regardless of coordinate magnitude or sign
 *  AC20 — all element types (text, image, arrow, table) are persisted and retrieved
 *          correctly on the infinite canvas, including the extended ArrowElement shape
 *          introduced in feature 09 (x1/y1/x2/y2, arrowHead union, anchor connections)
 *  AC22 — backward compatibility: designs stored with element coordinates inside the
 *          old 1280 × 720 bounds continue to load correctly
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
// Shared helpers
// ---------------------------------------------------------------------------

/** Extract the canvas argument that was passed to the second SQL call (the UPDATE). */
function extractCanvasFromPatch(): { elements: Record<string, unknown>[] } | undefined {
  const updateCall = mockSql.mock.calls[1];
  const args = (updateCall?.slice(1) ?? []) as unknown[];
  return args.find(
    (a): a is { elements: Record<string, unknown>[] } =>
      a !== null && typeof a === 'object' && 'elements' in (a as Record<string, unknown>),
  );
}

/** Mock a successful PATCH: SELECT current + UPDATE RETURNING. */
function mockPatchSuccess(projectId: string) {
  mockSql
    .mockResolvedValueOnce([{ name: 'Design', canvas: { elements: [] } }])
    .mockResolvedValueOnce([{ id: projectId, name: 'Design', updated_at: new Date() }]);
}

/** Mock a successful GET for one project with the supplied canvas. */
function mockGetSuccess(projectId: string, canvas: { elements: unknown[] }) {
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

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Infinite Canvas — project routes (feat13)', () => {
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
  // AC 11 — Elements returned at their exact stored world-space coordinates
  // =========================================================================

  describe('AC11 — element coordinates are returned verbatim from the database', () => {
    it('returns a text element whose x and y exceed the old 1280×720 surface bounds', async () => {
      const element = {
        id: 'txt-far',
        type: 'text',
        x: 3500,
        y: 2800,
        width: 200,
        height: 40,
        rotation: 0,
        opacity: 1,
        locked: false,
        content: 'Far away text',
        fontSize: 16,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#111827',
        align: 'left',
      };

      mockGetSuccess('proj-far', { elements: [element] });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-far' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { canvas: { elements: (typeof element)[] } } }>();
      expect(body.data.canvas.elements[0]).toMatchObject({ x: 3500, y: 2800 });
    });

    it('returns a text element at negative world-space coordinates (x < 0, y < 0)', async () => {
      const element = {
        id: 'txt-neg',
        type: 'text',
        x: -500,
        y: -300,
        width: 160,
        height: 40,
        rotation: 0,
        opacity: 1,
        locked: false,
        content: 'Negative space',
        fontSize: 14,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#111827',
        align: 'left',
      };

      mockGetSuccess('proj-neg', { elements: [element] });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-neg' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { canvas: { elements: (typeof element)[] } } }>();
      expect(body.data.canvas.elements[0]).toMatchObject({ x: -500, y: -300 });
    });

    it('returns an image element at the far edge of the initial 4000×3000 virtual canvas', async () => {
      const element = {
        id: 'img-edge',
        type: 'image',
        x: 3680,
        y: 2760,
        width: 320,
        height: 240,
        rotation: 0,
        opacity: 1,
        locked: false,
        src: '/api/assets/abc/content',
        objectFit: 'cover',
      };

      mockGetSuccess('proj-edge', { elements: [element] });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-edge' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { canvas: { elements: (typeof element)[] } } }>();
      expect(body.data.canvas.elements[0]).toMatchObject({ x: 3680, y: 2760 });
    });

    it('returns every element in a multi-element canvas with mixed coordinates, all verbatim', async () => {
      const elements = [
        {
          id: 'e1',
          type: 'text',
          x: -200,
          y: -100,
          width: 160,
          height: 40,
          rotation: 0,
          opacity: 1,
          locked: false,
          content: 'A',
          fontSize: 16,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#111827',
          align: 'left',
        },
        {
          id: 'e2',
          type: 'text',
          x: 0,
          y: 0,
          width: 160,
          height: 40,
          rotation: 0,
          opacity: 1,
          locked: false,
          content: 'B',
          fontSize: 16,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#111827',
          align: 'left',
        },
        {
          id: 'e3',
          type: 'text',
          x: 5000,
          y: 4000,
          width: 160,
          height: 40,
          rotation: 0,
          opacity: 1,
          locked: false,
          content: 'C',
          fontSize: 16,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#111827',
          align: 'left',
        },
      ];

      mockGetSuccess('proj-multi', { elements });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-multi' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { canvas: { elements: { x: number; y: number }[] } } }>();
      expect(body.data.canvas.elements[0]).toMatchObject({ x: -200, y: -100 });
      expect(body.data.canvas.elements[1]).toMatchObject({ x: 0, y: 0 });
      expect(body.data.canvas.elements[2]).toMatchObject({ x: 5000, y: 4000 });
    });

    it('preserves all element properties when coordinates are very large', async () => {
      const element = {
        id: 'txt-huge',
        type: 'text',
        x: 99000,
        y: -99000,
        width: 500,
        height: 80,
        rotation: 45,
        opacity: 0.7,
        locked: true,
        content: 'Edge of the world',
        fontSize: 32,
        fontFamily: 'Georgia, serif',
        fontWeight: 'bold',
        fontStyle: 'italic',
        color: '#FF0000',
        align: 'right',
      };

      mockGetSuccess('proj-huge', { elements: [element] });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-huge' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { canvas: { elements: (typeof element)[] } } }>();
      expect(body.data.canvas.elements[0]).toEqual(element);
    });
  });

  // =========================================================================
  // AC 11 — PATCH preserves arbitrary world-space coordinates
  // =========================================================================

  describe('AC11 — PATCH saves elements at any coordinate value', () => {
    it('accepts and saves an element whose x exceeds the old SURFACE_WIDTH (1280)', async () => {
      const element = {
        id: 'txt-wide',
        type: 'text',
        x: 2000,
        y: 100,
        width: 200,
        height: 40,
        rotation: 0,
        opacity: 1,
        locked: false,
        content: 'Beyond width',
        fontSize: 16,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#111827',
        align: 'left',
      };

      mockPatchSuccess('proj-wide');

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-wide',
        payload: { canvas: { elements: [element] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements[0]).toMatchObject({ x: 2000, y: 100 });
    });

    it('accepts and saves an element whose y exceeds the old SURFACE_HEIGHT (720)', async () => {
      const element = {
        id: 'txt-tall',
        type: 'text',
        x: 100,
        y: 1500,
        width: 200,
        height: 40,
        rotation: 0,
        opacity: 1,
        locked: false,
        content: 'Beyond height',
        fontSize: 16,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#111827',
        align: 'left',
      };

      mockPatchSuccess('proj-tall');

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-tall',
        payload: { canvas: { elements: [element] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements[0]).toMatchObject({ x: 100, y: 1500 });
    });

    it('accepts and saves an element at negative world-space coordinates', async () => {
      const element = {
        id: 'img-neg',
        type: 'image',
        x: -800,
        y: -600,
        width: 320,
        height: 240,
        rotation: 0,
        opacity: 1,
        locked: false,
        src: '/api/assets/xyz/content',
        objectFit: 'cover',
      };

      mockPatchSuccess('proj-neg-patch');

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-neg-patch',
        payload: { canvas: { elements: [element] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements[0]).toMatchObject({ x: -800, y: -600 });
    });

    it('PATCH → GET round-trip preserves large coordinates exactly', async () => {
      const element = {
        id: 'txt-rt',
        type: 'text',
        x: 6000,
        y: -1200,
        width: 300,
        height: 50,
        rotation: 0,
        opacity: 1,
        locked: false,
        content: 'Round-trip test',
        fontSize: 20,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#111827',
        align: 'left',
      };

      mockPatchSuccess('proj-rt');

      const patchResponse = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-rt',
        payload: { canvas: { elements: [element] } },
      });
      expect(patchResponse.statusCode).toBe(200);

      mockGetSuccess('proj-rt', { elements: [element] });

      const getResponse = await app.inject({ method: 'GET', url: '/api/projects/proj-rt' });
      expect(getResponse.statusCode).toBe(200);
      const body = getResponse.json<{ data: { canvas: { elements: (typeof element)[] } } }>();
      expect(body.data.canvas.elements[0]).toEqual(element);
    });
  });

  // =========================================================================
  // AC 9 — Viewport state is never stored in the canvas JSONB column
  // =========================================================================

  describe('AC9 — viewport state (zoom, panX, panY) is not persisted', () => {
    it('PATCH succeeds when the canvas payload contains only elements (no zoom or pan)', async () => {
      mockPatchSuccess('proj-vp');

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-vp',
        payload: {
          canvas: {
            elements: [
              {
                id: 'txt-1',
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
            ],
          },
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('GET /api/projects/:id does not include zoom, panX, or panY in the canvas response', async () => {
      mockGetSuccess('proj-novp', {
        elements: [
          {
            id: 'txt-1',
            type: 'text',
            x: 100,
            y: 100,
            width: 160,
            height: 40,
            rotation: 0,
            opacity: 1,
            locked: false,
            content: 'No viewport',
            fontSize: 16,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 'normal',
            fontStyle: 'normal',
            color: '#111827',
            align: 'left',
          },
        ],
      });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-novp' });
      expect(response.statusCode).toBe(200);

      const body = response.json<{ data: { canvas: Record<string, unknown> } }>();
      expect(body.data.canvas).not.toHaveProperty('zoom');
      expect(body.data.canvas).not.toHaveProperty('panX');
      expect(body.data.canvas).not.toHaveProperty('panY');
    });

    it('PATCH canvas payload that erroneously includes viewport fields still succeeds (backend ignores them)', async () => {
      // The frontend should never send zoom/pan in the canvas, but the backend
      // stores JSONB verbatim and must not reject or fail on unexpected fields.
      mockPatchSuccess('proj-extra');

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-extra',
        payload: {
          canvas: {
            elements: [],
            zoom: 2,
            panX: 300,
            panY: 150,
          },
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // AC 20 — Extended ArrowElement (feat09) persistence on the infinite canvas
  // =========================================================================

  describe('AC20 — extended ArrowElement (feat09) is persisted and retrieved correctly', () => {
    // The arrow element was extended in feature 09 with explicit endpoint
    // coordinates (x1, y1, x2, y2), a widened arrowHead union, and optional
    // anchor connections. Feature 13 uses this extended shape across the
    // infinite canvas — endpoints can be at any world-space position.

    it('GET returns an arrow with x1, y1, x2, y2 endpoint coordinates', async () => {
      const element = {
        id: 'arrow-ext',
        type: 'arrow',
        x1: 540,
        y1: 360,
        x2: 740,
        y2: 360,
        // Derived bounding box (kept in sync by the frontend)
        x: 539,
        y: 359,
        width: 202,
        height: 4,
        rotation: 0,
        opacity: 1,
        locked: false,
        stroke: '#111827',
        strokeWidth: 2,
        arrowHead: 'end',
      };

      mockGetSuccess('proj-arrow-ext', { elements: [element] });

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-arrow-ext',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { canvas: { elements: (typeof element)[] } } }>();
      expect(body.data.canvas.elements[0]).toMatchObject({
        x1: 540,
        y1: 360,
        x2: 740,
        y2: 360,
      });
    });

    it('GET returns an arrow with arrowHead: "both"', async () => {
      const element = {
        id: 'arrow-both',
        type: 'arrow',
        x1: 200,
        y1: 200,
        x2: 600,
        y2: 200,
        x: 199,
        y: 199,
        width: 402,
        height: 4,
        rotation: 0,
        opacity: 1,
        locked: false,
        stroke: '#3B82F6',
        strokeWidth: 3,
        arrowHead: 'both',
      };

      mockGetSuccess('proj-arrow-both', { elements: [element] });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-arrow-both' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { canvas: { elements: { arrowHead: string }[] } } }>();
      expect(body.data.canvas.elements[0]?.arrowHead).toBe('both');
    });

    it('GET returns an arrow with arrowHead: "start"', async () => {
      const element = {
        id: 'arrow-start',
        type: 'arrow',
        x1: 100,
        y1: 100,
        x2: 400,
        y2: 100,
        x: 99,
        y: 99,
        width: 302,
        height: 4,
        rotation: 0,
        opacity: 1,
        locked: false,
        stroke: '#111827',
        strokeWidth: 2,
        arrowHead: 'start',
      };

      mockGetSuccess('proj-arrow-start', { elements: [element] });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-arrow-start' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { canvas: { elements: { arrowHead: string }[] } } }>();
      expect(body.data.canvas.elements[0]?.arrowHead).toBe('start');
    });

    it('GET returns an arrow with arrowHead: "none"', async () => {
      const element = {
        id: 'arrow-none',
        type: 'arrow',
        x1: 300,
        y1: 300,
        x2: 700,
        y2: 500,
        x: 299,
        y: 299,
        width: 402,
        height: 202,
        rotation: 0,
        opacity: 1,
        locked: false,
        stroke: '#6B7280',
        strokeWidth: 1,
        arrowHead: 'none',
      };

      mockGetSuccess('proj-arrow-none', { elements: [element] });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-arrow-none' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { canvas: { elements: { arrowHead: string }[] } } }>();
      expect(body.data.canvas.elements[0]?.arrowHead).toBe('none');
    });

    it('GET returns an arrow with a startAnchor connection', async () => {
      const element = {
        id: 'arrow-anchored',
        type: 'arrow',
        x1: 560,
        y1: 320,
        x2: 800,
        y2: 320,
        x: 559,
        y: 319,
        width: 242,
        height: 4,
        rotation: 0,
        opacity: 1,
        locked: false,
        stroke: '#111827',
        strokeWidth: 2,
        arrowHead: 'end',
        startAnchor: { elementId: 'txt-1', side: 'right' },
      };

      mockGetSuccess('proj-arrow-anchor', { elements: [element] });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-arrow-anchor' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        data: { canvas: { elements: { startAnchor?: { elementId: string; side: string } }[] } };
      }>();
      expect(body.data.canvas.elements[0]?.startAnchor).toEqual({
        elementId: 'txt-1',
        side: 'right',
      });
    });

    it('GET returns an arrow with both startAnchor and endAnchor connections', async () => {
      const element = {
        id: 'arrow-both-anchors',
        type: 'arrow',
        x1: 280,
        y1: 360,
        x2: 640,
        y2: 360,
        x: 279,
        y: 359,
        width: 362,
        height: 4,
        rotation: 0,
        opacity: 1,
        locked: false,
        stroke: '#10B981',
        strokeWidth: 2,
        arrowHead: 'both',
        startAnchor: { elementId: 'box-a', side: 'right' },
        endAnchor: { elementId: 'box-b', side: 'left' },
      };

      mockGetSuccess('proj-anchors', { elements: [element] });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-anchors' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        data: {
          canvas: {
            elements: {
              startAnchor?: { elementId: string; side: string };
              endAnchor?: { elementId: string; side: string };
            }[];
          };
        };
      }>();
      const el = body.data.canvas.elements[0];
      expect(el?.startAnchor).toEqual({ elementId: 'box-a', side: 'right' });
      expect(el?.endAnchor).toEqual({ elementId: 'box-b', side: 'left' });
    });

    it('GET returns an arrow with diagonal endpoints at large world-space coordinates', async () => {
      const element = {
        id: 'arrow-large',
        type: 'arrow',
        x1: 3000,
        y1: 2000,
        x2: 3500,
        y2: 2400,
        x: 2999,
        y: 1999,
        width: 502,
        height: 402,
        rotation: 0,
        opacity: 1,
        locked: false,
        stroke: '#EF4444',
        strokeWidth: 4,
        arrowHead: 'end',
      };

      mockGetSuccess('proj-arrow-large', { elements: [element] });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-arrow-large' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { canvas: { elements: (typeof element)[] } } }>();
      expect(body.data.canvas.elements[0]).toMatchObject({
        x1: 3000,
        y1: 2000,
        x2: 3500,
        y2: 2400,
      });
    });

    it('PATCH saves the extended arrow shape with x1, y1, x2, y2', async () => {
      const element = {
        id: 'arrow-save',
        type: 'arrow',
        x1: 100,
        y1: 200,
        x2: 500,
        y2: 400,
        x: 99,
        y: 199,
        width: 402,
        height: 202,
        rotation: 0,
        opacity: 1,
        locked: false,
        stroke: '#111827',
        strokeWidth: 2,
        arrowHead: 'end',
      };

      mockPatchSuccess('proj-arrow-save');

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-arrow-save',
        payload: { canvas: { elements: [element] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements[0]).toMatchObject({
        x1: 100,
        y1: 200,
        x2: 500,
        y2: 400,
        arrowHead: 'end',
      });
    });

    it('PATCH saves an arrow with arrowHead: "both"', async () => {
      const element = {
        id: 'arrow-both-save',
        type: 'arrow',
        x1: 200,
        y1: 300,
        x2: 800,
        y2: 300,
        x: 199,
        y: 299,
        width: 602,
        height: 4,
        rotation: 0,
        opacity: 1,
        locked: false,
        stroke: '#6366F1',
        strokeWidth: 3,
        arrowHead: 'both',
      };

      mockPatchSuccess('proj-both-save');

      await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-both-save',
        payload: { canvas: { elements: [element] } },
      });

      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements[0]).toMatchObject({ arrowHead: 'both' });
    });

    it('PATCH saves an arrow with endAnchor connection', async () => {
      const element = {
        id: 'arrow-anchor-save',
        type: 'arrow',
        x1: 300,
        y1: 250,
        x2: 560,
        y2: 320,
        x: 299,
        y: 249,
        width: 262,
        height: 72,
        rotation: 0,
        opacity: 1,
        locked: false,
        stroke: '#111827',
        strokeWidth: 2,
        arrowHead: 'end',
        endAnchor: { elementId: 'txt-target', side: 'left' },
      };

      mockPatchSuccess('proj-anchor-save');

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-anchor-save',
        payload: { canvas: { elements: [element] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements[0]).toMatchObject({
        endAnchor: { elementId: 'txt-target', side: 'left' },
      });
    });

    it('PATCH saves an arrow with startAnchor and endAnchor to different canvas elements', async () => {
      const arrow = {
        id: 'arrow-connected',
        type: 'arrow',
        x1: 480,
        y1: 320,
        x2: 900,
        y2: 500,
        x: 479,
        y: 319,
        width: 422,
        height: 182,
        rotation: 0,
        opacity: 1,
        locked: false,
        stroke: '#F59E0B',
        strokeWidth: 2,
        arrowHead: 'end',
        startAnchor: { elementId: 'shape-left', side: 'center' },
        endAnchor: { elementId: 'shape-right', side: 'top' },
      };

      mockPatchSuccess('proj-connected');

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-connected',
        payload: { canvas: { elements: [arrow] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      const saved = canvas?.elements[0] as {
        startAnchor?: { elementId: string; side: string };
        endAnchor?: { elementId: string; side: string };
      };
      expect(saved.startAnchor).toEqual({ elementId: 'shape-left', side: 'center' });
      expect(saved.endAnchor).toEqual({ elementId: 'shape-right', side: 'top' });
    });

    it('PATCH → GET round-trip preserves the full extended arrow shape including anchors', async () => {
      const arrow = {
        id: 'arrow-rt',
        type: 'arrow',
        x1: 640,
        y1: 480,
        x2: 1200,
        y2: 600,
        x: 639,
        y: 479,
        width: 562,
        height: 122,
        rotation: 0,
        opacity: 1,
        locked: false,
        stroke: '#3B82F6',
        strokeWidth: 3,
        arrowHead: 'both',
        startAnchor: { elementId: 'el-a', side: 'bottom' },
        endAnchor: { elementId: 'el-b', side: 'top' },
      };

      mockPatchSuccess('proj-arrow-rt');

      const patchResp = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-arrow-rt',
        payload: { canvas: { elements: [arrow] } },
      });
      expect(patchResp.statusCode).toBe(200);

      mockGetSuccess('proj-arrow-rt', { elements: [arrow] });

      const getResp = await app.inject({ method: 'GET', url: '/api/projects/proj-arrow-rt' });
      expect(getResp.statusCode).toBe(200);

      const body = getResp.json<{ data: { canvas: { elements: (typeof arrow)[] } } }>();
      expect(body.data.canvas.elements[0]).toEqual(arrow);
    });

    it('PATCH saves a canvas with a connected text–arrow–text diagram', async () => {
      // Two text elements connected by an anchored arrow
      const textA = {
        id: 'txt-a',
        type: 'text',
        x: 100,
        y: 200,
        width: 160,
        height: 40,
        rotation: 0,
        opacity: 1,
        locked: false,
        content: 'Source',
        fontSize: 16,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#111827',
        align: 'left',
      };
      const textB = {
        id: 'txt-b',
        type: 'text',
        x: 500,
        y: 200,
        width: 160,
        height: 40,
        rotation: 0,
        opacity: 1,
        locked: false,
        content: 'Target',
        fontSize: 16,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#111827',
        align: 'left',
      };
      const arrow = {
        id: 'arrow-link',
        type: 'arrow',
        x1: 260,
        y1: 220,
        x2: 500,
        y2: 220,
        x: 259,
        y: 219,
        width: 242,
        height: 4,
        rotation: 0,
        opacity: 1,
        locked: false,
        stroke: '#111827',
        strokeWidth: 2,
        arrowHead: 'end',
        startAnchor: { elementId: 'txt-a', side: 'right' },
        endAnchor: { elementId: 'txt-b', side: 'left' },
      };

      mockPatchSuccess('proj-diagram');

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-diagram',
        payload: { canvas: { elements: [textA, textB, arrow] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements).toHaveLength(3);
      expect(canvas?.elements[0]).toMatchObject({ type: 'text', id: 'txt-a' });
      expect(canvas?.elements[1]).toMatchObject({ type: 'text', id: 'txt-b' });
      expect(canvas?.elements[2]).toMatchObject({
        type: 'arrow',
        startAnchor: { elementId: 'txt-a', side: 'right' },
        endAnchor: { elementId: 'txt-b', side: 'left' },
      });
    });
  });

  // =========================================================================
  // AC 20 — All element types at infinite-canvas coordinates
  // =========================================================================

  describe('AC20 — all element types work at arbitrary world-space coordinates', () => {
    it('GET returns an image element at coordinates outside the old surface bounds', async () => {
      const element = {
        id: 'img-inf',
        type: 'image',
        x: -400,
        y: 1500,
        width: 320,
        height: 240,
        rotation: 0,
        opacity: 0.9,
        locked: false,
        src: '/api/assets/far-img/content',
        objectFit: 'contain',
        objectPosition: '30% 70%',
      };

      mockGetSuccess('proj-img-inf', { elements: [element] });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-img-inf' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { canvas: { elements: (typeof element)[] } } }>();
      expect(body.data.canvas.elements[0]).toMatchObject({ x: -400, y: 1500 });
    });

    it('GET returns a table element at large world-space coordinates', async () => {
      const element = {
        id: 'tbl-inf',
        type: 'table',
        x: 3200,
        y: 2500,
        width: 400,
        height: 120,
        rotation: 0,
        opacity: 1,
        locked: false,
        columns: 2,
        columnWidths: [200, 200],
        rows: [
          { isHeader: true, height: 40, cells: ['A', 'B'] },
          { isHeader: false, height: 40, cells: ['1', '2'] },
          { isHeader: false, height: 40, cells: ['3', '4'] },
        ],
      };

      mockGetSuccess('proj-tbl-inf', { elements: [element] });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-tbl-inf' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { canvas: { elements: (typeof element)[] } } }>();
      expect(body.data.canvas.elements[0]).toMatchObject({ x: 3200, y: 2500, type: 'table' });
    });

    it('PATCH saves all four element types distributed across the infinite canvas', async () => {
      const elements = [
        {
          id: 'txt-dist',
          type: 'text',
          x: -300,
          y: -200,
          width: 160,
          height: 40,
          rotation: 0,
          opacity: 1,
          locked: false,
          content: 'Top-left region',
          fontSize: 16,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#111827',
          align: 'left',
        },
        {
          id: 'img-dist',
          type: 'image',
          x: 2000,
          y: 0,
          width: 320,
          height: 240,
          rotation: 0,
          opacity: 1,
          locked: false,
          src: '/api/assets/right/content',
          objectFit: 'cover',
        },
        {
          id: 'arrow-dist',
          type: 'arrow',
          x1: -300,
          y1: -180,
          x2: 2000,
          y2: 120,
          x: -301,
          y: -181,
          width: 2302,
          height: 302,
          rotation: 0,
          opacity: 1,
          locked: false,
          stroke: '#3B82F6',
          strokeWidth: 2,
          arrowHead: 'end',
          startAnchor: { elementId: 'txt-dist', side: 'right' },
          endAnchor: { elementId: 'img-dist', side: 'left' },
        },
        {
          id: 'tbl-dist',
          type: 'table',
          x: 1000,
          y: 1500,
          width: 400,
          height: 120,
          rotation: 0,
          opacity: 1,
          locked: false,
          columns: 2,
          columnWidths: [200, 200],
          rows: [
            { isHeader: true, height: 40, cells: ['Col 1', 'Col 2'] },
            { isHeader: false, height: 40, cells: ['a', 'b'] },
            { isHeader: false, height: 40, cells: ['c', 'd'] },
          ],
        },
      ];

      mockPatchSuccess('proj-dist');

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-dist',
        payload: { canvas: { elements } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements).toHaveLength(4);
      expect(canvas?.elements[0]).toMatchObject({ type: 'text', x: -300, y: -200 });
      expect(canvas?.elements[1]).toMatchObject({ type: 'image', x: 2000, y: 0 });
      expect(canvas?.elements[2]).toMatchObject({
        type: 'arrow',
        x1: -300,
        y1: -180,
        x2: 2000,
        y2: 120,
      });
      expect(canvas?.elements[3]).toMatchObject({ type: 'table', x: 1000, y: 1500 });
    });
  });

  // =========================================================================
  // AC 22 — Backward compatibility: designs with old-surface coordinates still load
  // =========================================================================

  describe('AC22 — backward compatibility: elements at old 1280×720 coordinates still load', () => {
    it('GET returns a design with elements at their original default positions (no migration needed)', async () => {
      // These are the default coordinates defined in the feature specs for each element type
      const elements = [
        {
          id: 'txt-default',
          type: 'text',
          x: 560,
          y: 320,
          width: 160,
          height: 40,
          rotation: 0,
          opacity: 1,
          locked: false,
          content: 'Double-click to edit',
          fontSize: 16,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#111827',
          align: 'left',
        },
        {
          id: 'img-default',
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
        {
          id: 'arrow-default',
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
        {
          id: 'tbl-default',
          type: 'table',
          x: 440,
          y: 300,
          width: 400,
          height: 120,
          rotation: 0,
          opacity: 1,
          locked: false,
          columns: 2,
          columnWidths: [200, 200],
          rows: [
            { isHeader: true, height: 40, cells: ['Header 1', 'Header 2'] },
            { isHeader: false, height: 40, cells: ['Cell 1', 'Cell 2'] },
            { isHeader: false, height: 40, cells: ['Cell 3', 'Cell 4'] },
          ],
        },
      ];

      mockGetSuccess('proj-legacy', { elements });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-legacy' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        data: { canvas: { elements: { x: number; y: number; type: string }[] } };
      }>();
      expect(body.data.canvas.elements).toHaveLength(4);
      // Coordinates are unchanged — no migration or transformation applied
      expect(body.data.canvas.elements[0]).toMatchObject({ type: 'text', x: 560, y: 320 });
      expect(body.data.canvas.elements[1]).toMatchObject({ type: 'image', x: 480, y: 240 });
      expect(body.data.canvas.elements[2]).toMatchObject({ type: 'arrow', x: 540, y: 355 });
      expect(body.data.canvas.elements[3]).toMatchObject({ type: 'table', x: 440, y: 300 });
    });

    it('PATCH round-trip on a design with original default coords preserves them exactly', async () => {
      const element = {
        id: 'txt-legacy',
        type: 'text',
        x: 560,
        y: 320,
        width: 160,
        height: 40,
        rotation: 0,
        opacity: 1,
        locked: false,
        content: 'Legacy content',
        fontSize: 16,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#111827',
        align: 'left',
      };

      mockPatchSuccess('proj-leg-rt');
      await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-leg-rt',
        payload: { canvas: { elements: [element] } },
      });

      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements[0]).toMatchObject({ x: 560, y: 320 });

      mockGetSuccess('proj-leg-rt', { elements: [element] });
      const getResp = await app.inject({ method: 'GET', url: '/api/projects/proj-leg-rt' });
      const body = getResp.json<{ data: { canvas: { elements: (typeof element)[] } } }>();
      expect(body.data.canvas.elements[0]).toEqual(element);
    });

    it('multiple designs at different coordinate ranges are independent and each loads correctly', async () => {
      const canvasLegacy = {
        elements: [
          {
            id: 'el-a',
            type: 'text',
            x: 640,
            y: 360,
            width: 160,
            height: 40,
            rotation: 0,
            opacity: 1,
            locked: false,
            content: 'Legacy',
            fontSize: 16,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 'normal',
            fontStyle: 'normal',
            color: '#111827',
            align: 'left',
          },
        ],
      };
      const canvasInfinite = {
        elements: [
          {
            id: 'el-b',
            type: 'text',
            x: 5000,
            y: -800,
            width: 160,
            height: 40,
            rotation: 0,
            opacity: 1,
            locked: false,
            content: 'Infinite',
            fontSize: 16,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 'normal',
            fontStyle: 'normal',
            color: '#111827',
            align: 'left',
          },
        ],
      };

      // GET design with legacy coordinates
      mockGetSuccess('proj-legacy2', canvasLegacy);
      const respLeg = await app.inject({ method: 'GET', url: '/api/projects/proj-legacy2' });
      const bodyLeg = respLeg.json<{
        data: { canvas: { elements: { x: number; y: number }[] } };
      }>();
      expect(bodyLeg.data.canvas.elements[0]).toMatchObject({ x: 640, y: 360 });

      // GET design with infinite-canvas coordinates
      mockGetSuccess('proj-infinite2', canvasInfinite);
      const respInf = await app.inject({ method: 'GET', url: '/api/projects/proj-infinite2' });
      const bodyInf = respInf.json<{
        data: { canvas: { elements: { x: number; y: number }[] } };
      }>();
      expect(bodyInf.data.canvas.elements[0]).toMatchObject({ x: 5000, y: -800 });

      // The two canvases are independent
      expect(bodyLeg.data.canvas).not.toEqual(bodyInf.data.canvas);
    });
  });
});
