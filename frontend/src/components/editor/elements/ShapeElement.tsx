import { useRef } from 'react'
import type { ShapeElement as ShapeElementType, ArrowElement as ArrowElementType } from '../../../types/canvas'
import { useCanvasStore } from '../../../stores/canvasStore'

type Props = {
  element: ShapeElementType
  isSelected: boolean
  onSelect: (e: React.MouseEvent) => void
  onUpdate: (patch: Partial<ShapeElementType>) => void
  onDragEnd?: (delta: { x: number; y: number }) => void
}

type CoSnap =
  | { id: string; isArrow: false; x: number; y: number }
  | { id: string; isArrow: true; x1: number; y1: number; x2: number; y2: number }

type Handle = 'tl' | 'tr' | 'bl' | 'br'

const DRAG_THRESHOLD = 4
const MIN_SIZE = 20

const handlePositions: Record<Handle, React.CSSProperties> = {
  tl: { top: -5, left: -5, cursor: 'nwse-resize' },
  tr: { top: -5, right: -5, cursor: 'nesw-resize' },
  bl: { bottom: -5, left: -5, cursor: 'nesw-resize' },
  br: { bottom: -5, right: -5, cursor: 'nwse-resize' },
}

export function ShapeElement({ element, isSelected, onSelect, onUpdate, onDragEnd }: Props) {
  const dragStartRef = useRef<{
    mouseX: number
    mouseY: number
    elementX: number
    elementY: number
    coSelected: CoSnap[]
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

  // -------------------------------------------------------------------------
  // Drag (reposition)
  // -------------------------------------------------------------------------

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isSelected || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    // Snapshot co-selected elements' positions at drag-start so we can move
    // them in real-time during onMouseMove — same timing as the dragged element.
    // This avoids relying on onMouseUp which Firefox resolves before the handler fires.
    const { selectedIds, elements: allElements } = useCanvasStore.getState()
    const coSelected: CoSnap[] = selectedIds
  .filter((id) => id !== element.id)
  .map((id): CoSnap | null => {
    const el = allElements.find((e) => e.id === id)

    if (!el) return null

    if (el.type === 'arrow') {
      const arr = el as ArrowElementType

      return {
        id: el.id,
        isArrow: true,
        x1: arr.x1,
        y1: arr.y1,
        x2: arr.x2,
        y2: arr.y2,
      }
    }

    return {
      id: el.id,
      isArrow: false,
      x: el.x,
      y: el.y,
    }
  })
  .filter((v): v is CoSnap => v !== null)

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      elementX: element.x,
      elementY: element.y,
      coSelected,
    }
    isDraggingRef.current = false

    const onMouseMove = (me: MouseEvent) => {
      if (!dragStartRef.current) return
      const dx = me.clientX - dragStartRef.current.mouseX
      const dy = me.clientY - dragStartRef.current.mouseY
      if (!isDraggingRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      isDraggingRef.current = true
      document.body.style.cursor = 'grabbing'
      const zoom = useCanvasStore.getState().zoom
      const worldDX = dx / zoom
      const worldDY = dy / zoom
      onUpdate({
        x: dragStartRef.current.elementX + worldDX,
        y: dragStartRef.current.elementY + worldDY,
      })
      // Move co-selected elements in real-time using snapshotted start positions.
      // Doing this here (not in onMouseUp) ensures Playwright sees updated DOM
      // positions before page.mouse.up() resolves in all browsers including Firefox.
      const updateElement = useCanvasStore.getState().updateElement
      for (const co of dragStartRef.current.coSelected) {
        if (co.isArrow) {
          updateElement(co.id, {
            x1: co.x1 + worldDX,
            y1: co.y1 + worldDY,
            x2: co.x2 + worldDX,
            y2: co.y2 + worldDY,
            startAnchor: undefined,
            endAnchor: undefined,
          })
        } else {
          updateElement(co.id, { x: co.x + worldDX, y: co.y + worldDY })
        }
      }
    }

    const onMouseUp = (me: MouseEvent) => {
      document.body.style.cursor = ''
      if (isDraggingRef.current && dragStartRef.current) {
        const zoom = useCanvasStore.getState().zoom
        const worldDX = (me.clientX - dragStartRef.current.mouseX) / zoom
        const worldDY = (me.clientY - dragStartRef.current.mouseY) / zoom
        onDragEnd?.({ x: worldDX, y: worldDY })
      }
      dragStartRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      setTimeout(() => {
        isDraggingRef.current = false
      }, 0)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isDraggingRef.current) return
    onSelect(e)
  }

  // -------------------------------------------------------------------------
  // Resize
  // -------------------------------------------------------------------------

  const handleResizeMouseDown = (e: React.MouseEvent, handle: Handle) => {
    e.preventDefault()
    e.stopPropagation()
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      elementX: element.x,
      elementY: element.y,
      elementW: element.width,
      elementH: element.height,
      handle,
    }

    const onMouseMove = (me: MouseEvent) => {
      const s = resizeStartRef.current
      if (!s) return
      const zoom = useCanvasStore.getState().zoom
      const dx = (me.clientX - s.mouseX) / zoom
      const dy = (me.clientY - s.mouseY) / zoom

      let x = s.elementX,
        y = s.elementY
      let w = s.elementW,
        h = s.elementH

      if (handle === 'tl') {
        x = s.elementX + dx
        y = s.elementY + dy
        w = s.elementW - dx
        h = s.elementH - dy
      } else if (handle === 'tr') {
        y = s.elementY + dy
        w = s.elementW + dx
        h = s.elementH - dy
      } else if (handle === 'bl') {
        x = s.elementX + dx
        w = s.elementW - dx
        h = s.elementH + dy
      } else if (handle === 'br') {
        w = s.elementW + dx
        h = s.elementH + dy
      }

      if (w < MIN_SIZE) {
        w = MIN_SIZE
        if (handle === 'tl' || handle === 'bl') x = s.elementX + s.elementW - MIN_SIZE
      }
      if (h < MIN_SIZE) {
        h = MIN_SIZE
        if (handle === 'tl' || handle === 'tr') y = s.elementY + s.elementH - MIN_SIZE
      }

      onUpdate({ x, y, width: w, height: h })
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
  // Styles for rect / ellipse (applied directly to the wrapper)
  // -------------------------------------------------------------------------

  const { shape, fill, stroke, strokeWidth, width, height } = element
  const hasBorder = strokeWidth > 0 && stroke !== 'transparent'
  const border = hasBorder ? `${strokeWidth}px solid ${stroke}` : 'none'

  const isTriangle = shape === 'triangle'

  const wrapperStyle: React.CSSProperties = {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width,
    height,
    outline: isSelected ? '2px solid #3B82F6' : 'none',
    outlineOffset: '2px',
    cursor: isSelected ? 'grab' : 'default',
    opacity: element.opacity,
    boxSizing: 'border-box',
    userSelect: 'none',
    // rect / ellipse visual styles (ignored for triangle via overlay)
    backgroundColor: isTriangle ? undefined : fill,
    border: isTriangle ? undefined : border,
    borderRadius: shape === 'ellipse' ? '50%' : undefined,
  }

  return (
    <div
      data-testid="shape-element"
      style={wrapperStyle}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      {/* Triangle: SVG child renders the shape */}
      {isTriangle && (
        <svg
          width={width}
          height={height}
          overflow="visible"
          style={{ display: 'block', pointerEvents: 'none' }}
        >
          <polygon
            points={`${width / 2},0 0,${height} ${width},${height}`}
            fill={fill}
            stroke={hasBorder ? stroke : 'none'}
            strokeWidth={strokeWidth}
          />
        </svg>
      )}

      {/* Corner resize handles */}
      {isSelected &&
        (['tl', 'tr', 'bl', 'br'] as Handle[]).map((h) => (
          <div
            key={h}
            data-testid={`shape-resize-handle-${h}`}
            style={{
              position: 'absolute',
              width: 10,
              height: 10,
              background: '#3B82F6',
              borderRadius: 2,
              ...handlePositions[h],
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, h)}
          />
        ))}
    </div>
  )
}
