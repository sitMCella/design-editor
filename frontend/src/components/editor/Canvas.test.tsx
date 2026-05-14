import { beforeEach, describe, expect, it } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
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

  it('left-mouse button does not initiate pan', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    const { container } = render(<Canvas />)
    const canvasEl = container.firstChild as HTMLElement

    fireEvent.mouseDown(canvasEl, { button: 0, clientX: 0, clientY: 0 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100, bubbles: true }))

    // Pan should not change without Space held
    expect(useCanvasStore.getState().panX).toBe(0)
    expect(useCanvasStore.getState().panY).toBe(0)
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
