/**
 * Backend unit tests for features 21 & 22 — Shape Element (toolbar insertion
 * and customisation).
 *
 * Both specs state "no backend persistence in this iteration," meaning the
 * frontend does not explicitly wire auto-save for shape elements. However the
 * backend API is type-agnostic: it stores whatever canvas JSON it receives via
 * PATCH. Since the auto-save pipeline sends the full canvas state (all
 * elements), the backend must correctly serialise and deserialise
 * ShapeElements. These tests verify that contract.
 *
 * Feature 21 — Toolbar & Shape Element (AC-relevant backend behaviour):
 *   - The default ShapeElement (shape: 'rect', fill: '#3B82F6',
 *     stroke: 'transparent', strokeWidth: 0) round-trips through PATCH/GET
 *     without data loss.
 *   - GET /api/projects elementCount counts shape elements like any other type.
 *   - Multiple shape elements can coexist in the same canvas.
 *   - Shape elements coexist with every other element type (text, image, arrow,
 *     table) in the same canvas.
 *
 * Feature 22 — Shape Element Customisation (AC-relevant backend behaviour):
 *   - All three shape variants ('rect', 'ellipse', 'triangle') are persisted
 *     and returned verbatim.
 *   - Fill colour — hex strings and the 'transparent' sentinel — are persisted.
 *   - Stroke colour — hex strings and the 'transparent' sentinel — are
 *     persisted.
 *   - Stroke width values from 0 to 20 are persisted.
 *   - Two shape elements with different customisations are stored independently.
 *   - The `hidden` field (spec 17 integration) is persisted for shape elements.
 *   - PATCH → GET round-trips restore every customised property exactly.
 *   - Multiple designs maintain independent shape element configurations.
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
// Types
// ---------------------------------------------------------------------------

type ShapeElementShape = {
  id: string;
  type: 'shape';
  shape: 'rect' | 'ellipse' | 'triangle';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  fill: string;
  stroke: string;
  strokeWidth: number;
  hidden?: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a ShapeElement with spec-21 defaults, allowing any field to be
 *  overridden so individual tests only declare what they care about. */
function makeShapeElement(overrides: Partial<ShapeElementShape> = {}): ShapeElementShape {
  return {
    id: 'shape-1',
    type: 'shape',
    shape: 'rect',
    x: 560,
    y: 310,
    width: 160,
    height: 160,
    rotation: 0,
    opacity: 1,
    locked: false,
    fill: '#3B82F6',
    stroke: 'transparent',
    strokeWidth: 0,
    ...overrides,
  };
}

/** A minimal text element used when testing mixed-type canvases. */
const textElement = {
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
};

/** A minimal image element used when testing mixed-type canvases. */
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
  src: '/api/assets/abc/content',
  objectFit: 'cover',
};

/** A minimal arrow element used when testing mixed-type canvases. */
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

/** Mock PATCH: SELECT current row + UPDATE RETURNING. */
function mockPatchSuccess(
  projectId: string,
  currentCanvas: Record<string, unknown> = { elements: [] },
) {
  mockSql
    .mockResolvedValueOnce([{ name: 'Design', canvas: currentCanvas }])
    .mockResolvedValueOnce([{ id: projectId, name: 'Design', updated_at: new Date() }]);
}

/** Mock GET for one project with the given canvas. */
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

/**
 * Extract the canvas argument passed to the UPDATE SQL call (the second call
 * after the SELECT that checks the project exists).
 */
