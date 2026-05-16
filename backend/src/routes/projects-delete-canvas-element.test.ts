/**
 * Backend unit tests for feature 16 — Delete Canvas Elements.
 *
 * Covered ACs (backend-observable behaviour only):
 *  AC15 — after a connected element is deleted the frontend clears the arrow's
 *          startAnchor / endAnchor before auto-saving; the backend must store
 *          and return the arrow without those dangling references
 *  AC16 — deleted elements are absent from the canvas persisted by
 *          PATCH /api/projects/:id; the endpoint accepts an empty or reduced
 *          elements array and returns 200
 *  AC17 — GET /api/projects/:id returns the canvas exactly as last saved;
 *          deleted elements are not present in the response
 *  AC19 — multiple successive PATCH calls, each with a progressively smaller
 *          elements array, all succeed and each persists the correct state
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
 * Extract the canvas argument passed to the UPDATE SQL call.
 * The mocked sql.json(v) returns v directly, so we look for an object with
 * an "elements" key among the template-literal interpolated arguments.
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
// Shared element fixtures
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
// Test suite
// ---------------------------------------------------------------------------

describe('Delete Canvas Elements — project routes (feat16)', () => {
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
  // AC16 — PATCH persists canvas with deleted elements absent
  // =========================================================================

  describe('AC16 — PATCH /api/projects/:id persists the canvas after deletion', () => {
    it('accepts and stores an empty elements array when all elements are deleted', async () => {
      mockPatchSuccess('proj-empty', {
        name: 'Design',
        canvas: { elements: [textElement] },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-empty',
        payload: { canvas: { elements: [] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements).toHaveLength(0);
    });

    it('returns 200 with id and updatedAt after deleting all elements', async () => {
      mockPatchSuccess('proj-del-all');

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-del-all',
        payload: { canvas: { elements: [] } },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ ok: boolean; data: { id: string; updatedAt: string } }>();
      expect(body.ok).toBe(true);
      expect(body.data.id).toBe('proj-del-all');
      expect(body.data.updatedAt).toBeDefined();
    });

    it('stores only the remaining elements when some are deleted from a multi-element canvas', async () => {
      // Canvas originally had text + image; image was deleted → only text remains
      mockPatchSuccess('proj-partial', {
        name: 'Design',
        canvas: { elements: [textElement, imageElement] },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-partial',
        payload: { canvas: { elements: [textElement] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements).toHaveLength(1);
      expect(canvas?.elements[0]).toMatchObject({ id: 'txt-1', type: 'text' });
    });

    it('stores only the remaining elements when a text element is deleted', async () => {
      mockPatchSuccess('proj-del-txt', {
        name: 'Design',
        canvas: { elements: [textElement, imageElement] },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-del-txt',
        payload: { canvas: { elements: [imageElement] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements).toHaveLength(1);
      expect(canvas?.elements[0]).toMatchObject({ id: 'img-1', type: 'image' });
    });

    it('stores only the remaining elements when an image element is deleted', async () => {
      mockPatchSuccess('proj-del-img', {
        name: 'Design',
        canvas: { elements: [textElement, imageElement] },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-del-img',
        payload: { canvas: { elements: [textElement] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements[0]).toMatchObject({ id: 'txt-1', type: 'text' });
    });

    it('stores only the remaining elements when an arrow element is deleted', async () => {
      mockPatchSuccess('proj-del-arrow', {
        name: 'Design',
        canvas: { elements: [textElement, arrowElement] },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-del-arrow',
        payload: { canvas: { elements: [textElement] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements).toHaveLength(1);
      expect(canvas?.elements[0]).toMatchObject({ id: 'txt-1', type: 'text' });
    });

    it('stores only the remaining elements when a table element is deleted', async () => {
      mockPatchSuccess('proj-del-tbl', {
        name: 'Design',
        canvas: { elements: [tableElement, textElement] },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-del-tbl',
        payload: { canvas: { elements: [textElement] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements).toHaveLength(1);
      expect(canvas?.elements[0]).toMatchObject({ id: 'txt-1', type: 'text' });
    });

    it('preserves all properties of the remaining element exactly', async () => {
      mockPatchSuccess('proj-props', {
        name: 'Design',
        canvas: { elements: [textElement, imageElement] },
      });

      await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-props',
        payload: { canvas: { elements: [textElement] } },
      });

      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements[0]).toEqual(textElement);
    });

    it('requires no authentication (AC16/AC12 cross-concern)', async () => {
      mockPatchSuccess('proj-noauth-del');

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-noauth-del',
        payload: { canvas: { elements: [] } },
      });

      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).not.toBe(403);
    });
  });

  // =========================================================================
  // AC17 — GET returns canvas faithfully after deletion was persisted
  // =========================================================================

  describe('AC17 — GET /api/projects/:id returns the canvas exactly as last saved', () => {
    it('returns an empty elements array when the canvas was saved with no elements', async () => {
      mockGetSuccess('proj-get-empty', { elements: [] });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-get-empty' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { canvas: { elements: unknown[] } } }>();
      expect(body.data.canvas.elements).toHaveLength(0);
    });

    it('returns only the surviving elements, not the deleted ones', async () => {
      // Simulates the state after img-1 was deleted and the PATCH was persisted
      mockGetSuccess('proj-get-partial', { elements: [textElement] });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-get-partial' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { canvas: { elements: { id: string }[] } } }>();
      expect(body.data.canvas.elements).toHaveLength(1);
      expect(body.data.canvas.elements[0]!.id).toBe('txt-1');
    });

    it('round-trip: PATCH with deleted element → GET returns canvas without it', async () => {
      // Step 1 — auto-save after deletion: only textElement remains
      mockPatchSuccess('proj-rt-del', {
        name: 'Design',
        canvas: { elements: [textElement, imageElement] },
      });

      const patchResp = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-rt-del',
        payload: { canvas: { elements: [textElement] } },
      });
      expect(patchResp.statusCode).toBe(200);

      // Step 2 — editor reload: GET returns what was saved
      mockGetSuccess('proj-rt-del', { elements: [textElement] });

      const getResp = await app.inject({ method: 'GET', url: '/api/projects/proj-rt-del' });
      expect(getResp.statusCode).toBe(200);

      const body = getResp.json<{ data: { canvas: { elements: { id: string }[] } } }>();
      expect(body.data.canvas.elements).toHaveLength(1);
      expect(body.data.canvas.elements[0]!.id).toBe('txt-1');
    });

    it('round-trip: PATCH with empty canvas → GET returns empty elements array', async () => {
      mockPatchSuccess('proj-rt-empty', {
        name: 'Design',
        canvas: { elements: [textElement] },
      });

      const patchResp = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-rt-empty',
        payload: { canvas: { elements: [] } },
      });
      expect(patchResp.statusCode).toBe(200);

      mockGetSuccess('proj-rt-empty', { elements: [] });

      const getResp = await app.inject({ method: 'GET', url: '/api/projects/proj-rt-empty' });
      expect(getResp.statusCode).toBe(200);

      const body = getResp.json<{ data: { canvas: { elements: unknown[] } } }>();
      expect(body.data.canvas.elements).toHaveLength(0);
    });

    it('returns all surviving element properties intact after deletion of another element', async () => {
      mockGetSuccess('proj-props-get', { elements: [textElement] });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-props-get' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { canvas: { elements: (typeof textElement)[] } } }>();
      expect(body.data.canvas.elements[0]).toEqual(textElement);
    });
  });

  // =========================================================================
  // AC16 — elementCount in GET /api/projects reflects deletion
  // =========================================================================

  describe('AC16 — GET /api/projects elementCount is updated after deletion', () => {
    it('returns elementCount 0 for a project whose all elements were deleted', async () => {
      mockSql.mockResolvedValueOnce([
        {
          id: 'proj-cnt-0',
          name: 'Design',
          element_count: 0,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const response = await app.inject({ method: 'GET', url: '/api/projects' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { id: string; elementCount: number }[] }>();
      expect(body.data[0]).toMatchObject({ id: 'proj-cnt-0', elementCount: 0 });
    });

    it('returns the correct elementCount for a project where some elements were deleted', async () => {
      // Originally had 4 elements; 3 were deleted → 1 remains
      mockSql.mockResolvedValueOnce([
        {
          id: 'proj-cnt-1',
          name: 'Design',
          element_count: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const response = await app.inject({ method: 'GET', url: '/api/projects' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: { id: string; elementCount: number }[] }>();
      expect(body.data[0]).toMatchObject({ id: 'proj-cnt-1', elementCount: 1 });
    });
  });

  // =========================================================================
  // AC15 — Arrow anchor cleanup: PATCH stores arrow without dangling anchors
  // =========================================================================

  describe('AC15 — arrow anchors pointing to deleted elements are absent from the persisted canvas', () => {
    it('stores an arrow without startAnchor when the connected element was deleted', async () => {
      // The frontend cleared startAnchor before auto-saving because txt-1 was deleted
      const arrowWithoutStartAnchor = { ...arrowElement };
      // startAnchor is absent (the property is simply not present)

      mockPatchSuccess('proj-no-start', {
        name: 'Design',
        canvas: {
          elements: [{ ...arrowElement, startAnchor: { elementId: 'txt-1', side: 'right' } }],
        },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-no-start',
        payload: { canvas: { elements: [arrowWithoutStartAnchor] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements[0]).not.toHaveProperty('startAnchor');
    });

    it('stores an arrow without endAnchor when the connected element was deleted', async () => {
      const arrowWithoutEndAnchor = { ...arrowElement };

      mockPatchSuccess('proj-no-end', {
        name: 'Design',
        canvas: {
          elements: [{ ...arrowElement, endAnchor: { elementId: 'img-1', side: 'left' } }],
        },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-no-end',
        payload: { canvas: { elements: [arrowWithoutEndAnchor] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements[0]).not.toHaveProperty('endAnchor');
    });

    it('stores an arrow without either anchor when both connected elements were deleted', async () => {
      const freeArrow = { ...arrowElement };

      mockPatchSuccess('proj-no-anchors', {
        name: 'Design',
        canvas: {
          elements: [
            {
              ...arrowElement,
              startAnchor: { elementId: 'txt-1', side: 'right' },
              endAnchor: { elementId: 'img-1', side: 'left' },
            },
          ],
        },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-no-anchors',
        payload: { canvas: { elements: [freeArrow] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements[0]).not.toHaveProperty('startAnchor');
      expect(canvas?.elements[0]).not.toHaveProperty('endAnchor');
    });

    it('GET returns the arrow without dangling anchor after the cleanup was persisted', async () => {
      // The database contains the already-cleaned-up arrow (no anchors)
      mockGetSuccess('proj-free-arrow', { elements: [arrowElement] });

      const response = await app.inject({ method: 'GET', url: '/api/projects/proj-free-arrow' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        data: { canvas: { elements: Record<string, unknown>[] } };
      }>();
      const el = body.data.canvas.elements[0];
      expect(el).not.toHaveProperty('startAnchor');
      expect(el).not.toHaveProperty('endAnchor');
    });

    it('retains an existing anchor on an arrow that was not affected by the deletion', async () => {
      // txt-2 was deleted; the arrow was connected only to txt-3 (still alive) — endAnchor kept
      const arrowWithEndAnchor = {
        ...arrowElement,
        endAnchor: { elementId: 'txt-3', side: 'left' as const },
      };
      const survivingText = { ...textElement, id: 'txt-3' };

      mockPatchSuccess('proj-partial-anchor', {
        name: 'Design',
        canvas: { elements: [] },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-partial-anchor',
        payload: { canvas: { elements: [survivingText, arrowWithEndAnchor] } },
      });

      expect(response.statusCode).toBe(200);
      const canvas = extractCanvasFromPatch();
      expect(canvas?.elements[1]).toMatchObject({
        endAnchor: { elementId: 'txt-3', side: 'left' },
      });
      expect(canvas?.elements[1]).not.toHaveProperty('startAnchor');
    });

    it('round-trip: PATCH cleanup → GET returns arrow without stale anchors', async () => {
      const cleanArrow = { ...arrowElement };

      mockPatchSuccess('proj-anchor-rt', { name: 'Design', canvas: { elements: [] } });

      const patchResp = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-anchor-rt',
        payload: { canvas: { elements: [cleanArrow] } },
      });
      expect(patchResp.statusCode).toBe(200);

      mockGetSuccess('proj-anchor-rt', { elements: [cleanArrow] });

      const getResp = await app.inject({ method: 'GET', url: '/api/projects/proj-anchor-rt' });
      expect(getResp.statusCode).toBe(200);

      const body = getResp.json<{ data: { canvas: { elements: Record<string, unknown>[] } } }>();
      const el = body.data.canvas.elements[0];
      expect(el).not.toHaveProperty('startAnchor');
      expect(el).not.toHaveProperty('endAnchor');
    });
  });

  // =========================================================================
  // AC19 — multiple successive deletions each persist the correct canvas state
  // =========================================================================

  describe('AC19 — successive PATCH calls each persist the correct reduced canvas', () => {
    it('three sequential PATCHes each with one fewer element all return 200', async () => {
      const allElements = [textElement, imageElement, arrowElement];

      // Deletion 1: arrowElement deleted → 2 remain
      mockPatchSuccess('proj-seq', { name: 'Design', canvas: { elements: allElements } });
      const r1 = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-seq',
        payload: { canvas: { elements: [textElement, imageElement] } },
      });
      expect(r1.statusCode).toBe(200);

      // Deletion 2: imageElement deleted → 1 remains
      mockPatchSuccess('proj-seq', {
        name: 'Design',
        canvas: { elements: [textElement, imageElement] },
      });
      const r2 = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-seq',
        payload: { canvas: { elements: [textElement] } },
      });
      expect(r2.statusCode).toBe(200);

      // Deletion 3: textElement deleted → empty
      mockPatchSuccess('proj-seq', { name: 'Design', canvas: { elements: [textElement] } });
      const r3 = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-seq',
        payload: { canvas: { elements: [] } },
      });
      expect(r3.statusCode).toBe(200);
    });

    it('each successive PATCH persists exactly the supplied elements', async () => {
      // First deletion: arrow removed
      mockPatchSuccess('proj-seq2', {
        name: 'Design',
        canvas: { elements: [textElement, imageElement, arrowElement] },
      });
      await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-seq2',
        payload: { canvas: { elements: [textElement, imageElement] } },
      });
      const canvas1 = extractCanvasFromPatch();
      expect(canvas1?.elements).toHaveLength(2);
      expect(canvas1?.elements.map((e) => (e as { id: string }).id)).toEqual(['txt-1', 'img-1']);

      vi.clearAllMocks();

      // Second deletion: image removed
      mockPatchSuccess('proj-seq2', {
        name: 'Design',
        canvas: { elements: [textElement, imageElement] },
      });
      await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-seq2',
        payload: { canvas: { elements: [textElement] } },
      });
      const canvas2 = extractCanvasFromPatch();
      expect(canvas2?.elements).toHaveLength(1);
      expect(canvas2?.elements[0]).toMatchObject({ id: 'txt-1' });
    });

    it('multiple independent projects maintain their own element counts after deletions', async () => {
      // Project A: all 3 elements deleted → empty
      mockPatchSuccess('proj-A', {
        name: 'A',
        canvas: { elements: [textElement, imageElement, arrowElement] },
      });
      const rA = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-A',
        payload: { canvas: { elements: [] } },
      });
      expect(rA.statusCode).toBe(200);

      vi.clearAllMocks();

      // Project B: only imageElement deleted → 2 remain
      mockPatchSuccess('proj-B', {
        name: 'B',
        canvas: { elements: [textElement, imageElement, arrowElement] },
      });
      const rB = await app.inject({
        method: 'PATCH',
        url: '/api/projects/proj-B',
        payload: { canvas: { elements: [textElement, arrowElement] } },
      });
      expect(rB.statusCode).toBe(200);

      const canvasB = extractCanvasFromPatch();
      expect(canvasB?.elements).toHaveLength(2);
    });
  });
});
