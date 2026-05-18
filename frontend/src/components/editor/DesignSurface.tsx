import { forwardRef } from 'react'
import { useCanvasStore } from '../../stores/canvasStore'
import { ArrowElement } from './elements/ArrowElement'
import { ImageElement } from './elements/ImageElement'
import { ShapeElement } from './elements/ShapeElement'
import { TableElement } from './elements/TableElement'
import { TextElement } from './elements/TextElement'
import type {
  TextElement as TextElementType,
  ImageElement as ImageElementType,
  ArrowElement as ArrowElementType,
  TableElement as TableElementType,
  ShapeElement as ShapeElementType,
} from '../../types/canvas'

export const DesignSurface = forwardRef<HTMLDivElement>(function DesignSurface(_props, ref) {
  const elements = useCanvasStore((s) => s.elements)
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const selectElements = useCanvasStore((s) => s.selectElements)
  const toggleElementSelection = useCanvasStore((s) => s.toggleElementSelection)
  const updateElement = useCanvasStore((s) => s.updateElement)
  const removeElements = useCanvasStore((s) => s.removeElements)

  const handleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.shiftKey) {
      toggleElementSelection(id)
    } else {
      selectElements([id])
    }
  }

  const handleDragEnd = (movedId: string, delta: { x: number; y: number }) => {
    // Apply the same world-space delta to all other selected elements
    selectedIds
      .filter((id) => id !== movedId)
      .forEach((id) => {
        const el = elements.find((e) => e.id === id)
        if (!el) return
        if (el.type === 'arrow') {
          const arr = el as ArrowElementType
          updateElement(id, {
            x1: arr.x1 + delta.x,
            y1: arr.y1 + delta.y,
            x2: arr.x2 + delta.x,
            y2: arr.y2 + delta.y,
            startAnchor: undefined,
            endAnchor: undefined,
          })
        } else {
          updateElement(id, { x: el.x + delta.x, y: el.y + delta.y })
        }
      })
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {elements.map((element) => {
        if (element.hidden) return null
        if (element.type === 'arrow') {
          return (
            <ArrowElement
              key={element.id}
              element={element as ArrowElementType}
              isSelected={selectedIds.includes(element.id)}
              onSelect={(e) => handleSelect(element.id, e)}
              onUpdate={(patch) => updateElement(element.id, patch)}
              allElements={elements}
              onDragEnd={(delta) => handleDragEnd(element.id, delta)}
            />
          )
        }
        if (element.type === 'text') {
          return (
            <TextElement
              key={element.id}
              element={element as TextElementType}
              isSelected={selectedIds.includes(element.id)}
              onSelect={(e) => handleSelect(element.id, e)}
              onUpdate={(patch) => updateElement(element.id, patch)}
              onRemove={() => removeElements([element.id])}
              onDragEnd={(delta) => handleDragEnd(element.id, delta)}
            />
          )
        }
        if (element.type === 'image') {
          return (
            <ImageElement
              key={element.id}
              element={element as ImageElementType}
              isSelected={selectedIds.includes(element.id)}
              onSelect={(e) => handleSelect(element.id, e)}
              onUpdate={(patch) => updateElement(element.id, patch)}
              onDragEnd={(delta) => handleDragEnd(element.id, delta)}
            />
          )
        }
        if (element.type === 'table') {
          return (
            <TableElement
              key={element.id}
              element={element as TableElementType}
              isSelected={selectedIds.includes(element.id)}
              onSelect={(e) => handleSelect(element.id, e)}
              onUpdate={(patch) => updateElement(element.id, patch)}
              onDragEnd={(delta) => handleDragEnd(element.id, delta)}
            />
          )
        }
        if (element.type === 'shape') {
          return (
            <ShapeElement
              key={element.id}
              element={element as ShapeElementType}
              isSelected={selectedIds.includes(element.id)}
              onSelect={(e) => handleSelect(element.id, e)}
              onDragEnd={(delta) => handleDragEnd(element.id, delta)}
            />
          )
        }
        return null
      })}
    </div>
  )
})
