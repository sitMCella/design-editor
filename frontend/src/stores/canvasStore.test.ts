import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from './canvasStore'
import type { TextElement, ArrowElement } from '../types/canvas'

const makeElement = (overrides: Partial<TextElement> = {}): TextElement => ({
  id: 'el-1',
  type: 'text',
  x: 560,
  y: 340,
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

beforeEach(() => {
  useCanvasStore.setState({
    elements: [],
    selectedIds: [],
    isDirty: false,
    designId: '',
    name: 'Untitled Design',
    zoom: 1,
    panX: 0,
    panY: 0,
  })
})

// AC 10 — no persistence: initial state is always empty
describe('initial state', () => {
  it('starts with no elements', () => {
    expect(useCanvasStore.getState().elements).toHaveLength(0)
  })

  it('starts with no selection', () => {
    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })

  it('starts clean (isDirty = false)', () => {
    expect(useCanvasStore.getState().isDirty).toBe(false)
  })
})

describe('addElement', () => {
  it('appends the element to the list', () => {
    useCanvasStore.getState().addElement(makeElement())
    expect(useCanvasStore.getState().elements).toHaveLength(1)
    expect(useCanvasStore.getState().elements[0].id).toBe('el-1')
  })

  it('marks the store as dirty', () => {
    useCanvasStore.getState().addElement(makeElement())
    expect(useCanvasStore.getState().isDirty).toBe(true)
  })

  it('can add multiple independent elements', () => {
    useCanvasStore.getState().addElement(makeElement({ id: 'a' }))
    useCanvasStore.getState().addElement(makeElement({ id: 'b' }))
    const elements = useCanvasStore.getState().elements
    expect(elements).toHaveLength(2)
    expect(elements[0].id).toBe('a')
    expect(elements[1].id).toBe('b')
  })
})

describe('updateElement', () => {
  it('patches the matching element', () => {
    useCanvasStore.getState().addElement(makeElement())
    useCanvasStore.getState().updateElement('el-1', { content: 'Updated' })
    expect((useCanvasStore.getState().elements[0] as TextElement).content).toBe('Updated')
  })

  it('does not affect other elements', () => {
    useCanvasStore.getState().addElement(makeElement({ id: 'a', content: 'A' }))
    useCanvasStore.getState().addElement(makeElement({ id: 'b', content: 'B' }))
    useCanvasStore.getState().updateElement('a', { content: 'A updated' })
    expect((useCanvasStore.getState().elements[1] as TextElement).content).toBe('B')
  })

  it('marks the store as dirty', () => {
    useCanvasStore.getState().addElement(makeElement())
    useCanvasStore.setState({ isDirty: false })
    useCanvasStore.getState().updateElement('el-1', { content: 'X' })
    expect(useCanvasStore.getState().isDirty).toBe(true)
  })

  it('is a no-op for unknown ids', () => {
    useCanvasStore.getState().addElement(makeElement())
    useCanvasStore.getState().updateElement('does-not-exist', { content: 'X' })
    expect((useCanvasStore.getState().elements[0] as TextElement).content).toBe('Hello')
  })
})

describe('removeElements', () => {
  it('removes the matching elements', () => {
    useCanvasStore.getState().addElement(makeElement({ id: 'a' }))
    useCanvasStore.getState().addElement(makeElement({ id: 'b' }))
    useCanvasStore.getState().removeElements(['a'])
    const elements = useCanvasStore.getState().elements
    expect(elements).toHaveLength(1)
    expect(elements[0].id).toBe('b')
  })

  it('also removes the ids from selectedIds', () => {
    useCanvasStore.getState().addElement(makeElement({ id: 'a' }))
    useCanvasStore.getState().selectElements(['a'])
    useCanvasStore.getState().removeElements(['a'])
    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })
})

describe('selectElements / clearSelection', () => {
  it('selectElements sets selectedIds', () => {
    useCanvasStore.getState().selectElements(['a', 'b'])
    expect(useCanvasStore.getState().selectedIds).toEqual(['a', 'b'])
  })

  it('clearSelection empties selectedIds', () => {
    useCanvasStore.getState().selectElements(['a'])
    useCanvasStore.getState().clearSelection()
    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// toggleElementSelection — feat14 AC6/AC7
// ---------------------------------------------------------------------------

describe('toggleElementSelection (feat14)', () => {
  it('AC6: adds an unselected element to selectedIds', () => {
    useCanvasStore.setState({ elements: [makeElement({ id: 'el-1' })], selectedIds: [] })
    useCanvasStore.getState().toggleElementSelection('el-1')
    expect(useCanvasStore.getState().selectedIds).toContain('el-1')
  })

  it('AC7: removes an already-selected element from selectedIds', () => {
    useCanvasStore.setState({ elements: [makeElement({ id: 'el-1' })], selectedIds: ['el-1'] })
    useCanvasStore.getState().toggleElementSelection('el-1')
    expect(useCanvasStore.getState().selectedIds).not.toContain('el-1')
  })

  it('preserves other selected elements when toggling one off', () => {
    useCanvasStore.setState({
      elements: [makeElement({ id: 'el-1' }), makeElement({ id: 'el-2' })],
      selectedIds: ['el-1', 'el-2'],
    })
    useCanvasStore.getState().toggleElementSelection('el-1')
    expect(useCanvasStore.getState().selectedIds).toEqual(['el-2'])
  })

  it('preserves other selected elements when toggling one on', () => {
    useCanvasStore.setState({
      elements: [makeElement({ id: 'el-1' }), makeElement({ id: 'el-2' })],
      selectedIds: ['el-2'],
    })
    useCanvasStore.getState().toggleElementSelection('el-1')
    expect(useCanvasStore.getState().selectedIds).toContain('el-1')
    expect(useCanvasStore.getState().selectedIds).toContain('el-2')
  })

  it('is a no-op on selectedIds when toggling an id that is not in elements', () => {
    useCanvasStore.setState({ elements: [], selectedIds: [] })
    useCanvasStore.getState().toggleElementSelection('ghost-id')
    expect(useCanvasStore.getState().selectedIds).toContain('ghost-id')
  })
})

// ---------------------------------------------------------------------------
// initDesign — resets store for a new design
// ---------------------------------------------------------------------------

describe('initDesign', () => {
  it('sets designId and name', () => {
    useCanvasStore.getState().initDesign('new-id', 'New Design')
    expect(useCanvasStore.getState().designId).toBe('new-id')
    expect(useCanvasStore.getState().name).toBe('New Design')
  })

  it('clears any existing elements', () => {
    useCanvasStore.getState().addElement(makeElement())
    useCanvasStore.getState().initDesign('new-id', 'New Design')
    expect(useCanvasStore.getState().elements).toHaveLength(0)
  })

  it('clears selection', () => {
    useCanvasStore.getState().selectElements(['el-1'])
    useCanvasStore.getState().initDesign('new-id', 'New Design')
    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })

  it('resets isDirty to false', () => {
    useCanvasStore.getState().addElement(makeElement())
    expect(useCanvasStore.getState().isDirty).toBe(true)
    useCanvasStore.getState().initDesign('new-id', 'New Design')
    expect(useCanvasStore.getState().isDirty).toBe(false)
  })

  it('resets zoom and pan to defaults', () => {
    useCanvasStore.setState({ zoom: 2, panX: 100, panY: 200 })
    useCanvasStore.getState().initDesign('new-id', 'New Design')
    const { zoom, panX, panY } = useCanvasStore.getState()
    expect(zoom).toBe(1)
    expect(panX).toBe(0)
    expect(panY).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// loadDesign — hydrates store from a persisted design
// ---------------------------------------------------------------------------

describe('loadDesign', () => {
  it('sets designId and name', () => {
    useCanvasStore.getState().loadDesign('loaded-id', 'Loaded Design', [])
    expect(useCanvasStore.getState().designId).toBe('loaded-id')
    expect(useCanvasStore.getState().name).toBe('Loaded Design')
  })

  it('populates elements from the provided array', () => {
    const el = makeElement({ id: 'persisted-1' })
    useCanvasStore.getState().loadDesign('id', 'Name', [el])
    expect(useCanvasStore.getState().elements).toHaveLength(1)
    expect(useCanvasStore.getState().elements[0].id).toBe('persisted-1')
  })

  it('restores all text element properties intact', () => {
    const el = makeElement({
      id: 'styled',
      content: 'Hello',
      fontSize: 24,
      fontFamily: 'Georgia, serif',
      fontWeight: 'bold',
      fontStyle: 'italic',
      color: '#FF0000',
      align: 'center',
    })
    useCanvasStore.getState().loadDesign('id', 'Name', [el])
    const loaded = useCanvasStore.getState().elements[0] as TextElement
    expect(loaded.fontSize).toBe(24)
    expect(loaded.fontFamily).toBe('Georgia, serif')
    expect(loaded.fontWeight).toBe('bold')
    expect(loaded.fontStyle).toBe('italic')
    expect(loaded.color).toBe('#FF0000')
    expect(loaded.align).toBe('center')
  })

  it('clears selection', () => {
    useCanvasStore.getState().selectElements(['old-id'])
    useCanvasStore.getState().loadDesign('id', 'Name', [])
    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })

  it('sets isDirty to false', () => {
    useCanvasStore.getState().addElement(makeElement())
    expect(useCanvasStore.getState().isDirty).toBe(true)
    useCanvasStore.getState().loadDesign('id', 'Name', [])
    expect(useCanvasStore.getState().isDirty).toBe(false)
  })

  it('resets zoom and pan to defaults', () => {
    useCanvasStore.setState({ zoom: 2, panX: 150, panY: 75 })
    useCanvasStore.getState().loadDesign('id', 'Name', [])
    expect(useCanvasStore.getState().zoom).toBe(1)
    expect(useCanvasStore.getState().panX).toBe(0)
    expect(useCanvasStore.getState().panY).toBe(0)
  })

  it('replaces existing elements rather than appending', () => {
    useCanvasStore.getState().addElement(makeElement({ id: 'old' }))
    useCanvasStore.getState().loadDesign('id', 'Name', [makeElement({ id: 'new' })])
    const elements = useCanvasStore.getState().elements
    expect(elements).toHaveLength(1)
    expect(elements[0].id).toBe('new')
  })
})

// ---------------------------------------------------------------------------
// updateElement — arrow bounding box recalculation (feature 09)
// ---------------------------------------------------------------------------

const makeArrow = (overrides: Partial<ArrowElement> = {}): ArrowElement => ({
  id: 'arr-1',
  type: 'arrow',
  x1: 100,
  y1: 200,
  x2: 300,
  y2: 200,
  // derived bbox: x=99, y=199, width=202, height=2 (strokeWidth=2)
  x: 99,
  y: 199,
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

describe('updateElement — arrow bounding box', () => {
  it('recalculates the bounding box when x1 changes', () => {
    useCanvasStore.getState().addElement(makeArrow())
    // Move start point to (200, 200) — arrow is now 100px wide instead of 200
    useCanvasStore.getState().updateElement('arr-1', { x1: 200, y1: 200 })
    const arr = useCanvasStore.getState().elements[0] as ArrowElement
    // deriveBBox(200,200, 300,200, 2) → x=199, y=199, width=102, height=2
    expect(arr.x).toBe(199)
    expect(arr.y).toBe(199)
    expect(arr.width).toBe(102)
    expect(arr.height).toBe(2)
  })

  it('recalculates the bounding box when both endpoints change (diagonal)', () => {
    useCanvasStore.getState().addElement(makeArrow())
    useCanvasStore.getState().updateElement('arr-1', { x1: 100, y1: 100, x2: 200, y2: 300 })
    const arr = useCanvasStore.getState().elements[0] as ArrowElement
    // deriveBBox(100,100, 200,300, 2) → x=99, y=99, width=102, height=202
    expect(arr.x).toBe(99)
    expect(arr.y).toBe(99)
    expect(arr.width).toBe(102)
    expect(arr.height).toBe(202)
  })

  it('recalculates the bounding box when strokeWidth changes', () => {
    useCanvasStore.getState().addElement(makeArrow())
    useCanvasStore.getState().updateElement('arr-1', { strokeWidth: 6 })
    const arr = useCanvasStore.getState().elements[0] as ArrowElement
    // deriveBBox(100,200, 300,200, 6) → x=97, y=197, width=206, height=6
    expect(arr.x).toBe(97)
    expect(arr.y).toBe(197)
    expect(arr.width).toBe(206)
    expect(arr.height).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// updateElement — connected arrow endpoints follow target element (AC11)
// ---------------------------------------------------------------------------

describe('updateElement — connected endpoint following', () => {
  it('AC11: moves connected start endpoint when target element moves', () => {
    // Text element at (100,100) size 100×50; right anchor = (200, 125)
    const text = makeElement({ id: 'txt-1', x: 100, y: 100, width: 100, height: 50 })
    const arrow = makeArrow({
      id: 'arr-1',
      x1: 200,
      y1: 125,
      x2: 400,
      y2: 125,
      startAnchor: { elementId: 'txt-1', side: 'right' },
    })
    useCanvasStore.getState().addElement(text)
    useCanvasStore.getState().addElement(arrow)

    // Move text element 100px right → new right anchor = (300, 125)
    useCanvasStore.getState().updateElement('txt-1', { x: 200 })

    const updatedArrow = useCanvasStore.getState().elements[1] as ArrowElement
    expect(updatedArrow.x1).toBe(300)
    expect(updatedArrow.y1).toBe(125)
  })

  it('AC11: moves connected end endpoint when target element moves', () => {
    // Text element at (400,100) size 100×50; left anchor = (400, 125)
    const text = makeElement({ id: 'txt-2', x: 400, y: 100, width: 100, height: 50 })
    const arrow = makeArrow({
      id: 'arr-2',
      x1: 200,
      y1: 125,
      x2: 400,
      y2: 125,
      endAnchor: { elementId: 'txt-2', side: 'left' },
    })
    useCanvasStore.getState().addElement(text)
    useCanvasStore.getState().addElement(arrow)

    // Move text element 100px right → new left anchor = (500, 125)
    useCanvasStore.getState().updateElement('txt-2', { x: 500 })

    const updatedArrow = useCanvasStore.getState().elements[1] as ArrowElement
    expect(updatedArrow.x2).toBe(500)
    expect(updatedArrow.y2).toBe(125)
  })

  it('AC11: updates arrow bounding box when connected target moves', () => {
    const text = makeElement({ id: 'txt-3', x: 100, y: 100, width: 100, height: 50 })
    const arrow = makeArrow({
      id: 'arr-3',
      x1: 200,
      y1: 125,
      x2: 400,
      y2: 125,
      startAnchor: { elementId: 'txt-3', side: 'right' },
    })
    useCanvasStore.getState().addElement(text)
    useCanvasStore.getState().addElement(arrow)

    useCanvasStore.getState().updateElement('txt-3', { x: 200 })

    // new x1=300, x2=400, strokeWidth=2 → bbox x=299, y=124, width=102, height=2
    const updatedArrow = useCanvasStore.getState().elements[1] as ArrowElement
    expect(updatedArrow.x).toBe(299)
    expect(updatedArrow.width).toBe(102)
  })

  it('AC11: both start and end endpoints follow their respective targets', () => {
    const textA = makeElement({ id: 'txt-a', x: 100, y: 100, width: 100, height: 50 })
    const textB = makeElement({ id: 'txt-b', x: 400, y: 100, width: 100, height: 50 })
    // right anchor of textA = (200, 125); left anchor of textB = (400, 125)
    const arrow = makeArrow({
      id: 'arr-ab',
      x1: 200,
      y1: 125,
      x2: 400,
      y2: 125,
      startAnchor: { elementId: 'txt-a', side: 'right' },
      endAnchor: { elementId: 'txt-b', side: 'left' },
    })
    useCanvasStore.getState().addElement(textA)
    useCanvasStore.getState().addElement(textB)
    useCanvasStore.getState().addElement(arrow)

    // Move textA right; textB stays
    useCanvasStore.getState().updateElement('txt-a', { x: 200 })

    const updatedArrow = useCanvasStore.getState().elements[2] as ArrowElement
    // new right anchor of textA = (300, 125); textB.left = (400, 125) unchanged
    expect(updatedArrow.x1).toBe(300)
    expect(updatedArrow.x2).toBe(400)
  })

  it('does not move endpoints that are not connected to the moved element', () => {
    const text = makeElement({ id: 'txt-x', x: 100, y: 100, width: 100, height: 50 })
    const arrow = makeArrow({
      id: 'arr-x',
      x1: 200,
      y1: 125,
      x2: 400,
      y2: 125,
      // no anchor — free endpoints
    })
    useCanvasStore.getState().addElement(text)
    useCanvasStore.getState().addElement(arrow)

    useCanvasStore.getState().updateElement('txt-x', { x: 300 })

    const arr = useCanvasStore.getState().elements[1] as ArrowElement
    expect(arr.x1).toBe(200)
    expect(arr.x2).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// markSaved — clears isDirty after a successful auto-save
// ---------------------------------------------------------------------------

describe('markSaved', () => {
  it('sets isDirty to false', () => {
    useCanvasStore.getState().addElement(makeElement())
    expect(useCanvasStore.getState().isDirty).toBe(true)
    useCanvasStore.getState().markSaved()
    expect(useCanvasStore.getState().isDirty).toBe(false)
  })

  it('does not affect elements', () => {
    useCanvasStore.getState().addElement(makeElement())
    useCanvasStore.getState().markSaved()
    expect(useCanvasStore.getState().elements).toHaveLength(1)
  })

  it('does not affect selection', () => {
    useCanvasStore.getState().addElement(makeElement())
    useCanvasStore.getState().selectElements(['el-1'])
    useCanvasStore.getState().markSaved()
    expect(useCanvasStore.getState().selectedIds).toEqual(['el-1'])
  })

  it('is a no-op when already clean', () => {
    expect(useCanvasStore.getState().isDirty).toBe(false)
    useCanvasStore.getState().markSaved()
    expect(useCanvasStore.getState().isDirty).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// setZoom — AC 2/3/4/6 (feat 13)
// ---------------------------------------------------------------------------

describe('setZoom', () => {
  it('sets the zoom value', () => {
    useCanvasStore.getState().setZoom(2)
    expect(useCanvasStore.getState().zoom).toBe(2)
  })

  it('accepts fractional zoom values', () => {
    useCanvasStore.getState().setZoom(0.5)
    expect(useCanvasStore.getState().zoom).toBe(0.5)
  })

  it('clamps zoom to the minimum of 0.1', () => {
    useCanvasStore.getState().setZoom(0.01)
    expect(useCanvasStore.getState().zoom).toBe(0.1)
  })

  it('clamps zoom to the maximum of 5', () => {
    useCanvasStore.getState().setZoom(99)
    expect(useCanvasStore.getState().zoom).toBe(5)
  })

  it('accepts the exact minimum boundary (0.1)', () => {
    useCanvasStore.getState().setZoom(0.1)
    expect(useCanvasStore.getState().zoom).toBe(0.1)
  })

  it('accepts the exact maximum boundary (5)', () => {
    useCanvasStore.getState().setZoom(5)
    expect(useCanvasStore.getState().zoom).toBe(5)
  })

  it('does not mark the store as dirty', () => {
    useCanvasStore.getState().setZoom(2)
    expect(useCanvasStore.getState().isDirty).toBe(false)
  })

  it('does not affect elements', () => {
    useCanvasStore.getState().addElement(makeElement())
    useCanvasStore.setState({ isDirty: false })
    useCanvasStore.getState().setZoom(3)
    expect(useCanvasStore.getState().elements).toHaveLength(1)
    expect(useCanvasStore.getState().isDirty).toBe(false)
  })

  it('does not affect selection', () => {
    useCanvasStore.getState().selectElements(['a', 'b'])
    useCanvasStore.getState().setZoom(2)
    expect(useCanvasStore.getState().selectedIds).toEqual(['a', 'b'])
  })
})

// ---------------------------------------------------------------------------
// setPan — AC 7/8 (feat 13)
// ---------------------------------------------------------------------------

describe('setPan', () => {
  it('sets panX and panY', () => {
    useCanvasStore.getState().setPan(150, 75)
    const { panX, panY } = useCanvasStore.getState()
    expect(panX).toBe(150)
    expect(panY).toBe(75)
  })

  it('allows negative pan values (infinite canvas has no boundary)', () => {
    useCanvasStore.getState().setPan(-500, -300)
    const { panX, panY } = useCanvasStore.getState()
    expect(panX).toBe(-500)
    expect(panY).toBe(-300)
  })

  it('allows large positive pan values', () => {
    useCanvasStore.getState().setPan(10000, 8000)
    const { panX, panY } = useCanvasStore.getState()
    expect(panX).toBe(10000)
    expect(panY).toBe(8000)
  })

  it('does not mark the store as dirty', () => {
    useCanvasStore.getState().setPan(100, 200)
    expect(useCanvasStore.getState().isDirty).toBe(false)
  })

  it('does not affect elements', () => {
    useCanvasStore.getState().addElement(makeElement())
    useCanvasStore.setState({ isDirty: false })
    useCanvasStore.getState().setPan(100, 200)
    expect(useCanvasStore.getState().elements).toHaveLength(1)
    expect(useCanvasStore.getState().isDirty).toBe(false)
  })

  it('setPan(0, 0) resets pan to origin', () => {
    useCanvasStore.getState().setPan(300, 400)
    useCanvasStore.getState().setPan(0, 0)
    expect(useCanvasStore.getState().panX).toBe(0)
    expect(useCanvasStore.getState().panY).toBe(0)
  })
})
