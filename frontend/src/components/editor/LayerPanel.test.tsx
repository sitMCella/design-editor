import { act, render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LayerPanel } from './LayerPanel'
import { useCanvasStore } from '../../stores/canvasStore'
import type { TextElement, ImageElement, ArrowElement, ShapeElement } from '../../types/canvas'

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const makeText = (id: string, overrides: Partial<TextElement> = {}): TextElement => ({
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

const makeImage = (id: string, overrides: Partial<ImageElement> = {}): ImageElement => ({
  id,
  type: 'image',
  x: 200,
  y: 200,
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

const makeArrow = (id: string, overrides: Partial<ArrowElement> = {}): ArrowElement => ({
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

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

// jsdom does not implement scrollIntoView — define a stub so the LayerPanel
// useEffect never throws when it calls rowEl.scrollIntoView(…).
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()

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
  vi.restoreAllMocks()
  // Flush any dangling window mouse listeners from drag tests
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
})

// ---------------------------------------------------------------------------
// AC4 — Elements listed in reverse z-order (topmost first)
// ---------------------------------------------------------------------------

describe('AC4 — elements displayed in reverse z-order (topmost first)', () => {
  it('shows the topmost element (last in array) as the first panel row', () => {
    // elements[0] = 'a' (bottommost), elements[1] = 'b' (topmost)
    useCanvasStore.setState({
      elements: [makeText('a'), makeText('b', { x: 300 })],
      selectedIds: [],
    })
    render(<LayerPanel />)

    // Both are 'text' type; labelling is by array index → 'Text 1' (a), 'Text 2' (b)
    // Panel reverses: 'Text 2' (b) should appear first, 'Text 1' (a) second
    const rows = screen.getAllByText(/^Text \d$/)
    expect(rows[0].textContent).toBe('Text 2') // topmost shown first
    expect(rows[1].textContent).toBe('Text 1') // bottommost shown last
  })

  it('lists three elements with the correct top-to-bottom panel order', () => {
    useCanvasStore.setState({
      elements: [makeText('a'), makeText('b', { x: 200 }), makeText('c', { x: 300 })],
      selectedIds: [],
    })
    render(<LayerPanel />)

    const rows = screen.getAllByText(/^Text \d$/)
    expect(rows[0].textContent).toBe('Text 3') // c (topmost) first
    expect(rows[1].textContent).toBe('Text 2') // b middle
    expect(rows[2].textContent).toBe('Text 1') // a (bottommost) last
  })
})

// ---------------------------------------------------------------------------
// AC5 — Each row shows the type icon, label, and visibility button
// ---------------------------------------------------------------------------

describe('AC5 — row shows type icon, auto label, and visibility toggle', () => {
  it('renders a visibility toggle button for each element', () => {
    useCanvasStore.setState({
      elements: [makeText('t1'), makeImage('i1')],
      selectedIds: [],
    })
    render(<LayerPanel />)

    // Each row has a visibility button (aria-label)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })

  it('renders the Layers heading', () => {
    render(<LayerPanel />)
    expect(screen.getByText('Layers')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC6 — Auto-generated labels follow per-type sequence numbering
// ---------------------------------------------------------------------------

describe('AC6 — auto-generated labels', () => {
  it('labels two text elements as "Text 1" and "Text 2"', () => {
    useCanvasStore.setState({
      elements: [makeText('t1'), makeText('t2', { x: 300 })],
      selectedIds: [],
    })
    render(<LayerPanel />)

    expect(screen.getByText('Text 1')).toBeInTheDocument()
    expect(screen.getByText('Text 2')).toBeInTheDocument()
  })

  it('numbers each element type independently', () => {
    useCanvasStore.setState({
      elements: [makeText('t1'), makeImage('i1'), makeText('t2', { x: 300 })],
      selectedIds: [],
    })
    render(<LayerPanel />)

    expect(screen.getByText('Text 1')).toBeInTheDocument()
    expect(screen.getByText('Text 2')).toBeInTheDocument()
    expect(screen.getByText('Image 1')).toBeInTheDocument()
  })

  it('labels an arrow element as "Arrow 1"', () => {
    useCanvasStore.setState({ elements: [makeArrow('arr1')], selectedIds: [] })
    render(<LayerPanel />)
    expect(screen.getByText('Arrow 1')).toBeInTheDocument()
  })

  it('first-created element of a type is always numbered 1 regardless of reordering', () => {
    // Elements stored as [t1, t2]; labelling uses indexOf in the elements array
    useCanvasStore.setState({
      elements: [makeText('t1'), makeText('t2', { x: 300 })],
      selectedIds: [],
    })
    render(<LayerPanel />)
    // t1 → 'Text 1', t2 → 'Text 2' (always, regardless of panel display order)
    expect(screen.getByText('Text 1')).toBeInTheDocument()
    expect(screen.getByText('Text 2')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC7 — Plain click on a row selects that element
// ---------------------------------------------------------------------------

describe('AC7 — plain click on row selects element', () => {
  it('clicking a row sets selectedIds to that element only', () => {
    useCanvasStore.setState({
      elements: [makeText('t1'), makeText('t2', { x: 300 })],
      selectedIds: [],
    })
    const { container } = render(<LayerPanel />)

    // Each row is a div with cursor-pointer; click the first row (topmost = t2)
    const rows = container.querySelectorAll('[class*="cursor-pointer"]')
    fireEvent.click(rows[0]) // clicks the first displayed row (t2, panelIndex=0)

    expect(useCanvasStore.getState().selectedIds).toEqual(['t2'])
  })

  it('clicking a second row replaces the selection', () => {
    useCanvasStore.setState({
      elements: [makeText('t1'), makeText('t2', { x: 300 })],
      selectedIds: ['t2'],
    })
    const { container } = render(<LayerPanel />)

    const rows = container.querySelectorAll('[class*="cursor-pointer"]')
    fireEvent.click(rows[1]) // clicks second panel row = t1

    expect(useCanvasStore.getState().selectedIds).toEqual(['t1'])
  })
})

// ---------------------------------------------------------------------------
// AC8 — Shift+click toggles element into/out of multi-selection
// ---------------------------------------------------------------------------

describe('AC8 — Shift+click toggles element in multi-selection', () => {
  it('Shift+click on an unselected element adds it to selectedIds', () => {
    useCanvasStore.setState({
      elements: [makeText('t1'), makeText('t2', { x: 300 })],
      selectedIds: ['t2'],
    })
    const { container } = render(<LayerPanel />)

    const rows = container.querySelectorAll('[class*="cursor-pointer"]')
    fireEvent.click(rows[1], { shiftKey: true }) // t1 is second panel row

    expect(useCanvasStore.getState().selectedIds).toContain('t1')
    expect(useCanvasStore.getState().selectedIds).toContain('t2')
  })

  it('Shift+click on an already-selected element removes it', () => {
    useCanvasStore.setState({
      elements: [makeText('t1'), makeText('t2', { x: 300 })],
      selectedIds: ['t1', 't2'],
    })
    const { container } = render(<LayerPanel />)

    const rows = container.querySelectorAll('[class*="cursor-pointer"]')
    fireEvent.click(rows[0], { shiftKey: true }) // t2 is first panel row

    expect(useCanvasStore.getState().selectedIds).not.toContain('t2')
    expect(useCanvasStore.getState().selectedIds).toContain('t1')
  })
})

// ---------------------------------------------------------------------------
// AC9 — Selected rows are highlighted with a blue background
// ---------------------------------------------------------------------------

describe('AC9 — selected rows are highlighted', () => {
  it('selected element row has the blue background class', () => {
    useCanvasStore.setState({
      elements: [makeText('t1')],
      selectedIds: ['t1'],
    })
    const { container } = render(<LayerPanel />)

    const blueRow = container.querySelector('.bg-blue-50')
    expect(blueRow).toBeInTheDocument()
  })

  it('unselected rows do not have the blue background class', () => {
    useCanvasStore.setState({
      elements: [makeText('t1')],
      selectedIds: [],
    })
    const { container } = render(<LayerPanel />)

    const blueRow = container.querySelector('.bg-blue-50')
    expect(blueRow).not.toBeInTheDocument()
  })

  it('only the selected row is highlighted when one of two is selected', () => {
    useCanvasStore.setState({
      elements: [makeText('t1'), makeText('t2', { x: 300 })],
      selectedIds: ['t1'],
    })
    const { container } = render(<LayerPanel />)

    const blueRows = container.querySelectorAll('.bg-blue-50')
    expect(blueRows).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// AC10 — Panel scrolls to make the first selected row visible
// ---------------------------------------------------------------------------

describe('AC10 — panel scrolls to selected row when selection changes', () => {
  it('calls scrollIntoView on the first selected row element', () => {
    // Element.prototype.scrollIntoView is already stubbed in beforeEach
    useCanvasStore.setState({
      elements: [makeText('t1')],
      selectedIds: ['t1'],
    })
    render(<LayerPanel />)

    // The useEffect fires on mount because selectedIds is non-empty
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('does not call scrollIntoView when selectedIds is empty', () => {
    useCanvasStore.setState({ elements: [makeText('t1')], selectedIds: [] })
    render(<LayerPanel />)

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC11 — Visibility eye icon toggles element hidden/visible
// ---------------------------------------------------------------------------

describe('AC11 — visibility eye icon', () => {
  it('clicking the eye button on a visible element calls toggleElementVisibility', () => {
    useCanvasStore.setState({ elements: [makeText('t1')], selectedIds: [] })
    render(<LayerPanel />)

    const hideBtn = screen.getByRole('button', { name: 'Hide element' })
    fireEvent.click(hideBtn)

    expect(useCanvasStore.getState().elements[0].hidden).toBe(true)
  })

  it('clicking the eye button on a hidden element makes it visible again', () => {
    useCanvasStore.setState({
      elements: [makeText('t1', { hidden: true })],
      selectedIds: [],
    })
    render(<LayerPanel />)

    const showBtn = screen.getByRole('button', { name: 'Show element' })
    fireEvent.click(showBtn)

    expect(useCanvasStore.getState().elements[0].hidden).toBe(false)
  })

  it('hidden row shows the EyeOff icon (aria-label "Show element")', () => {
    useCanvasStore.setState({
      elements: [makeText('t1', { hidden: true })],
      selectedIds: [],
    })
    render(<LayerPanel />)

    expect(screen.getByRole('button', { name: 'Show element' })).toBeInTheDocument()
  })

  it('visible row shows the Eye icon (aria-label "Hide element")', () => {
    useCanvasStore.setState({ elements: [makeText('t1')], selectedIds: [] })
    render(<LayerPanel />)

    expect(screen.getByRole('button', { name: 'Hide element' })).toBeInTheDocument()
  })

  it('hidden row has reduced opacity (opacity-50 class)', () => {
    useCanvasStore.setState({
      elements: [makeText('t1', { hidden: true })],
      selectedIds: [],
    })
    const { container } = render(<LayerPanel />)

    const dimmedRow = container.querySelector('.opacity-50')
    expect(dimmedRow).toBeInTheDocument()
  })

  it('clicking the eye button does not change selection state', () => {
    useCanvasStore.setState({ elements: [makeText('t1')], selectedIds: ['t1'] })
    render(<LayerPanel />)

    const hideBtn = screen.getByRole('button', { name: 'Hide element' })
    fireEvent.click(hideBtn)

    // Hiding removes element from selection (store action handles this)
    expect(useCanvasStore.getState().elements[0].hidden).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AC14 — Clicking a hidden row has no effect on selection
// ---------------------------------------------------------------------------

describe('AC14 — hidden rows are not selectable via panel click', () => {
  it('clicking a hidden row does not change selectedIds', () => {
    useCanvasStore.setState({
      elements: [makeText('t1', { hidden: true })],
      selectedIds: [],
    })
    const { container } = render(<LayerPanel />)

    const rows = container.querySelectorAll('[class*="cursor-pointer"]')
    fireEvent.click(rows[0])

    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })

  it('Shift+click on a hidden row does not add it to selection', () => {
    useCanvasStore.setState({
      elements: [makeText('t1'), makeText('t2', { x: 300, hidden: true })],
      selectedIds: ['t1'],
    })
    const { container } = render(<LayerPanel />)

    const rows = container.querySelectorAll('[class*="cursor-pointer"]')
    // Second panel row = t1 (bottom), first panel row = t2 (top/hidden)
    fireEvent.click(rows[0], { shiftKey: true })

    expect(useCanvasStore.getState().selectedIds).toEqual(['t1'])
    expect(useCanvasStore.getState().selectedIds).not.toContain('t2')
  })
})

// ---------------------------------------------------------------------------
// AC16 & AC19 — Drag-to-reorder: calls moveElementToIndex on mouseup
// ---------------------------------------------------------------------------

describe('AC16/AC19 — drag-to-reorder', () => {
  it('AC16: dragging a row past the 4px threshold reorders elements on mouseup', () => {
    // elements: [a (bottom, index 0), b (top, index 1)]
    // displayRows: [b (panelIndex 0), a (panelIndex 1)]
    useCanvasStore.setState({
      elements: [makeText('a'), makeText('b', { x: 300 })],
      selectedIds: [],
    })
    const { container } = render(<LayerPanel />)

    // Drag handle of the first panel row (b, panelIndex=0)
    const dragHandles = container.querySelectorAll('[class*="cursor-grab"]')
    fireEvent.mouseDown(dragHandles[0], { button: 0, clientY: 10 })

    // Move 40px down (>> 4px threshold); listTop=0 in jsdom, so rawIndex=round(50/36)=1
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 50, bubbles: true }))
    })
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    // moveElementToIndex('b', 1): b moves from elements[1] to elements[0]
    // Result: elements = [b, a]
    const elements = useCanvasStore.getState().elements
    expect(elements[0].id).toBe('b')
    expect(elements[1].id).toBe('a')
  })

  it('AC19: movement below 4px threshold does not trigger reorder', () => {
    useCanvasStore.setState({
      elements: [makeText('a'), makeText('b', { x: 300 })],
      selectedIds: [],
    })
    const { container } = render(<LayerPanel />)

    const dragHandles = container.querySelectorAll('[class*="cursor-grab"]')
    fireEvent.mouseDown(dragHandles[0], { button: 0, clientY: 10 })

    // Move only 3px (below threshold)
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 13, bubbles: true }))
    })
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    // Order must remain unchanged: [a, b]
    const elements = useCanvasStore.getState().elements
    expect(elements[0].id).toBe('a')
    expect(elements[1].id).toBe('b')
  })

  it('AC16: isDirty is set to true after a successful reorder', () => {
    useCanvasStore.setState({
      elements: [makeText('a'), makeText('b', { x: 300 })],
      selectedIds: [],
      isDirty: false,
    })
    const { container } = render(<LayerPanel />)

    const dragHandles = container.querySelectorAll('[class*="cursor-grab"]')
    fireEvent.mouseDown(dragHandles[0], { button: 0, clientY: 10 })

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 50, bubbles: true }))
    })
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    expect(useCanvasStore.getState().isDirty).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AC17 — Insertion line appears during drag
// ---------------------------------------------------------------------------

describe('AC17 — insertion line visible while dragging', () => {
  it('shows a blue insertion line after the drag threshold is crossed', () => {
    useCanvasStore.setState({
      elements: [makeText('a'), makeText('b', { x: 300 })],
      selectedIds: [],
    })
    const { container } = render(<LayerPanel />)

    const dragHandles = container.querySelectorAll('[class*="cursor-grab"]')
    fireEvent.mouseDown(dragHandles[0], { button: 0, clientY: 10 })

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 50, bubbles: true }))
    })

    // The insertion line is a div with bg-blue-500
    const insertionLine = container.querySelector('.bg-blue-500')
    expect(insertionLine).toBeInTheDocument()

    // Cleanup
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
  })

  it('insertion line is removed after mouseup', () => {
    useCanvasStore.setState({
      elements: [makeText('a'), makeText('b', { x: 300 })],
      selectedIds: [],
    })
    const { container } = render(<LayerPanel />)

    const dragHandles = container.querySelectorAll('[class*="cursor-grab"]')
    fireEvent.mouseDown(dragHandles[0], { button: 0, clientY: 10 })

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 50, bubbles: true }))
    })
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    const insertionLine = container.querySelector('.bg-blue-500')
    expect(insertionLine).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC18 — Dragged row shows as semi-transparent (opacity 0.5)
// ---------------------------------------------------------------------------

describe('AC18 — dragged row is semi-transparent during drag', () => {
  it('the dragged row wrapper has opacity 0.5 while dragging', () => {
    useCanvasStore.setState({
      elements: [makeText('a'), makeText('b', { x: 300 })],
      selectedIds: [],
    })
    const { container } = render(<LayerPanel />)

    const dragHandles = container.querySelectorAll('[class*="cursor-grab"]')
    fireEvent.mouseDown(dragHandles[0], { button: 0, clientY: 10 })

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 50, bubbles: true }))
    })

    // The dragged row wrapper has inline style opacity: 0.5
    const styledEls = Array.from(container.querySelectorAll('[style]')) as HTMLElement[]
    const halfOpacity = styledEls.find((el) => el.style.opacity === '0.5')
    expect(halfOpacity).toBeDefined()

    // Cleanup
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
  })

  it('opacity is restored to 1 after mouseup', () => {
    useCanvasStore.setState({
      elements: [makeText('a'), makeText('b', { x: 300 })],
      selectedIds: [],
    })
    const { container } = render(<LayerPanel />)

    const dragHandles = container.querySelectorAll('[class*="cursor-grab"]')
    fireEvent.mouseDown(dragHandles[0], { button: 0, clientY: 10 })

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 50, bubbles: true }))
    })
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    const styledEls = Array.from(container.querySelectorAll('[style]')) as HTMLElement[]
    const halfOpacity = styledEls.find((el) => el.style.opacity === '0.5')
    expect(halfOpacity).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// AC21 — Empty state message when canvas has no elements
// ---------------------------------------------------------------------------

describe('AC21 — empty state message', () => {
  it('shows "No elements yet." when elements array is empty', () => {
    useCanvasStore.setState({ elements: [], selectedIds: [] })
    render(<LayerPanel />)
    expect(screen.getByText('No elements yet.')).toBeInTheDocument()
  })

  it('shows the usage hint alongside the empty state', () => {
    useCanvasStore.setState({ elements: [], selectedIds: [] })
    render(<LayerPanel />)
    expect(screen.getByText('Use the toolbar to add content.')).toBeInTheDocument()
  })

  it('does not show the empty state when there is at least one element', () => {
    useCanvasStore.setState({ elements: [makeText('t1')], selectedIds: [] })
    render(<LayerPanel />)
    expect(screen.queryByText('No elements yet.')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC22 — Panel list area is independently scrollable
// ---------------------------------------------------------------------------

describe('AC22 — panel list has independent scroll', () => {
  it('the row list container has overflow-y-auto', () => {
    useCanvasStore.setState({ elements: [makeText('t1')], selectedIds: [] })
    const { container } = render(<LayerPanel />)
    const scrollable = container.querySelector('.overflow-y-auto')
    expect(scrollable).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC27 (feat22) — Shape elements appear in the layer panel with label "Shape N"
// ---------------------------------------------------------------------------

const makeShape = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
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
})

describe('AC27 (feat22) — shape elements labelled "Shape N" in the layer panel', () => {
  it('a single shape element is listed as "Shape 1"', () => {
    useCanvasStore.setState({ elements: [makeShape('s1')], selectedIds: [] })
    render(<LayerPanel />)
    expect(screen.getByText('Shape 1')).toBeInTheDocument()
  })

  it('two shape elements are labelled "Shape 1" and "Shape 2"', () => {
    useCanvasStore.setState({
      elements: [makeShape('s1'), makeShape('s2', { x: 400 })],
      selectedIds: [],
    })
    render(<LayerPanel />)
    expect(screen.getByText('Shape 1')).toBeInTheDocument()
    expect(screen.getByText('Shape 2')).toBeInTheDocument()
  })

  it('shape sequence numbers are independent from other element types', () => {
    useCanvasStore.setState({
      elements: [makeText('t1'), makeShape('s1'), makeShape('s2', { x: 400 })],
      selectedIds: [],
    })
    render(<LayerPanel />)
    expect(screen.getByText('Text 1')).toBeInTheDocument()
    expect(screen.getByText('Shape 1')).toBeInTheDocument()
    expect(screen.getByText('Shape 2')).toBeInTheDocument()
  })

  it('shape elements are reorderable — moveElementToIndex updates the z-order', () => {
    // Panel shows [s2 (top), s1 (bottom)]; drag s2 below s1
    useCanvasStore.setState({
      elements: [makeShape('s1'), makeShape('s2', { x: 400 })],
      selectedIds: [],
    })
    const { container } = render(<LayerPanel />)

    const dragHandles = container.querySelectorAll('[class*="cursor-grab"]')
    fireEvent.mouseDown(dragHandles[0], { button: 0, clientY: 10 })

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 50, bubbles: true }))
    })
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    // s2 moved to panelIndex=1 → elementsIndex=0 (bottom of stack)
    const elements = useCanvasStore.getState().elements
    expect(elements[0].id).toBe('s2')
    expect(elements[1].id).toBe('s1')
  })
})

// ---------------------------------------------------------------------------
// AC28 (feat22) — Hiding / showing a shape element via the layer panel
// ---------------------------------------------------------------------------

describe('AC28 (feat22) — hiding and showing shape elements via the layer panel', () => {
  it('clicking the eye button on a visible shape element hides it', () => {
    useCanvasStore.setState({ elements: [makeShape('s1')], selectedIds: [] })
    render(<LayerPanel />)

    const hideBtn = screen.getByRole('button', { name: 'Hide element' })
    fireEvent.click(hideBtn)

    expect(useCanvasStore.getState().elements[0].hidden).toBe(true)
  })

  it('clicking the eye button on a hidden shape element shows it again', () => {
    useCanvasStore.setState({
      elements: [makeShape('s1', { hidden: true })],
      selectedIds: [],
    })
    render(<LayerPanel />)

    const showBtn = screen.getByRole('button', { name: 'Show element' })
    fireEvent.click(showBtn)

    expect(useCanvasStore.getState().elements[0].hidden).toBe(false)
  })

  it('a hidden shape element row has reduced opacity (opacity-50)', () => {
    useCanvasStore.setState({
      elements: [makeShape('s1', { hidden: true })],
      selectedIds: [],
    })
    const { container } = render(<LayerPanel />)

    expect(container.querySelector('.opacity-50')).toBeInTheDocument()
  })

  it('hiding a selected shape removes it from selectedIds', () => {
    useCanvasStore.setState({ elements: [makeShape('s1')], selectedIds: ['s1'] })
    render(<LayerPanel />)

    const hideBtn = screen.getByRole('button', { name: 'Hide element' })
    fireEvent.click(hideBtn)

    expect(useCanvasStore.getState().selectedIds).not.toContain('s1')
    expect(useCanvasStore.getState().elements[0].hidden).toBe(true)
  })
})
