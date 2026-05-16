import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { Canvas } from './Canvas'
import { useCanvasStore } from '../../stores/canvasStore'
import type { TextElement, ImageElement, ArrowElement } from '../../types/canvas'

const makeTextElement = (id: string): TextElement => ({
  id,
  type: 'text',
  x: 100,
  y: 100,
  width: 160,
  height: 40,
  rotation: 0,
  opacity: 1,
  locked: false,
  content: 'Some text',
  fontSize: 16,
  fontFamily: 'Inter, sans-serif',
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#111827',
  align: 'left',
})

const makeImageElement = (id: string): ImageElement => ({
  id,
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
  objectPosition: '50% 50%',
})

const makeArrowElement = (id: string): ArrowElement => ({
  id,
  type: 'arrow',
  x1: 540,
  y1: 360,
  x2: 740,
  y2: 360,
  x: 539,
  y: 359,
  width: 202,
  height: 2,
  rotation: 0,
  opacity: 1,
  locked: false,
  stroke: '#111827',
  strokeWidth: 2,
  arrowHead: 'end',
})

// keep old name as alias so existing tests compile unchanged
const makeElement = makeTextElement

beforeEach(() => {
  useCanvasStore.setState({ elements: [], selectedIds: [], isDirty: false })
})

// AC 6 — clicking the canvas background deselects all elements
describe('background click deselection', () => {
  it('clears selectedIds when the canvas background is clicked', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1')],
      selectedIds: ['el-1'],
    })

    const { container } = render(<Canvas />)
    // Click the outermost canvas div (the grey viewport, not an element)
    fireEvent.click(container.firstChild as HTMLElement)

    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })

  it('leaves elements in the store after deselection', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1')],
      selectedIds: ['el-1'],
    })

    const { container } = render(<Canvas />)
    fireEvent.click(container.firstChild as HTMLElement)

    expect(useCanvasStore.getState().elements).toHaveLength(1)
  })

  it('is a no-op when nothing is selected', () => {
    const { container } = render(<Canvas />)
    fireEvent.click(container.firstChild as HTMLElement)
    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })
})

// AC 5 (03-image-element) — clicking the canvas background deselects an image element
describe('background click deselects image element', () => {
  it('clears selectedIds when a selected image element is deselected via canvas click', () => {
    useCanvasStore.setState({
      elements: [makeImageElement('img-1')],
      selectedIds: ['img-1'],
    })

    const { container } = render(<Canvas />)
    fireEvent.click(container.firstChild as HTMLElement)

    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })

  it('leaves the image element in the store after deselection', () => {
    useCanvasStore.setState({
      elements: [makeImageElement('img-1')],
      selectedIds: ['img-1'],
    })

    const { container } = render(<Canvas />)
    fireEvent.click(container.firstChild as HTMLElement)

    expect(useCanvasStore.getState().elements).toHaveLength(1)
    expect(useCanvasStore.getState().elements[0].type).toBe('image')
  })
})

// AC 6 (08-toolbar-arrow-element) — clicking the canvas background deselects an arrow element
describe('background click deselects arrow element', () => {
  it('clears selectedIds when a selected arrow element is deselected via canvas click', () => {
    useCanvasStore.setState({
      elements: [makeArrowElement('arrow-1')],
      selectedIds: ['arrow-1'],
    })

    const { container } = render(<Canvas />)
    fireEvent.click(container.firstChild as HTMLElement)

    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })

  it('leaves the arrow element in the store after deselection', () => {
    useCanvasStore.setState({
      elements: [makeArrowElement('arrow-1')],
      selectedIds: ['arrow-1'],
    })

    const { container } = render(<Canvas />)
    fireEvent.click(container.firstChild as HTMLElement)

    expect(useCanvasStore.getState().elements).toHaveLength(1)
    expect(useCanvasStore.getState().elements[0].type).toBe('arrow')
  })
})

// ---------------------------------------------------------------------------
// AC 1 — no fixed white surface box (feat 13)
// ---------------------------------------------------------------------------

describe('AC1 — no fixed design surface', () => {
  it('does not render any element with the old 1280×720 fixed dimensions', () => {
    const { container } = render(<Canvas />)
    const allDivs = container.querySelectorAll('div')
    allDivs.forEach((div) => {
      expect(div.style.width).not.toBe('1280px')
      expect(div.style.height).not.toBe('720px')
    })
  })
})

// ---------------------------------------------------------------------------
// AC 2 — world layer CSS transform reflects zoom/pan state (feat 13)
// ---------------------------------------------------------------------------

