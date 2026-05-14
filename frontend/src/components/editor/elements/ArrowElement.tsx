import { useRef, useState } from 'react'
import type { ArrowElement as ArrowElementType, AnchorSide, CanvasElement } from '../../../types/canvas'
import { getAllAnchorPoints, deriveBBox } from '../../../utils/anchorCoord'
import { SURFACE_WIDTH, SURFACE_HEIGHT } from '../DesignSurface'

const DRAG_THRESHOLD = 4
const SNAP_RADIUS = 12

type Props = {
  element: ArrowElementType
  isSelected: boolean
  onSelect: (e: React.MouseEvent) => void
  onUpdate: (patch: Partial<ArrowElementType>) => void
  allElements: CanvasElement[]
}

type SnapTarget = {
  elementId: string
  side: AnchorSide
  x: number
  y: number
}

// ---------------------------------------------------------------------------
// Arrowhead markers
// ---------------------------------------------------------------------------

function ArrowMarkers({ id, stroke, arrowHead }: { id: string; stroke: string; arrowHead: ArrowElementType['arrowHead'] }) {
  const showEnd = arrowHead === 'end' || arrowHead === 'both'
  const showStart = arrowHead === 'start' || arrowHead === 'both'
  return (
    <defs>
      {showEnd && (
        <marker
          id={`arrowhead-end-${id}`}
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill={stroke} />
        </marker>
      )}
      {showStart && (
        <marker
          id={`arrowhead-start-${id}`}
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L0,6 L8,3 z" fill={stroke} />
        </marker>
      )}
    </defs>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ArrowElement({ element, isSelected, onSelect, onUpdate, allElements }: Props) {
  const { id, x, y, width, height, x1, y1, x2, y2, stroke, strokeWidth, arrowHead, opacity, rotation } = element
  const isDraggingRef = useRef(false)
  const [snapTarget, setSnapTarget] = useState<SnapTarget | null>(null)

  const showEnd = arrowHead === 'end' || arrowHead === 'both'
  const showStart = arrowHead === 'start' || arrowHead === 'both'

  // -------------------------------------------------------------------------
  // Body drag
  // -------------------------------------------------------------------------

  const handleBodyMouseDown = (e: React.MouseEvent) => {
    if (!isSelected) return
    e.preventDefault()
    isDraggingRef.current = false

    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const startX1 = element.x1
    const startY1 = element.y1
    const startX2 = element.x2
    const startY2 = element.y2

    const onMouseMove = (me: MouseEvent) => {
      const dx = me.clientX - startMouseX
      const dy = me.clientY - startMouseY
      if (!isDraggingRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      isDraggingRef.current = true
      document.body.style.cursor = 'grabbing'

      const newX1 = Math.max(0, Math.min(SURFACE_WIDTH, startX1 + dx))
      const newY1 = Math.max(0, Math.min(SURFACE_HEIGHT, startY1 + dy))
      const newX2 = Math.max(0, Math.min(SURFACE_WIDTH, startX2 + dx))
      const newY2 = Math.max(0, Math.min(SURFACE_HEIGHT, startY2 + dy))

      // Breaking connections on body drag is handled: clear anchors and move freely
      onUpdate({
        x1: newX1, y1: newY1,
        x2: newX2, y2: newY2,
        startAnchor: undefined,
        endAnchor: undefined,
        ...deriveBBox(newX1, newY1, newX2, newY2, element.strokeWidth),
      })
    }

    const onMouseUp = () => {
      document.body.style.cursor = ''
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
    onSelect(e)
  }

  // -------------------------------------------------------------------------
  // Endpoint drag
  // -------------------------------------------------------------------------

  const handleEndpointMouseDown = (e: React.MouseEvent, which: 'start' | 'end') => {
    e.stopPropagation()
    e.preventDefault()

    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const startPtX = which === 'start' ? element.x1 : element.x2
    const startPtY = which === 'start' ? element.y1 : element.y2

    let currentSnap: SnapTarget | null = null

    const onMouseMove = (me: MouseEvent) => {
      const dx = me.clientX - startMouseX
      const dy = me.clientY - startMouseY
      let ptX = Math.max(0, Math.min(SURFACE_WIDTH, startPtX + dx))
      let ptY = Math.max(0, Math.min(SURFACE_HEIGHT, startPtY + dy))

      // Snap detection
      currentSnap = null
      for (const el of allElements) {
        if (el.type === 'arrow') continue
        for (const anchor of getAllAnchorPoints(el)) {
          const dist = Math.hypot(ptX - anchor.x, ptY - anchor.y)
          if (dist <= SNAP_RADIUS) {
            currentSnap = { elementId: el.id, side: anchor.side, x: anchor.x, y: anchor.y }
            ptX = anchor.x
            ptY = anchor.y
            break
          }
        }
        if (currentSnap) break
      }
      setSnapTarget(currentSnap)

      const patch: Partial<ArrowElementType> = which === 'start'
        ? { x1: ptX, y1: ptY }
        : { x2: ptX, y2: ptY }
      const newX1 = which === 'start' ? ptX : element.x1
      const newY1 = which === 'start' ? ptY : element.y1
      const newX2 = which === 'end' ? ptX : element.x2
      const newY2 = which === 'end' ? ptY : element.y2
      Object.assign(patch, deriveBBox(newX1, newY1, newX2, newY2, element.strokeWidth))
      // Clear the moved anchor while dragging
      if (which === 'start') patch.startAnchor = undefined
      else patch.endAnchor = undefined
      onUpdate(patch)
    }

    const onMouseUp = () => {
      setSnapTarget(null)
      if (currentSnap) {
        // Store the connection
        const anchorPatch: Partial<ArrowElementType> = which === 'start'
          ? { startAnchor: { elementId: currentSnap.elementId, side: currentSnap.side } }
          : { endAnchor: { elementId: currentSnap.elementId, side: currentSnap.side } }
        onUpdate(anchorPatch)
      }
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const outline = isSelected ? '2px solid #3B82F6' : 'none'
  const cursor = isSelected ? 'grab' : 'default'

  return (
    <div
      data-testid="arrow-element"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        opacity,
        outline,
        outlineOffset: '2px',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`${x} ${y} ${width} ${height}`}
        overflow="visible"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <ArrowMarkers id={id} stroke={stroke} arrowHead={arrowHead} />

        {/* Wide transparent path used as the click/drag target — using <path>
            (not <line>) keeps el.locator('line') returning a single element,
            while still providing a generous hit zone around the arrow */}
        <path
          d={`M${x1},${y1} L${x2},${y2}`}
          stroke="transparent"
          strokeWidth={Math.max(10, strokeWidth + 8)}
          fill="none"
          style={{ cursor, pointerEvents: 'stroke' }}
          onClick={handleClick}
          onMouseDown={handleBodyMouseDown}
        />

        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={stroke}
          strokeWidth={strokeWidth}
          markerEnd={showEnd ? `url(#arrowhead-end-${id})` : undefined}
          markerStart={showStart ? `url(#arrowhead-start-${id})` : undefined}
          style={{ pointerEvents: 'none' }}
        />

        {/* Endpoint handles — only when selected */}
        {isSelected && (
          <>
            {/* Start handle: hollow circle */}
            <circle
              data-testid="endpoint-start"
              cx={x1}
              cy={y1}
              r={4}
              fill="white"
              stroke="#3B82F6"
              strokeWidth={2}
              style={{ cursor: 'crosshair', pointerEvents: 'auto' }}
              onMouseDown={(e) => handleEndpointMouseDown(e, 'start')}
            />
            {/* End handle: filled circle */}
            <circle
              data-testid="endpoint-end"
              cx={x2}
              cy={y2}
              r={4}
              fill="#3B82F6"
              stroke="none"
              style={{ cursor: 'crosshair', pointerEvents: 'auto' }}
              onMouseDown={(e) => handleEndpointMouseDown(e, 'end')}
            />
          </>
        )}

        {/* Snap indicator — absolute design-surface coordinate */}
        {snapTarget && (
          <circle
            data-testid="snap-indicator"
            cx={snapTarget.x}
            cy={snapTarget.y}
            r={5}
            fill="#3B82F6"
            style={{ pointerEvents: 'none' }}
          />
        )}
      </svg>
    </div>
  )
}
