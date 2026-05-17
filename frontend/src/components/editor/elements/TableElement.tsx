import { useEffect, useRef, useState } from 'react'
import type { TableElement as TableElementType, TableRow } from '../../../types/canvas'
import { useCanvasStore } from '../../../stores/canvasStore'

type Props = {
  element: TableElementType
  isSelected: boolean
  onSelect: (e: React.MouseEvent) => void
  onUpdate: (patch: Partial<TableElementType>) => void
  onDragEnd?: (delta: { x: number; y: number }) => void
}

type Handle = 'tl' | 'tr' | 'bl' | 'br'

const DRAG_THRESHOLD = 4
const MIN_TABLE_WIDTH = 80
const MIN_TABLE_HEIGHT = 40
const MIN_COL_WIDTH = 40
const MIN_ROW_HEIGHT = 24

const handleStyles: Record<Handle, React.CSSProperties> = {
  tl: { top: -5, left: -5, cursor: 'nwse-resize' },
  tr: { top: -5, right: -5, cursor: 'nesw-resize' },
  bl: { bottom: -5, left: -5, cursor: 'nesw-resize' },
  br: { bottom: -5, right: -5, cursor: 'nwse-resize' },
}

export function TableElement({ element, isSelected, onSelect, onUpdate, onDragEnd }: Props) {
  const { x, y, width, height, rows, columns, opacity, rotation } = element

  // Backward-compat defaults for elements persisted before this feature
  const columnWidths: number[] =
    element.columnWidths ?? Array(columns).fill(Math.round(width / columns))
  const effectiveRows: TableRow[] = rows.map((r) => ({
    ...r,
    height: r.height ?? Math.round(height / rows.length),
  }))

  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colIndex: number } | null>(
    null
  )
  const valueAtEntryRef = useRef('')
  const editableRef = useRef<HTMLDivElement | null>(null)

  const dragStartRef = useRef<{
    mouseX: number
    mouseY: number
    elementX: number
    elementY: number
  } | null>(null)
  const isDraggingRef = useRef(false)

  const resizeStartRef = useRef<{
    mouseX: number
    mouseY: number
    elementX: number
    elementY: number
    elementW: number
    elementH: number
    handle: Handle
  } | null>(null)

  const colDivRef = useRef<{
    mouseX: number
    index: number
    leftWidth: number
    rightWidth: number
  } | null>(null)

  const rowDivRef = useRef<{
    mouseY: number
    index: number
    topHeight: number
    bottomHeight: number
  } | null>(null)

  // Exit edit mode when deselected
  useEffect(() => {
    if (!isSelected) setEditingCell(null)
  }, [isSelected])

  // Focus the editable div when editing starts
  useEffect(() => {
    if (!editingCell || !editableRef.current) return
    editableRef.current.focus()
    const range = document.createRange()
    const sel = window.getSelection()
    range.selectNodeContents(editableRef.current)
    range.collapse(false)
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [editingCell])

  // -------------------------------------------------------------------------
  // Body drag
  // -------------------------------------------------------------------------

  const handleBodyMouseDown = (e: React.MouseEvent) => {
    if (!isSelected || editingCell !== null) return
    // Handles and dividers call e.stopPropagation() so this won't fire for them
    e.preventDefault()
    dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, elementX: x, elementY: y }
    isDraggingRef.current = false

    const onMouseMove = (ev: MouseEvent) => {
      const s = dragStartRef.current
      if (!s) return
      const dx = ev.clientX - s.mouseX
      const dy = ev.clientY - s.mouseY
      if (!isDraggingRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      isDraggingRef.current = true
      document.body.style.cursor = 'grabbing'
      const zoom = useCanvasStore.getState().zoom
      onUpdate({
        x: s.elementX + dx / zoom,
        y: s.elementY + dy / zoom,
      })
    }

    const onMouseUp = (ev: MouseEvent) => {
      if (isDraggingRef.current && dragStartRef.current) {
        const zoom = useCanvasStore.getState().zoom
        const deltaX = (ev.clientX - dragStartRef.current.mouseX) / zoom
        const deltaY = (ev.clientY - dragStartRef.current.mouseY) / zoom
        onDragEnd?.({ x: deltaX, y: deltaY })
      }
      dragStartRef.current = null
      document.body.style.cursor = ''
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      // Defer the flag reset so the synchronous click that follows mouseup is suppressed
      setTimeout(() => {
        isDraggingRef.current = false
      }, 0)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  // -------------------------------------------------------------------------
  // Corner resize
  // -------------------------------------------------------------------------

  const handleResizeMouseDown = (e: React.MouseEvent, handle: Handle) => {
    e.stopPropagation()
    e.preventDefault()
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      elementX: x,
      elementY: y,
      elementW: width,
      elementH: height,
      handle,
    }

    const onMouseMove = (ev: MouseEvent) => {
      const s = resizeStartRef.current
      if (!s) return
      const zoom = useCanvasStore.getState().zoom
      const dx = (ev.clientX - s.mouseX) / zoom
      const dy = (ev.clientY - s.mouseY) / zoom

      let newX = s.elementX
      let newY = s.elementY
      let newW = s.elementW
      let newH = s.elementH

      if (s.handle === 'tl') {
        newW = Math.max(MIN_TABLE_WIDTH, s.elementW - dx)
        newH = Math.max(MIN_TABLE_HEIGHT, s.elementH - dy)
        newX = s.elementX + s.elementW - newW
        newY = s.elementY + s.elementH - newH
      } else if (s.handle === 'tr') {
        newW = Math.max(MIN_TABLE_WIDTH, s.elementW + dx)
        newH = Math.max(MIN_TABLE_HEIGHT, s.elementH - dy)
        newY = s.elementY + s.elementH - newH
      } else if (s.handle === 'bl') {
        newW = Math.max(MIN_TABLE_WIDTH, s.elementW - dx)
        newH = Math.max(MIN_TABLE_HEIGHT, s.elementH + dy)
        newX = s.elementX + s.elementW - newW
      } else {
        newW = Math.max(MIN_TABLE_WIDTH, s.elementW + dx)
        newH = Math.max(MIN_TABLE_HEIGHT, s.elementH + dy)
      }

      // Scale column widths proportionally; ensure they sum to newW
      const wRatio = newW / s.elementW
      const newColWidths = columnWidths.map((cw) =>
        Math.max(MIN_COL_WIDTH, Math.round(cw * wRatio))
      )
      const wSum = newColWidths.reduce((a, b) => a + b, 0)
      newColWidths[newColWidths.length - 1] = Math.max(
        MIN_COL_WIDTH,
        newColWidths[newColWidths.length - 1] + (newW - wSum)
      )

      // Scale row heights proportionally; ensure they sum to newH
      const hRatio = newH / s.elementH
      const newRows = effectiveRows.map((row) => ({
        ...row,
        height: Math.max(MIN_ROW_HEIGHT, Math.round(row.height * hRatio)),
      }))
      const hSum = newRows.reduce((a, r) => a + r.height, 0)
      newRows[newRows.length - 1] = {
        ...newRows[newRows.length - 1],
        height: Math.max(MIN_ROW_HEIGHT, newRows[newRows.length - 1].height + (newH - hSum)),
      }

      onUpdate({
        x: newX,
        y: newY,
        width: newW,
        height: newH,
        columnWidths: newColWidths,
        rows: newRows,
      })
    }

    const onMouseUp = () => {
      resizeStartRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  // -------------------------------------------------------------------------
  // Column divider drag
  // -------------------------------------------------------------------------

  const handleColDivMouseDown = (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    e.preventDefault()
    colDivRef.current = {
      mouseX: e.clientX,
      index,
      leftWidth: columnWidths[index],
      rightWidth: columnWidths[index + 1],
    }

    const onMouseMove = (ev: MouseEvent) => {
      const s = colDivRef.current
      if (!s) return
      const zoom = useCanvasStore.getState().zoom
      const delta = (ev.clientX - s.mouseX) / zoom
      const total = s.leftWidth + s.rightWidth
      const newLeft = Math.max(MIN_COL_WIDTH, Math.min(total - MIN_COL_WIDTH, s.leftWidth + delta))
      const newRight = total - newLeft
      const newWidths = [...columnWidths]
      newWidths[s.index] = newLeft
      newWidths[s.index + 1] = newRight
      onUpdate({ columnWidths: newWidths })
    }

    const onMouseUp = () => {
      colDivRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  // -------------------------------------------------------------------------
  // Row divider drag
  // -------------------------------------------------------------------------

  const handleRowDivMouseDown = (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    e.preventDefault()
    rowDivRef.current = {
      mouseY: e.clientY,
      index,
      topHeight: effectiveRows[index].height,
      bottomHeight: effectiveRows[index + 1].height,
    }

    const onMouseMove = (ev: MouseEvent) => {
      const s = rowDivRef.current
      if (!s) return
      const zoom = useCanvasStore.getState().zoom
      const delta = (ev.clientY - s.mouseY) / zoom
      const total = s.topHeight + s.bottomHeight
      const newTop = Math.max(MIN_ROW_HEIGHT, Math.min(total - MIN_ROW_HEIGHT, s.topHeight + delta))
      const newBottom = total - newTop
      const newRows = effectiveRows.map((row, i) => {
        if (i === s.index) return { ...row, height: newTop }
        if (i === s.index + 1) return { ...row, height: newBottom }
        return row
      })
      onUpdate({ rows: newRows })
    }

    const onMouseUp = () => {
      rowDivRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  // -------------------------------------------------------------------------
  // Cell inline editing
  // -------------------------------------------------------------------------

  const handleCellDoubleClick = (e: React.MouseEvent, rowIndex: number, colIndex: number) => {
    e.stopPropagation()
    if (!isSelected) return
    valueAtEntryRef.current = effectiveRows[rowIndex].cells[colIndex]
    setEditingCell({ rowIndex, colIndex })
  }

  const commitEdit = (rowIndex: number, colIndex: number, value: string) => {
    const newRows = effectiveRows.map((row, ri) => {
      if (ri !== rowIndex) return row
      return { ...row, cells: row.cells.map((c, ci) => (ci === colIndex ? value : c)) }
    })
    onUpdate({ rows: newRows })
    setEditingCell(null)
  }

  const handleCellBlur = (
    e: React.FocusEvent<HTMLDivElement>,
    rowIndex: number,
    colIndex: number
  ) => {
    commitEdit(rowIndex, colIndex, (e.currentTarget.textContent ?? '').trim())
  }

  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      // Revert content then blur — blur handler commits the original value (no-op)
      e.currentTarget.textContent = valueAtEntryRef.current
      e.currentTarget.blur()
    }
  }

  // -------------------------------------------------------------------------
  // Divider boundary coordinates
  // -------------------------------------------------------------------------

  const colBoundaries: number[] = []
  let accX = 0
  for (let i = 0; i < columns - 1; i++) {
    accX += columnWidths[i]
    colBoundaries.push(accX)
  }

  const rowBoundaries: number[] = []
  let accY = 0
  for (let i = 0; i < effectiveRows.length - 1; i++) {
    accY += effectiveRows[i].height
    rowBoundaries.push(accY)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isDraggingRef.current) return
    onSelect(e)
  }

  const isEditing = editingCell !== null
  const cursor = isEditing ? 'text' : isSelected ? 'grab' : 'default'

  return (
    <div
      data-testid="table-element"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        opacity,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        outline: isSelected ? '2px solid #3B82F6' : 'none',
        outlineOffset: '2px',
        cursor,
        boxSizing: 'border-box',
      }}
      onMouseDown={handleBodyMouseDown}
      onClick={handleClick}
    >
      {/* Table content — div-based layout for reliable html2canvas rendering */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          border: '1px solid #D1D5DB',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {effectiveRows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              style={{
                display: 'flex',
                flexDirection: 'row',
                flexShrink: 0,
                height: row.height,
                minHeight: row.height,
              }}
            >
              {row.cells.map((cell, colIndex) => {
                const isEditingThis =
                  editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex
                const colWidth = columnWidths[colIndex] ?? Math.round(width / columns)
                return (
                  <div
                    key={colIndex}
                    style={{
                      width: colWidth,
                      minWidth: colWidth,
                      maxWidth: colWidth,
                      height: '100%',
                      backgroundColor: row.isHeader ? '#F3F4F6' : '#FFFFFF',
                      color: row.isHeader ? '#111827' : '#374151',
                      fontWeight: row.isHeader ? 'bold' : 'normal',
                      fontSize: 14,
                      fontFamily: 'Inter, sans-serif',
                      border: '1px solid #E5E7EB',
                      // Negative margin collapses double borders with neighbours
                      marginLeft: colIndex === 0 ? 0 : -1,
                      marginTop: rowIndex === 0 ? 0 : -1,
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 8px',
                      cursor: isEditingThis ? 'text' : undefined,
                      position: 'relative',
                    }}
                    onDoubleClick={(e) => handleCellDoubleClick(e, rowIndex, colIndex)}
                  >
                    {isEditingThis ? (
                      <div
                        ref={(el) => {
                          if (isEditingThis) editableRef.current = el
                        }}
                        contentEditable
                        suppressContentEditableWarning
                        style={{
                          width: '100%',
                          outline: 'none',
                          cursor: 'text',
                          textAlign: 'center',
                          fontWeight: row.isHeader ? 'bold' : 'normal',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                        onBlur={(e) => handleCellBlur(e, rowIndex, colIndex)}
                        onKeyDown={handleCellKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        {cell}
                      </div>
                    ) : cell ? (
                      <span
                        style={{
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          display: 'block',
                          width: '100%',
                          textAlign: 'center',
                        }}
                      >
                        {cell}
                      </span>
                    ) : (
                      <span
                        style={{
                          color: '#9CA3AF',
                          fontStyle: 'italic',
                          fontWeight: 'normal',
                        }}
                      >
                        Click to edit
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

      {/* Corner handles */}
      {isSelected &&
        !isEditing &&
        (['tl', 'tr', 'bl', 'br'] as Handle[]).map((handle) => (
          <div
            key={handle}
            data-testid={`resize-handle-${handle}`}
            style={{
              position: 'absolute',
              width: 10,
              height: 10,
              backgroundColor: '#3B82F6',
              ...handleStyles[handle],
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, handle)}
          />
        ))}

      {/* Column divider handles */}
      {isSelected &&
        !isEditing &&
        colBoundaries.map((bx, i) => (
          <div
            key={`col-div-${i}`}
            data-testid={`col-divider-${i}`}
            style={{
              position: 'absolute',
              top: 0,
              left: bx - 2,
              width: 4,
              height,
              cursor: 'col-resize',
              zIndex: 1,
            }}
            onMouseDown={(e) => handleColDivMouseDown(e, i)}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(59,130,246,0.3)')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent')
            }
          />
        ))}

      {/* Row divider handles */}
      {isSelected &&
        !isEditing &&
        rowBoundaries.map((by, j) => (
          <div
            key={`row-div-${j}`}
            data-testid={`row-divider-${j}`}
            style={{
              position: 'absolute',
              left: 0,
              top: by - 2,
              width,
              height: 4,
              cursor: 'row-resize',
              zIndex: 1,
            }}
            onMouseDown={(e) => handleRowDivMouseDown(e, j)}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(59,130,246,0.3)')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent')
            }
          />
        ))}
    </div>
  )
}