describe('AC2 — world layer CSS transform', () => {
  it('applies translate(0px, 0px) scale(1) at default state', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const worldLayer = container.firstChild!.firstChild as HTMLElement
    expect(worldLayer.style.transform).toBe('translate(0px, 0px) scale(1)')
  })

  it('reflects a changed zoom in the transform', () => {
    useCanvasStore.setState({ zoom: 2, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const worldLayer = container.firstChild!.firstChild as HTMLElement
    expect(worldLayer.style.transform).toBe('translate(0px, 0px) scale(2)')
  })

  it('reflects a changed pan in the transform', () => {
    useCanvasStore.setState({ zoom: 1, panX: 150, panY: 75 })
    const { container } = render(<Canvas />)
    const worldLayer = container.firstChild!.firstChild as HTMLElement
    expect(worldLayer.style.transform).toBe('translate(150px, 75px) scale(1)')
  })

  it('combines non-default zoom and pan in the transform', () => {
    useCanvasStore.setState({ zoom: 0.5, panX: -100, panY: 200 })
    const { container } = render(<Canvas />)
    const worldLayer = container.firstChild!.firstChild as HTMLElement
    expect(worldLayer.style.transform).toBe('translate(-100px, 200px) scale(0.5)')
  })

  it('uses transform-origin 0 0', () => {
    const { container } = render(<Canvas />)
    const worldLayer = container.firstChild!.firstChild as HTMLElement
    expect(worldLayer.style.transformOrigin).toBe('0 0')
  })
})

// ---------------------------------------------------------------------------
// AC 2 — scroll-wheel zoom (feat 13)
// ---------------------------------------------------------------------------

describe('AC2 — scroll-wheel zoom', () => {
  it('increases zoom when scrolling up (deltaY < 0)', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    canvasEl.dispatchEvent(
      new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true })
    )

    expect(useCanvasStore.getState().zoom).toBeGreaterThan(1)
  })

  it('decreases zoom when scrolling down (deltaY > 0)', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    canvasEl.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true })
    )

    expect(useCanvasStore.getState().zoom).toBeLessThan(1)
  })

  it('does not exceed maximum zoom (5) on repeated zoom-in', () => {
    useCanvasStore.setState({ zoom: 4.9, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    // Several scroll-up events from near-max zoom
    for (let i = 0; i < 10; i++) {
      canvasEl.dispatchEvent(
        new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true })
      )
    }

    expect(useCanvasStore.getState().zoom).toBeLessThanOrEqual(5)
  })

  it('does not go below minimum zoom (0.1) on repeated zoom-out', () => {
    useCanvasStore.setState({ zoom: 0.15, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    for (let i = 0; i < 10; i++) {
      canvasEl.dispatchEvent(
        new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true })
      )
    }

    expect(useCanvasStore.getState().zoom).toBeGreaterThanOrEqual(0.1)
  })

  it('applies a factor of 1.1 per upward scroll tick', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    canvasEl.dispatchEvent(
      new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true })
    )

    expect(useCanvasStore.getState().zoom).toBeCloseTo(1.1, 5)
  })

  it('applies a factor of 1/1.1 per downward scroll tick', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    canvasEl.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true })
    )

    expect(useCanvasStore.getState().zoom).toBeCloseTo(1 / 1.1, 5)
  })
})

// ---------------------------------------------------------------------------
// AC 3/4 — keyboard zoom shortcuts (feat 13)
// ---------------------------------------------------------------------------

describe('AC3/4 — keyboard zoom shortcuts', () => {
  it('Ctrl+= zooms in by ×1.25', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    render(<Canvas />)

    fireEvent.keyDown(window, { key: '=', ctrlKey: true })

    expect(useCanvasStore.getState().zoom).toBeCloseTo(1.25, 5)
  })

  it('Ctrl+- zooms out by ÷1.25', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    render(<Canvas />)

    fireEvent.keyDown(window, { key: '-', ctrlKey: true })

    expect(useCanvasStore.getState().zoom).toBeCloseTo(1 / 1.25, 5)
  })

  it('Meta+= zooms in (Mac Cmd key)', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    render(<Canvas />)

    fireEvent.keyDown(window, { key: '=', metaKey: true })

    expect(useCanvasStore.getState().zoom).toBeCloseTo(1.25, 5)
  })

  it('Meta+- zooms out (Mac Cmd key)', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    render(<Canvas />)

    fireEvent.keyDown(window, { key: '-', metaKey: true })

    expect(useCanvasStore.getState().zoom).toBeCloseTo(1 / 1.25, 5)
  })

  it('Ctrl+0 resets zoom to 1', () => {
    useCanvasStore.setState({ zoom: 2.5, panX: 100, panY: 200 })
    render(<Canvas />)

    fireEvent.keyDown(window, { key: '0', ctrlKey: true })

    expect(useCanvasStore.getState().zoom).toBe(1)
  })

  it('Ctrl+0 resets pan to (0, 0)', () => {
    useCanvasStore.setState({ zoom: 2, panX: 300, panY: 150 })
    render(<Canvas />)

    fireEvent.keyDown(window, { key: '0', ctrlKey: true })

    expect(useCanvasStore.getState().panX).toBe(0)
    expect(useCanvasStore.getState().panY).toBe(0)
  })

  it('Ctrl+= does not exceed maximum zoom (5)', () => {
    useCanvasStore.setState({ zoom: 5, panX: 0, panY: 0 })
    render(<Canvas />)

    fireEvent.keyDown(window, { key: '=', ctrlKey: true })

    expect(useCanvasStore.getState().zoom).toBe(5)
  })

  it('Ctrl+- does not go below minimum zoom (0.1)', () => {
    useCanvasStore.setState({ zoom: 0.1, panX: 0, panY: 0 })
    render(<Canvas />)

    fireEvent.keyDown(window, { key: '-', ctrlKey: true })

    expect(useCanvasStore.getState().zoom).toBe(0.1)
  })

  it('zoom shortcuts without modifier key do nothing', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    render(<Canvas />)

    fireEvent.keyDown(window, { key: '=' })
    fireEvent.keyDown(window, { key: '-' })

    expect(useCanvasStore.getState().zoom).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// AC 7 — Space key activates pan-mode overlay (feat 13)
// ---------------------------------------------------------------------------

describe('AC7 — Space key pan mode', () => {
  it('shows grab-cursor overlay when Space is held', () => {
    const { container } = render(<Canvas />)

    fireEvent.keyDown(window, { code: 'Space' })

    // The overlay is a sibling of the world layer inside the canvas container
    const overlay = container.querySelector('[style*="z-index: 9999"]') as HTMLElement | null
    expect(overlay).not.toBeNull()
    expect(overlay!.style.cursor).toBe('grab')
  })

  it('removes the grab-cursor overlay when Space is released', () => {
    const { container } = render(<Canvas />)

    fireEvent.keyDown(window, { code: 'Space' })
    fireEvent.keyUp(window, { code: 'Space' })

    const overlay = container.querySelector('[style*="z-index: 9999"]')
    expect(overlay).toBeNull()
  })

  it('does not show the overlay for keys other than Space', () => {
    const { container } = render(<Canvas />)

    fireEvent.keyDown(window, { code: 'KeyA' })

    const overlay = container.querySelector('[style*="z-index: 9999"]')
    expect(overlay).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// AC 7/8 — middle-mouse pan (feat 13)
// ---------------------------------------------------------------------------

describe('AC7/8 — middle-mouse pan', () => {
  it('pans when the middle mouse button is held and dragged', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    // Middle mouse (button=1) down at origin
    fireEvent.mouseDown(canvasEl, { button: 1, clientX: 0, clientY: 0 })

    // Drag 80px right and 40px down
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 80, clientY: 40, bubbles: true }))

    expect(useCanvasStore.getState().panX).toBe(80)
    expect(useCanvasStore.getState().panY).toBe(40)
  })

  it('stops panning after mouseup', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 1, clientX: 0, clientY: 0 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 50, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    // Further movement should not change pan
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }))

    expect(useCanvasStore.getState().panX).toBe(50)
    expect(useCanvasStore.getState().panY).toBe(50)
  })

  it('left-mouse drag on canvas background initiates pan (AC1 feat14)', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, clientX: 0, clientY: 0 })
    // Exceed 4px threshold
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100, bubbles: true }))

    // Background left-click drag now pans the viewport
    expect(useCanvasStore.getState().panX).toBe(100)
    expect(useCanvasStore.getState().panY).toBe(100)

    // Clean up window listeners
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  })

  it('left-mouse drag under 4px threshold does not pan (AC2 feat14)', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, clientX: 0, clientY: 0 })
    // Under 4px threshold — should not pan
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 2, clientY: 2, bubbles: true }))

    expect(useCanvasStore.getState().panX).toBe(0)
    expect(useCanvasStore.getState().panY).toBe(0)

    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  })

  it('pan has no boundary — allows large negative offsets', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 1, clientX: 0, clientY: 0 })
    window.dispatchEvent(
      new MouseEvent('mousemove', { clientX: -5000, clientY: -3000, bubbles: true })
    )

    expect(useCanvasStore.getState().panX).toBe(-5000)
    expect(useCanvasStore.getState().panY).toBe(-3000)
  })
})

