import { useRef, useState } from 'react'
import type {
  ArrowElement as ArrowElementType,
  AnchorSide,
  CanvasElement,
} from '../../../types/canvas'
import { getAllAnchorPoints, deriveBBox } from '../../../utils/anchorCoord'
import { useCanvasStore } from '../../../stores/canvasStore'

const DRAG_THRESHOLD = 4
const SNAP_RADIUS = 12

type Props = {
  element: ArrowElementType
  isSelected: boolean
  onSelect: (e: React.MouseEvent) => void
  onUpdate: (patch: Partial<ArrowElementType>) => void
  allElements: CanvasElement[]
  onDragEnd?: (delta: { x: number; y: number }) => void
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

function ArrowMarkers({
  id,
  stroke,
  arrowHead,
}: {
  id: string
  stroke: string
  arrowHead: ArrowElementType['arrowHead']
}) {
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

export function ArrowElement({
  element,
  isSelected,
  onSelect,
  onUpdate,
  allElements,
  onDragEnd,
}: Props) {
  const {
    id,
    x,
    y,
    width,
    height,
    x1,
    y1,
    x2,
    y2,
    stroke,
    strokeWidth,
    arrowHead,
    opacity,
    rotation,
  } = element
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
    e.stopPropagation()
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

      const zoom = useCanvasStore.getState().zoom
      const newX1 = startX1 + dx / zoom
      const newY1 = startY1 + dy / zoom
      const newX2 = startX2 + dx / zoom
      const newY2 = startY2 + dy / zoom

      // Breaking connections on body drag is handled: clear anchors and move freely
      onUpdate({
        x1: newX1,
        y1: newY1,
        x2: newX2,
        y2: newY2,
        startAnchor: undefined,
        endAnchor: undefined,
        ...deriveBBox(newX1, newY1, newX2, newY2, element.strokeWidth),
      })
    }

    const onMouseUp = (me: MouseEvent) => {
      document.body.style.cursor = ''
      if (isDraggingRef.current) {
        const zoom = useCanvasStore.getState().zoom
        const deltaX = (me.clientX - startMouseX) / zoom
        const deltaY = (me.clientY - startMouseY) / zoom
        onDragEnd?.({ x: deltaX, y: deltaY })
      }
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
      const zoom = useCanvasStore.getState().zoom
      let ptX = startPtX + dx / zoom
      let ptY = startPtY + dy / zoom

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

      const patch: Partial<ArrowElementType> =
        which === 'start' ? { x1: ptX, y1: ptY } : { x2: ptX, y2: ptY }
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
        const anchorPatch: Partial<ArrowElementType> =
          which === 'start'
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

  // Expand the SVG by markerPadding on all sides so arrowhead markers stay
  // within the SVG's declared dimensions. html2canvas clips SVG content to the
  // element's width/height even when overflow="visible" is set.
  // We use direct coordinate offsets (not <g transform>) to avoid html2canvas
  // mishandling SVG transform elements.
  const markerPadding = Math.ceil(8 * strokeWidth)

  // All SVG coordinates are offset by markerPadding so the origin of the
  // expanded SVG (placed at left:-markerPadding, top:-markerPadding) maps the
  // arrow's bounding-box top-left to SVG position (markerPadding, markerPadding).
  const svgX1 = x1 - x + markerPadding
  const svgY1 = y1 - y + markerPadding
  const svgX2 = x2 - x + markerPadding
  const svgY2 = y2 - y + markerPadding

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
        cursor,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
      onClick={handleClick}
      onMouseDown={handleBodyMouseDown}
    >
      <svg
        width={width + markerPadding * 2}
        height={height + markerPadding * 2}
        style={{
          position: 'absolute',
          left: -markerPadding,
          top: -markerPadding,
          display: 'block',
          overflow: 'visible',
        }}
      >
        <ArrowMarkers id={id} stroke={stroke} arrowHead={arrowHead} />

        {/* Wide transparent path used as the click/drag target — using <path>
            (not <line>) keeps el.locator('line') returning a single element,
            while still providing a generous hit zone around the arrow */}
        <path
          d={`M${svgX1},${svgY1} L${svgX2},${svgY2}`}
          stroke="transparent"
          strokeWidth={Math.max(10, strokeWidth + 8)}
          fill="none"
          style={{ cursor, pointerEvents: 'stroke' }}
          onClick={handleClick}
          onMouseDown={handleBodyMouseDown}
        />

        <line
          x1={svgX1}
          y1={svgY1}
          x2={svgX2}
          y2={svgY2}
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
              cx={svgX1}
              cy={svgY1}
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
              cx={svgX2}
              cy={svgY2}
              r={4}
              fill="#3B82F6"
              stroke="none"
              style={{ cursor: 'crosshair', pointerEvents: 'auto' }}
              onMouseDown={(e) => handleEndpointMouseDown(e, 'end')}
            />
          </>
        )}

        {/* Snap indicator — relative to bounding box origin */}
        {snapTarget && (
          <circle
            data-testid="snap-indicator"
            cx={snapTarget.x - x + markerPadding}
            cy={snapTarget.y - y + markerPadding}
            r={5}
            fill="#3B82F6"
            style={{ pointerEvents: 'none' }}
          />
        )}
      </svg>
    </div>
  )
}
