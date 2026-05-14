import { forwardRef } from 'react'
import { useCanvasStore } from '../../stores/canvasStore'
import { ArrowElement } from './elements/ArrowElement'
import { ImageElement } from './elements/ImageElement'
import { TableElement } from './elements/TableElement'
import { TextElement } from './elements/TextElement'
import type {
  TextElement as TextElementType,
  ImageElement as ImageElementType,
  ArrowElement as ArrowElementType,
  TableElement as TableElementType,
} from '../../types/canvas'

export const DesignSurface = forwardRef<HTMLDivElement>(function DesignSurface(_props, ref) {
  const elements = useCanvasStore((s) => s.elements)
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const selectElements = useCanvasStore((s) => s.selectElements)
  const updateElement = useCanvasStore((s) => s.updateElement)
  const removeElements = useCanvasStore((s) => s.removeElements)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {elements.map((element) => {
        if (element.type === 'text') {
          return (
            <TextElement
              key={element.id}
              element={element as TextElementType}
              isSelected={selectedIds.includes(element.id)}
              onSelect={(e) => { e.stopPropagation(); selectElements([element.id]) }}
              onUpdate={(patch) => updateElement(element.id, patch)}
              onRemove={() => removeElements([element.id])}
            />
          )
        }
        if (element.type === 'image') {
          return (
            <ImageElement
              key={element.id}
              element={element as ImageElementType}
              isSelected={selectedIds.includes(element.id)}
              onSelect={(e) => { e.stopPropagation(); selectElements([element.id]) }}
              onUpdate={(patch) => updateElement(element.id, patch)}
            />
          )
        }
        if (element.type === 'arrow') {
          return (
            <ArrowElement
              key={element.id}
              element={element as ArrowElementType}
              isSelected={selectedIds.includes(element.id)}
              onSelect={(e) => { e.stopPropagation(); selectElements([element.id]) }}
              onUpdate={(patch) => updateElement(element.id, patch)}
              allElements={elements}
            />
          )
        }
        if (element.type === 'table') {
          return (
            <TableElement
              key={element.id}
              element={element as TableElementType}
              isSelected={selectedIds.includes(element.id)}
              onSelect={(e) => { e.stopPropagation(); selectElements([element.id]) }}
              onUpdate={(patch) => updateElement(element.id, patch)}
            />
          )
        }
        return null
      })}
    </div>
  )
})