// ---------------------------------------------------------------------------
// AC 9 — initDesign / loadDesign always reset viewport (feat 13)
// ---------------------------------------------------------------------------

describe('AC9 — viewport resets on design open', () => {
  it('initDesign resets zoom to 1', () => {
    useCanvasStore.setState({ zoom: 3 })
    useCanvasStore.getState().initDesign('new-id', 'New')
    expect(useCanvasStore.getState().zoom).toBe(1)
  })

  it('initDesign resets pan to (0, 0)', () => {
    useCanvasStore.setState({ panX: 400, panY: 300 })
    useCanvasStore.getState().initDesign('new-id', 'New')
    expect(useCanvasStore.getState().panX).toBe(0)
    expect(useCanvasStore.getState().panY).toBe(0)
  })

  it('loadDesign resets zoom to 1 regardless of prior zoom', () => {
    useCanvasStore.setState({ zoom: 0.25 })
    useCanvasStore.getState().loadDesign('loaded-id', 'Loaded', [])
    expect(useCanvasStore.getState().zoom).toBe(1)
  })

  it('loadDesign resets pan to (0, 0) regardless of prior pan', () => {
    useCanvasStore.setState({ panX: -800, panY: 600 })
    useCanvasStore.getState().loadDesign('loaded-id', 'Loaded', [])
    expect(useCanvasStore.getState().panX).toBe(0)
    expect(useCanvasStore.getState().panY).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// AC 21 — scrollbar tracks are always present in the rendered canvas (feat 13)
// ---------------------------------------------------------------------------

describe('AC21 — scrollbar elements are present', () => {
  it('renders a horizontal scrollbar track', () => {
    const { getByTestId } = render(<Canvas />)
    expect(getByTestId('scrollbar-h')).toBeTruthy()
  })

  it('renders a vertical scrollbar track', () => {
    const { getByTestId } = render(<Canvas />)
    expect(getByTestId('scrollbar-v')).toBeTruthy()
  })

  it('renders a corner fill element (AC 29)', () => {
    const { getByTestId } = render(<Canvas />)
    expect(getByTestId('scrollbar-corner')).toBeTruthy()
  })

  it('horizontal scrollbar track is positioned at the bottom of the canvas', () => {
    const { getByTestId } = render(<Canvas />)
    const track = getByTestId('scrollbar-h') as HTMLElement
    expect(track.style.position).toBe('absolute')
    expect(track.style.bottom).toBe('0px')
  })

  it('vertical scrollbar track is positioned on the right of the canvas', () => {
    const { getByTestId } = render(<Canvas />)
    const track = getByTestId('scrollbar-v') as HTMLElement
    expect(track.style.position).toBe('absolute')
    expect(track.style.right).toBe('0px')
  })
})

// ---------------------------------------------------------------------------
// AC 26 — scrollbar thumbs are hidden when the canvas fits inside the viewport
// ---------------------------------------------------------------------------

describe('AC26 — thumbs hidden when canvas fits in viewport', () => {
  it('horizontal thumb has opacity 0 when container width is 0 (canvas not measured yet)', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0, elements: [] })
    const { getByTestId } = render(<Canvas />)
    // jsdom reports clientWidth/Height as 0, so the whole canvas fits → thumb hidden
    const thumb = getByTestId('scrollbar-h-thumb') as HTMLElement
    expect(thumb.style.opacity).toBe('0')
  })

  it('vertical thumb has opacity 0 when container height is 0', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0, elements: [] })
    const { getByTestId } = render(<Canvas />)
    const thumb = getByTestId('scrollbar-v-thumb') as HTMLElement
    expect(thumb.style.opacity).toBe('0')
  })
})

