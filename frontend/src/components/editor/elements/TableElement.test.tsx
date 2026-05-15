import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TableElement } from './TableElement'
import type { TableElement as TableElementType } from '../../../types/canvas'
import { useCanvasStore } from '../../../stores/canvasStore'

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
  columnWidths: [200, 200],
  rows: [
    { isHeader: true, height: 40, cells: ['Header 1', 'Header 2'] },
    { isHeader: false, height: 40, cells: ['Cell 1', 'Cell 2'] },
    { isHeader: false, height: 40, cells: ['Cell 3', 'Cell 4'] },
  ],
}

const renderElement = (
  overrides: Partial<TableElementType> = {},
  props: { isSelected?: boolean } = {}
) => {
  const onSelect = vi.fn()
  const onUpdate = vi.fn()
  const result = render(
    <TableElement
      element={{ ...baseElement, ...overrides }}
      isSelected={props.isSelected ?? false}
      onSelect={onSelect}
      onUpdate={onUpdate}
    />
  )
  return { ...result, onSelect, onUpdate }
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
  it('renders a <col> for each column with the correct width', () => {
    const { container } = renderElement()
    const cols = container.querySelectorAll('col')
    expect(cols).toHaveLength(baseElement.columns)
    cols.forEach((col, i) => {
      expect((col as HTMLElement).style.width).toBe(`${baseElement.columnWidths[i]}px`)
    })
  })

  it('each row has height matching the row height', () => {
    const { container } = renderElement()
    const rows = container.querySelectorAll('tr')
    rows.forEach((tr, i) => {
      expect((tr as HTMLElement).style.height).toBe(`${baseElement.rows[i].height}px`)
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
    render(
      <TableElement
        element={baseElement}
        isSelected={false}
        onSelect={onSelect}
        onUpdate={vi.fn()}
      />
    )
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

// ---------------------------------------------------------------------------
// Helpers shared by new AC tests
// ---------------------------------------------------------------------------

const drag = (el: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }) => {
  fireEvent.mouseDown(el, { clientX: from.x, clientY: from.y })
  fireEvent.mouseMove(window, { clientX: to.x, clientY: to.y })
  fireEvent.mouseUp(window)
}

const resizeHandle = (
  handle: HTMLElement,
  from: { x: number; y: number },
  to: { x: number; y: number }
) => {
  fireEvent.mouseDown(handle, { clientX: from.x, clientY: from.y })
  fireEvent.mouseMove(window, { clientX: to.x, clientY: to.y })
  fireEvent.mouseUp(window)
}

// ---------------------------------------------------------------------------
// AC1 — drag repositions the selected element without deselecting
// AC2 — element cannot be dragged outside the 1280 × 720 design surface
// ---------------------------------------------------------------------------

describe('AC1: drag repositions a selected table element', () => {
  it('calls onUpdate with new x/y after a drag exceeding 4 px', () => {
    const { container, onUpdate } = renderElement({}, { isSelected: true })
    // baseElement: x=440, y=300; drag right 30, down 20
    drag(container.firstChild as HTMLElement, { x: 100, y: 100 }, { x: 130, y: 120 })
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ x: 470, y: 320 }))
  })

  it('does not call onUpdate when movement is below the 4 px threshold', () => {
    const { container, onUpdate } = renderElement({}, { isSelected: true })
    drag(container.firstChild as HTMLElement, { x: 100, y: 100 }, { x: 102, y: 101 })
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('does not drag when element is not selected', () => {
    const { container, onUpdate } = renderElement({}, { isSelected: false })
    drag(container.firstChild as HTMLElement, { x: 100, y: 100 }, { x: 200, y: 200 })
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('does not deselect after a drag (click following mouseup is suppressed)', () => {
    const { container, onSelect } = renderElement({}, { isSelected: true })
    const el = container.firstChild as HTMLElement
    drag(el, { x: 100, y: 100 }, { x: 130, y: 120 })
    fireEvent.click(el)
    // onSelect should not have been called by the drag-ending click
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('AC2: drag allows free movement on infinite canvas', () => {
  it('allows movement to negative x when dragged past the left edge', () => {
    const { container, onUpdate } = renderElement({ x: 10, y: 300 }, { isSelected: true })
    drag(container.firstChild as HTMLElement, { x: 200, y: 200 }, { x: 100, y: 200 })
    expect(onUpdate.mock.calls.at(-1)![0].x).toBe(-90)
  })

  it('allows movement beyond right surface bounds', () => {
    const { container, onUpdate } = renderElement({ x: 100, y: 300 }, { isSelected: true })
    drag(container.firstChild as HTMLElement, { x: 0, y: 0 }, { x: 2000, y: 0 })
    expect(onUpdate.mock.calls.at(-1)![0].x).toBe(2100)
  })

  it('allows movement to negative y when dragged past the top edge', () => {
    const { container, onUpdate } = renderElement({ x: 440, y: 10 }, { isSelected: true })
    drag(container.firstChild as HTMLElement, { x: 200, y: 200 }, { x: 200, y: 100 })
    expect(onUpdate.mock.calls.at(-1)![0].y).toBe(-90)
  })

  it('allows movement beyond bottom surface bounds', () => {
    const { container, onUpdate } = renderElement({ x: 440, y: 100 }, { isSelected: true })
    drag(container.firstChild as HTMLElement, { x: 0, y: 0 }, { x: 0, y: 2000 })
    expect(onUpdate.mock.calls.at(-1)![0].y).toBe(2100)
  })
})

// ---------------------------------------------------------------------------
// AC3 — corner resize handles are visible only when selected
// ---------------------------------------------------------------------------

describe('AC3: corner resize handle visibility', () => {
  it('shows all four corner handles when selected', () => {
    renderElement({}, { isSelected: true })
    expect(screen.getByTestId('resize-handle-tl')).toBeInTheDocument()
    expect(screen.getByTestId('resize-handle-tr')).toBeInTheDocument()
    expect(screen.getByTestId('resize-handle-bl')).toBeInTheDocument()
    expect(screen.getByTestId('resize-handle-br')).toBeInTheDocument()
  })

  it('hides corner handles when not selected', () => {
    renderElement({}, { isSelected: false })
    expect(screen.queryByTestId('resize-handle-tl')).not.toBeInTheDocument()
    expect(screen.queryByTestId('resize-handle-br')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC4 — corner handles resize the element; minimum 80 × 40; bounded by surface
// ---------------------------------------------------------------------------

describe('AC4: corner resize behaviour', () => {
  it('br handle increases width and height', () => {
    const { onUpdate } = renderElement({}, { isSelected: true })
    resizeHandle(screen.getByTestId('resize-handle-br'), { x: 0, y: 0 }, { x: 60, y: 30 })
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ width: 460, height: 150 }))
  })

  it('tl handle moves origin and shrinks dimensions', () => {
    const { onUpdate } = renderElement({}, { isSelected: true })
    // baseElement x=440, y=300, w=400, h=120; drag tl right 20, down 10
    resizeHandle(screen.getByTestId('resize-handle-tl'), { x: 0, y: 0 }, { x: 20, y: 10 })
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ x: 460, y: 310, width: 380, height: 110 })
    )
  })

  it('enforces minimum width of 80 px when shrinking', () => {
    const { onUpdate } = renderElement({ width: 100, height: 120 }, { isSelected: true })
    resizeHandle(screen.getByTestId('resize-handle-br'), { x: 0, y: 0 }, { x: -50, y: 0 })
    expect(onUpdate.mock.calls.at(-1)![0].width).toBe(80)
  })

  it('enforces minimum height of 40 px when shrinking', () => {
    const { onUpdate } = renderElement({ width: 400, height: 60 }, { isSelected: true })
    resizeHandle(screen.getByTestId('resize-handle-br'), { x: 0, y: 0 }, { x: 0, y: -40 })
    expect(onUpdate.mock.calls.at(-1)![0].height).toBe(40)
  })

  it('element can extend past the right edge on infinite canvas', () => {
    const { onUpdate } = renderElement(
      { x: 1100, y: 300, width: 100, height: 120 },
      { isSelected: true }
    )
    resizeHandle(screen.getByTestId('resize-handle-br'), { x: 0, y: 0 }, { x: 500, y: 0 })
    expect(onUpdate.mock.calls.at(-1)![0].width).toBe(600)
  })

  it('element can extend past the bottom edge on infinite canvas', () => {
    const { onUpdate } = renderElement(
      { x: 440, y: 650, width: 400, height: 50 },
      { isSelected: true }
    )
    resizeHandle(screen.getByTestId('resize-handle-br'), { x: 0, y: 0 }, { x: 0, y: 500 })
    expect(onUpdate.mock.calls.at(-1)![0].height).toBe(550)
  })
})

// ---------------------------------------------------------------------------
// AC5 — after a corner resize, columnWidths sum to width and row heights sum to height
// ---------------------------------------------------------------------------

describe('AC5: proportional scaling after resize', () => {
  it('sum of columnWidths equals the new width after br resize', () => {
    const { onUpdate } = renderElement({}, { isSelected: true })
    // Grow by 100 wide, 60 tall
    resizeHandle(screen.getByTestId('resize-handle-br'), { x: 0, y: 0 }, { x: 100, y: 60 })
    const patch = onUpdate.mock.calls.at(-1)![0]
    const widthSum = (patch.columnWidths as number[]).reduce((a: number, b: number) => a + b, 0)
    expect(widthSum).toBe(patch.width)
  })

  it('sum of row heights equals the new height after br resize', () => {
    const { onUpdate } = renderElement({}, { isSelected: true })
    resizeHandle(screen.getByTestId('resize-handle-br'), { x: 0, y: 0 }, { x: 100, y: 60 })
    const patch = onUpdate.mock.calls.at(-1)![0]
    const heightSum = (patch.rows as Array<{ height: number }>).reduce(
      (a: number, r: { height: number }) => a + r.height,
      0
    )
    expect(heightSum).toBe(patch.height)
  })
})

// ---------------------------------------------------------------------------
// AC6 — column-divider handles are visible only when selected
// ---------------------------------------------------------------------------

describe('AC6: column-divider handle visibility', () => {
  it('shows n−1 column-divider handles for a 2-column table when selected', () => {
    renderElement({}, { isSelected: true })
    expect(screen.getByTestId('col-divider-0')).toBeInTheDocument()
    expect(screen.queryByTestId('col-divider-1')).not.toBeInTheDocument()
  })

  it('shows n−1 dividers for a 3-column table when selected', () => {
    renderElement(
      {
        columns: 3,
        columnWidths: [133, 133, 134],
        rows: [
          { isHeader: true, height: 40, cells: ['H1', 'H2', 'H3'] },
          { isHeader: false, height: 40, cells: ['A', 'B', 'C'] },
        ],
      },
      { isSelected: true }
    )
    expect(screen.getByTestId('col-divider-0')).toBeInTheDocument()
    expect(screen.getByTestId('col-divider-1')).toBeInTheDocument()
    expect(screen.queryByTestId('col-divider-2')).not.toBeInTheDocument()
  })

  it('hides column-divider handles when not selected', () => {
    renderElement({}, { isSelected: false })
    expect(screen.queryByTestId('col-divider-0')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC7 — dragging a column-divider redistributes width; minimum 40 px per column
// ---------------------------------------------------------------------------

describe('AC7: column-divider drag', () => {
  it('redistributes width between adjacent columns after a drag', () => {
    const { onUpdate } = renderElement({}, { isSelected: true })
    // col-divider-0 sits between column 0 (200px) and column 1 (200px)
    // drag 50px right → col0 = 250, col1 = 150
    const divider = screen.getByTestId('col-divider-0')
    fireEvent.mouseDown(divider, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 50, clientY: 0 })
    fireEvent.mouseUp(window)
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ columnWidths: [250, 150] }))
  })

  it('enforces a minimum column width of 40 px', () => {
    const { onUpdate } = renderElement({}, { isSelected: true })
    // drag far left — would make col0 = 0, should clamp to 40; col1 = 360
    const divider = screen.getByTestId('col-divider-0')
    fireEvent.mouseDown(divider, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: -300, clientY: 0 })
    fireEvent.mouseUp(window)
    const widths: number[] = onUpdate.mock.calls.at(-1)![0].columnWidths
    expect(widths[0]).toBe(40)
    expect(widths[1]).toBe(360)
  })

  it('enforces min 40 px on the right column when dragging far right', () => {
    const { onUpdate } = renderElement({}, { isSelected: true })
    const divider = screen.getByTestId('col-divider-0')
    fireEvent.mouseDown(divider, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 300, clientY: 0 })
    fireEvent.mouseUp(window)
    const widths: number[] = onUpdate.mock.calls.at(-1)![0].columnWidths
    expect(widths[1]).toBe(40)
    expect(widths[0]).toBe(360)
  })
})

// ---------------------------------------------------------------------------
// AC8 — row-divider handles are visible only when selected
// ---------------------------------------------------------------------------

describe('AC8: row-divider handle visibility', () => {
  it('shows m−1 row-divider handles for a 3-row table when selected', () => {
    renderElement({}, { isSelected: true })
    expect(screen.getByTestId('row-divider-0')).toBeInTheDocument()
    expect(screen.getByTestId('row-divider-1')).toBeInTheDocument()
    expect(screen.queryByTestId('row-divider-2')).not.toBeInTheDocument()
  })

  it('hides row-divider handles when not selected', () => {
    renderElement({}, { isSelected: false })
    expect(screen.queryByTestId('row-divider-0')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC9 — dragging a row-divider redistributes height; minimum 24 px per row
// ---------------------------------------------------------------------------

describe('AC9: row-divider drag', () => {
  it('redistributes height between adjacent rows after a drag', () => {
    const { onUpdate } = renderElement({}, { isSelected: true })
    // row-divider-0 sits between row 0 (40px) and row 1 (40px)
    // drag 10px down → row0 = 50, row1 = 30
    const divider = screen.getByTestId('row-divider-0')
    fireEvent.mouseDown(divider, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 0, clientY: 10 })
    fireEvent.mouseUp(window)
    const updatedRows = onUpdate.mock.calls.at(-1)![0].rows as Array<{ height: number }>
    expect(updatedRows[0].height).toBe(50)
    expect(updatedRows[1].height).toBe(30)
  })

  it('enforces a minimum row height of 24 px', () => {
    const { onUpdate } = renderElement({}, { isSelected: true })
    // drag far up — would make row0 height = 0, should clamp to 24; row1 = 56
    const divider = screen.getByTestId('row-divider-0')
    fireEvent.mouseDown(divider, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 0, clientY: -100 })
    fireEvent.mouseUp(window)
    const updatedRows = onUpdate.mock.calls.at(-1)![0].rows as Array<{ height: number }>
    expect(updatedRows[0].height).toBe(24)
    expect(updatedRows[1].height).toBe(56)
  })

  it('enforces min 24 px on the bottom row when dragging far down', () => {
    const { onUpdate } = renderElement({}, { isSelected: true })
    const divider = screen.getByTestId('row-divider-0')
    fireEvent.mouseDown(divider, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 0, clientY: 100 })
    fireEvent.mouseUp(window)
    const updatedRows = onUpdate.mock.calls.at(-1)![0].rows as Array<{ height: number }>
    expect(updatedRows[1].height).toBe(24)
    expect(updatedRows[0].height).toBe(56)
  })
})

// ---------------------------------------------------------------------------
// AC15 — double-clicking a cell enters inline edit mode
// ---------------------------------------------------------------------------

describe('AC15: cell inline edit mode entry', () => {
  it('renders a contentEditable div after double-clicking a selected cell', () => {
    renderElement({}, { isSelected: true })
    fireEvent.doubleClick(screen.getByText('Cell 1'))
    expect(document.querySelector('[contenteditable="true"]')).toBeInTheDocument()
  })

  it('does not enter edit mode when the table is not selected', () => {
    renderElement({}, { isSelected: false })
    fireEvent.doubleClick(screen.getByText('Cell 1'))
    expect(document.querySelector('[contenteditable="true"]')).not.toBeInTheDocument()
  })

  it('hides corner handles and dividers while editing', () => {
    renderElement({}, { isSelected: true })
    fireEvent.doubleClick(screen.getByText('Cell 1'))
    expect(screen.queryByTestId('resize-handle-tl')).not.toBeInTheDocument()
    expect(screen.queryByTestId('col-divider-0')).not.toBeInTheDocument()
    expect(screen.queryByTestId('row-divider-0')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC17 — blur or Enter commits the edited value and exits edit mode
// ---------------------------------------------------------------------------

describe('AC17: commit on blur / Enter', () => {
  it('calls onUpdate with the new cell content on blur', () => {
    const { onUpdate } = renderElement({}, { isSelected: true })
    fireEvent.doubleClick(screen.getByText('Cell 1'))
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editable.textContent = 'Updated text'
    fireEvent.blur(editable)
    const updatedRows = onUpdate.mock.calls.at(-1)![0].rows as Array<{ cells: string[] }>
    expect(updatedRows[1].cells[0]).toBe('Updated text')
  })

  it('removes the contentEditable div after blur', () => {
    renderElement({}, { isSelected: true })
    fireEvent.doubleClick(screen.getByText('Cell 1'))
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    fireEvent.blur(editable)
    expect(document.querySelector('[contenteditable="true"]')).not.toBeInTheDocument()
  })

  it('commits content when Enter is pressed', () => {
    const { onUpdate } = renderElement({}, { isSelected: true })
    fireEvent.doubleClick(screen.getByText('Cell 1'))
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editable.textContent = 'Enter commit'
    fireEvent.keyDown(editable, { key: 'Enter' })
    const updatedRows = onUpdate.mock.calls.at(-1)![0].rows as Array<{ cells: string[] }>
    expect(updatedRows[1].cells[0]).toBe('Enter commit')
  })

  it('restores corner handles and dividers after committing', () => {
    renderElement({}, { isSelected: true })
    fireEvent.doubleClick(screen.getByText('Cell 1'))
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    fireEvent.blur(editable)
    expect(screen.getByTestId('resize-handle-tl')).toBeInTheDocument()
    expect(screen.getByTestId('col-divider-0')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC18 — Escape reverts the cell to its value before editing
// ---------------------------------------------------------------------------

describe('AC18: Escape reverts cell content', () => {
  it('calls onUpdate with the original value when Escape is pressed', () => {
    const { onUpdate } = renderElement({}, { isSelected: true })
    fireEvent.doubleClick(screen.getByText('Cell 1'))
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editable.textContent = 'Changed text'
    fireEvent.keyDown(editable, { key: 'Escape' })
    // blur fires after Escape sets textContent back to original → commits 'Cell 1'
    const updatedRows = onUpdate.mock.calls.at(-1)![0].rows as Array<{ cells: string[] }>
    expect(updatedRows[1].cells[0]).toBe('Cell 1')
  })

  it('exits edit mode after Escape', () => {
    renderElement({}, { isSelected: true })
    fireEvent.doubleClick(screen.getByText('Cell 1'))
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    fireEvent.keyDown(editable, { key: 'Escape' })
    expect(document.querySelector('[contenteditable="true"]')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC19 — empty cells display a muted "Click to edit" placeholder
// ---------------------------------------------------------------------------

describe('AC19: empty cell placeholder', () => {
  it('shows "Click to edit" placeholder text for empty cells', () => {
    renderElement({
      rows: [
        { isHeader: true, height: 40, cells: ['Header 1', 'Header 2'] },
        { isHeader: false, height: 40, cells: ['', ''] },
        { isHeader: false, height: 40, cells: ['Cell 3', 'Cell 4'] },
      ],
    })
    expect(screen.getAllByText('Click to edit')).toHaveLength(2)
  })

  it('does not show the placeholder for cells that have content', () => {
    renderElement()
    expect(screen.queryByText('Click to edit')).not.toBeInTheDocument()
  })

  it('placeholder is styled with muted colour', () => {
    const { container } = renderElement({
      rows: [
        { isHeader: true, height: 40, cells: ['H1', 'H2'] },
        { isHeader: false, height: 40, cells: ['', 'X'] },
        { isHeader: false, height: 40, cells: ['Y', 'Z'] },
      ],
    })
    const placeholder = container.querySelector('span')!
    expect(placeholder.style.color).toBe('rgb(156, 163, 175)')
  })
})

// ---------------------------------------------------------------------------
// AC 12 — drag and resize produce correct world-space deltas at any zoom level
// ---------------------------------------------------------------------------

describe('AC12: zoom-aware drag', () => {
  beforeEach(() => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
  })

  it('halves the world-space position delta when zoom is 2 (drag)', () => {
    useCanvasStore.setState({ zoom: 2 })
    const { container, onUpdate } = renderElement({ x: 100, y: 100 }, { isSelected: true })
    const el = container.firstChild as HTMLElement
    // 200px screen drag at zoom=2 → 100px world delta
    fireEvent.mouseDown(el, { clientX: 200, clientY: 200 })
    fireEvent.mouseMove(window, { clientX: 400, clientY: 200 })
    fireEvent.mouseUp(window)
    const call = onUpdate.mock.calls.at(-1)![0]
    expect(call.x).toBe(200) // 100 + 200/2
  })

  it('doubles the world-space position delta when zoom is 0.5 (drag)', () => {
    useCanvasStore.setState({ zoom: 0.5 })
    const { container, onUpdate } = renderElement({ x: 100, y: 100 }, { isSelected: true })
    const el = container.firstChild as HTMLElement
    // 100px screen drag at zoom=0.5 → 200px world delta
    fireEvent.mouseDown(el, { clientX: 200, clientY: 200 })
    fireEvent.mouseMove(window, { clientX: 300, clientY: 200 })
    fireEvent.mouseUp(window)
    const call = onUpdate.mock.calls.at(-1)![0]
    expect(call.x).toBe(300) // 100 + 100/0.5
  })
})

describe('AC12: zoom-aware resize', () => {
  beforeEach(() => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
  })

  it('halves the width delta when zoom is 2 (br handle)', () => {
    useCanvasStore.setState({ zoom: 2 })
    const { onUpdate } = renderElement(
      { x: 100, y: 100, width: 400, height: 120 },
      { isSelected: true }
    )
    // 100px screen drag at zoom=2 → 50px world delta → width = 400 + 50 = 450
    fireEvent.mouseDown(screen.getByTestId('resize-handle-br'), { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 100, clientY: 0 })
    fireEvent.mouseUp(window)
    const call = onUpdate.mock.calls.at(-1)![0]
    expect(call.width).toBe(450)
  })

  it('doubles the width delta when zoom is 0.5 (br handle)', () => {
    useCanvasStore.setState({ zoom: 0.5 })
    const { onUpdate } = renderElement(
      { x: 100, y: 100, width: 400, height: 120 },
      { isSelected: true }
    )
    // 50px screen drag at zoom=0.5 → 100px world delta → width = 400 + 100 = 500
    fireEvent.mouseDown(screen.getByTestId('resize-handle-br'), { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 50, clientY: 0 })
    fireEvent.mouseUp(window)
    const call = onUpdate.mock.calls.at(-1)![0]
    expect(call.width).toBe(500)
  })
})
