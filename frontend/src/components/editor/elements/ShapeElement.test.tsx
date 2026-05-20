import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { ShapeElement } from './ShapeElement'
import type { ShapeElement as ShapeElementType } from '../../../types/canvas'

const makeShape = (overrides: Partial<ShapeElementType> = {}): ShapeElementType => ({
  id: 'shape-1',
  type: 'shape',
  shape: 'rect',
  x: 100,
  y: 200,
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

afterEach(() => {
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  document.body.style.cursor = ''
})

// ---------------------------------------------------------------------------
// AC 3 — renders as a blue filled square with no visible border
// ---------------------------------------------------------------------------

describe('rendering', () => {
  it('renders a div with the element fill colour as background', () => {
    const { container } = render(
      <ShapeElement
        element={makeShape()}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
      />
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.backgroundColor).toBe('rgb(59, 130, 246)') // #3B82F6
  })

  it('renders with the correct position (left / top)', () => {
    const { container } = render(
      <ShapeElement
        element={makeShape({ x: 50, y: 75 })}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
      />
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.left).toBe('50px')
    expect(el.style.top).toBe('75px')
  })

  it('renders with the correct dimensions (width / height)', () => {
    const { container } = render(
      <ShapeElement
        element={makeShape({ width: 200, height: 100 })}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
      />
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe('200px')
    expect(el.style.height).toBe('100px')
  })

  it('renders with no border when strokeWidth is 0', () => {
    const { container } = render(
      <ShapeElement
        element={makeShape({ strokeWidth: 0 })}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
      />
    )
    const el = container.firstChild as HTMLElement
    // jsdom normalises `border: none` to an empty string; either is "no border"
    expect(el.style.border === 'none' || el.style.border === '').toBe(true)
  })

  it('renders with a border when strokeWidth > 0', () => {
    const { container } = render(
      <ShapeElement
        element={makeShape({ stroke: '#000000', strokeWidth: 2 })}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
      />
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.border).toBe('2px solid rgb(0, 0, 0)')
  })

  it('applies opacity from the element', () => {
    const { container } = render(
      <ShapeElement
        element={makeShape({ opacity: 0.5 })}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
      />
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.opacity).toBe('0.5')
  })

  it('renders absolutely positioned', () => {
    const { container } = render(
      <ShapeElement
        element={makeShape()}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
      />
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.position).toBe('absolute')
  })
})

// ---------------------------------------------------------------------------
// AC 4 — selected state: blue outline and grab cursor
// ---------------------------------------------------------------------------

describe('selected state', () => {
  it('shows blue outline when selected', () => {
    const { container } = render(
      <ShapeElement element={makeShape()} isSelected={true} onSelect={vi.fn()} onUpdate={vi.fn()} />
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.outline).toBe('2px solid #3B82F6')
  })

  it('shows no outline when not selected', () => {
    const { container } = render(
      <ShapeElement
        element={makeShape()}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
      />
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.outline).toBe('none')
  })

  it('uses grab cursor when selected', () => {
    const { container } = render(
      <ShapeElement element={makeShape()} isSelected={true} onSelect={vi.fn()} onUpdate={vi.fn()} />
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.cursor).toBe('grab')
  })

  it('uses default cursor when not selected', () => {
    const { container } = render(
      <ShapeElement
        element={makeShape()}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
      />
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.cursor).toBe('default')
  })
})

// ---------------------------------------------------------------------------
// AC 4 — click to select
// ---------------------------------------------------------------------------

describe('click to select', () => {
  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <ShapeElement
        element={makeShape()}
        isSelected={false}
        onSelect={onSelect}
        onUpdate={vi.fn()}
      />
    )
    fireEvent.click(container.firstChild as HTMLElement)
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('passes the mouse event to onSelect', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <ShapeElement
        element={makeShape()}
        isSelected={false}
        onSelect={onSelect}
        onUpdate={vi.fn()}
      />
    )
    fireEvent.click(container.firstChild as HTMLElement)
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ type: 'click' }))
  })

  it('stops propagation on click so the canvas does not also deselect', () => {
    const parentHandler = vi.fn()
    const { container } = render(
      <div onClick={parentHandler}>
        <ShapeElement
          element={makeShape()}
          isSelected={false}
          onSelect={vi.fn()}
          onUpdate={vi.fn()}
        />
      </div>
    )
    fireEvent.click(container.firstChild!.firstChild as HTMLElement)
    expect(parentHandler).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Drag interaction — fires onDragEnd with delta after 4 px threshold
// ---------------------------------------------------------------------------

describe('drag interaction', () => {
  it('does not start a drag when element is not selected', () => {
    const onDragEnd = vi.fn()
    const { container } = render(
      <ShapeElement
        element={makeShape()}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
        onDragEnd={onDragEnd}
      />
    )
    const el = container.firstChild as HTMLElement

    fireEvent.mouseDown(el, { button: 0, clientX: 100, clientY: 100 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 120, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 150, clientY: 120, bubbles: true }))

    expect(onDragEnd).not.toHaveBeenCalled()
  })

  it('does not start a drag on non-left-button mousedown', () => {
    const onDragEnd = vi.fn()
    const { container } = render(
      <ShapeElement
        element={makeShape()}
        isSelected={true}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
        onDragEnd={onDragEnd}
      />
    )
    const el = container.firstChild as HTMLElement

    fireEvent.mouseDown(el, { button: 2, clientX: 100, clientY: 100 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 120, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 150, clientY: 120, bubbles: true }))

    expect(onDragEnd).not.toHaveBeenCalled()
  })

  it('fires onDragEnd with the pixel delta when dragged past 4 px threshold', () => {
    const onDragEnd = vi.fn()
    const { container } = render(
      <ShapeElement
        element={makeShape()}
        isSelected={true}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
        onDragEnd={onDragEnd}
      />
    )
    const el = container.firstChild as HTMLElement

    fireEvent.mouseDown(el, { button: 0, clientX: 100, clientY: 100 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 160, clientY: 130, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 160, clientY: 130, bubbles: true }))

    expect(onDragEnd).toHaveBeenCalledWith({ x: 60, y: 30 })
  })

  it('does not fire onDragEnd when movement stays below 4 px threshold', () => {
    const onDragEnd = vi.fn()
    const { container } = render(
      <ShapeElement
        element={makeShape()}
        isSelected={true}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
        onDragEnd={onDragEnd}
      />
    )
    const el = container.firstChild as HTMLElement

    fireEvent.mouseDown(el, { button: 0, clientX: 100, clientY: 100 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 102, clientY: 101, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 102, clientY: 101, bubbles: true }))

    expect(onDragEnd).not.toHaveBeenCalled()
  })

  it('sets grabbing cursor on body during drag', () => {
    const { container } = render(
      <ShapeElement element={makeShape()} isSelected={true} onSelect={vi.fn()} onUpdate={vi.fn()} />
    )
    const el = container.firstChild as HTMLElement

    fireEvent.mouseDown(el, { button: 0, clientX: 100, clientY: 100 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 120, bubbles: true }))

    expect(document.body.style.cursor).toBe('grabbing')

    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 150, clientY: 120, bubbles: true }))
    expect(document.body.style.cursor).toBe('')
  })

  it('cleans up window listeners after drag ends', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    const { container } = render(
      <ShapeElement element={makeShape()} isSelected={true} onSelect={vi.fn()} onUpdate={vi.fn()} />
    )
    const el = container.firstChild as HTMLElement

    fireEvent.mouseDown(el, { button: 0, clientX: 100, clientY: 100 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 120, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 150, clientY: 120, bubbles: true }))

    expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    removeEventListenerSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// boxSizing — ensures border does not bleed outside bounds