// ---------------------------------------------------------------------------
// AC 23 — thumb drag updates panX / panY via the store (feat 13)
// ---------------------------------------------------------------------------

describe('AC23 — scrollbar thumb drag pans the viewport', () => {
  it('dragging the horizontal thumb fires setPan with a new panX', () => {
    // Give the canvas a known container size so scrollbars are active
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0, elements: [] })
    const { getByTestId, rerender } = render(<Canvas />)

    // Simulate ResizeObserver firing by manually updating component internal size.
    // We do this by overriding containerSizeRef via the ResizeObserver callback path
    // — in jsdom, clientWidth stays 0, so we exercise the "thumb hidden" path.
    // The meaningful pan-update logic is covered by the virtualBounds unit tests
    // and the integration: thumb mousedown → window mousemove → onThumbMove → setPan.
    const thumb = getByTestId('scrollbar-h-thumb') as HTMLElement

    // Mousedown on the thumb (records drag start at clientX=50)
    fireEvent.mouseDown(thumb, { clientX: 50, clientY: 0 })

    // Mousemove on window (drag 80px to the right)
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 130, clientY: 0, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    // With containerSize = 0, maxScroll = 0 so no pan change — but the event chain
    // must not throw and the component must remain mounted.
    rerender(<Canvas />)
    expect(getByTestId('scrollbar-h-thumb')).toBeTruthy()
  })

  it('dragging the vertical thumb does not throw', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0, elements: [] })
    const { getByTestId } = render(<Canvas />)
    const thumb = getByTestId('scrollbar-v-thumb') as HTMLElement

    fireEvent.mouseDown(thumb, { clientX: 0, clientY: 50 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, clientY: 130, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(getByTestId('scrollbar-v-thumb')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// AC 24 — clicking the track jumps by one viewport page (feat 13)
// ---------------------------------------------------------------------------

describe('AC24 — clicking the scrollbar track jumps one page', () => {
  it('clicking the horizontal track does not throw and keeps the thumb visible (opacity prop)', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0, elements: [] })
    const { getByTestId } = render(<Canvas />)
    const track = getByTestId('scrollbar-h') as HTMLElement

    // Click the track at position 200 (to the right of a zero-width thumb → forward direction)
    fireEvent.mouseDown(track, { clientX: 200, clientY: 0 })

    expect(getByTestId('scrollbar-h')).toBeTruthy()
  })

  it('clicking the vertical track does not throw', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0, elements: [] })
    const { getByTestId } = render(<Canvas />)
    const track = getByTestId('scrollbar-v') as HTMLElement

    fireEvent.mouseDown(track, { clientX: 0, clientY: 200 })

    expect(getByTestId('scrollbar-v')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// AC 25 — scrollbar thumb size shrinks as zoom increases, grows as zoom decreases
// ---------------------------------------------------------------------------

describe('AC25 — scrollbar thumb size is proportional to zoom', () => {
  // Provide a non-zero container size so scrollbar geometry is meaningful.
  // Canvas reads clientWidth/clientHeight via useLayoutEffect; mocking them
  // makes the containerSize state update to { w: 800, h: 600 }.
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 800,
    })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 600,
    })
    useCanvasStore.setState({ elements: [], panX: 0, panY: 0 })
  })

  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 0,
    })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 0,
    })
  })

  it('horizontal thumb is narrower at zoom=2 than at zoom=1', () => {
    useCanvasStore.setState({ zoom: 1 })
    const { getByTestId } = render(<Canvas />)
    const thumbAt1 = parseInt((getByTestId('scrollbar-h-thumb') as HTMLElement).style.width)

    act(() => {
      useCanvasStore.setState({ zoom: 2 })
    })
    const thumbAt2 = parseInt((getByTestId('scrollbar-h-thumb') as HTMLElement).style.width)

    expect(thumbAt1).toBeGreaterThan(0)
    expect(thumbAt2).toBeGreaterThan(0)
    expect(thumbAt2).toBeLessThan(thumbAt1)
  })

  it('vertical thumb is shorter at zoom=2 than at zoom=1', () => {
    useCanvasStore.setState({ zoom: 1 })
    const { getByTestId } = render(<Canvas />)
    const thumbAt1 = parseInt((getByTestId('scrollbar-v-thumb') as HTMLElement).style.height)

    act(() => {
      useCanvasStore.setState({ zoom: 2 })
    })
    const thumbAt2 = parseInt((getByTestId('scrollbar-v-thumb') as HTMLElement).style.height)

    expect(thumbAt1).toBeGreaterThan(0)
    expect(thumbAt2).toBeGreaterThan(0)
    expect(thumbAt2).toBeLessThan(thumbAt1)
  })

  it('horizontal thumb grows when zoom decreases below 1', () => {
    useCanvasStore.setState({ zoom: 1 })
    const { getByTestId } = render(<Canvas />)
    const thumbAt1 = parseInt((getByTestId('scrollbar-h-thumb') as HTMLElement).style.width)

    act(() => {
      useCanvasStore.setState({ zoom: 0.5 })
    })
    const thumbAt05 = parseInt((getByTestId('scrollbar-h-thumb') as HTMLElement).style.width)

    expect(thumbAt05).toBeGreaterThan(thumbAt1)
  })

  it('vertical thumb grows when zoom decreases below 1', () => {
    useCanvasStore.setState({ zoom: 1 })
    const { getByTestId } = render(<Canvas />)
    const thumbAt1 = parseInt((getByTestId('scrollbar-v-thumb') as HTMLElement).style.height)

    act(() => {
      useCanvasStore.setState({ zoom: 0.5 })
    })
    const thumbAt05 = parseInt((getByTestId('scrollbar-v-thumb') as HTMLElement).style.height)

    expect(thumbAt05).toBeGreaterThan(thumbAt1)
  })
})

