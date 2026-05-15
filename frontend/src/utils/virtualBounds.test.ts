import { describe, expect, it } from 'vitest'
import { computeVirtualBounds, INITIAL_CANVAS_WIDTH, INITIAL_CANVAS_HEIGHT } from './virtualBounds'
import type { TextElement } from '../types/canvas'

const makeText = (x: number, y: number, w: number, h: number): TextElement => ({
  id: 'el',
  type: 'text',
  x,
  y,
  width: w,
  height: h,
  rotation: 0,
  opacity: 1,
  locked: false,
  content: 'test',
  fontSize: 16,
  fontFamily: 'Inter, sans-serif',
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#111827',
  align: 'left',
})

// ---------------------------------------------------------------------------
// AC 22 — initial virtual canvas is 4000 × 3000 with no elements / default viewport
// ---------------------------------------------------------------------------

describe('computeVirtualBounds — initial dimensions', () => {
  it('has width INITIAL_CANVAS_WIDTH with no elements at default state', () => {
    const b = computeVirtualBounds([], 0, 0, 1, 0, 0)
    expect(b.right - b.left).toBe(INITIAL_CANVAS_WIDTH)
  })

  it('has height INITIAL_CANVAS_HEIGHT with no elements at default state', () => {
    const b = computeVirtualBounds([], 0, 0, 1, 0, 0)
    expect(b.bottom - b.top).toBe(INITIAL_CANVAS_HEIGHT)
  })

  it('starts at world origin (left=0, top=0) with no elements and no pan', () => {
    const b = computeVirtualBounds([], 0, 0, 1, 0, 0)
    expect(b.left).toBe(0)
    expect(b.top).toBe(0)
  })

  it('never shrinks below initial width even with a viewport that fits inside', () => {
    const b = computeVirtualBounds([], 0, 0, 1, 800, 600)
    expect(b.right - b.left).toBeGreaterThanOrEqual(INITIAL_CANVAS_WIDTH)
  })

  it('never shrinks below initial height even with a viewport that fits inside', () => {
    const b = computeVirtualBounds([], 0, 0, 1, 800, 600)
    expect(b.bottom - b.top).toBeGreaterThanOrEqual(INITIAL_CANVAS_HEIGHT)
  })
})

// ---------------------------------------------------------------------------
// AC 27 — element near any edge causes the virtual bounds to expand
// ---------------------------------------------------------------------------

describe('computeVirtualBounds — auto-expansion from element position', () => {
  it('expands right bound when element right edge exceeds INITIAL_CANVAS_WIDTH', () => {
    // element right edge = 4100; + 200 px padding → right ≥ 4300
    const el = makeText(INITIAL_CANVAS_WIDTH - 100, 100, 200, 40)
    const b = computeVirtualBounds([el], 0, 0, 1, 0, 0)
    expect(b.right).toBeGreaterThanOrEqual(el.x + el.width + 200)
  })

  it('expands bottom bound when element bottom edge exceeds INITIAL_CANVAS_HEIGHT', () => {
    const el = makeText(100, INITIAL_CANVAS_HEIGHT - 50, 100, 200)
    const b = computeVirtualBounds([el], 0, 0, 1, 0, 0)
    expect(b.bottom).toBeGreaterThanOrEqual(el.y + el.height + 200)
  })

  it('expands left bound for an element with negative x', () => {
    const el = makeText(-500, 100, 100, 40)
    const b = computeVirtualBounds([el], 0, 0, 1, 0, 0)
    expect(b.left).toBeLessThanOrEqual(el.x - 200)
  })

  it('expands top bound for an element with negative y', () => {
    const el = makeText(100, -300, 100, 40)
    const b = computeVirtualBounds([el], 0, 0, 1, 0, 0)
    expect(b.top).toBeLessThanOrEqual(el.y - 200)
  })

  it('does not expand when element is well within initial bounds', () => {
    const el = makeText(200, 200, 100, 40)
    const b = computeVirtualBounds([el], 0, 0, 1, 0, 0)
    expect(b.right - b.left).toBe(INITIAL_CANVAS_WIDTH)
    expect(b.bottom - b.top).toBe(INITIAL_CANVAS_HEIGHT)
  })
})

// ---------------------------------------------------------------------------
// AC 28 — viewport inclusion: bounds always encompass the current viewport
// ---------------------------------------------------------------------------

describe('computeVirtualBounds — viewport inclusion after free pan', () => {
  it('expands right to include viewport panned far right', () => {
    // panX = -10000, vpW = 800 → viewport covers world x [10000, 10800]
    const b = computeVirtualBounds([], -10000, 0, 1, 800, 0)
    expect(b.right).toBeGreaterThanOrEqual(10000 + 800)
  })

  it('expands left when viewport is panned to show negative world x (positive panX)', () => {
    // panX = +2000, zoom = 1 → viewport left at world x = -2000
    const b = computeVirtualBounds([], 2000, 0, 1, 0, 0)
    expect(b.left).toBeLessThanOrEqual(-2000)
  })

  it('expands top when viewport is panned above world origin (positive panY)', () => {
    const b = computeVirtualBounds([], 0, 1500, 1, 0, 0)
    expect(b.top).toBeLessThanOrEqual(-1500)
  })

  it('expands bottom when viewport is panned below initial canvas', () => {
    // panY = -5000, vpH = 600 → viewport bottom at world y = 5600
    const b = computeVirtualBounds([], 0, -5000, 1, 0, 600)
    expect(b.bottom).toBeGreaterThanOrEqual(5600)
  })

  it('accounts for zoom when computing viewport world extent', () => {
    // zoom = 0.5 → 800×600 viewport covers 1600×1200 world units (well within 4000×3000)
    const b = computeVirtualBounds([], 0, 0, 0.5, 800, 600)
    expect(b.right).toBe(INITIAL_CANVAS_WIDTH)
    expect(b.bottom).toBe(INITIAL_CANVAS_HEIGHT)
  })

  it('handles zoom > 1 correctly (viewport covers fewer world units)', () => {
    // zoom = 2 → 800 px viewport covers only 400 world units
    const b = computeVirtualBounds([], 0, 0, 2, 800, 0)
    // viewport right = 400, which is within 4000
    expect(b.right).toBe(INITIAL_CANVAS_WIDTH)
  })
})