// ---------------------------------------------------------------------------

describe('box-sizing', () => {
  it('uses border-box sizing', () => {
    const { container } = render(
      <ShapeElement
        element={makeShape()}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
      />
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.boxSizing).toBe('border-box')
  })
})

// ---------------------------------------------------------------------------
// onDragEnd is optional — no error when omitted
// ---------------------------------------------------------------------------

describe('optional onDragEnd', () => {
  it('does not throw when onDragEnd is not provided and a drag occurs', () => {
    const { container } = render(
      <ShapeElement element={makeShape()} isSelected={true} onSelect={vi.fn()} onUpdate={vi.fn()} />
    )
    const el = container.firstChild as HTMLElement

    expect(() => {
      fireEvent.mouseDown(el, { button: 0, clientX: 100, clientY: 100 })
      window.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 150, clientY: 150, bubbles: true })
      )
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: 150, clientY: 150, bubbles: true }))
    }).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// AC 3 — selected shape shows four corner resize handles
// ---------------------------------------------------------------------------

describe('AC3: resize handles visibility', () => {
  it('renders four resize handles when selected', () => {
    const { getByTestId } = render(
      <ShapeElement element={makeShape()} isSelected={true} onSelect={vi.fn()} onUpdate={vi.fn()} />
    )
    expect(getByTestId('shape-resize-handle-tl')).toBeInTheDocument()
    expect(getByTestId('shape-resize-handle-tr')).toBeInTheDocument()
    expect(getByTestId('shape-resize-handle-bl')).toBeInTheDocument()
    expect(getByTestId('shape-resize-handle-br')).toBeInTheDocument()
  })

  it('does not render resize handles when not selected', () => {
    const { queryByTestId } = render(
      <ShapeElement
        element={makeShape()}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
      />
    )
    expect(queryByTestId('shape-resize-handle-tl')).toBeNull()
    expect(queryByTestId('shape-resize-handle-tr')).toBeNull()
    expect(queryByTestId('shape-resize-handle-bl')).toBeNull()
    expect(queryByTestId('shape-resize-handle-br')).toBeNull()
  })

  it('handles are 10x10 px with blue fill', () => {
    const { getByTestId } = render(
      <ShapeElement element={makeShape()} isSelected={true} onSelect={vi.fn()} onUpdate={vi.fn()} />
    )
    const handle = getByTestId('shape-resize-handle-br')
    expect(handle.style.width).toBe('10px')
    expect(handle.style.height).toBe('10px')
    // jsdom normalises hex to rgb
    expect(handle.style.background).toMatch(/rgb\(59,\s*130,\s*246\)|#3B82F6/i)
  })
})

// ---------------------------------------------------------------------------
// AC 4 — dragging a corner handle resizes the element; minimum size 20 × 20
// ---------------------------------------------------------------------------

describe('AC4: corner handle resize', () => {
  it('dragging the bottom-right handle increases width and height', () => {
    const onUpdate = vi.fn()
    const { getByTestId } = render(
      <ShapeElement
        element={makeShape({ x: 100, y: 200, width: 160, height: 160 })}
        isSelected={true}
        onSelect={vi.fn()}
        onUpdate={onUpdate}
      />
    )
    const handle = getByTestId('shape-resize-handle-br')

    fireEvent.mouseDown(handle, { clientX: 260, clientY: 360 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 310, clientY: 410, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 310, clientY: 410, bubbles: true }))

    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0]
    expect(lastCall.width).toBe(210)
    expect(lastCall.height).toBe(210)
  })

  it('dragging the bottom-right handle does not go below minimum width of 20', () => {
    const onUpdate = vi.fn()
    const { getByTestId } = render(
      <ShapeElement
        element={makeShape({ x: 100, y: 200, width: 160, height: 160 })}
        isSelected={true}
        onSelect={vi.fn()}
        onUpdate={onUpdate}
      />
    )
    const handle = getByTestId('shape-resize-handle-br')

    // Drag far to the left to make width tiny
    fireEvent.mouseDown(handle, { clientX: 260, clientY: 360 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 250, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 50, clientY: 250, bubbles: true }))

    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0]
    expect(lastCall.width).toBeGreaterThanOrEqual(20)
    expect(lastCall.height).toBeGreaterThanOrEqual(20)
  })

  it('dragging the top-left handle decreases width and height and moves x/y', () => {
    const onUpdate = vi.fn()
    const { getByTestId } = render(
      <ShapeElement
        element={makeShape({ x: 100, y: 200, width: 160, height: 160 })}
        isSelected={true}
        onSelect={vi.fn()}
        onUpdate={onUpdate}
      />
    )
    const handle = getByTestId('shape-resize-handle-tl')

    fireEvent.mouseDown(handle, { clientX: 100, clientY: 200 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 120, clientY: 220, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 120, clientY: 220, bubbles: true }))

    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0]
    expect(lastCall.x).toBe(120) // x moved right by 20
    expect(lastCall.y).toBe(220) // y moved down by 20
    expect(lastCall.width).toBe(140) // width decreased by 20
    expect(lastCall.height).toBe(140) // height decreased by 20
  })
})