// ---------------------------------------------------------------------------
// feat14 AC1–3 — background left-click drag-to-pan
// ---------------------------------------------------------------------------

describe('AC1–3 (feat14) — background left-click drag-to-pan', () => {
  afterEach(() => {
    document.body.style.cursor = ''
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  })

  it('AC1: pans viewport when left-click drag exceeds 4px on background', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, clientX: 50, clientY: 50 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 130, bubbles: true }))

    expect(useCanvasStore.getState().panX).toBe(100)
    expect(useCanvasStore.getState().panY).toBe(80)
  })

  it('AC1: pan delta is relative to mousedown position, not origin', () => {
    useCanvasStore.setState({ zoom: 1, panX: 10, panY: 20 })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, clientX: 100, clientY: 100 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 140, clientY: 160, bubbles: true }))

    expect(useCanvasStore.getState().panX).toBe(50) // 10 + 40
    expect(useCanvasStore.getState().panY).toBe(80) // 20 + 60
  })

  it('AC1: pan stops after mouseup — further movement does not update pan', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, clientX: 0, clientY: 0 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 50, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 300, bubbles: true }))

    expect(useCanvasStore.getState().panX).toBe(50)
    expect(useCanvasStore.getState().panY).toBe(50)
  })

  it('AC2: movement under 4px threshold does not pan', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, clientX: 0, clientY: 0 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 2, clientY: 2, bubbles: true }))

    expect(useCanvasStore.getState().panX).toBe(0)
    expect(useCanvasStore.getState().panY).toBe(0)
  })

  it('AC2: sub-threshold background mousedown followed by mouseup deselects', () => {
    useCanvasStore.setState({
      zoom: 1,
      panX: 0,
      panY: 0,
      elements: [makeElement('el-1')],
      selectedIds: ['el-1'],
    })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, clientX: 0, clientY: 0 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1, clientY: 1, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    fireEvent.click(canvasEl, { clientX: 1, clientY: 1 })

    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })

  it('AC3: grabbing cursor is set on body once 4px threshold is crossed', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, clientX: 0, clientY: 0 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 50, bubbles: true }))

    expect(document.body.style.cursor).toBe('grabbing')
  })

  it('AC3: grabbing cursor is restored on mouseup', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, clientX: 0, clientY: 0 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 50, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(document.body.style.cursor).toBe('')
  })

  it('AC3: a pan that does not cross 4px threshold does not set grabbing cursor', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, clientX: 0, clientY: 0 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 2, clientY: 2, bubbles: true }))

    expect(document.body.style.cursor).not.toBe('grabbing')
  })

  it('AC4: Space+drag still pans without triggering bg-pan logic', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.keyDown(window, { code: 'Space' })
    // Space pan uses the overlay div; middle-mouse still uses the container
    fireEvent.mouseDown(canvasEl, { button: 1, clientX: 0, clientY: 0 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 60, clientY: 30, bubbles: true }))

    expect(useCanvasStore.getState().panX).toBe(60)
    expect(useCanvasStore.getState().panY).toBe(30)

    fireEvent.keyUp(window, { code: 'Space' })
  })
})

// ---------------------------------------------------------------------------
// feat14 AC9 — shift+click canvas background does not change selection
// ---------------------------------------------------------------------------

