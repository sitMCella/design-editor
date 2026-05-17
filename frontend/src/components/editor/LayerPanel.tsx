import { useEffect, useRef, useState } from 'react'
import { useCanvasStore } from '../../stores/canvasStore'
import { LayerRow } from './LayerRow'
import type { CanvasElement } from '../../types/canvas'

const ROW_HEIGHT = 36

function elementLabel(el: CanvasElement, elements: CanvasElement[]): string {
  const typeLabel: Record<CanvasElement['type'], string> = {
    text: 'Text',
    image: 'Image',
    arrow: 'Arrow',
    table: 'Table',
  }
  const sameType = elements.filter((e) => e.type === el.type)
  const index = sameType.indexOf(el) + 1
  return `${typeLabel[el.type]} ${index}`
}

type DragState = {
  id: string
  panelIndex: number
  isDragging: boolean
  insertionIndex: number
}

export function LayerPanel() {
  const elements = useCanvasStore((s) => s.elements)
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const selectElements = useCanvasStore((s) => s.selectElements)
  const toggleElementSelection = useCanvasStore((s) => s.toggleElementSelection)
  const toggleElementVisibility = useCanvasStore((s) => s.toggleElementVisibility)
  const moveElementToIndex = useCanvasStore((s) => s.moveElementToIndex)

  const [dragState, setDragState] = useState<DragState | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Panel shows elements in reverse: topmost element first
  const displayRows = [...elements].reverse()

  // Scroll first selected row into view when selection changes
  useEffect(() => {
    if (selectedIds.length === 0) return
    const rowEl = rowRefs.current.get(selectedIds[0])
    if (rowEl) rowEl.scrollIntoView({ block: 'nearest' })
  }, [selectedIds])

  const handleDragHandleMouseDown = (id: string, panelIndex: number, e: React.MouseEvent) => {
    e.preventDefault()
    const startMouseY = e.clientY
    const totalRows = displayRows.length
    let finalInsertionIndex = panelIndex
    let isDragging = false

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dy = Math.abs(moveEvent.clientY - startMouseY)
      if (dy >= 4) {
        isDragging = true
        const listRect = listRef.current?.getBoundingClientRect()
        if (!listRect) return
        const relativeY = moveEvent.clientY - listRect.top
        const rawIndex = Math.round(relativeY / ROW_HEIGHT)
        finalInsertionIndex = Math.max(0, Math.min(rawIndex, totalRows))
        setDragState({
          id,
          panelIndex,
          isDragging: true,
          insertionIndex: finalInsertionIndex,
        })
      }
    }

    const onMouseUp = () => {
      if (isDragging) {
        // Clamp insertion index to valid panel index range [0, N-1]
        const targetPanelIndex = Math.min(finalInsertionIndex, totalRows - 1)
        moveElementToIndex(id, targetPanelIndex)
      }
      setDragState(null)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const handleRowSelect = (element: CanvasElement, e: React.MouseEvent) => {
    if (element.hidden) return
    if (e.shiftKey) {
      toggleElementSelection(element.id)
    } else {
      selectElements([element.id])
    }
  }

  return (
    <div className="flex w-48 flex-shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-2 py-2">
        <h2 className="text-sm font-medium text-gray-700">Layers</h2>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto">
        {displayRows.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-4 text-center">
            <p className="text-sm text-gray-400">No elements yet.</p>
            <p className="text-sm text-gray-400">Use the toolbar to add content.</p>
          </div>
        ) : (
          <div className="relative">
            {displayRows.map((element, panelIndex) => {
              const isBeingDragged = dragState?.isDragging && dragState.id === element.id
              const showInsertionLine =
                dragState?.isDragging && dragState.insertionIndex === panelIndex
              const isLastRow = panelIndex === displayRows.length - 1
              const showInsertionAfterLast =
                dragState?.isDragging &&
                dragState.insertionIndex === displayRows.length &&
                isLastRow

              return (
                <div
                  key={element.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(element.id, el)
                    else rowRefs.current.delete(element.id)
                  }}
                >
                  {showInsertionLine && (
                    <div className="h-0.5 w-full bg-blue-500" aria-hidden="true" />
                  )}
                  <div style={{ opacity: isBeingDragged ? 0.5 : 1 }}>
                    <LayerRow
                      element={element}
                      label={elementLabel(element, elements)}
                      isSelected={selectedIds.includes(element.id)}
                      onSelect={(e) => handleRowSelect(element, e)}
                      onToggleVisibility={() => toggleElementVisibility(element.id)}
                      onDragHandleMouseDown={(e) =>
                        handleDragHandleMouseDown(element.id, panelIndex, e)
                      }
                    />
                  </div>
                  {showInsertionAfterLast && (
                    <div className="h-0.5 w-full bg-blue-500" aria-hidden="true" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
