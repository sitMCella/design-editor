/**
 * Backend unit tests for feature 17 — Layer Panel.
 *
 * Covered ACs (backend-observable behaviour only):
 *  AC25 — hiding an element persists `hidden: true` in the canvas JSONB via
 *          PATCH /api/projects/:id; GET /api/projects/:id returns the element
 *          with `hidden: true` intact (simulating editor reload)
 *  AC26 — reordering elements (changing z-order) via PATCH persists the new
 *          array order; GET returns elements in the same persisted order
 *
 * Additional backend-observable concerns:
 *  - GET /api/projects elementCount counts ALL elements in the canvas array,
 *    including hidden ones, because the JSONB array length does not filter by
 *    the `hidden` field
 *  - All element types (text, image, arrow, table) can carry `hidden: true`;
 *    the field is stored and returned verbatim for each type
 *  - A canvas with a mix of hidden and visible elements is stored and returned
 *    correctly
 *  - An element previously hidden (hidden: true) can be restored (hidden: false
 *    or the field absent) in a subsequent PATCH
 *  - Multiple independent projects each maintain their own element visibility
 *    and z-order state
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

/** Mock a successful PATCH: SELECT current + UPDATE RETURNING. */
function mockPatchSuccess(
  projectId: string,
  existing: { name: string; canvas: { elements: unknown[] } } = {
    name: 'Design',
    canvas: { elements: [] },
  },
) {
  mockSql
    .mockResolvedValueOnce([existing])
    .mockResolvedValueOnce([{ id: projectId, name: existing.name, updated_at: new Date() }]);
}

