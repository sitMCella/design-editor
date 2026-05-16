import { describe, expect, it } from 'vitest'
import { elementsBBox } from './elementsBBox'
import type { TextElement, ImageElement, ArrowElement, TableElement } from '../types/canvas'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeText = (overrides: Partial<TextElement> = {}): TextElement => ({
  id: 't1',
  type: 'text',
  x: 100,
  y: 200,
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
  ...overrides,
})

const makeImage = (overrides: Partial<ImageElement> = {}): ImageElement => ({
  id: 'i1',
  type: 'image',
  x: 400,
  y: 300,
  width: 320,
  height: 240,
  rotation: 0,
  opacity: 1,
  locked: false,
  src: '',
  objectFit: 'cover',
  objectPosition: '50% 50%',
  ...overrides,
})

const makeArrow = (overrides: Partial<ArrowElement> = {}): ArrowElement => ({
  id: 'a1',
  type: 'arrow',
  x1: 50,
  y1: 50,
  x2: 250,
  y2: 50,
  x: 49,
  y: 49,
  width: 202,
  height: 2,
  rotation: 0,
  opacity: 1,
  locked: false,
  stroke: '#111827',
  strokeWidth: 2,
  arrowHead: 'end',
  ...overrides,
})

const makeTable = (overrides: Partial<TableElement> = {}): TableElement => ({
  id: 'tb1',
  type: 'table',
  x: 200,
  y: 400,
  width: 400,
  height: 120,
  rotation: 0,
  opacity: 1,
  locked: false,
  columns: 2,
  columnWidths: [200, 200],
  rows: [
    { isHeader: true, height: 40, cells: ['H1', 'H2'] },
    { isHeader: false, height: 40, cells: ['A', 'B'] },
    { isHeader: false, height: 40, cells: ['C', 'D'] },
  ],
  ...overrides,
})

// ---------------------------------------------------------------------------
// Empty array
// ---------------------------------------------------------------------------

