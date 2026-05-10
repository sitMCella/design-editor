import { useEffect, useRef, useState } from 'react'
import type { ImageElement as ImageElementType } from '../../../types/canvas'
import { SURFACE_WIDTH, SURFACE_HEIGHT } from '../DesignSurface'

type Props = {
  element: ImageElementType
  isSelected: boolean
  onSelect: (e: React.MouseEvent) => void
  onUpdate: (patch: Partial<ImageElementType>) => void
}

type Handle = 'tl' | 'tr' | 'bl' | 'br'

const DRAG_THRESHOLD = 4
const MIN_SIZE = 40

// ---------------------------------------------------------------------------
// Placeholder icon
// ---------------------------------------------------------------------------

function PlaceholderIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      stroke="#9CA3AF"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="8" width="40" height="32" rx="3" />
      <circle cx="16" cy="18" r="4" />
      <path d="M4 34 l10-10 7 7 7-8 12 12" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Resize handle
// ---------------------------------------------------------------------------

const handleStyles: Record<Handle, React.CSSProperties> = {
  tl: { top: -5, left: -5, cursor: 'nwse-resize' },
  tr: { top: -5, right: -5, cursor: 'nesw-resize' },
  bl: { bottom: -5, left: -5, cursor: 'nesw-resize' },
  br: { bottom: -5, right: -5, cursor: 'nwse-resize' },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImageElement({ element, isSelected, onSelect, onUpdate }: Props) {
  const [isCropping, setIsCropping] = useState(false)

  const dragStartRef = useRef<{
    mouseX: number; mouseY: number; elementX: number; elementY: number
  } | null>(null)
  const isDraggingRef = useRef(false)

  const resizeStartRef = useRef<{
    mouseX: number; mouseY: number
    elementX: number; elementY: number
    elementW: number; elementH: number
    handle: Handle
  } | null>(null)

  const panStartRef = useRef<{
    mouseX: number; mouseY: number; posX: number; posY: number
  } | null>(null)

  // Reset crop mode when element is deselected
  useEffect(() => {
    if (!isSelected) setIsCropping(false)
  }, [isSelected])

  // Parse objectPosition "X% Y%" → numbers
  const parsePosition = (pos: string): [number, number] => {
    const parts = pos.split(' ')
    return [parseFloat(parts[0] ?? '50'), parseFloat(parts[1] ?? '50')]
  }

  // -------------------------------------------------------------------------
  // Drag (reposition)
  // -------------------------------------------------------------------------

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isSelected || isCropping) return
    e.preventDefault()
    e.stopPropagation()
    dragStartRef.current = {
      mouseX: e.clientX, mouseY: e.clientY,
      elementX: element.x, elementY: element.y,
    }
    isDraggingRef.current = false

    const onMouseMove = (me: MouseEvent) => {
      if (!dragStartRef.current) return
      const dx = me.clientX - dragStartRef.current.mouseX
      const dy = me.clientY - dragStartRef.current.mouseY
      if (!isDraggingRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      isDraggingRef.current = true
      document.body.style.cursor = 'grabbing'
      onUpdate({
        x: Math.max(0, Math.min(SURFACE_WIDTH - element.width, dragStartRef.current.elementX + dx)),
        y: Math.max(0, Math.min(SURFACE_HEIGHT - element.height, dragStartRef.current.elementY + dy)),
      })
    }

    const onMouseUp = () => {
      document.body.style.cursor = ''
      dragStartRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      setTimeout(() => { isDraggingRef.current = false }, 0)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isDraggingRef.current) return
    if (!isCropping) onSelect(e)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isSelected) setIsCropping(true)
  }

  // -------------------------------------------------------------------------
  // Resize
  // -------------------------------------------------------------------------

  const handleResizeMouseDown = (e: React.MouseEvent, handle: Handle) => {
    e.preventDefault()
    e.stopPropagation()
    resizeStartRef.current = {
      mouseX: e.clientX, mouseY: e.clientY,
      elementX: element.x, elementY: element.y,
      elementW: element.width, elementH: element.height,
      handle,
    }

    const onMouseMove = (me: MouseEvent) => {
      const s = resizeStartRef.current
      if (!s) return
      const dx = me.clientX - s.mouseX
      const dy = me.clientY - s.mouseY

      let x = s.elementX, y = s.elementY
      let w = s.elementW, h = s.elementH

      if (handle === 'tl') { x = s.elementX + dx; y = s.elementY + dy; w = s.elementW - dx; h = s.elementH - dy }
      if (handle === 'tr') {                        y = s.elementY + dy; w = s.elementW + dx; h = s.elementH - dy }
      if (handle === 'bl') { x = s.elementX + dx;                        w = s.elementW - dx; h = s.elementH + dy }
      if (handle === 'br') {                                               w = s.elementW + dx; h = s.elementH + dy }

      // Enforce minimum size
      if (w < MIN_SIZE) { w = MIN_SIZE; if (handle === 'tl' || handle === 'bl') x = s.elementX + s.elementW - MIN_SIZE }
      if (h < MIN_SIZE) { h = MIN_SIZE; if (handle === 'tl' || handle === 'tr') y = s.elementY + s.elementH - MIN_SIZE }

      // Clamp to surface bounds
      x = Math.max(0, x)
      y = Math.max(0, y)
      w = Math.min(w, SURFACE_WIDTH - x)
      h = Math.min(h, SURFACE_HEIGHT - y)

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
  // Crop / pan
  // -------------------------------------------------------------------------

  const handlePanMouseDown = (e: React.MouseEvent) => {
    if (!isCropping) return
    e.preventDefault()
    e.stopPropagation()
    const [posX, posY] = parsePosition(element.objectPosition)
    panStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, posX, posY }

    const onMouseMove = (me: MouseEvent) => {
      const s = panStartRef.current
      if (!s) return
      // Convert pixel delta to percentage of element size
      const newX = Math.max(0, Math.min(100, s.posX - ((me.clientX - s.mouseX) / element.width) * 100))
      const newY = Math.max(0, Math.min(100, s.posY - ((me.clientY - s.mouseY) / element.height) * 100))
      onUpdate({ objectPosition: `${newX.toFixed(1)}% ${newY.toFixed(1)}%` })
    }

    const onMouseUp = () => {
      panStartRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isCropping) {
      e.preventDefault()
      setIsCropping(false)
    }
  }

  // -------------------------------------------------------------------------
  // Styles
  // -------------------------------------------------------------------------

  const outline = !isSelected
    ? 'none'
    : isCropping
      ? '2px dashed #3B82F6'
      : '2px solid #3B82F6'

  const cursor = isCropping ? 'move' : isSelected ? 'grab' : 'default'

  return (
    <div
      tabIndex={isSelected ? 0 : undefined}
      style={{
        position: 'absolute',
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
        opacity: element.opacity,
        outline,
        outlineOffset: '2px',
        boxSizing: 'border-box',
        cursor,
        userSelect: 'none',
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={isCropping ? handlePanMouseDown : handleMouseDown}
      onKeyDown={handleKeyDown}
    >
      {/* Image / placeholder */}
      {element.src ? (
        <img
          src={element.src}
          alt=""
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: element.objectFit,
            objectPosition: element.objectPosition,
            display: 'block',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: '#E5E7EB',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <PlaceholderIcon />
          <span style={{ fontSize: 14, color: '#9CA3AF', userSelect: 'none' }}>Add image</span>
        </div>
      )}

      {/* Corner resize handles — shown when selected and not in crop mode */}
      {isSelected && !isCropping && (['tl', 'tr', 'bl', 'br'] as Handle[]).map((h) => (
        <div
          key={h}
          data-testid={`resize-handle-${h}`}
          style={{
            position: 'absolute',
            width: 10,
            height: 10,
            background: '#3B82F6',
            borderRadius: 2,
            ...handleStyles[h],
          }}
          onMouseDown={(e) => handleResizeMouseDown(e, h)}
        />
      ))}
    </div>
  )
}
