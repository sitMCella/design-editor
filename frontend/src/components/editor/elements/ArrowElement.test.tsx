import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { ArrowElement } from './ArrowElement'
import type { ArrowElement as ArrowElementType } from '../../../types/canvas'

const baseElement: ArrowElementType = {
  id: 'arrow-1',
  type: 'arrow',
  x: 540,
  y: 355,
  width: 200,
  height: 10,
  rotation: 0,
  opacity: 1,
  locked: false,
  stroke: '#111827',
  strokeWidth: 2,
  arrowHead: 'end',
}

const renderElement = (
  overrides: Partial<ArrowElementType> = {},
  props: { isSelected?: boolean } = {}
) => {
  const onSelect = vi.fn()
  const result = render(
    <ArrowElement
      element={{ ...baseElement, ...overrides }}
      isSelected={props.isSelected ?? false}
      onSelect={onSelect}
    />
  )
  return { ...result, onSelect }
}

// AC 4 — arrow is rendered as a horizontal line with a filled arrowhead at its right end
describe('SVG rendering', () => {
  it('renders an SVG element', () => {
    const { container } = renderElement()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders a <line> element inside the SVG', () => {
    const { container } = renderElement()
    expect(container.querySelector('line')).toBeInTheDocument()
  })

  it('line starts at x1=0 (left edge)', () => {
    const { container } = renderElement()
    expect(container.querySelector('line')?.getAttribute('x1')).toBe('0')
  })

  it('line ends at x2=width (right edge)', () => {
    const { container } = renderElement({ width: 200 })
    expect(container.querySelector('line')?.getAttribute('x2')).toBe('200')
  })

  it('line is horizontal — y1 and y2 are equal (mid-height)', () => {
    const { container } = renderElement({ height: 10 })
    const line = container.querySelector('line')!
    expect(line.getAttribute('y1')).toBe('5')
    expect(line.getAttribute('y2')).toBe('5')
  })

  it('line carries the stroke colour', () => {
    const { container } = renderElement({ stroke: '#ff0000' })
    expect(container.querySelector('line')?.getAttribute('stroke')).toBe('#ff0000')
  })

  it('line carries the strokeWidth', () => {
    const { container } = renderElement({ strokeWidth: 2 })
    expect(container.querySelector('line')?.getAttribute('stroke-width')).toBe('2')
  })

  it('renders a <marker> element for the arrowhead', () => {
    const { container } = renderElement()
    expect(container.querySelector('marker')).toBeInTheDocument()
  })

  it('marker id is scoped to the element id to avoid collisions', () => {
    const { container } = renderElement({ id: 'arrow-42' })
    expect(container.querySelector('marker')?.getAttribute('id')).toBe('arrowhead-arrow-42')
  })

  it('marker contains a filled triangle path', () => {
    const { container } = renderElement()
    const path = container.querySelector('marker path')
    expect(path).toBeInTheDocument()
    expect(path?.getAttribute('d')).toBe('M0,0 L0,6 L8,3 z')
  })

  it('marker path fill matches the stroke colour', () => {
    const { container } = renderElement({ stroke: '#111827' })
    expect(container.querySelector('marker path')?.getAttribute('fill')).toBe('#111827')
  })

  it('line markerEnd references the element-scoped marker id', () => {
    const { container } = renderElement({ id: 'arrow-42' })
    expect(container.querySelector('line')?.getAttribute('marker-end')).toBe(
      'url(#arrowhead-arrow-42)'
    )
  })
})

// AC 4 — SVG dimensions match the element width/height
describe('sizing', () => {
  it('SVG width matches element width', () => {
    const { container } = renderElement({ width: 200 })
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('200')
  })

  it('SVG height matches element height', () => {
    const { container } = renderElement({ height: 10 })
    expect(container.querySelector('svg')?.getAttribute('height')).toBe('10')
  })

  it('wrapper div width matches element width', () => {
    const { container } = renderElement({ width: 200 })
    expect((container.firstChild as HTMLElement).style.width).toBe('200px')
  })

  it('wrapper div height matches element height', () => {
    const { container } = renderElement({ height: 10 })
    expect((container.firstChild as HTMLElement).style.height).toBe('10px')
  })
})

// AC 4 — element is positioned absolutely at (x, y)
describe('positioning', () => {
  it('wrapper is absolutely positioned', () => {
    const { container } = renderElement({ x: 540, y: 355 })
    const el = container.firstChild as HTMLElement
    expect(el.style.position).toBe('absolute')
  })

  it('left matches element x', () => {
    const { container } = renderElement({ x: 540 })
    expect((container.firstChild as HTMLElement).style.left).toBe('540px')
  })

  it('top matches element y', () => {
    const { container } = renderElement({ y: 355 })
    expect((container.firstChild as HTMLElement).style.top).toBe('355px')
  })
})

// AC 4 — opacity and rotation are applied
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

// AC 5 — clicking the arrow element selects it and shows a blue bounding-box outline
describe('selection', () => {
  it('calls onSelect when the hit area is clicked', () => {
    const { container, onSelect } = renderElement()
    fireEvent.click(container.querySelector('rect')!)
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

// Cursor reflects selection state via the transparent hit-area rect
describe('cursor', () => {
  it('shows grab cursor on the hit area when selected', () => {
    const { container } = renderElement({}, { isSelected: true })
    expect((container.querySelector('rect') as HTMLElement).style.cursor).toBe('grab')
  })

  it('shows default cursor on the hit area when not selected', () => {
    const { container } = renderElement({}, { isSelected: false })
    expect((container.querySelector('rect') as HTMLElement).style.cursor).toBe('default')
  })
})

// Marker id uniqueness — multiple arrow elements rendered at once must not share marker ids
describe('marker id uniqueness', () => {
  it('uses different marker ids for elements with different ids', () => {
    const { container: c1 } = render(
      <ArrowElement
        element={{ ...baseElement, id: 'arrow-a' }}
        isSelected={false}
        onSelect={vi.fn()}
      />
    )
    const { container: c2 } = render(
      <ArrowElement
        element={{ ...baseElement, id: 'arrow-b' }}
        isSelected={false}
        onSelect={vi.fn()}
      />
    )
    const id1 = c1.querySelector('marker')?.getAttribute('id')
    const id2 = c2.querySelector('marker')?.getAttribute('id')
    expect(id1).not.toBe(id2)
  })
})
