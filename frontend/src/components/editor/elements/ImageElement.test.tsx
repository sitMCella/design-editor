import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ImageElement } from './ImageElement'
import type { ImageElement as ImageElementType } from '../../../types/canvas'

const baseElement: ImageElementType = {
  id: 'img-1',
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
}

const renderElement = (
  overrides: Partial<ImageElementType> = {},
  props: { isSelected?: boolean } = {}
) => {
  const onSelect = vi.fn()
  const onUpdate = vi.fn()
  const result = render(
    <ImageElement
      element={{ ...baseElement, ...overrides }}
      isSelected={props.isSelected ?? false}
      onSelect={onSelect}
      onUpdate={onUpdate}
    />
  )
  return { ...result, onSelect, onUpdate }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const drag = (el: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }) => {
  fireEvent.mouseDown(el, { clientX: from.x, clientY: from.y })
  fireEvent.mouseMove(window, { clientX: to.x, clientY: to.y })
  fireEvent.mouseUp(window)
}

const resize = (
  handle: HTMLElement,
  from: { x: number; y: number },
  to: { x: number; y: number }
) => {
  fireEvent.mouseDown(handle, { clientX: from.x, clientY: from.y })
  fireEvent.mouseMove(window, { clientX: to.x, clientY: to.y })
  fireEvent.mouseUp(window)
}

