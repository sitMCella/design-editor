import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LayerRow } from './LayerRow'
import type { TextElement, ImageElement, ArrowElement, TableElement } from '../../types/canvas'

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const makeText = (overrides: Partial<TextElement> = {}): TextElement => ({
  id: 'el-1',
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

const makeImage = (overrides: Partial<ImageElement> = {}): ImageElement => ({
  id: 'el-2',
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

const makeArrow = (overrides: Partial<ArrowElement> = {}): ArrowElement => ({
  id: 'el-3',
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

const makeTable = (overrides: Partial<TableElement> = {}): TableElement => ({
  id: 'el-4',
  type: 'table',
  x: 440,
  y: 300,
  width: 400,
  height: 120,
  rotation: 0,
  opacity: 1,
  locked: false,
  columns: 2,
  columnWidths: [200, 200],
  rows: [
    { isHeader: true, height: 40, cells: ['Header 1', 'Header 2'] },
    { isHeader: false, height: 40, cells: ['Cell 1', 'Cell 2'] },
    { isHeader: false, height: 40, cells: ['Cell 3', 'Cell 4'] },
  ],
  ...overrides,
})

// Default no-op callbacks
const noop = () => {}
const noopEvent = (_e: React.MouseEvent) => {}

// ---------------------------------------------------------------------------
// AC5 — Each row shows element type icon, label, and visibility button
// ---------------------------------------------------------------------------

describe('AC5 — row content: icon, label, visibility button', () => {
  it('renders the label text', () => {
    render(
      <LayerRow
        element={makeText()}
        label="Text 1"
        isSelected={false}
        onSelect={noopEvent}
        onToggleVisibility={noop}
        onDragHandleMouseDown={noopEvent}
      />,
    )
    expect(screen.getByText('Text 1')).toBeInTheDocument()
  })

  it('renders a visibility toggle button for a text element', () => {
    render(
      <LayerRow
        element={makeText()}
        label="Text 1"
        isSelected={false}
        onSelect={noopEvent}
        onToggleVisibility={noop}
        onDragHandleMouseDown={noopEvent}
      />,
    )
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('text element row shows "T" type indicator', () => {
    const { container } = render(
      <LayerRow
        element={makeText()}
        label="Text 1"
        isSelected={false}
        onSelect={noopEvent}
        onToggleVisibility={noop}
        onDragHandleMouseDown={noopEvent}
      />,
    )
    // The ElementIcon for text renders a bold 'T' span
    expect(container.querySelector('span.font-bold')).toHaveTextContent('T')
  })

  it('image element row renders an SVG icon', () => {
    const { container } = render(
      <LayerRow
        element={makeImage()}
        label="Image 1"
        isSelected={false}
        onSelect={noopEvent}
        onToggleVisibility={noop}
        onDragHandleMouseDown={noopEvent}
      />,
    )
    // SVG is present for the image icon
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByText('Image 1')).toBeInTheDocument()
  })

  it('arrow element row shows "→" type indicator', () => {
    const { container } = render(
      <LayerRow
        element={makeArrow()}
        label="Arrow 1"
        isSelected={false}
        onSelect={noopEvent}
        onToggleVisibility={noop}
        onDragHandleMouseDown={noopEvent}
      />,
    )
    expect(container.querySelector('span.font-bold')).toHaveTextContent('→')
  })

  it('table element row renders the table SVG icon', () => {
    const { container } = render(
      <LayerRow
        element={makeTable()}
        label="Table 1"
        isSelected={false}
        onSelect={noopEvent}
        onToggleVisibility={noop}
        onDragHandleMouseDown={noopEvent}
      />,
    )
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByText('Table 1')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC9 — Selected state styling (blue background, blue label text)
// ---------------------------------------------------------------------------

describe('AC9 — selected row styling', () => {
  it('selected row has bg-blue-50 class', () => {
    const { container } = render(
      <LayerRow
        element={makeText()}
        label="Text 1"
        isSelected={true}
        onSelect={noopEvent}
        onToggleVisibility={noop}
        onDragHandleMouseDown={noopEvent}
      />,
    )
    expect(container.firstChild).toHaveClass('bg-blue-50')
  })

  it('selected row label has blue text class', () => {
    const { container } = render(
      <LayerRow
        element={makeText()}
        label="Text 1"
        isSelected={true}
        onSelect={noopEvent}
        onToggleVisibility={noop}
        onDragHandleMouseDown={noopEvent}
      />,
    )
    const label = container.querySelector('.text-blue-700')
    expect(label).toBeInTheDocument()
  })

  it('unselected row does not have bg-blue-50', () => {
    const { container } = render(
      <LayerRow
        element={makeText()}
        label="Text 1"
        isSelected={false}
        onSelect={noopEvent}
        onToggleVisibility={noop}
        onDragHandleMouseDown={noopEvent}
      />,
    )
    expect(container.firstChild).not.toHaveClass('bg-blue-50')
  })
})

// ---------------------------------------------------------------------------
// AC11 — Hidden state styling (opacity-50, crossed-out eye)
// ---------------------------------------------------------------------------

describe('AC11 — hidden row styling and icon', () => {
  it('hidden row has opacity-50 class', () => {
    const { container } = render(
      <LayerRow
        element={makeText({ hidden: true })}
        label="Text 1"
        isSelected={false}
        onSelect={noopEvent}
        onToggleVisibility={noop}
        onDragHandleMouseDown={noopEvent}
      />,
    )
    expect(container.firstChild).toHaveClass('opacity-50')
  })

  it('visible row does not have opacity-50 class', () => {
    const { container } = render(
      <LayerRow
        element={makeText()}
        label="Text 1"
        isSelected={false}
        onSelect={noopEvent}
        onToggleVisibility={noop}
        onDragHandleMouseDown={noopEvent}
      />,
    )
    expect(container.firstChild).not.toHaveClass('opacity-50')
  })

  it('hidden row visibility button has aria-label "Show element"', () => {
    render(
      <LayerRow
        element={makeText({ hidden: true })}
        label="Text 1"
        isSelected={false}
        onSelect={noopEvent}
        onToggleVisibility={noop}
        onDragHandleMouseDown={noopEvent}
      />,
    )
    expect(screen.getByRole('button', { name: 'Show element' })).toBeInTheDocument()
  })

  it('visible row visibility button has aria-label "Hide element"', () => {
    render(
      <LayerRow
        element={makeText()}
        label="Text 1"
        isSelected={false}
        onSelect={noopEvent}
        onToggleVisibility={noop}
        onDragHandleMouseDown={noopEvent}
      />,
    )
    expect(screen.getByRole('button', { name: 'Hide element' })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Callback wiring
// ---------------------------------------------------------------------------

describe('callback wiring', () => {
  it('calls onSelect when the row is clicked', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <LayerRow
        element={makeText()}
        label="Text 1"
        isSelected={false}
        onSelect={onSelect}
        onToggleVisibility={noop}
        onDragHandleMouseDown={noopEvent}
      />,
    )
    fireEvent.click(container.firstChild as HTMLElement)
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('calls onToggleVisibility when the visibility button is clicked', () => {
    const onToggleVisibility = vi.fn()
    render(
      <LayerRow
        element={makeText()}
        label="Text 1"
        isSelected={false}
        onSelect={noopEvent}
        onToggleVisibility={onToggleVisibility}
        onDragHandleMouseDown={noopEvent}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Hide element' }))
    expect(onToggleVisibility).toHaveBeenCalledOnce()
  })

  it('clicking the visibility button does not propagate to onSelect', () => {
    const onSelect = vi.fn()
    render(
      <LayerRow
        element={makeText()}
        label="Text 1"
        isSelected={false}
        onSelect={onSelect}
        onToggleVisibility={noop}
        onDragHandleMouseDown={noopEvent}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Hide element' }))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('calls onDragHandleMouseDown when the drag handle is clicked', () => {
    const onDragHandleMouseDown = vi.fn()
    const { container } = render(
      <LayerRow
        element={makeText()}
        label="Text 1"
        isSelected={false}
        onSelect={noopEvent}
        onToggleVisibility={noop}
        onDragHandleMouseDown={onDragHandleMouseDown}
      />,
    )
    const dragHandle = container.querySelector('[class*="cursor-grab"]')!
    fireEvent.mouseDown(dragHandle)
    expect(onDragHandleMouseDown).toHaveBeenCalledOnce()
  })
})
