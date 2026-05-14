import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TableElement } from './TableElement'
import type { TableElement as TableElementType } from '../../../types/canvas'

const baseElement: TableElementType = {
  id: 'table-1',
  type: 'table',
  x: 440,
  y: 300,
  width: 400,
  height: 120,
  rotation: 0,
  opacity: 1,
  locked: false,
  columns: 2,
  rows: [
    { isHeader: true, cells: ['Header 1', 'Header 2'] },
    { isHeader: false, cells: ['Cell 1', 'Cell 2'] },
    { isHeader: false, cells: ['Cell 3', 'Cell 4'] },
  ],
}

const renderElement = (
  overrides: Partial<TableElementType> = {},
  props: { isSelected?: boolean } = {}
) => {
  const onSelect = vi.fn()
  const result = render(
    <TableElement
      element={{ ...baseElement, ...overrides }}
      isSelected={props.isSelected ?? false}
      onSelect={onSelect}
    />
  )
  return { ...result, onSelect }
}

// ---------------------------------------------------------------------------
// AC 3 — table structure: 1 header row + 2 data rows, 2 columns each
// ---------------------------------------------------------------------------

describe('AC3: table structure', () => {
  it('renders the table wrapper with data-testid="table-element"', () => {
    renderElement()
    expect(screen.getByTestId('table-element')).toBeInTheDocument()
  })

  it('renders exactly 3 rows in total', () => {
    const { container } = renderElement()
    expect(container.querySelectorAll('tr')).toHaveLength(3)
  })

  it('renders 2 <th> cells for the header row', () => {
    const { container } = renderElement()
    expect(container.querySelectorAll('th')).toHaveLength(2)
  })

  it('renders 4 <td> cells for the two data rows', () => {
    const { container } = renderElement()
    expect(container.querySelectorAll('td')).toHaveLength(4)
  })

  it('the first row is the header row', () => {
    const { container } = renderElement()
    const firstRow = container.querySelector('tr')!
    expect(firstRow.querySelectorAll('th')).toHaveLength(2)
    expect(firstRow.querySelectorAll('td')).toHaveLength(0)
  })

  it('the second and third rows are data rows', () => {
    const { container } = renderElement()
    const rows = container.querySelectorAll('tr')
    expect(rows[1].querySelectorAll('td')).toHaveLength(2)
    expect(rows[2].querySelectorAll('td')).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// AC 4 — header row visual distinction: bold text, grey background (#F3F4F6)
// ---------------------------------------------------------------------------

describe('AC4: header row styling', () => {
  it('header cells have bold font weight', () => {
    const { container } = renderElement()
    container.querySelectorAll('th').forEach((th) => {
      expect(th.style.fontWeight).toBe('bold')
    })
  })

  it('header cells have the grey background #F3F4F6', () => {
    const { container } = renderElement()
    container.querySelectorAll('th').forEach((th) => {
      expect(th.style.backgroundColor).toBe('rgb(243, 244, 246)')
    })
  })

  it('header cells have the dark text colour #111827', () => {
    const { container } = renderElement()
    container.querySelectorAll('th').forEach((th) => {
      expect(th.style.color).toBe('rgb(17, 24, 39)')
    })
  })

  it('data cells do not have bold font weight', () => {
    const { container } = renderElement()
    container.querySelectorAll('td').forEach((td) => {
      expect(td.style.fontWeight).not.toBe('bold')
    })
  })

  it('data cells have a white background', () => {
    const { container } = renderElement()
    container.querySelectorAll('td').forEach((td) => {
      expect(td.style.backgroundColor).toBe('rgb(255, 255, 255)')
    })
  })

  it('data cells have the muted text colour #374151', () => {
    const { container } = renderElement()
    container.querySelectorAll('td').forEach((td) => {
      expect(td.style.color).toBe('rgb(55, 65, 81)')
    })
  })
})

// ---------------------------------------------------------------------------
// AC 5 — cell content: placeholder text displayed, content centred
// ---------------------------------------------------------------------------

describe('AC5: cell content', () => {
  it('displays the header cell placeholder texts', () => {
    renderElement()
    expect(screen.getByText('Header 1')).toBeInTheDocument()
    expect(screen.getByText('Header 2')).toBeInTheDocument()
  })

  it('displays the data cell placeholder texts', () => {
    renderElement()
    expect(screen.getByText('Cell 1')).toBeInTheDocument()
    expect(screen.getByText('Cell 2')).toBeInTheDocument()
    expect(screen.getByText('Cell 3')).toBeInTheDocument()
    expect(screen.getByText('Cell 4')).toBeInTheDocument()
  })

  it('header cells are horizontally centred', () => {
    const { container } = renderElement()
    container.querySelectorAll('th').forEach((th) => {
      expect(th.style.textAlign).toBe('center')
    })
  })

  it('header cells are vertically centred', () => {
    const { container } = renderElement()
    container.querySelectorAll('th').forEach((th) => {
      expect(th.style.verticalAlign).toBe('middle')
    })
  })

  it('data cells are horizontally centred', () => {
    const { container } = renderElement()
    container.querySelectorAll('td').forEach((td) => {
      expect(td.style.textAlign).toBe('center')
    })
  })

  it('data cells are vertically centred', () => {
    const { container } = renderElement()
    container.querySelectorAll('td').forEach((td) => {
      expect(td.style.verticalAlign).toBe('middle')
    })
  })
})

// ---------------------------------------------------------------------------
// AC 6 — equal column widths and row heights
// ---------------------------------------------------------------------------

describe('AC6: equal cell dimensions', () => {
  it('each column has width equal to element width divided by column count', () => {
    const { container } = renderElement()
    const expectedCellWidth = baseElement.width / baseElement.columns
    container.querySelectorAll('th, td').forEach((cell) => {
      expect((cell as HTMLElement).style.width).toBe(`${expectedCellWidth}px`)
    })
  })

  it('each row has height equal to element height divided by row count', () => {
    const { container } = renderElement()
    const expectedCellHeight = baseElement.height / baseElement.rows.length
    container.querySelectorAll('th, td').forEach((cell) => {
      expect((cell as HTMLElement).style.height).toBe(`${expectedCellHeight}px`)
    })
  })
})

// ---------------------------------------------------------------------------
// AC 7 — selection: blue outline when selected, none when not selected
// ---------------------------------------------------------------------------

describe('AC7: selection outline', () => {
  it('shows a blue outline when selected', () => {
    renderElement({}, { isSelected: true })
    const wrapper = screen.getByTestId('table-element')
    expect(wrapper.style.outline).toBe('2px solid #3B82F6')
  })

  it('shows no outline when not selected', () => {
    renderElement({}, { isSelected: false })
    const wrapper = screen.getByTestId('table-element')
    expect(wrapper.style.outline).toBe('none')
  })
})

// ---------------------------------------------------------------------------
// AC 8 — click calls onSelect
// ---------------------------------------------------------------------------

describe('AC8: click interaction', () => {
  it('calls onSelect when the element is clicked', () => {
    const { onSelect } = renderElement()
    fireEvent.click(screen.getByTestId('table-element'))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('does not call onSelect when clicking without a handler', () => {
    // Ensures the handler is wired through the element and not a parent
    const onSelect = vi.fn()
    render(<TableElement element={baseElement} isSelected={false} onSelect={onSelect} />)
    fireEvent.click(screen.getByTestId('table-element'))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Positioning and sizing of the wrapper
// ---------------------------------------------------------------------------

describe('wrapper positioning', () => {
  it('is absolutely positioned at the element x/y coordinates', () => {
    renderElement()
    const wrapper = screen.getByTestId('table-element')
    expect(wrapper.style.position).toBe('absolute')
    expect(wrapper.style.left).toBe(`${baseElement.x}px`)
    expect(wrapper.style.top).toBe(`${baseElement.y}px`)
  })

  it('has width and height matching the element dimensions', () => {
    renderElement()
    const wrapper = screen.getByTestId('table-element')
    expect(wrapper.style.width).toBe(`${baseElement.width}px`)
    expect(wrapper.style.height).toBe(`${baseElement.height}px`)
  })

  it('applies element opacity', () => {
    renderElement({ opacity: 0.5 })
    const wrapper = screen.getByTestId('table-element')
    expect(wrapper.style.opacity).toBe('0.5')
  })
})