describe('empty array', () => {
  it('returns null for an empty elements array', () => {
    expect(elementsBBox([])).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Single element
// ---------------------------------------------------------------------------

describe('single element', () => {
  it('returns the element own bounding box for a single text element', () => {
    const result = elementsBBox([makeText()])
    expect(result).toEqual({ x: 100, y: 200, width: 160, height: 40 })
  })

  it('returns the element own bounding box for a single image element', () => {
    const result = elementsBBox([makeImage()])
    expect(result).toEqual({ x: 400, y: 300, width: 320, height: 240 })
  })

  it('uses BaseElement x/y/width/height fields for an arrow element', () => {
    // Arrow stored bbox: x=49, y=49, width=202, height=2
    const result = elementsBBox([makeArrow()])
    expect(result).toEqual({ x: 49, y: 49, width: 202, height: 2 })
  })

  it('returns the element own bounding box for a table element', () => {
    const result = elementsBBox([makeTable()])
    expect(result).toEqual({ x: 200, y: 400, width: 400, height: 120 })
  })
})

// ---------------------------------------------------------------------------
// Multiple elements — union bounding box
// ---------------------------------------------------------------------------

describe('multiple elements — union bbox', () => {
  it('returns the union of two horizontally adjacent elements', () => {
    // text: x=100, right=260  |  image: x=400, right=720
    // union: x=100, right=720 → width=620
    // text: y=200, bottom=240 | image: y=300, bottom=540
    // union: y=200, bottom=540 → height=340
    const result = elementsBBox([makeText(), makeImage()])
    expect(result).toEqual({ x: 100, y: 200, width: 620, height: 340 })
  })

  it('returns the union of two vertically stacked elements', () => {
    const top = makeText({ id: 'top', x: 0, y: 0, width: 100, height: 50 })
    const bottom = makeText({ id: 'bot', x: 0, y: 100, width: 100, height: 50 })
    const result = elementsBBox([top, bottom])
    expect(result).toEqual({ x: 0, y: 0, width: 100, height: 150 })
  })

  it('returns the tight union of overlapping elements', () => {
    const a = makeText({ id: 'a', x: 50, y: 50, width: 200, height: 100 })
    const b = makeText({ id: 'b', x: 100, y: 80, width: 200, height: 100 })
    // right = max(250, 300) = 300, bottom = max(150, 180) = 180
    const result = elementsBBox([a, b])
    expect(result).toEqual({ x: 50, y: 50, width: 250, height: 130 })
  })

  it('handles a mix of element types correctly', () => {
    // text:  x=100, y=200, right=260, bottom=240
    // image: x=400, y=300, right=720, bottom=540
    // arrow: x=49,  y=49,  right=251, bottom=51
    // table: x=200, y=400, right=600, bottom=520
    // union: x=49, y=49, right=720, bottom=540 → width=671, height=491
    const result = elementsBBox([makeText(), makeImage(), makeArrow(), makeTable()])
    expect(result).toEqual({ x: 49, y: 49, width: 671, height: 491 })
  })

  it('handles three elements where the middle one is the widest', () => {
    const a = makeText({ id: 'a', x: 100, y: 100, width: 50, height: 50 })
    const b = makeText({ id: 'b', x: 0, y: 120, width: 300, height: 20 })
    const c = makeText({ id: 'c', x: 80, y: 200, width: 50, height: 50 })
    // x=0, y=100, right=300, bottom=250 → width=300, height=150
    const result = elementsBBox([a, b, c])
    expect(result).toEqual({ x: 0, y: 100, width: 300, height: 150 })
  })
})

// ---------------------------------------------------------------------------
// Negative coordinates
// ---------------------------------------------------------------------------

describe('negative coordinates', () => {
  it('handles elements placed at negative x/y (infinite canvas allows this)', () => {
    const el = makeText({ x: -200, y: -100, width: 160, height: 40 })
    const result = elementsBBox([el])
    expect(result).toEqual({ x: -200, y: -100, width: 160, height: 40 })
  })

  it('computes the correct union when one element has negative coords', () => {
    const neg = makeText({ id: 'neg', x: -100, y: -50, width: 80, height: 30 })
    const pos = makeText({ id: 'pos', x: 100, y: 100, width: 80, height: 30 })
    // x=-100, y=-50, right=max(-20, 180)=180, bottom=max(-20, 130)=130
    // width=180-(-100)=280, height=130-(-50)=180
    const result = elementsBBox([neg, pos])
    expect(result).toEqual({ x: -100, y: -50, width: 280, height: 180 })
  })

  it('handles elements entirely in negative space', () => {
    const a = makeText({ id: 'a', x: -300, y: -200, width: 100, height: 50 })
    const b = makeText({ id: 'b', x: -150, y: -300, width: 100, height: 50 })
    // a: right=-200, bottom=-150 | b: right=-50, bottom=-250
    // union: x=-300, y=-300, right=max(-200,-50)=-50, bottom=max(-150,-250)=-150
    // width=-50-(-300)=250, height=-150-(-300)=150
    const result = elementsBBox([a, b])
    expect(result).toEqual({ x: -300, y: -300, width: 250, height: 150 })
  })
})

// ---------------------------------------------------------------------------
// Width / height derived from bbox
// ---------------------------------------------------------------------------

describe('bbox dimensions', () => {
  it('width equals (maxRight − minLeft)', () => {
    const el = makeText({ x: 50, y: 0, width: 200, height: 10 })
    const result = elementsBBox([el])
    expect(result!.width).toBe(200)
    expect(result!.x + result!.width).toBe(250) // right edge
  })

  it('height equals (maxBottom − minTop)', () => {
    const el = makeText({ x: 0, y: 75, width: 10, height: 100 })
    const result = elementsBBox([el])
    expect(result!.height).toBe(100)
    expect(result!.y + result!.height).toBe(175) // bottom edge
  })

  it('a single point-sized element (1×1) returns width=1, height=1', () => {
    const el = makeText({ x: 0, y: 0, width: 1, height: 1 })
    expect(elementsBBox([el])).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })
})

// ---------------------------------------------------------------------------
// feat17 AC15 — hidden elements are excluded from the bounding box
// ---------------------------------------------------------------------------

describe('hidden elements excluded from bbox (feat17 AC15)', () => {
  it('returns null when the only element is hidden', () => {
    const el = makeText({ hidden: true })
    expect(elementsBBox([el])).toBeNull()
  })

  it('returns null when all elements are hidden', () => {
    const elements = [
      makeText({ id: 't1', hidden: true }),
      makeText({ id: 't2', x: 300, hidden: true }),
    ]
    expect(elementsBBox(elements)).toBeNull()
  })

  it('returns the bbox of visible elements only, ignoring a hidden one', () => {
    // visible: x=100, y=100, w=100, h=50 → right=200, bottom=150
    // hidden:  x=0,   y=0,   w=50,  h=50 (should not expand the bbox)
    const visible = makeText({ id: 'vis', x: 100, y: 100, width: 100, height: 50 })
    const hidden = makeText({ id: 'hid', x: 0, y: 0, width: 50, height: 50, hidden: true })
    const result = elementsBBox([visible, hidden])
    expect(result).toEqual({ x: 100, y: 100, width: 100, height: 50 })
  })

  it('computes the union of multiple visible elements ignoring hidden ones', () => {
    // v1: x=10,  y=10,  right=110, bottom=60
    // h1: x=500, y=500, right=600, bottom=600 (hidden — must be excluded)
    // v2: x=50,  y=100, right=250, bottom=150
    // union of v1+v2: x=10, y=10, right=250, bottom=150 → width=240, height=140
    const v1 = makeText({ id: 'v1', x: 10, y: 10, width: 100, height: 50 })
    const h1 = makeText({ id: 'h1', x: 500, y: 500, width: 100, height: 100, hidden: true })
    const v2 = makeText({ id: 'v2', x: 50, y: 100, width: 200, height: 50 })
    const result = elementsBBox([v1, h1, v2])
    expect(result).toEqual({ x: 10, y: 10, width: 240, height: 140 })
  })

  it('treats undefined hidden field as visible (backward-compatible default)', () => {
    // Elements with no hidden property should be included
    const el = makeText({ id: 'no-hidden-field' })
    delete (el as Partial<typeof el>).hidden
    const result = elementsBBox([el])
    expect(result).not.toBeNull()
    expect(result!.width).toBe(el.width)
  })

  it('hidden image element is excluded from the bbox', () => {
    const visible = makeText({ id: 'vis', x: 0, y: 0, width: 100, height: 50 })
    const hiddenImg = makeImage({ id: 'himg', x: 1000, y: 1000, hidden: true })
    const result = elementsBBox([visible, hiddenImg])
    expect(result).toEqual({ x: 0, y: 0, width: 100, height: 50 })
  })

  it('hidden arrow element is excluded from the bbox', () => {
    const visible = makeText({ id: 'vis', x: 0, y: 0, width: 100, height: 50 })
    // Arrow with derived bbox far from visible element
    const hiddenArrow = makeArrow({ id: 'harr', x: 2000, y: 2000, hidden: true })
    const result = elementsBBox([visible, hiddenArrow])
    expect(result).toEqual({ x: 0, y: 0, width: 100, height: 50 })
  })
})