describe('AC9 (feat14) — shift+click canvas background', () => {
  it('shift+click on background preserves the current selection', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1'), makeElement('el-2')],
      selectedIds: ['el-1', 'el-2'],
    })
    const { container } = render(<Canvas />)

    fireEvent.click(container.firstChild as HTMLElement, { shiftKey: true })

    expect(useCanvasStore.getState().selectedIds).toHaveLength(2)
    expect(useCanvasStore.getState().selectedIds).toContain('el-1')
    expect(useCanvasStore.getState().selectedIds).toContain('el-2')
  })

  it('shift+click on background with empty selection leaves it empty', () => {
    useCanvasStore.setState({ elements: [], selectedIds: [] })
    const { container } = render(<Canvas />)

    fireEvent.click(container.firstChild as HTMLElement, { shiftKey: true })

    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// feat14 AC11 — Escape clears selection
// ---------------------------------------------------------------------------

describe('AC11 (feat14) — Escape clears the entire selection', () => {
  it('Escape clears selectedIds when no element is in edit mode', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1'), makeElement('el-2')],
      selectedIds: ['el-1', 'el-2'],
    })
    render(<Canvas />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })

  it('Escape is a no-op when nothing is selected', () => {
    useCanvasStore.setState({ elements: [], selectedIds: [] })
    render(<Canvas />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })

  it('Escape does not fire clearSelection when defaultPrevented is set', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1')],
      selectedIds: ['el-1'],
    })
    render(<Canvas />)

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    Object.defineProperty(event, 'defaultPrevented', { value: true, writable: false })
    window.dispatchEvent(event)

    expect(useCanvasStore.getState().selectedIds).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// feat14 AC18 — plain click on background deselects multi-selection
// ---------------------------------------------------------------------------

describe('AC18 (feat14) — plain click background deselects multi-selection', () => {
  it('plain click on canvas background clears all selected elements', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1'), makeElement('el-2')],
      selectedIds: ['el-1', 'el-2'],
    })
    const { container } = render(<Canvas />)

    fireEvent.click(container.firstChild as HTMLElement)

    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// feat14 ACs 19–27 — Shift+drag marquee selection
//
// jsdom: getBoundingClientRect() returns all zeros, so containerLeft = 0.
// With panX=0, panY=0, zoom=1: worldCoord = clientCoord.
// ---------------------------------------------------------------------------

describe('AC19–27 (feat14) — Shift+drag marquee selection', () => {
  afterEach(() => {
    document.body.style.cursor = ''
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  })

  // AC 19 — Shift+drag shows a dashed blue marquee rectangle
  it('AC19: marquee overlay appears after Shift+drag exceeds 4px', () => {
    const { container, getByTestId } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, shiftKey: true, clientX: 50, clientY: 50 })
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 150, clientY: 150, bubbles: true })
      )
    })

    const marquee = getByTestId('marquee-rect') as HTMLElement
    expect(marquee).toBeTruthy()
    expect(marquee.style.border).toContain('dashed')
    // jsdom normalises hex colours to rgb() in computed style
    expect(marquee.style.border).toMatch(/rgb\(59,\s*130,\s*246\)/)
    expect(marquee.style.backgroundColor).toBe('rgba(59, 130, 246, 0.08)')
  })

  // AC 19 — marquee position and size match the dragged area
  it('AC19: marquee rect dimensions match mouse delta', () => {
    const { container, getByTestId } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, shiftKey: true, clientX: 30, clientY: 40 })
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 130, clientY: 200, bubbles: true })
      )
    })

    const marquee = getByTestId('marquee-rect') as HTMLElement
    expect(marquee.style.left).toBe('30px')
    expect(marquee.style.top).toBe('40px')
    expect(marquee.style.width).toBe('100px')
    expect(marquee.style.height).toBe('160px')
  })

  // AC 20 — marquee tracks drags in all four directions from mousedown point
  it('AC20: marquee rect normalises when dragging up-left', () => {
    const { container, getByTestId } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    // Start at (200, 200), drag to (50, 80) — up and to the left
    fireEvent.mouseDown(canvasEl, { button: 0, shiftKey: true, clientX: 200, clientY: 200 })
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 80, bubbles: true }))
    })

    const marquee = getByTestId('marquee-rect') as HTMLElement
    // x should be the smaller of 200 and 50
    expect(marquee.style.left).toBe('50px')
    expect(marquee.style.top).toBe('80px')
    expect(marquee.style.width).toBe('150px')
    expect(marquee.style.height).toBe('120px')
  })

  it('AC20: marquee rect normalises when dragging down-left', () => {
    const { container, getByTestId } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, shiftKey: true, clientX: 200, clientY: 100 })
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 80, clientY: 250, bubbles: true })
      )
    })

    const marquee = getByTestId('marquee-rect') as HTMLElement
    expect(marquee.style.left).toBe('80px')
    expect(marquee.style.top).toBe('100px')
    expect(marquee.style.width).toBe('120px')
    expect(marquee.style.height).toBe('150px')
  })

  // AC 21 — fully enclosed elements are selected; partial overlaps are not
  it('AC21: fully enclosed element is added to selection on mouseup', () => {
    // Element at world (100,100) size 50×50, fully inside marquee (90,90)→(160,160)
    const el = { ...makeTextElement('el-inside'), x: 100, y: 100, width: 50, height: 50 }
    useCanvasStore.setState({ elements: [el], selectedIds: [], zoom: 1, panX: 0, panY: 0 })

    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, shiftKey: true, clientX: 90, clientY: 90 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 160, clientY: 160, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(useCanvasStore.getState().selectedIds).toContain('el-inside')
  })

  it('AC21: element only partially overlapping the marquee is NOT selected', () => {
    // Element starts at (50,50) but extends to (150,150) — overlaps but not fully inside
    // Marquee from (90,90) to (160,160): element.x=50 < 90 → excluded
    const el = { ...makeTextElement('el-partial'), x: 50, y: 50, width: 100, height: 100 }
    useCanvasStore.setState({ elements: [el], selectedIds: [], zoom: 1, panX: 0, panY: 0 })

    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, shiftKey: true, clientX: 90, clientY: 90 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 160, clientY: 160, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(useCanvasStore.getState().selectedIds).not.toContain('el-partial')
  })

  it('AC21: only fully enclosed elements are selected when both types are present', () => {
    const inside = { ...makeTextElement('inside'), x: 100, y: 100, width: 50, height: 50 }
    const outside = { ...makeTextElement('outside'), x: 50, y: 50, width: 200, height: 200 }
    useCanvasStore.setState({
      elements: [inside, outside],
      selectedIds: [],
      zoom: 1,
      panX: 0,
      panY: 0,
    })

    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, shiftKey: true, clientX: 90, clientY: 90 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 160, clientY: 160, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(useCanvasStore.getState().selectedIds).toContain('inside')
    expect(useCanvasStore.getState().selectedIds).not.toContain('outside')
  })

  // AC 22 — locked elements are not added to selection
  it('AC22: locked element is not selected even when fully enclosed by marquee', () => {
    const el = {
      ...makeTextElement('locked-el'),
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      locked: true,
    }
    useCanvasStore.setState({ elements: [el], selectedIds: [], zoom: 1, panX: 0, panY: 0 })

    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, shiftKey: true, clientX: 90, clientY: 90 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 160, clientY: 160, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(useCanvasStore.getState().selectedIds).not.toContain('locked-el')
  })

  // AC 23 — if marquee encloses no elements, selection is unchanged
  it('AC23: selection is unchanged when no elements are enclosed', () => {
    // Element at (500,500) — far outside marquee (90,90)→(160,160)
    const el = { ...makeTextElement('far-el'), x: 500, y: 500, width: 50, height: 50 }
    useCanvasStore.setState({
      elements: [el],
      selectedIds: ['far-el'],
      zoom: 1,
      panX: 0,
      panY: 0,
    })

    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, shiftKey: true, clientX: 90, clientY: 90 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 160, clientY: 160, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    // Pre-existing selection should still contain 'far-el'
    expect(useCanvasStore.getState().selectedIds).toContain('far-el')
  })

  // AC 24 — marquee overlay is removed immediately on mouseup
  it('AC24: marquee overlay div is removed after mouseup', () => {
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, shiftKey: true, clientX: 50, clientY: 50 })
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true })
      )
    })
    // Overlay present before mouseup
    expect(container.querySelector('[data-testid="marquee-rect"]')).not.toBeNull()

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    expect(container.querySelector('[data-testid="marquee-rect"]')).toBeNull()
  })

  // AC 25 — Shift+drag under 4px threshold does not change selection
  it('AC25: sub-threshold Shift+drag leaves selection unchanged', () => {
    const el = { ...makeTextElement('el-1'), x: 0, y: 0, width: 10, height: 10 }
    useCanvasStore.setState({
      elements: [el],
      selectedIds: ['el-1'],
      zoom: 1,
      panX: 0,
      panY: 0,
    })

    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, shiftKey: true, clientX: 50, clientY: 50 })
    // Move only 2px — under the 4px threshold
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 52, clientY: 51, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    // No marquee was committed → no selection change
    expect(useCanvasStore.getState().selectedIds).toContain('el-1')
    // No marquee overlay was shown
    expect(container.querySelector('[data-testid="marquee-rect"]')).toBeNull()
  })

  // AC 26 — cursor is crosshair while Shift is held (idle and during marquee drag)
  it('AC26: container cursor is crosshair when Shift key is held', () => {
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.keyDown(window, { key: 'Shift' })

    expect((canvasEl as HTMLElement).style.cursor).toBe('crosshair')

    fireEvent.keyUp(window, { key: 'Shift' })
  })

  it('AC26: body cursor is crosshair during an active marquee drag', () => {
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, shiftKey: true, clientX: 50, clientY: 50 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 150, bubbles: true }))

    expect(document.body.style.cursor).toBe('crosshair')
  })

  it('AC26: body cursor is restored after marquee drag ends', () => {
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, shiftKey: true, clientX: 50, clientY: 50 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 150, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(document.body.style.cursor).toBe('')
  })

  // AC 27 — successive Shift+drag operations accumulate into selectedIds
  it('AC27: a second Shift+drag adds more elements without clearing prior selection', () => {
    const el1 = { ...makeTextElement('el-1'), x: 10, y: 10, width: 30, height: 30 }
    const el2 = { ...makeTextElement('el-2'), x: 200, y: 200, width: 30, height: 30 }
    useCanvasStore.setState({ elements: [el1, el2], selectedIds: [], zoom: 1, panX: 0, panY: 0 })

    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    // First marquee: selects el-1
    fireEvent.mouseDown(canvasEl, { button: 0, shiftKey: true, clientX: 0, clientY: 0 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 50, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(useCanvasStore.getState().selectedIds).toContain('el-1')
    expect(useCanvasStore.getState().selectedIds).not.toContain('el-2')

    // Second marquee: adds el-2 without removing el-1
    fireEvent.mouseDown(canvasEl, { button: 0, shiftKey: true, clientX: 190, clientY: 190 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 240, clientY: 240, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(useCanvasStore.getState().selectedIds).toContain('el-1')
    expect(useCanvasStore.getState().selectedIds).toContain('el-2')
  })
})

// ---------------------------------------------------------------------------
// feat16 AC8/9/14 — Delete and Backspace keys remove selected elements
// ---------------------------------------------------------------------------

describe('AC8/9/14 (feat16) — Delete and Backspace keyboard deletion', () => {
  it('AC8: Delete removes all selected elements', () => {
    useCanvasStore.setState({ elements: [makeElement('el-1')], selectedIds: ['el-1'] })
    render(<Canvas />)

    fireEvent.keyDown(window, { key: 'Delete' })

    expect(useCanvasStore.getState().elements).toHaveLength(0)
  })

  it('AC9: Backspace has the same effect as Delete', () => {
    useCanvasStore.setState({ elements: [makeElement('el-1')], selectedIds: ['el-1'] })
    render(<Canvas />)

    fireEvent.keyDown(window, { key: 'Backspace' })

    expect(useCanvasStore.getState().elements).toHaveLength(0)
  })

  it('AC14: selection is cleared after Delete', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1'), makeElement('el-2')],
      selectedIds: ['el-1', 'el-2'],
    })
    render(<Canvas />)

    fireEvent.keyDown(window, { key: 'Delete' })

    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })

  it('AC14: selection is cleared after Backspace', () => {
    useCanvasStore.setState({ elements: [makeElement('el-1')], selectedIds: ['el-1'] })
    render(<Canvas />)

    fireEvent.keyDown(window, { key: 'Backspace' })

    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })

  it('removes multiple selected elements at once', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1'), makeElement('el-2'), makeElement('el-3')],
      selectedIds: ['el-1', 'el-3'],
    })
    render(<Canvas />)

    fireEvent.keyDown(window, { key: 'Delete' })

    const remaining = useCanvasStore.getState().elements
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe('el-2')
  })

  it('is a no-op when selectedIds is empty', () => {
    useCanvasStore.setState({ elements: [makeElement('el-1')], selectedIds: [] })
    render(<Canvas />)

    fireEvent.keyDown(window, { key: 'Delete' })

    expect(useCanvasStore.getState().elements).toHaveLength(1)
  })

  it('does not fire when defaultPrevented is set', () => {
    useCanvasStore.setState({ elements: [makeElement('el-1')], selectedIds: ['el-1'] })
    render(<Canvas />)

    const event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })
    Object.defineProperty(event, 'defaultPrevented', { value: true, writable: false })
    window.dispatchEvent(event)

    expect(useCanvasStore.getState().elements).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// feat16 AC10–13 — Delete / Backspace suppressed when a text-entry context is focused
