import { describe, expect, it } from 'vitest'
import { anchorCoord, deriveBBox, getAllAnchorPoints } from './anchorCoord'

const el = { x: 100, y: 200, width: 80, height: 40 }

// ---------------------------------------------------------------------------
// anchorCoord
// ---------------------------------------------------------------------------

describe('anchorCoord', () => {
  it('top: midpoint of top edge', () => {
    expect(anchorCoord(el, 'top')).toEqual({ x: 140, y: 200 })
  })

  it('right: midpoint of right edge', () => {
    expect(anchorCoord(el, 'right')).toEqual({ x: 180, y: 220 })
  })

  it('bottom: midpoint of bottom edge', () => {
    expect(anchorCoord(el, 'bottom')).toEqual({ x: 140, y: 240 })
  })

  it('left: midpoint of left edge', () => {
    expect(anchorCoord(el, 'left')).toEqual({ x: 100, y: 220 })
  })

  it('center: centre of the element', () => {
    expect(anchorCoord(el, 'center')).toEqual({ x: 140, y: 220 })
  })

  it('works for an element at the origin', () => {
    const origin = { x: 0, y: 0, width: 100, height: 50 }
    expect(anchorCoord(origin, 'right')).toEqual({ x: 100, y: 25 })
  })
})

// ---------------------------------------------------------------------------
// deriveBBox
// ---------------------------------------------------------------------------

describe('deriveBBox', () => {
  it('horizontal arrow (x1 < x2, y1 === y2)', () => {
    // x: 100-1=99, y: 200-1=199, width: 200+2=202, height: 0+2=2
    expect(deriveBBox(100, 200, 300, 200, 2)).toEqual({ x: 99, y: 199, width: 202, height: 2 })
  })

  it('horizontal arrow with large strokeWidth', () => {
    // x: 100-3=97, y: 200-3=197, width: 200+6=206, height: 0+6=6
    expect(deriveBBox(100, 200, 300, 200, 6)).toEqual({ x: 97, y: 197, width: 206, height: 6 })
  })

  it('diagonal arrow (x2 < x1, y2 < y1)', () => {
    // x: 100-1=99, y: 100-1=99, width: 200+2=202, height: 200+2=202
    expect(deriveBBox(300, 300, 100, 100, 2)).toEqual({ x: 99, y: 99, width: 202, height: 202 })
  })

  it('vertical arrow (x1 === x2)', () => {
    // x: 200-1=199, y: 100-1=99, width: 0+2=2, height: 200+2=202
    expect(deriveBBox(200, 100, 200, 300, 2)).toEqual({ x: 199, y: 99, width: 2, height: 202 })
  })

  it('zero-length arrow', () => {
    // x: 200-2=198, y: 300-2=298, width: 0+4=4, height: 0+4=4
    expect(deriveBBox(200, 300, 200, 300, 4)).toEqual({ x: 198, y: 298, width: 4, height: 4 })
  })

  it('accounts for fractional strokeWidth', () => {
    // x: 100-0.5=99.5, y: 200-0.5=199.5, width: 200+1=201, height: 0+1=1
    expect(deriveBBox(100, 200, 300, 200, 1)).toEqual({ x: 99.5, y: 199.5, width: 201, height: 1 })
  })
})

// ---------------------------------------------------------------------------
// getAllAnchorPoints
// ---------------------------------------------------------------------------

describe('getAllAnchorPoints', () => {
  it('returns exactly 5 anchor points', () => {
    const points = getAllAnchorPoints(el)
    expect(points).toHaveLength(5)
  })

  it('includes all five sides', () => {
    const points = getAllAnchorPoints(el)
    const sides = points.map((p) => p.side)
    expect(sides).toEqual(expect.arrayContaining(['top', 'right', 'bottom', 'left', 'center']))
  })

  it('each point has the correct coordinate for its side', () => {
    const points = getAllAnchorPoints(el)
    const bySlide = Object.fromEntries(points.map((p) => [p.side, p]))
    expect(bySlide.top).toMatchObject({ x: 140, y: 200 })
    expect(bySlide.right).toMatchObject({ x: 180, y: 220 })
    expect(bySlide.bottom).toMatchObject({ x: 140, y: 240 })
    expect(bySlide.left).toMatchObject({ x: 100, y: 220 })
    expect(bySlide.center).toMatchObject({ x: 140, y: 220 })
  })

  it('works for an element at origin', () => {
    const points = getAllAnchorPoints({ x: 0, y: 0, width: 200, height: 100 })
    const top = points.find((p) => p.side === 'top')!
    expect(top).toMatchObject({ x: 100, y: 0 })
  })
})
