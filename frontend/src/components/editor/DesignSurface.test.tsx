import { createRef } from 'react'
import { render, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DesignSurface } from './DesignSurface'
import { useCanvasStore } from '../../stores/canvasStore'
import type {
  TextElement,
  ArrowElement as ArrowElementType,
  ShapeElement,
} from '../../types/canvas'

const makeTextElement = (id: string, overrides: Partial<TextElement> = {}): TextElement => ({
  id,
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
  ...overrides,
})

const makeArrowElement = (
  id: string,
  overrides: Partial<ArrowElementType> = {}
): ArrowElementType => ({
  id,
  type: 'arrow',
  x1: 100,
  y1: 100,
  x2: 300,
  y2: 100,
  x: 99,
  y: 99,
  width: 202,
  height: 4,
  rotation: 0,
  opacity: 1,
  locked: false,
  stroke: '#111827',
  strokeWidth: 2,
  arrowHead: 'end',
  ...overrides,
})

beforeEach(() => {
  useCanvasStore.setState({
    designId: '',
    name: 'Test',
    elements: [],
    selectedIds: [],
    zoom: 1,
    panX: 0,
    panY: 0,
    isDirty: false,
  })
})

afterEach(() => {
  // Clean up any stale window mouse listeners from drag tests
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  document.body.style.cursor = ''
})

// ---------------------------------------------------------------------------
// Forwarded ref — required by useThumbnail to capture the DOM node
// ---------------------------------------------------------------------------

describe('forwarded ref', () => {
  it('populates the ref with the root div on mount', () => {
    const ref = createRef<HTMLDivElement>()
    render(<DesignSurface ref={ref} />)
    expect(ref.current).not.toBeNull()
    expect(ref.current!.tagName).toBe('DIV')
  })

  it('ref.current is attached to the document', () => {
    const ref = createRef<HTMLDivElement>()
    render(<DesignSurface ref={ref} />)
    expect(ref.current).toBeInTheDocument()
  })

  it('ref is null when no ref is provided', () => {
    expect(() => render(<DesignSurface />)).not.toThrow()
  })
})

// Helper: get direct child elements of DesignSurface's root div.
// Using direct children avoids accidentally matching nested resize handle divs,
// which also have position:absolute and would skew the index.
function getDirectChildren(container: HTMLElement): HTMLElement[] {
  const root = container.firstChild as HTMLElement
  return Array.from(root.children) as HTMLElement[]
}

// ---------------------------------------------------------------------------
// AC6 (feat14) — Shift+click unselected element adds it to selection
// ---------------------------------------------------------------------------

describe('AC6 (feat14) — Shift+click adds element to selection', () => {
  it('shift+clicking an unselected element adds it to the current selection', () => {
    useCanvasStore.setState({
      elements: [makeTextElement('a'), makeTextElement('b', { x: 400 })],
      selectedIds: ['a'],
    })
    const { container } = render(<DesignSurface />)
    // Direct children: [element-a-wrapper, element-b-wrapper]
    const children = getDirectChildren(container)
    const secondEl = children[1]

    fireEvent.click(secondEl, { shiftKey: true })

    expect(useCanvasStore.getState().selectedIds).toContain('a')
    expect(useCanvasStore.getState().selectedIds).toContain('b')
  })
})

// ---------------------------------------------------------------------------
// AC7 (feat14) — Shift+click already-selected element removes it
// ---------------------------------------------------------------------------

describe('AC7 (feat14) — Shift+click removes element from selection', () => {
  it('shift+clicking an already-selected element removes it', () => {
    useCanvasStore.setState({
      elements: [makeTextElement('a'), makeTextElement('b', { x: 400 })],
      selectedIds: ['a', 'b'],
    })
    const { container } = render(<DesignSurface />)
    const children = getDirectChildren(container)
    const secondEl = children[1]

    fireEvent.click(secondEl, { shiftKey: true })

    expect(useCanvasStore.getState().selectedIds).toContain('a')
    expect(useCanvasStore.getState().selectedIds).not.toContain('b')
  })
})

