import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { ArrowElement } from './ArrowElement'
import type { ArrowElement as ArrowElementType, CanvasElement } from '../../../types/canvas'

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
    expect(handle.getAttribute('stroke').toLowerCase()).toContain('3b82f6')
  })

  it('end handle is a filled circle (blue fill)', () => {
    const { getByTestId } = renderElement({}, { isSelected: true })
    const handle = getByTestId('endpoint-end')
    expect(handle.getAttribute('fill').toLowerCase()).toContain('3b82f6')
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
