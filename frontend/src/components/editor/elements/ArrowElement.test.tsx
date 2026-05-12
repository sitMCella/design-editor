import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ArrowElement } from './ArrowElement'
import type { ArrowElement as ArrowElementType, CanvasElement, TextElement } from '../../../types/canvas'

// Default element: horizontal arrow from (540,360) to (740,360), strokeWidth=2
// Derived bbox: x=539, y=359, width=202, height=2
const baseElement: ArrowElementType = {
  id: 'arrow-1',
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
}

const noElements: CanvasElement[] = []

const renderElement = (
  overrides: Partial<ArrowElementType> = {},
  props: { isSelected?: boolean } = {}
) => {
  const onSelect = vi.fn()
  const onUpdate = vi.fn()
  const result = render(
    <ArrowElement
      element={{ ...baseElement, ...overrides }}
      isSelected={props.isSelected ?? false}
      onSelect={onSelect}
      onUpdate={onUpdate}
      allElements={noElements}
    />
  )
  return { ...result, onSelect, onUpdate }
}

// ---------------------------------------------------------------------------
// SVG rendering
// ---------------------------------------------------------------------------

describe('SVG rendering', () => {
  it('renders an SVG element', () => {
    const { container } = renderElement()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders a <line> element inside the SVG', () => {
    const { container } = renderElement()
    expect(container.querySelector('line')).toBeInTheDocument()
  })

  it('line x1/y1 are relative to the bounding box left/top', () => {
    const { container } = renderElement()
    // x1=540, x=539 → svgX1=1; y1=360, y=359 → svgY1=1
    const line = container.querySelector('line')!
    expect(line.getAttribute('x1')).toBe('1')
    expect(line.getAttribute('y1')).toBe('1')
  })

  it('line x2/y2 are relative to the bounding box left/top', () => {
    const { container } = renderElement()
    // x2=740, x=539 → svgX2=201; y2=360, y=359 → svgY2=1
    const line = container.querySelector('line')!
    expect(line.getAttribute('x2')).toBe('201')
    expect(line.getAttribute('y2')).toBe('1')
  })

  it('line carries the stroke colour', () => {
    const { container } = renderElement({ stroke: '#ff0000' })
    expect(container.querySelector('line')?.getAttribute('stroke')).toBe('#ff0000')
  })

  it('line carries the strokeWidth', () => {
    const { container } = renderElement({ strokeWidth: 4 })
    expect(container.querySelector('line')?.getAttribute('stroke-width')).toBe('4')
  })

  it('renders an end marker when arrowHead is "end"', () => {
    const { container } = renderElement({ arrowHead: 'end' })
    expect(container.querySelector(`marker[id="arrowhead-end-arrow-1"]`)).toBeInTheDocument()
    expect(container.querySelector(`marker[id="arrowhead-start-arrow-1"]`)).toBeNull()
  })

  it('renders a start marker when arrowHead is "start"', () => {
    const { container } = renderElement({ arrowHead: 'start' })
    expect(container.querySelector(`marker[id="arrowhead-start-arrow-1"]`)).toBeInTheDocument()
    expect(container.querySelector(`marker[id="arrowhead-end-arrow-1"]`)).toBeNull()
  })

  it('renders both markers when arrowHead is "both"', () => {
    const { container } = renderElement({ arrowHead: 'both' })
    expect(container.querySelector(`marker[id="arrowhead-end-arrow-1"]`)).toBeInTheDocument()
    expect(container.querySelector(`marker[id="arrowhead-start-arrow-1"]`)).toBeInTheDocument()
  })

  it('renders no markers when arrowHead is "none"', () => {
    const { container } = renderElement({ arrowHead: 'none' })
    expect(container.querySelector('marker')).toBeNull()
  })

  it('line markerEnd references the end marker when arrowHead is "end"', () => {
    const { container } = renderElement({ id: 'arrow-42', arrowHead: 'end' })
    expect(container.querySelector('line')?.getAttribute('marker-end')).toBe(
      'url(#arrowhead-end-arrow-42)'
    )
  })

  it('line has no markerEnd when arrowHead is "none"', () => {
    const { container } = renderElement({ arrowHead: 'none' })
    expect(container.querySelector('line')?.getAttribute('marker-end')).toBeFalsy()
  })

  it('marker ids are scoped to the element id', () => {
    const { container } = renderElement({ id: 'arrow-99', arrowHead: 'both' })
    expect(container.querySelector('marker[id="arrowhead-end-arrow-99"]')).toBeInTheDocument()
    expect(container.querySelector('marker[id="arrowhead-start-arrow-99"]')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// SVG dimensions from bounding box
// ---------------------------------------------------------------------------

describe('sizing', () => {
  it('SVG width matches element width', () => {
    const { container } = renderElement()
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('202')
  })

  it('SVG height matches element height', () => {
    const { container } = renderElement()
    expect(container.querySelector('svg')?.getAttribute('height')).toBe('2')
  })

  it('wrapper div width matches element width', () => {
    const { container } = renderElement()
    expect((container.firstChild as HTMLElement).style.width).toBe('202px')
  })

  it('wrapper div height matches element height', () => {
    const { container } = renderElement()
    expect((container.firstChild as HTMLElement).style.height).toBe('2px')
  })
})

// ---------------------------------------------------------------------------
// Positioning from bounding box (x, y)
// ---------------------------------------------------------------------------

describe('positioning', () => {
  it('wrapper is absolutely positioned', () => {
    const { container } = renderElement()
    expect((container.firstChild as HTMLElement).style.position).toBe('absolute')
  })

  it('left matches element x (bounding box left)', () => {
    const { container } = renderElement()
    expect((container.firstChild as HTMLElement).style.left).toBe('539px')
  })

  it('top matches element y (bounding box top)', () => {
    const { container } = renderElement()
    expect((container.firstChild as HTMLElement).style.top).toBe('359px')
  })
})

// ---------------------------------------------------------------------------
// Opacity and rotation
// ---------------------------------------------------------------------------

describe('opacity and rotation', () => {
  it('applies opacity to the wrapper', () => {
    const { container } = renderElement({ opacity: 0.5 })
    expect((container.firstChild as HTMLElement).style.opacity).toBe('0.5')
  })

  it('applies rotation transform to the wrapper', () => {
    const { container } = renderElement({ rotation: 45 })
    expect((container.firstChild as HTMLElement).style.transform).toBe('rotate(45deg)')
  })
})

// ---------------------------------------------------------------------------
// Selection outline
// ---------------------------------------------------------------------------

describe('selection', () => {
  it('calls onSelect when the wrapper div is clicked', () => {
    const { container, onSelect } = renderElement()
    fireEvent.click(container.firstChild as HTMLElement)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('applies a blue outline when isSelected is true', () => {
    const { container } = renderElement({}, { isSelected: true })
    const el = container.firstChild as HTMLElement
    expect(el.style.outline).toContain('solid')
    expect(el.style.outline.toLowerCase()).toContain('3b82f6')
  })

  it('applies no outline when isSelected is false', () => {
    const { container } = renderElement({}, { isSelected: false })
    expect((container.firstChild as HTMLElement).style.outline).toBe('none')
  })
})

// ---------------------------------------------------------------------------
// Cursor
// ---------------------------------------------------------------------------

describe('cursor', () => {
  it('shows grab cursor on the wrapper when selected', () => {
    const { container } = renderElement({}, { isSelected: true })
    expect((container.firstChild as HTMLElement).style.cursor).toBe('grab')
  })

  it('shows default cursor on the wrapper when not selected', () => {
    const { container } = renderElement({}, { isSelected: false })
    expect((container.firstChild as HTMLElement).style.cursor).toBe('default')
  })
})

// ---------------------------------------------------------------------------
// Endpoint handles
// ---------------------------------------------------------------------------

describe('endpoint handles', () => {
  it('shows start and end handles when selected', () => {
    const { getByTestId } = renderElement({}, { isSelected: true })
    expect(getByTestId('endpoint-start')).toBeInTheDocument()
    expect(getByTestId('endpoint-end')).toBeInTheDocument()
  })

  it('hides handles when not selected', () => {
    const { queryByTestId } = renderElement({}, { isSelected: false })
    expect(queryByTestId('endpoint-start')).toBeNull()
    expect(queryByTestId('endpoint-end')).toBeNull()
  })

  it('start handle is a hollow circle (white fill, blue stroke)', () => {
    const { getByTestId } = renderElement({}, { isSelected: true })
    const handle = getByTestId('endpoint-start')
    expect(handle.getAttribute('fill')).toBe('white')
    expect(handle.getAttribute('stroke')!.toLowerCase()).toContain('3b82f6')
  })

  it('end handle is a filled circle (blue fill)', () => {
    const { getByTestId } = renderElement({}, { isSelected: true })
    const handle = getByTestId('endpoint-end')
    expect(handle.getAttribute('fill')!.toLowerCase()).toContain('3b82f6')
  })

  it('start handle is positioned at svgX1, svgY1', () => {
    const { getByTestId } = renderElement({}, { isSelected: true })
    // svgX1 = x1 - x = 540 - 539 = 1; svgY1 = y1 - y = 360 - 359 = 1
    const handle = getByTestId('endpoint-start')
    expect(handle.getAttribute('cx')).toBe('1')
    expect(handle.getAttribute('cy')).toBe('1')
  })

  it('end handle is positioned at svgX2, svgY2', () => {
    const { getByTestId } = renderElement({}, { isSelected: true })
    // svgX2 = x2 - x = 740 - 539 = 201; svgY2 = y2 - y = 360 - 359 = 1
    const handle = getByTestId('endpoint-end')
    expect(handle.getAttribute('cx')).toBe('201')
    expect(handle.getAttribute('cy')).toBe('1')
  })
})

// ---------------------------------------------------------------------------
// Marker id uniqueness
// ---------------------------------------------------------------------------

describe('marker id uniqueness', () => {
  it('uses different marker ids for elements with different ids', () => {
    const { container: c1 } = render(
      <ArrowElement
        element={{ ...baseElement, id: 'arrow-a' }}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
        allElements={noElements}
      />
    )
    const { container: c2 } = render(
      <ArrowElement
        element={{ ...baseElement, id: 'arrow-b' }}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
        allElements={noElements}
      />
    )
    const id1 = c1.querySelector('marker')?.getAttribute('id')
    const id2 = c2.querySelector('marker')?.getAttribute('id')
    expect(id1).not.toBe(id2)
  })
})

// ---------------------------------------------------------------------------
// Body drag — AC1, AC2, AC3, AC4
// ---------------------------------------------------------------------------

describe('body drag', () => {
  it('AC1: moves both endpoints by the mouse delta', () => {
    const { container, onUpdate } = renderElement({}, { isSelected: true })
    const wrapper = container.firstChild as HTMLElement

    fireEvent.mouseDown(wrapper, { clientX: 100, clientY: 100 })
    // delta (50, 20) > 4px threshold
    fireEvent.mouseMove(window, { clientX: 150, clientY: 120 })
    fireEvent.mouseUp(window)

    const patch = onUpdate.mock.calls[0][0]
    // x1=540+50=590, y1=360+20=380, x2=740+50=790, y2=360+20=380
    expect(patch.x1).toBe(590)
    expect(patch.y1).toBe(380)
    expect(patch.x2).toBe(790)
    expect(patch.y2).toBe(380)
  })

  it('AC2: body drag does not trigger onSelect', () => {
    const { container, onSelect, onUpdate } = renderElement({}, { isSelected: true })
    const wrapper = container.firstChild as HTMLElement

    fireEvent.mouseDown(wrapper, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(window, { clientX: 150, clientY: 120 })
    fireEvent.mouseUp(window)

    expect(onUpdate).toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('AC3: clamps x2 to the right surface boundary', () => {
    const { container, onUpdate } = renderElement({ x2: 1270, y2: 360 }, { isSelected: true })
    const wrapper = container.firstChild as HTMLElement

    // Try to drag 200px right; x2 would exceed 1280
    fireEvent.mouseDown(wrapper, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 200, clientY: 0 })
    fireEvent.mouseUp(window)

    const patch = onUpdate.mock.calls[0][0]
    expect(patch.x2).toBeLessThanOrEqual(1280)
  })

  it('AC3: clamps x1 to the left surface boundary (0)', () => {
    const { container, onUpdate } = renderElement({ x1: 10, y1: 360 }, { isSelected: true })
    const wrapper = container.firstChild as HTMLElement

    // Try to drag 200px left; x1 would go below 0
    fireEvent.mouseDown(wrapper, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: -200, clientY: 0 })
    fireEvent.mouseUp(window)

    const patch = onUpdate.mock.calls[0][0]
    expect(patch.x1).toBeGreaterThanOrEqual(0)
  })

  it('AC4: clears startAnchor and endAnchor when body drag begins', () => {
    const { container, onUpdate } = renderElement(
      {
        startAnchor: { elementId: 'el-1', side: 'right' },
        endAnchor: { elementId: 'el-2', side: 'left' },
      },
      { isSelected: true }
    )
    const wrapper = container.firstChild as HTMLElement

    fireEvent.mouseDown(wrapper, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(window, { clientX: 150, clientY: 120 })
    fireEvent.mouseUp(window)

    const patch = onUpdate.mock.calls[0][0]
    expect(patch.startAnchor).toBeUndefined()
    expect(patch.endAnchor).toBeUndefined()
  })

  it('does not drag when not selected', () => {
    const { container, onUpdate } = renderElement({}, { isSelected: false })
    const wrapper = container.firstChild as HTMLElement

    fireEvent.mouseDown(wrapper, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(window, { clientX: 150, clientY: 120 })
    fireEvent.mouseUp(window)

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('does not call onUpdate when movement is below the 4px threshold', () => {
    const { container, onUpdate } = renderElement({}, { isSelected: true })
    const wrapper = container.firstChild as HTMLElement

    // distance = sqrt(2^2 + 1^2) ≈ 2.2 < 4
    fireEvent.mouseDown(wrapper, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(window, { clientX: 102, clientY: 101 })
    fireEvent.mouseUp(window)

    expect(onUpdate).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Endpoint drag — AC5, AC6, AC7, AC8
// ---------------------------------------------------------------------------

describe('endpoint drag', () => {
  it('AC5: start handle is visible when selected', () => {
    const { getByTestId } = renderElement({}, { isSelected: true })
    expect(getByTestId('endpoint-start')).toBeInTheDocument()
  })

  it('AC6: start handle drag updates only x1 and y1', () => {
    const onUpdate = vi.fn()
    render(
      <ArrowElement
        element={baseElement}
        isSelected={true}
        onSelect={vi.fn()}
        onUpdate={onUpdate}
        allElements={noElements}
      />
    )
    const startHandle = screen.getByTestId('endpoint-start')

    // clientX=0,clientY=0 as reference; move to (100,50) → delta=(100,50)
    // startPtX=x1=540, startPtY=y1=360 → new x1=640, y1=410
    fireEvent.mouseDown(startHandle, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 100, clientY: 50 })
    fireEvent.mouseUp(window)

    const posCall = onUpdate.mock.calls.find((c) => 'x1' in c[0])!
    expect(posCall[0].x1).toBe(640)
    expect(posCall[0].y1).toBe(410)
    // x2 must NOT be in the position patch from mousemove
    expect(posCall[0].x2).toBeUndefined()
  })

  it('AC7: end handle drag updates only x2 and y2', () => {
    const onUpdate = vi.fn()
    render(
      <ArrowElement
        element={baseElement}
        isSelected={true}
        onSelect={vi.fn()}
        onUpdate={onUpdate}
        allElements={noElements}
      />
    )
    const endHandle = screen.getByTestId('endpoint-end')

    // startPtX=x2=740, startPtY=y2=360 → delta=(100,50) → new x2=840, y2=410
    fireEvent.mouseDown(endHandle, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 100, clientY: 50 })
    fireEvent.mouseUp(window)

    const posCall = onUpdate.mock.calls.find((c) => 'x2' in c[0])!
    expect(posCall[0].x2).toBe(840)
    expect(posCall[0].y2).toBe(410)
    expect(posCall[0].x1).toBeUndefined()
  })

  it('AC8: end handle clamps to right surface boundary', () => {
    const onUpdate = vi.fn()
    render(
      <ArrowElement
        element={{ ...baseElement, x2: 1270, y2: 360 }}
        isSelected={true}
        onSelect={vi.fn()}
        onUpdate={onUpdate}
        allElements={noElements}
      />
    )
    const endHandle = screen.getByTestId('endpoint-end')

    // Try to drag 200px right — would put x2 at 1470 without clamping
    fireEvent.mouseDown(endHandle, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 200, clientY: 0 })
    fireEvent.mouseUp(window)

    const posCall = onUpdate.mock.calls.find((c) => 'x2' in c[0])!
    expect(posCall[0].x2).toBeLessThanOrEqual(1280)
  })

  it('AC8: start handle clamps to left surface boundary (0)', () => {
    const onUpdate = vi.fn()
    render(
      <ArrowElement
        element={{ ...baseElement, x1: 10, y1: 360 }}
        isSelected={true}
        onSelect={vi.fn()}
        onUpdate={onUpdate}
        allElements={noElements}
      />
    )
    const startHandle = screen.getByTestId('endpoint-start')

    fireEvent.mouseDown(startHandle, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: -200, clientY: 0 })
    fireEvent.mouseUp(window)

    const posCall = onUpdate.mock.calls.find((c) => 'x1' in c[0])!
    expect(posCall[0].x1).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// Snap behavior — AC9, AC10, AC12
// ---------------------------------------------------------------------------

// A text element whose right anchor sits at (539, 360) — 1px from x1=540, y1=360
const snapTextElement: TextElement = {
  id: 'snap-target',
  type: 'text',
  x: 439,
  y: 340,
  width: 100,
  height: 40,
  rotation: 0,
  opacity: 1,
  locked: false,
  content: '',
  fontSize: 16,
  fontFamily: 'Inter, sans-serif',
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#000000',
  align: 'left',
}
// right anchor of snapTextElement = (439+100, 340+20) = (539, 360)
// distance from x1=540, y1=360 → 1 px  ≤ 12 → snaps

describe('snap behavior', () => {
  it('AC9: shows snap indicator when endpoint is within snap radius of an anchor', () => {
    const onUpdate = vi.fn()
    render(
      <ArrowElement
        element={baseElement}
        isSelected={true}
        onSelect={vi.fn()}
        onUpdate={onUpdate}
        allElements={[snapTextElement]}
      />
    )
    const startHandle = screen.getByTestId('endpoint-start')

    // No movement — start point stays at (540,360), which is 1px from anchor (539,360)
    fireEvent.mouseDown(startHandle, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 0, clientY: 0 })

    expect(screen.getByTestId('snap-indicator')).toBeInTheDocument()
    fireEvent.mouseUp(window)
  })

  it('AC9: snap indicator disappears after mouseup', () => {
    const onUpdate = vi.fn()
    render(
      <ArrowElement
        element={baseElement}
        isSelected={true}
        onSelect={vi.fn()}
        onUpdate={onUpdate}
        allElements={[snapTextElement]}
      />
    )
    const startHandle = screen.getByTestId('endpoint-start')

    fireEvent.mouseDown(startHandle, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 0, clientY: 0 })
    fireEvent.mouseUp(window)

    expect(screen.queryByTestId('snap-indicator')).toBeNull()
  })

  it('AC10: stores startAnchor on mouseup when snap target is active', () => {
    const onUpdate = vi.fn()
    render(
      <ArrowElement
        element={baseElement}
        isSelected={true}
        onSelect={vi.fn()}
        onUpdate={onUpdate}
        allElements={[snapTextElement]}
      />
    )
    const startHandle = screen.getByTestId('endpoint-start')

    fireEvent.mouseDown(startHandle, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 0, clientY: 0 })
    fireEvent.mouseUp(window)

    // The mouseup call stores the connection — find the call with a non-undefined startAnchor
    // (mousemove patches set startAnchor: undefined so we must filter those out)
    const anchorCall = onUpdate.mock.calls.find((c) => c[0].startAnchor !== undefined)
    expect(anchorCall).toBeDefined()
    expect(anchorCall![0].startAnchor).toEqual({ elementId: 'snap-target', side: 'right' })
  })

  it('AC10: stores endAnchor when end handle snaps to a target', () => {
    // Text element with left anchor at (741, 360) — 1px from x2=740, y2=360
    const targetEl: TextElement = {
      ...snapTextElement,
      id: 'end-target',
      x: 741,
      y: 340,
      width: 100,
      height: 40,
    }
    // left anchor = (741, 360) — distance from (740,360) = 1 ≤ 12 ✓

    const onUpdate = vi.fn()
    render(
      <ArrowElement
        element={baseElement}
        isSelected={true}
        onSelect={vi.fn()}
        onUpdate={onUpdate}
        allElements={[targetEl]}
      />
    )
    const endHandle = screen.getByTestId('endpoint-end')

    fireEvent.mouseDown(endHandle, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 0, clientY: 0 })
    fireEvent.mouseUp(window)

    const anchorCall = onUpdate.mock.calls.find((c) => c[0].endAnchor !== undefined)
    expect(anchorCall).toBeDefined()
    expect(anchorCall![0].endAnchor).toEqual({ elementId: 'end-target', side: 'left' })
  })

  it('AC12: does not store an anchor when released far from any target', () => {
    const onUpdate = vi.fn()
    render(
      <ArrowElement
        element={baseElement}
        isSelected={true}
        onSelect={vi.fn()}
        onUpdate={onUpdate}
        allElements={[snapTextElement]}
      />
    )
    const startHandle = screen.getByTestId('endpoint-start')

    // Move far away (100px) so no snap activates
    fireEvent.mouseDown(startHandle, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 100, clientY: 0 })
    fireEvent.mouseUp(window)

    // No call should have a non-undefined startAnchor (mousemove sets startAnchor: undefined which we skip)
    const anchorCall = onUpdate.mock.calls.find((c) => c[0].startAnchor !== undefined)
    expect(anchorCall).toBeUndefined()
  })

  it('does not snap to arrow elements', () => {
    const arrowEl: ArrowElementType = {
      ...baseElement,
      id: 'other-arrow',
    }
    const onUpdate = vi.fn()
    render(
      <ArrowElement
        element={baseElement}
        isSelected={true}
        onSelect={vi.fn()}
        onUpdate={onUpdate}
        allElements={[arrowEl]}
      />
    )
    const startHandle = screen.getByTestId('endpoint-start')

    fireEvent.mouseDown(startHandle, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 0, clientY: 0 })
    fireEvent.mouseUp(window)

    expect(screen.queryByTestId('snap-indicator')).toBeNull()
    const anchorCall = onUpdate.mock.calls.find((c) => c[0].startAnchor !== undefined)
    expect(anchorCall).toBeUndefined()
  })
})