function extractCanvasFromPatch(): { elements: Record<string, unknown>[] } | undefined {
  const updateCall = mockSql.mock.calls[1];
  const args = (updateCall?.slice(1) ?? []) as unknown[];
  return args.find(
    (a): a is { elements: Record<string, unknown>[] } =>
      a !== null && typeof a === 'object' && 'elements' in (a as Record<string, unknown>),
  );
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Shape Element — project routes (feat21 & feat22)', () => {
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
  // Feature 21 — default ShapeElement JSONB persistence
  // =========================================================================

  describe('Feature 21 — default ShapeElement round-trip', () => {
    // -----------------------------------------------------------------------
    // GET /api/projects — elementCount includes shape elements
    // -----------------------------------------------------------------------

    describe('GET /api/projects — elementCount (feat21)', () => {
      it('reflects a single shape element in elementCount', async () => {
        mockSql.mockResolvedValueOnce([
          {
            id: 'proj-shape',
            name: 'Shape Design',
            element_count: 1,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ]);

        const response = await app.inject({ method: 'GET', url: '/api/projects' });

        expect(response.statusCode).toBe(200);
        const body = response.json<{ ok: boolean; data: { id: string; elementCount: number }[] }>();
        expect(body.data[0]).toMatchObject({ id: 'proj-shape', elementCount: 1 });
      });

      it('counts multiple shape elements correctly', async () => {
        mockSql.mockResolvedValueOnce([
          {
            id: 'proj-multi-shape',
            name: 'Multi Shape',
            element_count: 3,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ]);

        const response = await app.inject({ method: 'GET', url: '/api/projects' });

        expect(response.statusCode).toBe(200);
        const body = response.json<{ ok: boolean; data: { elementCount: number }[] }>();
        expect(body.data[0]).toMatchObject({ elementCount: 3 });
      });

      it('counts a mixed canvas of text + shape elements correctly', async () => {
        // 1 text + 1 shape = 2 elements
        mockSql.mockResolvedValueOnce([
          {
            id: 'proj-mixed',
            name: 'Mixed',
            element_count: 2,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ]);

        const response = await app.inject({ method: 'GET', url: '/api/projects' });

        expect(response.statusCode).toBe(200);
        const body = response.json<{ ok: boolean; data: { elementCount: number }[] }>();
        expect(body.data[0]).toMatchObject({ elementCount: 2 });
      });

      it('does not expose the canvas or shape properties in the list response', async () => {
        mockSql.mockResolvedValueOnce([
          {
            id: 'proj-shape-list',
            name: 'Shapes',
            element_count: 1,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ]);

        const response = await app.inject({ method: 'GET', url: '/api/projects' });

        const body = response.json<{ data: Record<string, unknown>[] }>();
        expect(body.data[0]).not.toHaveProperty('canvas');
        expect(body.data[0]).not.toHaveProperty('fill');
        expect(body.data[0]).not.toHaveProperty('shape');
      });
    });

    // -----------------------------------------------------------------------
    // PATCH /api/projects/:id — saves default ShapeElement to JSONB
    // -----------------------------------------------------------------------

    describe('PATCH /api/projects/:id — saves default ShapeElement (feat21)', () => {
      it('saves all base element properties of a default shape element', async () => {
        const shape = makeShapeElement();
        mockPatchSuccess('proj-shape-base');

        const response = await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-shape-base',
          payload: { canvas: { elements: [shape] } },
        });

        expect(response.statusCode).toBe(200);
        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements[0]).toMatchObject({
          id: 'shape-1',
          type: 'shape',
          x: 560,
          y: 310,
          width: 160,
          height: 160,
          rotation: 0,
          opacity: 1,
          locked: false,
        });
      });

      it('saves shape-specific properties of the default element (shape, fill, stroke, strokeWidth)', async () => {
        const shape = makeShapeElement();
        mockPatchSuccess('proj-shape-specific');

        const response = await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-shape-specific',
          payload: { canvas: { elements: [shape] } },
        });

        expect(response.statusCode).toBe(200);
        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements[0]).toMatchObject({
          type: 'shape',
          shape: 'rect',
          fill: '#3B82F6',
          stroke: 'transparent',
          strokeWidth: 0,
        });
      });

      it('saves two independent shape elements in the same canvas', async () => {
        const shape1 = makeShapeElement({ id: 'shape-1', x: 100, y: 100 });
        const shape2 = makeShapeElement({ id: 'shape-2', x: 400, y: 400 });
        mockPatchSuccess('proj-two-shapes');

        const response = await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-two-shapes',
          payload: { canvas: { elements: [shape1, shape2] } },
        });

        expect(response.statusCode).toBe(200);
        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements).toHaveLength(2);
        expect(canvas?.elements[0]).toMatchObject({ id: 'shape-1', x: 100, y: 100 });
        expect(canvas?.elements[1]).toMatchObject({ id: 'shape-2', x: 400, y: 400 });
      });

      it('saves a canvas containing a shape element alongside a text element', async () => {
        const shape = makeShapeElement({ id: 'shape-1' });
        mockPatchSuccess('proj-shape-text');

        const response = await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-shape-text',
          payload: { canvas: { elements: [textElement, shape] } },
        });

        expect(response.statusCode).toBe(200);
        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements).toHaveLength(2);
        expect(canvas?.elements[0]).toMatchObject({ type: 'text', id: 'txt-1' });
        expect(canvas?.elements[1]).toMatchObject({ type: 'shape', id: 'shape-1' });
      });

      it('saves a canvas containing a shape element alongside an image element', async () => {
        const shape = makeShapeElement({ id: 'shape-1' });
        mockPatchSuccess('proj-shape-image');

        const response = await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-shape-image',
          payload: { canvas: { elements: [imageElement, shape] } },
        });

        expect(response.statusCode).toBe(200);
        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements).toHaveLength(2);
        expect(canvas?.elements[0]).toMatchObject({ type: 'image' });
        expect(canvas?.elements[1]).toMatchObject({ type: 'shape' });
      });

      it('saves a canvas containing a shape element alongside an arrow element', async () => {
        const shape = makeShapeElement({ id: 'shape-1' });
        mockPatchSuccess('proj-shape-arrow');

        const response = await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-shape-arrow',
          payload: { canvas: { elements: [arrowElement, shape] } },
        });

        expect(response.statusCode).toBe(200);
        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements).toHaveLength(2);
        expect(canvas?.elements[0]).toMatchObject({ type: 'arrow' });
        expect(canvas?.elements[1]).toMatchObject({ type: 'shape' });
      });

      it('saves a canvas with all five element types including a shape', async () => {
        const tableElement = {
          id: 'tbl-1',
          type: 'table',
          x: 440,
          y: 500,
          width: 400,
          height: 120,
          rotation: 0,
          opacity: 1,
          locked: false,
          columns: 2,
          columnWidths: [200, 200],
          rows: [
            { isHeader: true, height: 40, cells: ['H1', 'H2'] },
            { isHeader: false, height: 40, cells: ['C1', 'C2'] },
            { isHeader: false, height: 40, cells: ['C3', 'C4'] },
          ],
        };
        const shape = makeShapeElement({ id: 'shape-1' });

        mockPatchSuccess('proj-all-types');

        const response = await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-all-types',
          payload: {
            canvas: {
              elements: [textElement, imageElement, arrowElement, tableElement, shape],
            },
          },
        });

        expect(response.statusCode).toBe(200);
        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements).toHaveLength(5);
        expect(canvas?.elements[0]).toMatchObject({ type: 'text' });
        expect(canvas?.elements[1]).toMatchObject({ type: 'image' });
        expect(canvas?.elements[2]).toMatchObject({ type: 'arrow' });
        expect(canvas?.elements[3]).toMatchObject({ type: 'table' });
        expect(canvas?.elements[4]).toMatchObject({ type: 'shape' });
      });
    });

    // -----------------------------------------------------------------------
    // GET /api/projects/:id — returns default ShapeElement intact
    // -----------------------------------------------------------------------

    describe('GET /api/projects/:id — returns default ShapeElement intact (feat21)', () => {
      it('returns all ShapeElement properties exactly as stored', async () => {
        const shape = makeShapeElement();
        mockGetSuccess('proj-shape-get', { elements: [shape] });

        const response = await app.inject({ method: 'GET', url: '/api/projects/proj-shape-get' });

        expect(response.statusCode).toBe(200);
        const body = response.json<{
          ok: boolean;
          data: { canvas: { elements: ShapeElementShape[] } };
        }>();
        expect(body.data.canvas.elements[0]).toEqual(shape);
      });

      it('returns the shape element type discriminator correctly', async () => {
        const shape = makeShapeElement();
        mockGetSuccess('proj-shape-type', { elements: [shape] });

        const response = await app.inject({ method: 'GET', url: '/api/projects/proj-shape-type' });

        expect(response.statusCode).toBe(200);
        const body = response.json<{ data: { canvas: { elements: { type: string }[] } } }>();
        expect(body.data.canvas.elements[0]?.type).toBe('shape');
      });

      it('returns two independent shape elements in the same canvas', async () => {
        const shape1 = makeShapeElement({ id: 'shape-1', x: 100, y: 100 });
        const shape2 = makeShapeElement({ id: 'shape-2', x: 500, y: 300 });
        mockGetSuccess('proj-two-shapes-get', { elements: [shape1, shape2] });

        const response = await app.inject({
          method: 'GET',
          url: '/api/projects/proj-two-shapes-get',
        });

        expect(response.statusCode).toBe(200);
        const body = response.json<{
          data: { canvas: { elements: ShapeElementShape[] } };
        }>();
        expect(body.data.canvas.elements).toHaveLength(2);
        expect(body.data.canvas.elements[0]).toMatchObject({ id: 'shape-1', x: 100, y: 100 });
        expect(body.data.canvas.elements[1]).toMatchObject({ id: 'shape-2', x: 500, y: 300 });
      });

      it('returns a mixed canvas with shape and other element types intact', async () => {
        const shape = makeShapeElement({ id: 'shape-1' });
        mockGetSuccess('proj-mixed-get', {
          elements: [textElement, shape],
        });

        const response = await app.inject({ method: 'GET', url: '/api/projects/proj-mixed-get' });

        expect(response.statusCode).toBe(200);
        const body = response.json<{
          data: { canvas: { elements: { type: string; id: string }[] } };
        }>();
        expect(body.data.canvas.elements).toHaveLength(2);
        expect(body.data.canvas.elements[0]?.type).toBe('text');
        expect(body.data.canvas.elements[1]?.type).toBe('shape');
      });

      it('returns 404 NOT_FOUND for a missing project (baseline)', async () => {
        mockSql.mockResolvedValueOnce([]);

        const response = await app.inject({ method: 'GET', url: '/api/projects/missing' });

        expect(response.statusCode).toBe(404);
        const body = response.json<{ ok: boolean; error: { code: string } }>();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('NOT_FOUND');
      });
    });

    // -----------------------------------------------------------------------
    // PATCH → GET round-trip (feat21)
    // -----------------------------------------------------------------------

    describe('PATCH → GET round-trip preserves default ShapeElement (feat21)', () => {
      it('a shape element saved via PATCH is returned verbatim by the subsequent GET', async () => {
        const shape = makeShapeElement();

        // PATCH
        mockPatchSuccess('proj-rt-shape');
        const patchResp = await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-rt-shape',
          payload: { canvas: { elements: [shape] } },
        });
        expect(patchResp.statusCode).toBe(200);

        // GET — mock returns the same element that was stored
        mockGetSuccess('proj-rt-shape', { elements: [shape] });
        const getResp = await app.inject({
          method: 'GET',
          url: '/api/projects/proj-rt-shape',
        });
        expect(getResp.statusCode).toBe(200);

        const body = getResp.json<{
          data: { canvas: { elements: ShapeElementShape[] } };
        }>();
        expect(body.data.canvas.elements[0]).toEqual(shape);
      });
    });
  });

  // =========================================================================
  // Feature 22 — Shape Element Customisation persistence
  // =========================================================================

  describe('Feature 22 — ShapeElement customisation round-trips', () => {
    // -----------------------------------------------------------------------
    // Shape variant persistence
    // -----------------------------------------------------------------------

    describe('shape variant persistence (feat22)', () => {
      it.each([
        ['rect', 'rect' as const],
        ['ellipse', 'ellipse' as const],
        ['triangle', 'triangle' as const],
      ])('saves and returns the "%s" variant verbatim', async (variantName, variant) => {
        const shape = makeShapeElement({ id: `shape-${variantName}`, shape: variant });
        mockPatchSuccess(`proj-variant-${variantName}`);

        const response = await app.inject({
          method: 'PATCH',
          url: `/api/projects/proj-variant-${variantName}`,
          payload: { canvas: { elements: [shape] } },
        });

        expect(response.statusCode).toBe(200);
        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements[0]).toMatchObject({ type: 'shape', shape: variant });
      });

      it('two shapes with different variants coexist in the same canvas', async () => {
        const rect = makeShapeElement({ id: 'shape-rect', shape: 'rect' });
        const ellipse = makeShapeElement({ id: 'shape-ellipse', shape: 'ellipse' });
        mockPatchSuccess('proj-two-variants');

        const response = await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-two-variants',
          payload: { canvas: { elements: [rect, ellipse] } },
        });

        expect(response.statusCode).toBe(200);
        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements[0]).toMatchObject({ id: 'shape-rect', shape: 'rect' });
        expect(canvas?.elements[1]).toMatchObject({ id: 'shape-ellipse', shape: 'ellipse' });
      });

      it('all three variants can coexist in the same canvas', async () => {
        const shapes = [
          makeShapeElement({ id: 's1', shape: 'rect' }),
          makeShapeElement({ id: 's2', shape: 'ellipse' }),
          makeShapeElement({ id: 's3', shape: 'triangle' }),
        ];
        mockPatchSuccess('proj-all-variants');

        const response = await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-all-variants',
          payload: { canvas: { elements: shapes } },
        });

        expect(response.statusCode).toBe(200);
        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements).toHaveLength(3);
        expect(canvas?.elements[0]).toMatchObject({ shape: 'rect' });
        expect(canvas?.elements[1]).toMatchObject({ shape: 'ellipse' });
        expect(canvas?.elements[2]).toMatchObject({ shape: 'triangle' });
      });

      it('GET returns the triangle variant with all properties intact', async () => {
        const triangle = makeShapeElement({
          id: 'shape-tri',
          shape: 'triangle',
          fill: '#EF4444',
          stroke: '#111827',
          strokeWidth: 3,
        });
        mockGetSuccess('proj-tri-get', { elements: [triangle] });

        const response = await app.inject({ method: 'GET', url: '/api/projects/proj-tri-get' });

        expect(response.statusCode).toBe(200);
        const body = response.json<{
          data: { canvas: { elements: ShapeElementShape[] } };
        }>();
        expect(body.data.canvas.elements[0]).toMatchObject({
          shape: 'triangle',
          fill: '#EF4444',
          stroke: '#111827',
          strokeWidth: 3,
        });
      });

      it('GET returns the ellipse variant with all properties intact', async () => {
        const ellipse = makeShapeElement({
          id: 'shape-ell',
          shape: 'ellipse',
          fill: '#A7F3D0',
          stroke: 'transparent',
          strokeWidth: 0,
        });
        mockGetSuccess('proj-ell-get', { elements: [ellipse] });

        const response = await app.inject({ method: 'GET', url: '/api/projects/proj-ell-get' });

        expect(response.statusCode).toBe(200);
        const body = response.json<{
          data: { canvas: { elements: ShapeElementShape[] } };
        }>();
        expect(body.data.canvas.elements[0]).toMatchObject({
          shape: 'ellipse',
          fill: '#A7F3D0',
          stroke: 'transparent',
          strokeWidth: 0,
        });
      });
    });

    // -----------------------------------------------------------------------
    // Fill colour persistence (AC8, AC9, AC10)
    // -----------------------------------------------------------------------

    describe('fill colour persistence (feat22, AC8-AC10)', () => {
      it('saves a custom hex fill colour', async () => {
        const shape = makeShapeElement({ fill: '#EF4444' });
        mockPatchSuccess('proj-fill-hex');

        const response = await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-fill-hex',
          payload: { canvas: { elements: [shape] } },
        });

        expect(response.statusCode).toBe(200);
        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements[0]).toMatchObject({ fill: '#EF4444' });
      });

      it('saves the transparent fill sentinel value', async () => {
        const shape = makeShapeElement({ fill: 'transparent' });
        mockPatchSuccess('proj-fill-transparent');

        const response = await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-fill-transparent',
          payload: { canvas: { elements: [shape] } },
        });

        expect(response.statusCode).toBe(200);
        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements[0]).toMatchObject({ fill: 'transparent' });
      });

      it('GET returns a custom hex fill colour verbatim', async () => {
        const shape = makeShapeElement({ fill: '#8B5CF6' });
        mockGetSuccess('proj-fill-get', { elements: [shape] });

        const response = await app.inject({ method: 'GET', url: '/api/projects/proj-fill-get' });

        expect(response.statusCode).toBe(200);
        const body = response.json<{
          data: { canvas: { elements: ShapeElementShape[] } };
        }>();
        expect(body.data.canvas.elements[0]?.fill).toBe('#8B5CF6');
      });

      it('GET returns the transparent fill sentinel verbatim', async () => {
        const shape = makeShapeElement({ fill: 'transparent' });
        mockGetSuccess('proj-fill-transp-get', { elements: [shape] });

        const response = await app.inject({
          method: 'GET',
          url: '/api/projects/proj-fill-transp-get',
        });

        expect(response.statusCode).toBe(200);
        const body = response.json<{
          data: { canvas: { elements: ShapeElementShape[] } };
        }>();
        expect(body.data.canvas.elements[0]?.fill).toBe('transparent');
      });

      it('saves fill colour alongside all other shape properties without loss', async () => {
        const shape = makeShapeElement({
          shape: 'ellipse',
          fill: '#FDE68A',
          stroke: '#92400E',
          strokeWidth: 4,
          width: 200,
          height: 100,
        });
        mockPatchSuccess('proj-fill-full');

        await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-fill-full',
          payload: { canvas: { elements: [shape] } },
        });

        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements[0]).toMatchObject({
          shape: 'ellipse',
          fill: '#FDE68A',
          stroke: '#92400E',
          strokeWidth: 4,
        });
      });

      it('PATCH → GET round-trip preserves the transparent fill sentinel', async () => {
        const shape = makeShapeElement({ fill: 'transparent' });

        mockPatchSuccess('proj-fill-rt');
        await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-fill-rt',
          payload: { canvas: { elements: [shape] } },
        });

        mockGetSuccess('proj-fill-rt', { elements: [shape] });
        const getResp = await app.inject({ method: 'GET', url: '/api/projects/proj-fill-rt' });

        const body = getResp.json<{
          data: { canvas: { elements: ShapeElementShape[] } };
        }>();
        expect(body.data.canvas.elements[0]?.fill).toBe('transparent');
      });
    });

    // -----------------------------------------------------------------------
    // Stroke colour persistence (AC11, AC12)
    // -----------------------------------------------------------------------

    describe('stroke colour persistence (feat22, AC11-AC12)', () => {
      it('saves a custom hex stroke colour', async () => {
        const shape = makeShapeElement({ stroke: '#1E40AF', strokeWidth: 2 });
        mockPatchSuccess('proj-stroke-hex');

        const response = await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-stroke-hex',
          payload: { canvas: { elements: [shape] } },
        });

        expect(response.statusCode).toBe(200);
        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements[0]).toMatchObject({ stroke: '#1E40AF' });
      });

      it('saves the transparent stroke sentinel value', async () => {
        const shape = makeShapeElement({ stroke: 'transparent', strokeWidth: 0 });
        mockPatchSuccess('proj-stroke-transparent');

        const response = await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-stroke-transparent',
          payload: { canvas: { elements: [shape] } },
        });

        expect(response.statusCode).toBe(200);
        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements[0]).toMatchObject({ stroke: 'transparent' });
      });

      it('GET returns a custom hex stroke colour verbatim', async () => {
        const shape = makeShapeElement({ stroke: '#DC2626', strokeWidth: 3 });
        mockGetSuccess('proj-stroke-get', { elements: [shape] });

        const response = await app.inject({ method: 'GET', url: '/api/projects/proj-stroke-get' });

        expect(response.statusCode).toBe(200);
        const body = response.json<{
          data: { canvas: { elements: ShapeElementShape[] } };
        }>();
        expect(body.data.canvas.elements[0]?.stroke).toBe('#DC2626');
      });

      it('GET returns the transparent stroke sentinel verbatim', async () => {
        const shape = makeShapeElement({ stroke: 'transparent', strokeWidth: 0 });
        mockGetSuccess('proj-stroke-transp-get', { elements: [shape] });

        const response = await app.inject({
          method: 'GET',
          url: '/api/projects/proj-stroke-transp-get',
        });

        expect(response.statusCode).toBe(200);
        const body = response.json<{
          data: { canvas: { elements: ShapeElementShape[] } };
        }>();
        expect(body.data.canvas.elements[0]?.stroke).toBe('transparent');
      });

      it('stroke colour is independent from fill colour in the same element', async () => {
        const shape = makeShapeElement({
          fill: '#FDE68A',
          stroke: '#92400E',
          strokeWidth: 2,
        });
        mockPatchSuccess('proj-fill-stroke-independent');

        await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-fill-stroke-independent',
          payload: { canvas: { elements: [shape] } },
        });

        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements[0]).toMatchObject({
          fill: '#FDE68A',
          stroke: '#92400E',
        });
      });
    });

    // -----------------------------------------------------------------------
    // Stroke width persistence (AC13, AC14)
    // -----------------------------------------------------------------------

    describe('stroke width persistence (feat22, AC13-AC14)', () => {
      it('saves strokeWidth: 0 (no stroke, default)', async () => {
        const shape = makeShapeElement({ strokeWidth: 0 });
        mockPatchSuccess('proj-sw-0');

        const response = await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-sw-0',
          payload: { canvas: { elements: [shape] } },
        });

        expect(response.statusCode).toBe(200);
        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements[0]).toMatchObject({ strokeWidth: 0 });
      });

      it.each([1, 5, 10, 20])(
        'saves strokeWidth: %i within the valid range',
        async (strokeWidth) => {
          const shape = makeShapeElement({ stroke: '#111827', strokeWidth });
          mockPatchSuccess(`proj-sw-${String(strokeWidth)}`);

          const response = await app.inject({
            method: 'PATCH',
            url: `/api/projects/proj-sw-${String(strokeWidth)}`,
            payload: { canvas: { elements: [shape] } },
          });

          expect(response.statusCode).toBe(200);
          const canvas = extractCanvasFromPatch();
          expect(canvas?.elements[0]).toMatchObject({ strokeWidth });
        },
      );

      it('GET returns strokeWidth: 0 verbatim', async () => {
        const shape = makeShapeElement({ strokeWidth: 0 });
        mockGetSuccess('proj-sw-0-get', { elements: [shape] });

        const response = await app.inject({ method: 'GET', url: '/api/projects/proj-sw-0-get' });

        expect(response.statusCode).toBe(200);
        const body = response.json<{
          data: { canvas: { elements: ShapeElementShape[] } };
        }>();
        expect(body.data.canvas.elements[0]?.strokeWidth).toBe(0);
      });

      it('GET returns a non-zero strokeWidth verbatim', async () => {
        const shape = makeShapeElement({ stroke: '#3B82F6', strokeWidth: 8 });
        mockGetSuccess('proj-sw-8-get', { elements: [shape] });

        const response = await app.inject({ method: 'GET', url: '/api/projects/proj-sw-8-get' });

        expect(response.statusCode).toBe(200);
        const body = response.json<{
          data: { canvas: { elements: ShapeElementShape[] } };
        }>();
        expect(body.data.canvas.elements[0]?.strokeWidth).toBe(8);
      });

      it('two elements with different strokeWidths are stored independently', async () => {
        const thin = makeShapeElement({ id: 'shape-thin', stroke: '#111827', strokeWidth: 1 });
        const thick = makeShapeElement({ id: 'shape-thick', stroke: '#111827', strokeWidth: 20 });
        mockPatchSuccess('proj-sw-two');

        await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-sw-two',
          payload: { canvas: { elements: [thin, thick] } },
        });

        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements[0]).toMatchObject({ id: 'shape-thin', strokeWidth: 1 });
        expect(canvas?.elements[1]).toMatchObject({ id: 'shape-thick', strokeWidth: 20 });
      });
    });

    // -----------------------------------------------------------------------
    // Full customisation round-trip (feat22, AC29)
    // -----------------------------------------------------------------------

    describe('full customisation PATCH → GET round-trip (feat22, AC29)', () => {
      it('a fully customised rect element is returned verbatim by GET', async () => {
        const shape = makeShapeElement({
          id: 'shape-custom',
          shape: 'rect',
          x: 200,
          y: 150,
          width: 300,
          height: 80,
          fill: '#1E40AF',
          stroke: '#93C5FD',
          strokeWidth: 4,
        });

        mockPatchSuccess('proj-custom-rt');
        const patchResp = await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-custom-rt',
          payload: { canvas: { elements: [shape] } },
        });
        expect(patchResp.statusCode).toBe(200);

        mockGetSuccess('proj-custom-rt', { elements: [shape] });
        const getResp = await app.inject({ method: 'GET', url: '/api/projects/proj-custom-rt' });
        expect(getResp.statusCode).toBe(200);

        const body = getResp.json<{
          data: { canvas: { elements: ShapeElementShape[] } };
        }>();
        expect(body.data.canvas.elements[0]).toEqual(shape);
      });

      it('a fully customised ellipse element is returned verbatim by GET', async () => {
        const shape = makeShapeElement({
          id: 'shape-ellipse-custom',
          shape: 'ellipse',
          x: 600,
          y: 200,
          width: 240,
          height: 240,
          fill: 'transparent',
          stroke: '#7C3AED',
          strokeWidth: 6,
        });

        mockPatchSuccess('proj-ellipse-rt');
        await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-ellipse-rt',
          payload: { canvas: { elements: [shape] } },
        });

        mockGetSuccess('proj-ellipse-rt', { elements: [shape] });
        const getResp = await app.inject({ method: 'GET', url: '/api/projects/proj-ellipse-rt' });

        const body = getResp.json<{
          data: { canvas: { elements: ShapeElementShape[] } };
        }>();
        expect(body.data.canvas.elements[0]).toEqual(shape);
      });

      it('a fully customised triangle element is returned verbatim by GET', async () => {
        const shape = makeShapeElement({
          id: 'shape-tri-custom',
          shape: 'triangle',
          x: 400,
          y: 400,
          width: 180,
          height: 180,
          fill: '#F59E0B',
          stroke: '#78350F',
          strokeWidth: 3,
        });

        mockPatchSuccess('proj-tri-rt');
        await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-tri-rt',
          payload: { canvas: { elements: [shape] } },
        });

        mockGetSuccess('proj-tri-rt', { elements: [shape] });
        const getResp = await app.inject({ method: 'GET', url: '/api/projects/proj-tri-rt' });

        const body = getResp.json<{
          data: { canvas: { elements: ShapeElementShape[] } };
        }>();
        expect(body.data.canvas.elements[0]).toEqual(shape);
      });

      it('two independently customised shapes in the same canvas round-trip correctly', async () => {
        const shape1 = makeShapeElement({
          id: 'shape-a',
          shape: 'rect',
          fill: '#EF4444',
          stroke: 'transparent',
          strokeWidth: 0,
          x: 100,
          y: 100,
          width: 200,
          height: 120,
        });
        const shape2 = makeShapeElement({
          id: 'shape-b',
          shape: 'triangle',
          fill: 'transparent',
          stroke: '#10B981',
          strokeWidth: 5,
          x: 500,
          y: 300,
          width: 150,
          height: 150,
        });

        mockGetSuccess('proj-two-custom-rt', { elements: [shape1, shape2] });
        const getResp = await app.inject({
          method: 'GET',
          url: '/api/projects/proj-two-custom-rt',
        });

        const body = getResp.json<{
          data: { canvas: { elements: ShapeElementShape[] } };
        }>();
        expect(body.data.canvas.elements[0]).toEqual(shape1);
        expect(body.data.canvas.elements[1]).toEqual(shape2);
      });
    });

    // -----------------------------------------------------------------------
    // Hidden state integration — feature 17 applied to shape elements (AC27, AC28)
    // -----------------------------------------------------------------------

    describe('hidden state (feat17 integration, feat22 AC27-AC28)', () => {
      it('saves a shape element with hidden: true to the canvas JSONB', async () => {
        const shape = makeShapeElement({ hidden: true });
        mockPatchSuccess('proj-shape-hidden');

        const response = await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-shape-hidden',
          payload: { canvas: { elements: [shape] } },
        });

        expect(response.statusCode).toBe(200);
        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements[0]).toMatchObject({ type: 'shape', hidden: true });
      });

      it('saves a shape element with hidden: false to the canvas JSONB', async () => {
        const shape = makeShapeElement({ hidden: false });
        mockPatchSuccess('proj-shape-visible');

        const response = await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-shape-visible',
          payload: { canvas: { elements: [shape] } },
        });

        expect(response.statusCode).toBe(200);
        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements[0]).toMatchObject({ type: 'shape', hidden: false });
      });

      it('GET returns a hidden shape element with hidden: true intact', async () => {
        const shape = makeShapeElement({ hidden: true });
        mockGetSuccess('proj-shape-hidden-get', { elements: [shape] });

        const response = await app.inject({
          method: 'GET',
          url: '/api/projects/proj-shape-hidden-get',
        });

        expect(response.statusCode).toBe(200);
        const body = response.json<{
          data: { canvas: { elements: ShapeElementShape[] } };
        }>();
        expect(body.data.canvas.elements[0]).toMatchObject({ type: 'shape', hidden: true });
      });

      it('PATCH can restore a previously hidden shape element (hidden: false)', async () => {
        // First save: shape is hidden
        const hiddenShape = makeShapeElement({ hidden: true });
        mockPatchSuccess('proj-shape-restore', {
          elements: [hiddenShape],
        });

        await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-shape-restore',
          payload: { canvas: { elements: [hiddenShape] } },
        });

        vi.clearAllMocks();
        mockSql.end.mockResolvedValue(undefined);

        // Second save: shape is now visible again
        const visibleShape = makeShapeElement({ hidden: false });
        mockPatchSuccess('proj-shape-restore', {
          elements: [hiddenShape],
        });

        const response = await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-shape-restore',
          payload: { canvas: { elements: [visibleShape] } },
        });

        expect(response.statusCode).toBe(200);
        const canvas = extractCanvasFromPatch();
        expect(canvas?.elements[0]).toMatchObject({ type: 'shape', hidden: false });
      });

      it('a canvas with one visible and one hidden shape is stored and returned correctly', async () => {
        const visible = makeShapeElement({ id: 'shape-vis', hidden: false });
        const hidden = makeShapeElement({ id: 'shape-hid', hidden: true });
        mockGetSuccess('proj-mixed-visibility', { elements: [visible, hidden] });

        const response = await app.inject({
          method: 'GET',
          url: '/api/projects/proj-mixed-visibility',
        });

        expect(response.statusCode).toBe(200);
        const body = response.json<{
          data: { canvas: { elements: ShapeElementShape[] } };
        }>();
        expect(body.data.canvas.elements).toHaveLength(2);
        expect(body.data.canvas.elements[0]).toMatchObject({ id: 'shape-vis', hidden: false });
        expect(body.data.canvas.elements[1]).toMatchObject({ id: 'shape-hid', hidden: true });
      });
    });

    // -----------------------------------------------------------------------
    // Multiple designs with independent shape configurations (AC29)
    // -----------------------------------------------------------------------

    describe('multiple designs with independent shape configurations (feat22, AC29)', () => {
      it('two designs can have different shape elements with different customisations', async () => {
        // GET design A — rect with blue fill
        mockGetSuccess('proj-ind-a', {
          elements: [makeShapeElement({ id: 'sa', shape: 'rect', fill: '#3B82F6' })],
        });
        const respA = await app.inject({ method: 'GET', url: '/api/projects/proj-ind-a' });
        const bodyA = respA.json<{ data: { canvas: { elements: ShapeElementShape[] } } }>();
        expect(bodyA.data.canvas.elements[0]).toMatchObject({ shape: 'rect', fill: '#3B82F6' });

        // GET design B — triangle with transparent fill
        mockGetSuccess('proj-ind-b', {
          elements: [
            makeShapeElement({ id: 'sb', shape: 'triangle', fill: 'transparent', strokeWidth: 3 }),
          ],
        });
        const respB = await app.inject({ method: 'GET', url: '/api/projects/proj-ind-b' });
        const bodyB = respB.json<{ data: { canvas: { elements: ShapeElementShape[] } } }>();
        expect(bodyB.data.canvas.elements[0]).toMatchObject({
          shape: 'triangle',
          fill: 'transparent',
        });

        // Confirm they are independent
        expect(bodyA.data.canvas).not.toEqual(bodyB.data.canvas);
      });

      it('PATCH on one design does not affect another design', async () => {
        // PATCH design A to change its shape
        mockPatchSuccess('proj-ind-patch-a');
        const patchResp = await app.inject({
          method: 'PATCH',
          url: '/api/projects/proj-ind-patch-a',
          payload: {
            canvas: {
              elements: [makeShapeElement({ shape: 'ellipse', fill: '#A7F3D0' })],
            },
          },
        });
        expect(patchResp.statusCode).toBe(200);
        const canvasA = extractCanvasFromPatch();
        expect(canvasA?.elements[0]).toMatchObject({ shape: 'ellipse', fill: '#A7F3D0' });

        // GET design B — its configuration is entirely independent
        vi.clearAllMocks();
        mockSql.end.mockResolvedValue(undefined);
        mockGetSuccess('proj-ind-patch-b', {
          elements: [makeShapeElement({ id: 'sb', shape: 'rect', fill: '#EF4444' })],
        });
        const getResp = await app.inject({ method: 'GET', url: '/api/projects/proj-ind-patch-b' });
        const bodyB = getResp.json<{ data: { canvas: { elements: ShapeElementShape[] } } }>();
        expect(bodyB.data.canvas.elements[0]).toMatchObject({ shape: 'rect', fill: '#EF4444' });
      });

      it('three designs can each hold a distinct shape configuration', async () => {
        const configs: { id: string; shape: 'rect' | 'ellipse' | 'triangle'; fill: string }[] = [
          { id: 'proj-cfg-a', shape: 'rect', fill: '#3B82F6' },
          { id: 'proj-cfg-b', shape: 'ellipse', fill: 'transparent' },
          { id: 'proj-cfg-c', shape: 'triangle', fill: '#F59E0B' },
        ];

        for (const { id, shape, fill } of configs) {
          mockGetSuccess(id, {
            elements: [makeShapeElement({ shape, fill })],
          });
          const resp = await app.inject({ method: 'GET', url: `/api/projects/${id}` });
          expect(resp.statusCode).toBe(200);
          const body = resp.json<{ data: { canvas: { elements: ShapeElementShape[] } } }>();
          expect(body.data.canvas.elements[0]).toMatchObject({ shape, fill });
        }
      });
    });
  });
});