// ---------------------------------------------------------------------------
// AC 3 — placeholder: grey background, picture icon, "Add image" label
describe('AC3: placeholder rendering', () => {
  it('shows the "Add image" label when src is empty', () => {
    renderElement({ src: '' })
    expect(screen.getByText('Add image')).toBeInTheDocument()
  })

  it('renders the placeholder SVG icon when src is empty', () => {
    const { container } = renderElement({ src: '' })
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('applies the grey placeholder background when src is empty', () => {
    const { container } = renderElement({ src: '' })
    // The placeholder div is nested one level inside the outer wrapper
    const placeholder = container.querySelector('div > div > div') as HTMLElement
    expect(placeholder.style.background).toBe('rgb(229, 231, 235)')
  })

  it('renders an img element when src is non-empty', () => {
    const { container } = renderElement({ src: 'https://example.com/photo.jpg' })
    // alt="" makes the role "presentation"; query by tag instead
    expect(container.querySelector('img')).toBeInTheDocument()
  })

  it('does not show the "Add image" label when src is non-empty', () => {
    renderElement({ src: 'https://example.com/photo.jpg' })
    expect(screen.queryByText('Add image')).not.toBeInTheDocument()
  })
})

// AC 4 — click selects the element; blue outline when selected
describe('AC4: selection', () => {
  it('calls onSelect when clicked', () => {
    const { container, onSelect } = renderElement()
    fireEvent.click(container.firstChild as HTMLElement)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('applies a solid blue outline when selected', () => {
    const { container } = renderElement({}, { isSelected: true })
    const el = container.firstChild as HTMLElement
    expect(el.style.outline).toContain('solid')
    expect(el.style.outline.toLowerCase()).toContain('3b82f6')
  })

  it('applies no outline when not selected', () => {
    const { container } = renderElement({}, { isSelected: false })
    const el = container.firstChild as HTMLElement
    expect(el.style.outline).toBe('none')
  })

  it('stops click propagation so the canvas does not also deselect', () => {
    const parentHandler = vi.fn()
    const { container } = renderElement()
    container.parentElement!.addEventListener('click', parentHandler)
    fireEvent.click(container.firstChild as HTMLElement)
    expect(parentHandler).not.toHaveBeenCalled()
    container.parentElement!.removeEventListener('click', parentHandler)
  })
})

// ---------------------------------------------------------------------------
// AC 1 — dragging a selected element repositions it
// AC 2 — element cannot be dragged outside the design surface (1280 × 720)
// ---------------------------------------------------------------------------

describe('AC1/AC2: drag behaviour', () => {
  it('AC1: calls onUpdate with new position after dragging ≥ 4px', () => {
    const { container, onUpdate } = renderElement({}, { isSelected: true })
    const el = container.firstChild as HTMLElement
    // baseElement starts at x:480, y:240; drag right 20, down 15
    drag(el, { x: 100, y: 100 }, { x: 120, y: 115 })
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ x: 500, y: 255 }))
  })

  it('AC1: does not call onUpdate when movement is below the 4px threshold', () => {
    const { container, onUpdate } = renderElement({}, { isSelected: true })
    const el = container.firstChild as HTMLElement
    drag(el, { x: 100, y: 100 }, { x: 102, y: 101 })
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('AC1: does not call onSelect after a drag (no spurious deselection)', () => {
    const { container, onSelect } = renderElement({}, { isSelected: true })
    const el = container.firstChild as HTMLElement
    drag(el, { x: 100, y: 100 }, { x: 120, y: 115 })
    // Simulate the click that follows mouseup in real browsers
    fireEvent.click(el)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('AC1: does not drag when element is not selected', () => {
    const { container, onUpdate } = renderElement({}, { isSelected: false })
    const el = container.firstChild as HTMLElement
    drag(el, { x: 100, y: 100 }, { x: 200, y: 200 })
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('AC2: allows movement to negative x when dragged past the left edge', () => {
    const { container, onUpdate } = renderElement({ x: 10, y: 240 }, { isSelected: true })
    const el = container.firstChild as HTMLElement
    // dx = -100 → x = 10 - 100 = -90 (no clamping on infinite canvas)
    drag(el, { x: 200, y: 200 }, { x: 100, y: 200 })
    const last = onUpdate.mock.calls.at(-1)![0]
    expect(last.x).toBe(-90)
  })

  it('AC2: allows movement beyond right surface bounds', () => {
    const { container, onUpdate } = renderElement({ x: 100, y: 240 }, { isSelected: true })
    const el = container.firstChild as HTMLElement
    // drag far right → x = 100 + 2000 = 2100 (no clamping on infinite canvas)
    drag(el, { x: 100, y: 100 }, { x: 2100, y: 100 })
    const last = onUpdate.mock.calls.at(-1)![0]
    expect(last.x).toBe(2100)
  })

  it('AC2: allows movement to negative y when dragged past the top edge', () => {
    const { container, onUpdate } = renderElement({ x: 480, y: 10 }, { isSelected: true })
    const el = container.firstChild as HTMLElement
    // dy = -100 → y = 10 - 100 = -90 (no clamping on infinite canvas)
    drag(el, { x: 200, y: 200 }, { x: 200, y: 100 })
    const last = onUpdate.mock.calls.at(-1)![0]
    expect(last.y).toBe(-90)
  })

  it('AC2: allows movement beyond bottom surface bounds', () => {
    const { container, onUpdate } = renderElement({ x: 480, y: 100 }, { isSelected: true })
    const el = container.firstChild as HTMLElement
    // drag far down → y = 100 + 2000 = 2100 (no clamping on infinite canvas)
    drag(el, { x: 100, y: 100 }, { x: 100, y: 2100 })
    const last = onUpdate.mock.calls.at(-1)![0]
    expect(last.y).toBe(2100)
  })
})

// ---------------------------------------------------------------------------
// AC 3 — selected element shows resize handles at its four corners
// ---------------------------------------------------------------------------

describe('AC3: resize handles', () => {
  it('renders all four corner handles when selected', () => {
    renderElement({}, { isSelected: true })
    expect(screen.getByTestId('resize-handle-tl')).toBeInTheDocument()
    expect(screen.getByTestId('resize-handle-tr')).toBeInTheDocument()
    expect(screen.getByTestId('resize-handle-bl')).toBeInTheDocument()
    expect(screen.getByTestId('resize-handle-br')).toBeInTheDocument()
  })

  it('does not render resize handles when not selected', () => {
    renderElement({}, { isSelected: false })
    expect(screen.queryByTestId('resize-handle-tl')).not.toBeInTheDocument()
    expect(screen.queryByTestId('resize-handle-tr')).not.toBeInTheDocument()
    expect(screen.queryByTestId('resize-handle-bl')).not.toBeInTheDocument()
    expect(screen.queryByTestId('resize-handle-br')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC 4 — corner handles resize the element; min 40 × 40; bounded to surface
// ---------------------------------------------------------------------------

describe('AC4: resize behaviour', () => {
  it('br handle grows width and height', () => {
    const { onUpdate } = renderElement({}, { isSelected: true })
    // baseElement: width=320, height=240; drag br right 50, down 30
    resize(screen.getByTestId('resize-handle-br'), { x: 0, y: 0 }, { x: 50, y: 30 })
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ width: 370, height: 270 }))
  })

  it('tl handle moves the origin and shrinks dimensions', () => {
    const { onUpdate } = renderElement({}, { isSelected: true })
    // Drag tl right 20, down 20 → x+20, y+20, w-20, h-20
    resize(screen.getByTestId('resize-handle-tl'), { x: 0, y: 0 }, { x: 20, y: 20 })
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ x: 500, y: 260, width: 300, height: 220 })
    )
  })

  it('enforces minimum width and height of 40px when shrinking', () => {
    const { onUpdate } = renderElement({ width: 50, height: 50 }, { isSelected: true })
    // Drag br inward by 20 → would give 30×30, clamped to 40×40
    resize(screen.getByTestId('resize-handle-br'), { x: 0, y: 0 }, { x: -20, y: -20 })
    const last = onUpdate.mock.calls.at(-1)![0]
    expect(last.width).toBe(40)
    expect(last.height).toBe(40)
  })

  it('element can extend past the right edge on infinite canvas', () => {
    const { onUpdate } = renderElement(
      { x: 1100, y: 240, width: 100, height: 100 },
      { isSelected: true }
    )
    // Drag br far right; x=1100, width = 100 + 500 = 600 (no surface clamp)
    resize(screen.getByTestId('resize-handle-br'), { x: 0, y: 0 }, { x: 500, y: 0 })
    const last = onUpdate.mock.calls.at(-1)![0]
    expect(last.width).toBe(600)
  })

  it('element can extend past the bottom edge on infinite canvas', () => {
    const { onUpdate } = renderElement(
      { x: 480, y: 600, width: 100, height: 100 },
      { isSelected: true }
    )
    // Drag br far down; y=600, height = 100 + 500 = 600 (no surface clamp)
    resize(screen.getByTestId('resize-handle-br'), { x: 0, y: 0 }, { x: 0, y: 500 })
    const last = onUpdate.mock.calls.at(-1)![0]
    expect(last.height).toBe(600)
  })
})

// ---------------------------------------------------------------------------
// AC 9  — double-click enters crop/pan mode (dashed outline, handles hidden)
// AC 10 — dragging in crop/pan mode updates objectPosition
// AC 11 — Escape exits crop/pan mode; losing selection also exits
// ---------------------------------------------------------------------------

describe('AC9/AC10/AC11: crop/pan mode', () => {
  it('AC9: entering crop mode shows a dashed outline', () => {
    const { container } = renderElement({}, { isSelected: true })
    const el = container.firstChild as HTMLElement
    fireEvent.doubleClick(el)
    expect(el.style.outline).toContain('dashed')
  })

  it('AC9: entering crop mode hides the resize handles', () => {
    const { container } = renderElement({}, { isSelected: true })
    const el = container.firstChild as HTMLElement
    expect(screen.getByTestId('resize-handle-tl')).toBeInTheDocument()
    fireEvent.doubleClick(el)
    expect(screen.queryByTestId('resize-handle-tl')).not.toBeInTheDocument()
    expect(screen.queryByTestId('resize-handle-tr')).not.toBeInTheDocument()
    expect(screen.queryByTestId('resize-handle-bl')).not.toBeInTheDocument()
    expect(screen.queryByTestId('resize-handle-br')).not.toBeInTheDocument()
  })

  it('AC9: double-click does not enter crop mode when element is not selected', () => {
    const { container } = renderElement({}, { isSelected: false })
    const el = container.firstChild as HTMLElement
    fireEvent.doubleClick(el)
    expect(el.style.outline).toBe('none')
  })

  it('AC10: dragging in crop mode calls onUpdate with a new objectPosition', () => {
    const { container, onUpdate } = renderElement(
      { src: 'https://example.com/img.jpg', objectPosition: '50% 50%' },
      { isSelected: true }
    )
    const el = container.firstChild as HTMLElement
    fireEvent.doubleClick(el)
    // Pan: drag 50px right, 40px down
    fireEvent.mouseDown(el, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 50, clientY: 40 })
    fireEvent.mouseUp(window)
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ objectPosition: expect.stringContaining('%') })
    )
  })

  it('AC10: dragging in crop mode does NOT call onUpdate with x/y (only objectPosition)', () => {
    const { container, onUpdate } = renderElement(
      { src: 'https://example.com/img.jpg', objectPosition: '50% 50%' },
      { isSelected: true }
    )
    const el = container.firstChild as HTMLElement
    fireEvent.doubleClick(el)
    fireEvent.mouseDown(el, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 50, clientY: 40 })
    fireEvent.mouseUp(window)
    const last = onUpdate.mock.calls.at(-1)![0]
    expect(last).not.toHaveProperty('x')
    expect(last).not.toHaveProperty('y')
  })

  it('AC11: Escape exits crop mode and restores solid outline', () => {
    const { container } = renderElement({}, { isSelected: true })
    const el = container.firstChild as HTMLElement
    fireEvent.doubleClick(el)
    expect(el.style.outline).toContain('dashed')
    fireEvent.keyDown(el, { key: 'Escape' })
    expect(el.style.outline).toContain('solid')
  })

  it('AC11: Escape exits crop mode and restores resize handles', () => {
    const { container } = renderElement({}, { isSelected: true })
    const el = container.firstChild as HTMLElement
    fireEvent.doubleClick(el)
    expect(screen.queryByTestId('resize-handle-tl')).not.toBeInTheDocument()
    fireEvent.keyDown(el, { key: 'Escape' })
    expect(screen.getByTestId('resize-handle-tl')).toBeInTheDocument()
  })

  it('AC11: crop mode exits when isSelected becomes false', () => {
    const { container, rerender, onUpdate } = renderElement({}, { isSelected: true })
    const el = container.firstChild as HTMLElement
    fireEvent.doubleClick(el)
    expect(el.style.outline).toContain('dashed')
    rerender(
      <ImageElement
        element={baseElement}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={onUpdate}
      />
    )
    expect(el.style.outline).toBe('none')
  })
})