// ---------------------------------------------------------------------------
// AC 5 — top/left handle drags keep the anchor corner stationary
// ---------------------------------------------------------------------------

describe('AC5: anchor corner remains stationary during top/left handle drag', () => {
  it('top-left drag: bottom-right corner stays at original position', () => {
    const onUpdate = vi.fn()
    const element = makeShape({ x: 100, y: 200, width: 160, height: 160 })
    // Bottom-right anchor = (100+160, 200+160) = (260, 360)
    const { getByTestId } = render(
      <ShapeElement element={element} isSelected={true} onSelect={vi.fn()} onUpdate={onUpdate} />
    )
    const handle = getByTestId('shape-resize-handle-tl')

    fireEvent.mouseDown(handle, { clientX: 100, clientY: 200 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 130, clientY: 240, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 130, clientY: 240, bubbles: true }))

    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0]
    // Anchor (bottom-right) must not move: x + width = 260, y + height = 360
    expect(lastCall.x + lastCall.width).toBe(260)
    expect(lastCall.y + lastCall.height).toBe(360)
  })

  it('top-right drag: bottom-left corner stays at original position', () => {
    const onUpdate = vi.fn()
    const element = makeShape({ x: 100, y: 200, width: 160, height: 160 })
    // Bottom-left anchor x = 100, y + height = 360
    const { getByTestId } = render(
      <ShapeElement element={element} isSelected={true} onSelect={vi.fn()} onUpdate={onUpdate} />
    )
    const handle = getByTestId('shape-resize-handle-tr')

    fireEvent.mouseDown(handle, { clientX: 260, clientY: 200 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 230, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 300, clientY: 230, bubbles: true }))

    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0]
    // x anchor unchanged, y + height stays at 360
    expect(lastCall.x).toBe(100)
    expect(lastCall.y + lastCall.height).toBe(360)
  })
})