// ---------------------------------------------------------------------------
// AC8 / AC17 (feat14) — plain click replaces multi-selection with single element
// ---------------------------------------------------------------------------

describe('AC8/AC17 (feat14) — plain click replaces selection', () => {
  it('plain click on an element replaces the entire selection with only that element', () => {
    useCanvasStore.setState({
      elements: [makeTextElement('a'), makeTextElement('b', { x: 400 })],
      selectedIds: ['a', 'b'],
    })
    const { container } = render(<DesignSurface />)
    const children = getDirectChildren(container)
    const secondEl = children[1]

    fireEvent.click(secondEl, { shiftKey: false })

    expect(useCanvasStore.getState().selectedIds).toEqual(['b'])
  })
})

// ---------------------------------------------------------------------------
// AC10 (feat14) — all selected elements show blue outline
// ---------------------------------------------------------------------------

describe('AC10 (feat14) — all selected elements show blue outline', () => {
  it('both selected elements have the blue outline class/style', () => {
    useCanvasStore.setState({
      elements: [makeTextElement('a'), makeTextElement('b', { x: 400 })],
      selectedIds: ['a', 'b'],
    })
    const { container } = render(<DesignSurface />)
    // Elements with isSelected=true render with a blue outline style
    const outlines = container.querySelectorAll('[style*="2px solid #3B82F6"]')
    expect(outlines.length).toBeGreaterThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// AC12 / AC16 (feat14) — multi-element drag moves all selected; selection stays
// ---------------------------------------------------------------------------

describe('AC12/AC16 (feat14) — multi-element drag', () => {
  it('dragging one selected element also moves the other selected elements', () => {
    useCanvasStore.setState({
      elements: [
        makeTextElement('a', { x: 100, y: 100 }),
        makeTextElement('b', { x: 400, y: 100 }),
      ],
      selectedIds: ['a', 'b'],
      zoom: 1,
    })
    const { container } = render(<DesignSurface />)
    // Drag the first element wrapper (element 'a')
    const wrappers = container.querySelectorAll('[style*="position: absolute"]')
    const firstEl = wrappers[0] as HTMLElement

    fireEvent.mouseDown(firstEl, { button: 0, clientX: 100, clientY: 100 })
    // Move enough to exceed 4px threshold
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 120, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 150, clientY: 120, bubbles: true }))

    const elements = useCanvasStore.getState().elements
    const elB = elements.find((e) => e.id === 'b')!
    // Element 'b' should have moved by the same delta (50, 20)
    expect(elB.x).toBe(450) // 400 + 50
    expect(elB.y).toBe(120) // 100 + 20
  })

  it('after a multi-element drag, all selected elements remain selected (AC16)', () => {
    useCanvasStore.setState({
      elements: [
        makeTextElement('a', { x: 100, y: 100 }),
        makeTextElement('b', { x: 400, y: 100 }),
      ],
      selectedIds: ['a', 'b'],
      zoom: 1,
    })
    const { container } = render(<DesignSurface />)
    const wrappers = container.querySelectorAll('[style*="position: absolute"]')
    const firstEl = wrappers[0] as HTMLElement

    fireEvent.mouseDown(firstEl, { button: 0, clientX: 100, clientY: 100 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 120, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 150, clientY: 120, bubbles: true }))

    expect(useCanvasStore.getState().selectedIds).toContain('a')
    expect(useCanvasStore.getState().selectedIds).toContain('b')
  })
})

// ---------------------------------------------------------------------------
// AC13 (feat14) — arrow anchors cleared during multi-element drag
// ---------------------------------------------------------------------------

