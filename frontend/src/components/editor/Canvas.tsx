import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useCanvasStore } from '../../stores/canvasStore'
import { DesignSurface } from './DesignSurface'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 5
const ZOOM_STEP = 1.25

type Props = {
  worldRef?: RefObject<HTMLDivElement | null>
}

export function Canvas({ worldRef }: Props) {
  const zoom = useCanvasStore((s) => s.zoom)
  const panX = useCanvasStore((s) => s.panX)
  const panY = useCanvasStore((s) => s.panY)
  const setZoom = useCanvasStore((s) => s.setZoom)
  const setPan = useCanvasStore((s) => s.setPan)
  const clearSelection = useCanvasStore((s) => s.clearSelection)

  const containerRef = useRef<HTMLDivElement>(null)
  const spaceDownRef = useRef(false)
  const [spaceActive, setSpaceActive] = useState(false)
  const panStartRef = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number } | null>(null)
  const isPanningRef = useRef(false)

  // Non-passive wheel listener for zoom toward cursor
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const { zoom: currentZoom, panX: currentPanX, panY: currentPanY } = useCanvasStore.getState()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom * factor))
      const newPanX = cx - (cx - currentPanX) * (newZoom / currentZoom)
      const newPanY = cy - (cy - currentPanY) * (newZoom / currentZoom)
      setZoom(newZoom)
      setPan(newPanX, newPanY)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [setZoom, setPan])

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        spaceDownRef.current = true
        setSpaceActive(true)
      }
      const isMod = e.ctrlKey || e.metaKey
      if (!isMod) return
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        const { zoom: z, panX: px, panY: py } = useCanvasStore.getState()
        const el = containerRef.current
        const rect = el?.getBoundingClientRect()
        const cx = rect ? rect.width / 2 : 0
        const cy = rect ? rect.height / 2 : 0
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * ZOOM_STEP))
        setPan(cx - (cx - px) * (newZoom / z), cy - (cy - py) * (newZoom / z))
        setZoom(newZoom)
      }
      if (e.key === '-') {
        e.preventDefault()
        const { zoom: z, panX: px, panY: py } = useCanvasStore.getState()
        const el = containerRef.current
        const rect = el?.getBoundingClientRect()
        const cx = rect ? rect.width / 2 : 0
        const cy = rect ? rect.height / 2 : 0
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z / ZOOM_STEP))
        setPan(cx - (cx - px) * (newZoom / z), cy - (cy - py) * (newZoom / z))
        setZoom(newZoom)
      }
      if (e.key === '0') {
        e.preventDefault()
        setZoom(1)
        setPan(0, 0)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDownRef.current = false
        setSpaceActive(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [setZoom, setPan])

  const startPan = useCallback((clientX: number, clientY: number) => {
    const { panX, panY } = useCanvasStore.getState()
    isPanningRef.current = false
    panStartRef.current = { mouseX: clientX, mouseY: clientY, panX, panY }
    document.body.style.cursor = 'grabbing'

    const onMove = (me: MouseEvent) => {
      if (!panStartRef.current) return
      isPanningRef.current = true
      const dx = me.clientX - panStartRef.current.mouseX
      const dy = me.clientY - panStartRef.current.mouseY
      setPan(panStartRef.current.panX + dx, panStartRef.current.panY + dy)
    }
    const onUp = () => {
      document.body.style.cursor = ''
      panStartRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [setPan])

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Middle mouse button or Space+left click → pan
    if (e.button === 1 || (e.button === 0 && spaceDownRef.current)) {
      e.preventDefault()
      startPan(e.clientX, e.clientY)
    }
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only clear selection on background clicks (target is the container, not an element inside)
    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvasBg === 'true') {
      if (!isPanningRef.current) clearSelection()
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden bg-gray-100"
      style={{ cursor: spaceActive ? 'grab' : undefined }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      data-canvas-bg="true"
    >
      {/* World layer */}
      <div
        style={{
          position: 'absolute',
          transformOrigin: '0 0',
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
        }}
        data-canvas-bg="true"
      >
        <DesignSurface ref={worldRef} />
      </div>

      {/* Space-pan overlay — sits on top and captures all pointer events when Space is held */}
      {spaceActive && (
        <div
          className="absolute inset-0"
          style={{ cursor: 'grab', zIndex: 9999 }}
          onMouseDown={(e) => {
            e.preventDefault()
            startPan(e.clientX, e.clientY)
          }}
        />
      )}
    </div>
  )
}
