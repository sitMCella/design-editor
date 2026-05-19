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
      <ShapeElement element={makeShape()} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />,
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.backgroundColor).toBe('rgb(59, 130, 246)') // #3B82F6
  })

  it('renders with the correct position (left / top)', () => {
    const { container } = render(
      <ShapeElement element={makeShape({ x: 50, y: 75 })} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />,
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
        onSelect={vi.fn()} onUpdate={vi.fn()}
      />,
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
        onSelect={vi.fn()} onUpdate={vi.fn()}
      />,
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
        onSelect={vi.fn()} onUpdate={vi.fn()}
      />,
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.border).toBe('2px solid rgb(0, 0, 0)')
  })

  it('applies opacity from the element', () => {
    const { container } = render(
      <ShapeElement
        element={makeShape({ opacity: 0.5 })}
        isSelected={false}
        onSelect={vi.fn()} onUpdate={vi.fn()}
      />,
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.opacity).toBe('0.5')
  })

  it('renders absolutely positioned', () => {
    const { container } = render(
      <ShapeElement element={makeShape()} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />,
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
      <ShapeElement element={makeShape()} isSelected={true} onSelect={vi.fn()} onUpdate={vi.fn()} />,
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.outline).toBe('2px solid #3B82F6')
  })

  it('shows no outline when not selected', () => {
    const { container } = render(
      <ShapeElement element={makeShape()} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />,
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.outline).toBe('none')
  })

  it('uses grab cursor when selected', () => {
    const { container } = render(
      <ShapeElement element={makeShape()} isSelected={true} onSelect={vi.fn()} onUpdate={vi.fn()} />,
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.cursor).toBe('grab')
  })

  it('uses default cursor when not selected', () => {
    const { container } = render(
      <ShapeElement element={makeShape()} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />,
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
      <ShapeElement element={makeShape()} isSelected={false} onSelect={onSelect} onUpdate={vi.fn()} />,
    )
    fireEvent.click(container.firstChild as HTMLElement)
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('passes the mouse event to onSelect', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <ShapeElement element={makeShape()} isSelected={false} onSelect={onSelect} onUpdate={vi.fn()} />,
    )
    fireEvent.click(container.firstChild as HTMLElement)
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ type: 'click' }))
  })

  it('stops propagation on click so the canvas does not also deselect', () => {
    const parentHandler = vi.fn()
    const { container } = render(
      <div onClick={parentHandler}>
        <ShapeElement element={makeShape()} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />
      </div>,
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
        onSelect={vi.fn()} onUpdate={vi.fn()}
        onDragEnd={onDragEnd}
      />,
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
        onSelect={vi.fn()} onUpdate={vi.fn()}
        onDragEnd={onDragEnd}
      />,
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
        onSelect={vi.fn()} onUpdate={vi.fn()}
        onDragEnd={onDragEnd}
      />,
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
        onSelect={vi.fn()} onUpdate={vi.fn()}
        onDragEnd={onDragEnd}
      />,
    )
    const el = container.firstChild as HTMLElement

    fireEvent.mouseDown(el, { button: 0, clientX: 100, clientY: 100 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 102, clientY: 101, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 102, clientY: 101, bubbles: true }))

    expect(onDragEnd).not.toHaveBeenCalled()
  })

  it('sets grabbing cursor on body during drag', () => {
    const { container } = render(
      <ShapeElement element={makeShape()} isSelected={true} onSelect={vi.fn()} onUpdate={vi.fn()} />,
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
      <ShapeElement element={makeShape()} isSelected={true} onSelect={vi.fn()} onUpdate={vi.fn()} />,
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
      <ShapeElement element={makeShape()} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />,
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
      <ShapeElement element={makeShape()} isSelected={true} onSelect={vi.fn()} onUpdate={vi.fn()} />,
    )
    const el = container.firstChild as HTMLElement

    expect(() => {
      fireEvent.mouseDown(el, { button: 0, clientX: 100, clientY: 100 })
      window.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 150, clientY: 150, bubbles: true }),
      )
      window.dispatchEvent(
        new MouseEvent('mouseup', { clientX: 150, clientY: 150, bubbles: true }),
      )
    }).not.toThrow()
  })
})