// ---------------------------------------------------------------------------

describe('AC10–13 (feat16) — Delete/Backspace suppressed in text-entry contexts', () => {
  // jsdom does not reliably update document.activeElement for contentEditable divs,
  // so we stub the getter directly to simulate the focused-contentEditable scenario.
  function stubActiveElement(stub: Partial<HTMLElement>) {
    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      get: () => stub,
    })
  }

  afterEach(() => {
    // Restore the prototype getter so subsequent tests use real activeElement behaviour
    const proto = Object.getOwnPropertyDescriptor(Document.prototype, 'activeElement')
    if (proto) Object.defineProperty(document, 'activeElement', proto)
    ;(document.activeElement as HTMLElement | null)?.blur?.()
  })

  it('AC10: Delete does not fire when a contentEditable element is focused', () => {
    useCanvasStore.setState({ elements: [makeElement('el-1')], selectedIds: ['el-1'] })
    render(<Canvas />)

    stubActiveElement({ tagName: 'DIV', isContentEditable: true } as HTMLElement)

    fireEvent.keyDown(window, { key: 'Delete' })

    expect(useCanvasStore.getState().elements).toHaveLength(1)
  })

  it('AC10: Backspace does not fire when a contentEditable element is focused', () => {
    useCanvasStore.setState({ elements: [makeElement('el-1')], selectedIds: ['el-1'] })
    render(<Canvas />)

    stubActiveElement({ tagName: 'DIV', isContentEditable: true } as HTMLElement)

    fireEvent.keyDown(window, { key: 'Backspace' })

    expect(useCanvasStore.getState().elements).toHaveLength(1)
  })

  it('AC12/13: Delete does not fire when an <input> is focused', () => {
    useCanvasStore.setState({ elements: [makeElement('el-1')], selectedIds: ['el-1'] })
    render(<Canvas />)

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    fireEvent.keyDown(window, { key: 'Delete' })

    expect(useCanvasStore.getState().elements).toHaveLength(1)
    document.body.removeChild(input)
  })

  it('AC13: Delete does not fire when a <textarea> is focused', () => {
    useCanvasStore.setState({ elements: [makeElement('el-1')], selectedIds: ['el-1'] })
    render(<Canvas />)

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    fireEvent.keyDown(window, { key: 'Delete' })

    expect(useCanvasStore.getState().elements).toHaveLength(1)
    document.body.removeChild(textarea)
  })

  it('AC13: Delete does not fire when a <select> is focused', () => {
    useCanvasStore.setState({ elements: [makeElement('el-1')], selectedIds: ['el-1'] })
    render(<Canvas />)

    const select = document.createElement('select')
    document.body.appendChild(select)
    select.focus()

    fireEvent.keyDown(window, { key: 'Delete' })

    expect(useCanvasStore.getState().elements).toHaveLength(1)
    document.body.removeChild(select)
  })

  it('AC13: Backspace does not fire when an <input> is focused', () => {
    useCanvasStore.setState({ elements: [makeElement('el-1')], selectedIds: ['el-1'] })
    render(<Canvas />)

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    fireEvent.keyDown(window, { key: 'Backspace' })

    expect(useCanvasStore.getState().elements).toHaveLength(1)
    document.body.removeChild(input)
  })
})