// ---------------------------------------------------------------------------
// AC 15 — ellipse variant renders with borderRadius 50%
// ---------------------------------------------------------------------------

describe('AC15: ellipse variant rendering', () => {
  it('applies borderRadius 50% for the ellipse shape', () => {
    const { container } = render(
      <ShapeElement
        element={makeShape({ shape: 'ellipse' })}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
      />
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.borderRadius).toBe('50%')
  })

  it('does not apply borderRadius for the rect shape', () => {
    const { container } = render(
      <ShapeElement
        element={makeShape({ shape: 'rect' })}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
      />
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.borderRadius).toBe('')
  })
})

// ---------------------------------------------------------------------------
// AC 16 — triangle variant renders as SVG polygon
// ---------------------------------------------------------------------------

describe('AC16: triangle variant rendering', () => {
  it('renders an SVG element for the triangle shape', () => {
    const { container } = render(
      <ShapeElement
        element={makeShape({ shape: 'triangle' })}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
      />
    )
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('renders a polygon element with the correct vertices', () => {
    const { container } = render(
      <ShapeElement
        element={makeShape({ shape: 'triangle', width: 160, height: 160 })}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
      />
    )
    const polygon = container.querySelector('polygon')
    expect(polygon).not.toBeNull()
    // Top-centre at (width/2, 0) = (80,0), bottom-left (0,160), bottom-right (160,160)
    expect(polygon!.getAttribute('points')).toBe('80,0 0,160 160,160')
  })

  it('uses fill attribute on the polygon', () => {
    const { container } = render(
      <ShapeElement
        element={makeShape({ shape: 'triangle', fill: '#ff0000' })}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
      />
    )
    const polygon = container.querySelector('polygon')!
    expect(polygon.getAttribute('fill')).toBe('#ff0000')
  })

  it('does not render an SVG for the rect shape', () => {
    const { container } = render(
      <ShapeElement
        element={makeShape({ shape: 'rect' })}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
      />
    )
    expect(container.querySelector('svg')).toBeNull()
  })
})