describe('AC13 (feat14) — arrow startAnchor/endAnchor cleared in multi-drag', () => {
  it('arrow element in a multi-drag has startAnchor and endAnchor cleared', () => {
    const arrowWithAnchors = makeArrowElement('arr', {
      x1: 200,
      y1: 200,
      x2: 300,
      y2: 200,
      startAnchor: { elementId: 'text-a', side: 'right' },
      endAnchor: { elementId: 'text-b', side: 'left' },
    })
    useCanvasStore.setState({
      elements: [makeTextElement('text-a', { x: 100, y: 180 }), arrowWithAnchors],
      selectedIds: ['text-a', 'arr'],
      zoom: 1,
    })
    const { container } = render(<DesignSurface />)
    const wrappers = container.querySelectorAll('[style*="position: absolute"]')
    const firstEl = wrappers[0] as HTMLElement

    fireEvent.mouseDown(firstEl, { button: 0, clientX: 100, clientY: 180 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 180, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 150, clientY: 180, bubbles: true }))

    const elements = useCanvasStore.getState().elements
    const arr = elements.find((e) => e.id === 'arr') as ArrowElementType
    expect(arr.startAnchor).toBeUndefined()
    expect(arr.endAnchor).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// feat17 AC11/AC12 — hidden elements are not rendered on the canvas
// ---------------------------------------------------------------------------

describe('AC11/AC12 (feat17) — hidden elements are not rendered', () => {
  it('a hidden text element produces no child node in the surface', () => {
    useCanvasStore.setState({
      elements: [makeTextElement('hidden-el', { hidden: true })],
      selectedIds: [],
    })
    const { container } = render(<DesignSurface />)
    // No element wrapper should appear
    const children = getDirectChildren(container)
    expect(children).toHaveLength(0)
  })

  it('a visible element alongside a hidden one is still rendered', () => {
    useCanvasStore.setState({
      elements: [
        makeTextElement('visible-el', { x: 100 }),
        makeTextElement('hidden-el', { x: 300, hidden: true }),
      ],
      selectedIds: [],
    })
    const { container } = render(<DesignSurface />)
    const children = getDirectChildren(container)
    // Only the visible element should render
    expect(children).toHaveLength(1)
  })

  it('when all elements are hidden the surface renders no children', () => {
    useCanvasStore.setState({
      elements: [
        makeTextElement('h1', { hidden: true }),
        makeTextElement('h2', { x: 300, hidden: true }),
      ],
      selectedIds: [],
    })
    const { container } = render(<DesignSurface />)
    const children = getDirectChildren(container)
    expect(children).toHaveLength(0)
  })

  it('making a hidden element visible renders it after store update', () => {
    useCanvasStore.setState({
      elements: [makeTextElement('t1', { hidden: true })],
      selectedIds: [],
    })
    const { container, rerender } = render(<DesignSurface />)
    expect(getDirectChildren(container)).toHaveLength(0)

    // Show the element
    useCanvasStore.getState().toggleElementVisibility('t1')
    rerender(<DesignSurface />)
    expect(getDirectChildren(container)).toHaveLength(1)
  })

  it('hiding a visible element removes it from the rendered surface', () => {
    useCanvasStore.setState({
      elements: [makeTextElement('t1')],
      selectedIds: [],
    })
    const { container, rerender } = render(<DesignSurface />)
    expect(getDirectChildren(container)).toHaveLength(1)

    // Hide the element
    useCanvasStore.getState().toggleElementVisibility('t1')
    rerender(<DesignSurface />)
    expect(getDirectChildren(container)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// feat21 — ShapeElement rendering and selection in DesignSurface
// ---------------------------------------------------------------------------

const makeShapeElement = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'rect',
  x: 100,
  y: 100,
  width: 160,
  height: 160,
  rotation: 0,
  opacity: 1,
  locked: false,
  fill: '#3B82F6',
  stroke: 'transparent',
  strokeWidth: 0,
  ...overrides,
})

describe('AC 4 (feat21) — shape element click-to-select', () => {
  it('clicking a shape element selects it', () => {
    useCanvasStore.setState({
      elements: [makeShapeElement('s1')],
      selectedIds: [],
    })
    const { container } = render(<DesignSurface />)
    const child = getDirectChildren(container)[0]

    fireEvent.click(child)

    expect(useCanvasStore.getState().selectedIds).toContain('s1')
  })

  it('clicking a shape element with Shift toggles it into the selection', () => {
    useCanvasStore.setState({
      elements: [makeTextElement('t1'), makeShapeElement('s1', { x: 400 })],
      selectedIds: ['t1'],
    })
    const { container } = render(<DesignSurface />)
    const children = getDirectChildren(container)
    // second child is the shape element
    fireEvent.click(children[1], { shiftKey: true })

    expect(useCanvasStore.getState().selectedIds).toContain('t1')
    expect(useCanvasStore.getState().selectedIds).toContain('s1')
  })

  it('plain click on a shape element replaces the selection', () => {
    useCanvasStore.setState({
      elements: [makeTextElement('t1'), makeShapeElement('s1', { x: 400 })],
      selectedIds: ['t1'],
    })
    const { container } = render(<DesignSurface />)
    const children = getDirectChildren(container)
    fireEvent.click(children[1], { shiftKey: false })

    expect(useCanvasStore.getState().selectedIds).toEqual(['s1'])
  })
})

describe('AC 3 (feat21) — selected shape shows blue outline', () => {
  it('a selected shape element has the blue outline style', () => {
    useCanvasStore.setState({
      elements: [makeShapeElement('s1')],
      selectedIds: ['s1'],
    })
    const { container } = render(<DesignSurface />)
    const outlines = container.querySelectorAll('[style*="2px solid #3B82F6"]')
    expect(outlines.length).toBeGreaterThanOrEqual(1)
  })

  it('an unselected shape element has no blue outline', () => {
    useCanvasStore.setState({
      elements: [makeShapeElement('s1')],
      selectedIds: [],
    })
    const { container } = render(<DesignSurface />)
    // outline style should be 'none'
    const child = getDirectChildren(container)[0] as HTMLElement
    expect(child.style.outline).toBe('none')
  })
})

describe('feat21 — hidden shape elements are not rendered', () => {
  it('a hidden shape element produces no child node in the surface', () => {
    useCanvasStore.setState({
      elements: [makeShapeElement('s1', { hidden: true })],
      selectedIds: [],
    })
    const { container } = render(<DesignSurface />)
    expect(getDirectChildren(container)).toHaveLength(0)
  })

  it('a visible shape element alongside a hidden one is still rendered', () => {
    useCanvasStore.setState({
      elements: [makeShapeElement('s1'), makeShapeElement('s2', { x: 400, hidden: true })],
      selectedIds: [],
    })
    const { container } = render(<DesignSurface />)
    expect(getDirectChildren(container)).toHaveLength(1)
  })
})

describe('AC 6 (feat21) / AC 8 (feat14) — shape elements participate in multi-element selection', () => {
  it('multiple shape elements can each be independently selected', () => {
    useCanvasStore.setState({
      elements: [makeShapeElement('s1'), makeShapeElement('s2', { x: 400 })],
      selectedIds: [],
    })
    const { container } = render(<DesignSurface />)
    const children = getDirectChildren(container)

    fireEvent.click(children[0])
    expect(useCanvasStore.getState().selectedIds).toEqual(['s1'])

    fireEvent.click(children[1])
    expect(useCanvasStore.getState().selectedIds).toEqual(['s2'])
  })

  it('dragging a selected shape element also moves other selected elements', () => {
    useCanvasStore.setState({
      elements: [
        makeShapeElement('s1', { x: 100, y: 100 }),
        makeShapeElement('s2', { x: 400, y: 100 }),
      ],
      selectedIds: ['s1', 's2'],
      zoom: 1,
    })
    const { container } = render(<DesignSurface />)
    const wrappers = container.querySelectorAll('[style*="position: absolute"]')
    const firstEl = wrappers[0] as HTMLElement

    fireEvent.mouseDown(firstEl, { button: 0, clientX: 100, clientY: 100 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 150, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 150, clientY: 150, bubbles: true }))

    const elements = useCanvasStore.getState().elements
    const s2 = elements.find((e) => e.id === 's2')!
    expect(s2.x).toBe(450)
    expect(s2.y).toBe(150)
  })
})
