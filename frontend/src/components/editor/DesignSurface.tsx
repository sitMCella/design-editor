import { useCanvasStore } from '../../stores/canvasStore'
import { ImageElement } from './elements/ImageElement'
import { TextElement } from './elements/TextElement'
import type {
  TextElement as TextElementType,
  ImageElement as ImageElementType,
} from '../../types/canvas'

export const SURFACE_WIDTH = 1280
export const SURFACE_HEIGHT = 720

export function DesignSurface() {
  const elements = useCanvasStore((s) => s.elements)
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const selectElements = useCanvasStore((s) => s.selectElements)
  const updateElement = useCanvasStore((s) => s.updateElement)
  const removeElements = useCanvasStore((s) => s.removeElements)

  return (
    <div
      style={{
        position: 'relative',
        width: SURFACE_WIDTH,
        height: SURFACE_HEIGHT,
        background: '#ffffff',
        flexShrink: 0,
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      }}
    >
      {elements.map((element) => {
        if (element.type === 'text') {
          return (
            <TextElement
              key={element.id}
              element={element as TextElementType}
              isSelected={selectedIds.includes(element.id)}
              onSelect={(e) => {
                e.stopPropagation()
                selectElements([element.id])
              }}
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
              onSelect={(e) => {
                e.stopPropagation()
                selectElements([element.id])
              }}
              onUpdate={(patch) => updateElement(element.id, patch)}
            />
          )
        }
        return null
      })}
    </div>
  )
}