/** Mock a successful GET for one project with the supplied canvas. */
function mockGetSuccess(projectId: string, canvas: { elements: unknown[] }) {
  mockSql.mockResolvedValueOnce([
    { id: projectId, name: 'Design', canvas, created_at: new Date(), updated_at: new Date() },
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
// Element fixtures
// ---------------------------------------------------------------------------

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
  fontWeight: 'normal' as const,
  fontStyle: 'normal' as const,
  color: '#111827',
  align: 'left' as const,
};

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
  objectFit: 'cover' as const,
};

const arrowElement = {
  id: 'arrow-1',
  type: 'arrow',
  x1: 540,
  y1: 360,
  x2: 740,
  y2: 360,
  x: 539,
  y: 359,
  width: 202,
  height: 4,
  rotation: 0,
  opacity: 1,
  locked: false,
  stroke: '#111827',
  strokeWidth: 2,
  arrowHead: 'end' as const,
};

const tableElement = {
  id: 'tbl-1',
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
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Layer Panel — project routes (feat17)', () => {
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
  // AC25 — PATCH stores `hidden: true`; GET returns it intact
  // =========================================================================

  describe('AC25 — element visibility is persisted and restored correctly', () => {
    it('stores hidden: true on a text element when the visibility is toggled off', async () => {
      const hiddenText = { ...textElement, hidden: true };

      mockPatchSuccess('proj-hidden-txt', {
        name: 'Design',
        canvas: { elements: [textElement] },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-hidden-txt',
        payload: { canvas: { elements: [hiddenText] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements[0]).toMatchObject({ id: 'txt-1', hidden: true });
    });

    it('stores hidden: true on an image element', async () => {
      const hiddenImage = { ...imageElement, hidden: true };

      mockPatchSuccess('proj-hidden-img', {
        name: 'Design',
        canvas: { elements: [imageElement] },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-hidden-img',
        payload: { canvas: { elements: [hiddenImage] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements[0]).toMatchObject({ id: 'img-1', hidden: true });
    });

    it('stores hidden: true on an arrow element', async () => {
      const hiddenArrow = { ...arrowElement, hidden: true };

      mockPatchSuccess('proj-hidden-arrow', {
        name: 'Design',
        canvas: { elements: [arrowElement] },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-hidden-arrow',
        payload: { canvas: { elements: [hiddenArrow] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements[0]).toMatchObject({ id: 'arrow-1', hidden: true });
    });

    it('stores hidden: true on a table element', async () => {
      const hiddenTable = { ...tableElement, hidden: true };

      mockPatchSuccess('proj-hidden-tbl', {
        name: 'Design',
        canvas: { elements: [tableElement] },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-hidden-tbl',
        payload: { canvas: { elements: [hiddenTable] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements[0]).toMatchObject({ id: 'tbl-1', hidden: true });
    });

    it('GET returns a hidden text element with hidden: true intact (AC25)', async () => {
      const hiddenText = { ...textElement, hidden: true };
      mockGetSuccess('proj-get-hidden', { elements: [hiddenText] });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-get-hidden' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        data: { canvas: { elements: Record<string, unknown>[] } };
      }>();
      expect(body.data.canvas.elements[0]).toMatchObject({ id: 'txt-1', hidden: true });
    });

    it('GET returns all element properties intact alongside hidden: true (AC25)', async () => {
      const hiddenText = { ...textElement, hidden: true };
      mockGetSuccess('proj-get-props', { elements: [hiddenText] });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-get-props' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        data: { canvas: { elements: (typeof hiddenText)[] } };
      }>();
      expect(body.data.canvas.elements[0]).toEqual(hiddenText);
    });

    it('round-trip: PATCH with hidden: true → GET restores the same hidden state (AC25)', async () => {
      const hiddenText = { ...textElement, hidden: true };

      mockPatchSuccess('proj-rt-hidden', {
        name: 'Design',
        canvas: { elements: [textElement] },
      });

      const patchResp = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-rt-hidden',
        payload: { canvas: { elements: [hiddenText] } },
      });
      expect(patchResp.statusCode).toBe(200);

      mockGetSuccess('proj-rt-hidden', { elements: [hiddenText] });

      const getResp = await app.inject({ method: 'GET', url: '/api/projects/proj-rt-hidden' });
      expect(getResp.statusCode).toBe(200);

      const body = getResp.json<{
        data: { canvas: { elements: (typeof hiddenText)[] } };
      }>();
      expect(body.data.canvas.elements[0]).toMatchObject({ id: 'txt-1', hidden: true });
    });

    it('stores a canvas with a mix of hidden and visible elements correctly', async () => {
      const hiddenImage = { ...imageElement, hidden: true };
      const visibleText = { ...textElement }; // no hidden field

      mockPatchSuccess('proj-mixed-vis', {
        name: 'Design',
        canvas: { elements: [visibleText, imageElement] },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-mixed-vis',
        payload: { canvas: { elements: [visibleText, hiddenImage] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements).toHaveLength(2);
      expect(canvas?.elements[0]).not.toHaveProperty('hidden');
      expect(canvas?.elements[1]).toMatchObject({ id: 'img-1', hidden: true });
    });

    it('GET returns a canvas with mixed visibility elements in the correct state', async () => {
      const hiddenImage = { ...imageElement, hidden: true };
      const visibleText = { ...textElement };
      mockGetSuccess('proj-get-mixed', { elements: [visibleText, hiddenImage] });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-get-mixed' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        data: { canvas: { elements: Record<string, unknown>[] } };
      }>();
      expect(body.data.canvas.elements).toHaveLength(2);
      expect(body.data.canvas.elements[0]).not.toHaveProperty('hidden');
      expect(body.data.canvas.elements[1]).toMatchObject({ id: 'img-1', hidden: true });
    });

    it('stores multiple simultaneously hidden elements', async () => {
      const hiddenText = { ...textElement, hidden: true };
      const hiddenImage = { ...imageElement, hidden: true };
      const hiddenArrow = { ...arrowElement, hidden: true };

      mockPatchSuccess('proj-all-hidden', {
        name: 'Design',
        canvas: { elements: [textElement, imageElement, arrowElement] },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-all-hidden',
        payload: { canvas: { elements: [hiddenText, hiddenImage, hiddenArrow] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements).toHaveLength(3);
      canvas?.elements.forEach((el) => {
        expect(el).toHaveProperty('hidden', true);
      });
    });

    it('stores hidden: false when a previously hidden element is made visible again', async () => {
      const restoredText = { ...textElement, hidden: false };

      mockPatchSuccess('proj-restore', {
        name: 'Design',
        canvas: { elements: [{ ...textElement, hidden: true }] },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-restore',
        payload: { canvas: { elements: [restoredText] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements[0]).toMatchObject({ id: 'txt-1', hidden: false });
    });

    it('round-trip: restore visibility — PATCH with hidden: false → GET returns element with hidden: false', async () => {
      const restoredText = { ...textElement, hidden: false };

      mockPatchSuccess('proj-rt-restore', {
        name: 'Design',
        canvas: { elements: [{ ...textElement, hidden: true }] },
      });

      const patchResp = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-rt-restore',
        payload: { canvas: { elements: [restoredText] } },
      });
      expect(patchResp.statusCode).toBe(200);

      mockGetSuccess('proj-rt-restore', { elements: [restoredText] });

      const getResp = await app.inject({ method: 'GET', url: '/api/projects/proj-rt-restore' });
      expect(getResp.statusCode).toBe(200);

      const body = getResp.json<{
        data: { canvas: { elements: (typeof restoredText)[] } };
      }>();
      expect(body.data.canvas.elements[0]).toMatchObject({ id: 'txt-1', hidden: false });
    });
  });

  // =========================================================================
  // AC25 — elementCount in GET /api/projects counts hidden elements too
  // =========================================================================

  describe('GET /api/projects — elementCount includes hidden elements (AC25)', () => {
    it('counts hidden elements in elementCount because they remain in the canvas array', async () => {
      // Canvas has 3 elements (1 visible text + 1 hidden image + 1 hidden arrow);
      // jsonb_array_length counts all regardless of the `hidden` field
      mockSql.mockResolvedValueOnce([
        {
          id: 'proj-cnt-hidden',
          name: 'Design',
          element_count: 3,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const response = await app.inject({ method: 'GET', url: '/api/projects' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { id: string; elementCount: number }[] }>();
      expect(body.data[0]).toMatchObject({ id: 'proj-cnt-hidden', elementCount: 3 });
    });

    it('elementCount is unchanged when an element is hidden (not deleted)', async () => {
      // Before: 2 elements (both visible)
      // After hiding one: still 2 elements in the canvas array
      mockSql.mockResolvedValueOnce([
        {
          id: 'proj-cnt-stable',
          name: 'Design',
          element_count: 2,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const response = await app.inject({ method: 'GET', url: '/api/projects' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { elementCount: number }[] }>();
      expect(body.data[0]).toMatchObject({ elementCount: 2 });
    });
  });

  // =========================================================================
  // AC26 — z-order (elements array order) is persisted and restored
  // =========================================================================

  describe('AC26 — element z-order is persisted and restored correctly', () => {
    it('PATCH stores elements in the exact order provided (AC26)', async () => {
      // Elements sent in a specific order: image on top (last), text on bottom (first)
      const orderedElements = [textElement, imageElement];

      mockPatchSuccess('proj-zorder', {
        name: 'Design',
        canvas: { elements: [imageElement, textElement] }, // previous order
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-zorder',
        payload: { canvas: { elements: orderedElements } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements).toHaveLength(2);
      expect(canvas?.elements[0]).toMatchObject({ id: 'txt-1' });
      expect(canvas?.elements[1]).toMatchObject({ id: 'img-1' });
    });

    it('GET returns elements in exactly the same order as stored (AC26)', async () => {
      // Stored order: text at index 0 (bottom), image at index 1, arrow at index 2 (top)
      const orderedCanvas = { elements: [textElement, imageElement, arrowElement] };
      mockGetSuccess('proj-get-zorder', orderedCanvas);

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-get-zorder' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        data: { canvas: { elements: { id: string }[] } };
      }>();
      const ids = body.data.canvas.elements.map((el) => el.id);
      expect(ids).toEqual(['txt-1', 'img-1', 'arrow-1']);
    });

    it('PATCH with reversed element order stores the new z-order correctly (AC26)', async () => {
      // User dragged the bottom element to the top in the layer panel
      const reversedOrder = [arrowElement, imageElement, textElement];

      mockPatchSuccess('proj-reversed', {
        name: 'Design',
        canvas: { elements: [textElement, imageElement, arrowElement] },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-reversed',
        payload: { canvas: { elements: reversedOrder } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      const ids = canvas?.elements.map((el) => (el as { id: string }).id);
      expect(ids).toEqual(['arrow-1', 'img-1', 'txt-1']);
    });

    it('round-trip: PATCH with new z-order → GET restores same order (AC26)', async () => {
      // New order after reorder: table first (bottom), then text (top)
      const reorderedElements = [tableElement, textElement];

      mockPatchSuccess('proj-rt-zorder', {
        name: 'Design',
        canvas: { elements: [textElement, tableElement] },
      });

      const patchResp = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-rt-zorder',
        payload: { canvas: { elements: reorderedElements } },
      });
      expect(patchResp.statusCode).toBe(200);

      mockGetSuccess('proj-rt-zorder', { elements: reorderedElements });

      const getResp = await app.inject({ method: 'GET', url: '/api/projects/proj-rt-zorder' });
      expect(getResp.statusCode).toBe(200);

      const body = getResp.json<{
        data: { canvas: { elements: { id: string }[] } };
      }>();
      const ids = body.data.canvas.elements.map((el) => el.id);
      expect(ids).toEqual(['tbl-1', 'txt-1']);
    });

    it('PATCH stores a single-element canvas with correct position (AC26)', async () => {
      mockPatchSuccess('proj-single', {
        name: 'Design',
        canvas: { elements: [textElement] },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-single',
        payload: { canvas: { elements: [textElement] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements).toHaveLength(1);
      expect(canvas?.elements[0]).toMatchObject({ id: 'txt-1' });
    });

    it('PATCH stores four element types in the specified z-order', async () => {
      // Specific order: arrow (bottom), table, text, image (top)
      const zOrderedElements = [arrowElement, tableElement, textElement, imageElement];

      mockPatchSuccess('proj-four-types', {
        name: 'Design',
        canvas: { elements: [] },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-four-types',
        payload: { canvas: { elements: zOrderedElements } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      const types = canvas?.elements.map((el) => (el as { type: string }).type);
      expect(types).toEqual(['arrow', 'table', 'text', 'image']);
    });

    it('GET returns four element types in the stored z-order', async () => {
      // Stored order: arrow (bottom), table, text, image (top)
      const storedElements = [arrowElement, tableElement, textElement, imageElement];
      mockGetSuccess('proj-get-four', { elements: storedElements });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-get-four' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        data: { canvas: { elements: { type: string }[] } };
      }>();
      const types = body.data.canvas.elements.map((el) => el.type);
      expect(types).toEqual(['arrow', 'table', 'text', 'image']);
    });
  });

  // =========================================================================
  // Combined visibility and z-order
  // =========================================================================

  describe('combined hidden state and z-order persistence', () => {
    it('PATCH stores elements with correct order and individual hidden states', async () => {
      const hiddenArrow = { ...arrowElement, hidden: true };
      const visibleTable = { ...tableElement };
      const hiddenText = { ...textElement, hidden: true };

      // Order: hiddenArrow (bottom), visibleTable, hiddenText (top)
      const elements = [hiddenArrow, visibleTable, hiddenText];

      mockPatchSuccess('proj-combined', {
        name: 'Design',
        canvas: { elements: [] },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-combined',
        payload: { canvas: { elements } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements).toHaveLength(3);
      expect(canvas?.elements[0]).toMatchObject({ id: 'arrow-1', hidden: true });
      expect(canvas?.elements[1]).toMatchObject({ id: 'tbl-1' });
      expect(canvas?.elements[1]).not.toHaveProperty('hidden');
      expect(canvas?.elements[2]).toMatchObject({ id: 'txt-1', hidden: true });
    });

    it('GET returns elements with both z-order and visibility intact', async () => {
      const hiddenArrow = { ...arrowElement, hidden: true };
      const visibleTable = { ...tableElement };
      const hiddenText = { ...textElement, hidden: true };

      mockGetSuccess('proj-get-combined', {
        elements: [hiddenArrow, visibleTable, hiddenText],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-get-combined',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        data: { canvas: { elements: Record<string, unknown>[] } };
      }>();
      const els = body.data.canvas.elements;
      expect(els).toHaveLength(3);
      expect(els[0]).toMatchObject({ id: 'arrow-1', hidden: true });
      expect(els[1]).toMatchObject({ id: 'tbl-1' });
      expect(els[1]).not.toHaveProperty('hidden');
      expect(els[2]).toMatchObject({ id: 'txt-1', hidden: true });
    });

    it('round-trip: combined hidden + z-order state is restored verbatim (AC25, AC26)', async () => {
      const hiddenImage = { ...imageElement, hidden: true };
      const visibleText = { ...textElement };
      // Order: visibleText (bottom), hiddenImage (top)
      const elements = [visibleText, hiddenImage];

      mockPatchSuccess('proj-rt-combined', {
        name: 'Design',
        canvas: { elements: [hiddenImage, visibleText] }, // previous state
      });

      const patchResp = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-rt-combined',
        payload: { canvas: { elements } },
      });
      expect(patchResp.statusCode).toBe(200);

      mockGetSuccess('proj-rt-combined', { elements });

      const getResp = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-rt-combined',
      });
      expect(getResp.statusCode).toBe(200);

      const body = getResp.json<{
        data: { canvas: { elements: Record<string, unknown>[] } };
      }>();
      const els = body.data.canvas.elements;
      expect(els[0]).toMatchObject({ id: 'txt-1' });
      expect(els[0]).not.toHaveProperty('hidden');
      expect(els[1]).toMatchObject({ id: 'img-1', hidden: true });
    });
  });

  // =========================================================================
  // Multiple independent projects maintain separate state
  // =========================================================================

  describe('multiple independent projects (AC25, AC26)', () => {
    it('two projects with different visibility states are independent', async () => {
      // Project A: text is hidden
      mockGetSuccess('proj-A', { elements: [{ ...textElement, hidden: true }] });
      const respA = await app.inject({ method: 'GET', url: '/api/projects/proj-A' });
      const bodyA = respA.json<{
        data: { canvas: { elements: Record<string, unknown>[] } };
      }>();

      // Project B: text is visible
      mockGetSuccess('proj-B', { elements: [textElement] });
      const respB = await app.inject({ method: 'GET', url: '/api/projects/proj-B' });
      const bodyB = respB.json<{
        data: { canvas: { elements: Record<string, unknown>[] } };
      }>();

      expect(bodyA.data.canvas.elements[0]).toMatchObject({ hidden: true });
      expect(bodyB.data.canvas.elements[0]).not.toHaveProperty('hidden');
    });

    it('two projects with different z-orders maintain them independently', async () => {
      // Project A: text then image (text at bottom)
      mockGetSuccess('proj-zA', { elements: [textElement, imageElement] });
      const respA = await app.inject({ method: 'GET', url: '/api/projects/proj-zA' });
      const bodyA = respA.json<{ data: { canvas: { elements: { id: string }[] } } }>();

      // Project B: image then text (image at bottom)
      mockGetSuccess('proj-zB', { elements: [imageElement, textElement] });
      const respB = await app.inject({ method: 'GET', url: '/api/projects/proj-zB' });
      const bodyB = respB.json<{ data: { canvas: { elements: { id: string }[] } } }>();

      expect(bodyA.data.canvas.elements.map((e) => e.id)).toEqual(['txt-1', 'img-1']);
      expect(bodyB.data.canvas.elements.map((e) => e.id)).toEqual(['img-1', 'txt-1']);
    });
  });
});
