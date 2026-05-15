import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useCanvasStore } from '../../stores/canvasStore'
import { DesignSurface } from './DesignSurface'
import { CanvasScrollbar, SCROLLBAR_SIZE } from './CanvasScrollbar'
import { computeVirtualBounds } from '../../utils/virtualBounds'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 5
const ZOOM_STEP = 1.25
const MIN_THUMB_SIZE = 32

type Props = {
  worldRef?: RefObject<HTMLDivElement | null>
}

export function Canvas({ worldRef }: Props) {
  const zoom = useCanvasStore((s) => s.zoom)
  const panX = useCanvasStore((s) => s.panX)
  const panY = useCanvasStore((s) => s.panY)
  const elements = useCanvasStore((s) => s.elements)
  const setZoom = useCanvasStore((s) => s.setZoom)
  const setPan = useCanvasStore((s) => s.setPan)
  const clearSelection = useCanvasStore((s) => s.clearSelection)

  const containerRef = useRef<HTMLDivElement>(null)
  const spaceDownRef = useRef(false)
  const [spaceActive, setSpaceActive] = useState(false)
  const panStartRef = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number } | null>(
    null
  )
  const isPanningRef = useRef(false)
  const bgPanStartRef = useRef<{
    mouseX: number
    mouseY: number
    panX: number
    panY: number
  } | null>(null)
  const isBgPanningRef = useRef(false)
  const suppressClickRef = useRef(false)

  // Container pixel size — drives scrollbar geometry. Tracked via ResizeObserver.
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const containerSizeRef = useRef({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const size = { w: el.clientWidth, h: el.clientHeight }
      containerSizeRef.current = size
      setContainerSize(size)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Viewport dimensions: subtract the scrollbar strip from the container.
  const vpW = Math.max(0, containerSize.w - SCROLLBAR_SIZE)
  const vpH = Math.max(0, containerSize.h - SCROLLBAR_SIZE)

  // Virtual bounds: union of initial canvas, element bboxes (+padding), and current viewport.
  const bounds = computeVirtualBounds(elements, panX, panY, zoom, vpW, vpH)

  const totalScreenW = (bounds.right - bounds.left) * zoom
  const totalScreenH = (bounds.bottom - bounds.top) * zoom

  // Thumb visibility: hide when the entire virtual canvas fits in the viewport.
  const hScrollVisible = vpW > 0 && totalScreenW > vpW
  const vScrollVisible = vpH > 0 && totalScreenH > vpH

  // Maximum scroll distances (screen pixels).
  const maxScrollX = Math.max(0, totalScreenW - vpW)
  const maxScrollY = Math.max(0, totalScreenH - vpH)

  // Thumb sizes: proportional to (viewport / total), clamped to minimum.
  const thumbW =
    vpW > 0 ? Math.min(vpW, Math.max(MIN_THUMB_SIZE, (vpW * vpW) / totalScreenW)) : MIN_THUMB_SIZE
  const thumbH =
    vpH > 0 ? Math.min(vpH, Math.max(MIN_THUMB_SIZE, (vpH * vpH) / totalScreenH)) : MIN_THUMB_SIZE

  // Current scroll offset: distance from virtual-canvas edge to viewport edge, in screen px.
  const scrollX = -panX - bounds.left * zoom
  const scrollY = -panY - bounds.top * zoom

  // Thumb positions along their respective tracks.
  const thumbX =
    maxScrollX > 0
      ? Math.max(0, Math.min(vpW - thumbW, (scrollX / maxScrollX) * (vpW - thumbW)))
      : 0
  const thumbY =
    maxScrollY > 0
      ? Math.max(0, Math.min(vpH - thumbH, (scrollY / maxScrollY) * (vpH - thumbH)))
      : 0

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
      if (e.key === 'Escape' && !e.defaultPrevented) {
        clearSelection()
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
  }, [setZoom, setPan, clearSelection])

  const startPan = useCallback(
    (clientX: number, clientY: number) => {
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
    },
    [setPan]
  )

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Middle mouse button or Space+left click → existing pan
    if (e.button === 1 || (e.button === 0 && spaceDownRef.current)) {
      e.preventDefault()
      startPan(e.clientX, e.clientY)
      return
    }

    // Plain left-click on canvas background (no Space, no Shift) → background drag-to-pan
    const isBackground =
      e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvasBg === 'true'
    if (e.button === 0 && !e.shiftKey && isBackground) {
      const { panX: px, panY: py } = useCanvasStore.getState()
      bgPanStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, panX: px, panY: py }
      isBgPanningRef.current = false

      const onMove = (me: MouseEvent) => {
        if (!bgPanStartRef.current) return
        const dx = me.clientX - bgPanStartRef.current.mouseX
        const dy = me.clientY - bgPanStartRef.current.mouseY
        if (!isBgPanningRef.current && Math.hypot(dx, dy) < 4) return
        if (!isBgPanningRef.current) {
          isBgPanningRef.current = true
          document.body.style.cursor = 'grabbing'
        }
        setPan(bgPanStartRef.current.panX + dx, bgPanStartRef.current.panY + dy)
      }

      const onUp = () => {
        document.body.style.cursor = ''
        if (isBgPanningRef.current) {
          suppressClickRef.current = true
        }
        bgPanStartRef.current = null
        isBgPanningRef.current = false
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    }
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Suppress the click that follows a background pan drag
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    // Only clear selection on background clicks (target is the container, not an element inside)
    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvasBg === 'true') {
      // Shift+click on background: do not change selection (spec AC 9)
      if (!isPanningRef.current && !e.shiftKey) clearSelection()
    }
  }

  // ---------------------------------------------------------------------------
  // Scrollbar helpers — always read fresh store state so callbacks never go stale
  // ---------------------------------------------------------------------------

  /** Recompute scrollbar geometry for one axis from current store + container state. */
  const freshGeometry = useCallback((axis: 'h' | 'v') => {
    const { panX: px, panY: py, zoom: z, elements: els } = useCanvasStore.getState()
    const { w, h } = containerSizeRef.current
    const vW = Math.max(0, w - SCROLLBAR_SIZE)
    const vH = Math.max(0, h - SCROLLBAR_SIZE)
    const b = computeVirtualBounds(els, px, py, z, vW, vH)

    if (axis === 'h') {
      const total = (b.right - b.left) * z
      const thumb = Math.min(vW, Math.max(MIN_THUMB_SIZE, (vW * vW) / total))
      const maxScroll = Math.max(0, total - vW)
      const curScroll = -px - b.left * z
      return { vp: vW, thumb, maxScroll, curScroll, edgeOffset: b.left, z }
    } else {
      const total = (b.bottom - b.top) * z
      const thumb = Math.min(vH, Math.max(MIN_THUMB_SIZE, (vH * vH) / total))
      const maxScroll = Math.max(0, total - vH)
      const curScroll = -py - b.top * z
      return { vp: vH, thumb, maxScroll, curScroll, edgeOffset: b.top, z }
    }
  }, [])

  /** Horizontal thumb dragged to newOffset px from track start → update panX. */
  const handleHThumbMove = useCallback(
    (newOffset: number) => {
      const { panY: py } = useCanvasStore.getState()
      const g = freshGeometry('h')
      const trackLen = g.vp - g.thumb
      const newScroll = trackLen > 0 ? (newOffset / trackLen) * g.maxScroll : 0
      setPan(-(newScroll + g.edgeOffset * g.z), py)
    },
    [freshGeometry, setPan]
  )

  /** Vertical thumb dragged to newOffset px from track start → update panY. */
  const handleVThumbMove = useCallback(
    (newOffset: number) => {
      const { panX: px } = useCanvasStore.getState()
      const g = freshGeometry('v')
      const trackLen = g.vp - g.thumb
      const newScroll = trackLen > 0 ? (newOffset / trackLen) * g.maxScroll : 0
      setPan(px, -(newScroll + g.edgeOffset * g.z))
    },
    [freshGeometry, setPan]
  )

  /** Click on horizontal track → jump one viewport-width toward the clicked side. */
  const handleHTrackClick = useCallback(
    (clickPosPx: number) => {
      const { panY: py } = useCanvasStore.getState()
      const g = freshGeometry('h')
      const curThumbX = g.maxScroll > 0 ? (g.curScroll / g.maxScroll) * (g.vp - g.thumb) : 0
      const dir = clickPosPx < curThumbX ? -1 : 1
      const newScroll = Math.max(0, Math.min(g.maxScroll, g.curScroll + dir * g.vp))
      setPan(-(newScroll + g.edgeOffset * g.z), py)
    },
    [freshGeometry, setPan]
  )

  /** Click on vertical track → jump one viewport-height toward the clicked side. */
  const handleVTrackClick = useCallback(
    (clickPosPx: number) => {
      const { panX: px } = useCanvasStore.getState()
      const g = freshGeometry('v')
      const curThumbY = g.maxScroll > 0 ? (g.curScroll / g.maxScroll) * (g.vp - g.thumb) : 0
      const dir = clickPosPx < curThumbY ? -1 : 1
      const newScroll = Math.max(0, Math.min(g.maxScroll, g.curScroll + dir * g.vp))
      setPan(px, -(newScroll + g.edgeOffset * g.z))
    },
    [freshGeometry, setPan]
  )

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

      {/* Horizontal scrollbar */}
      <CanvasScrollbar
        orientation="horizontal"
        thumbSize={thumbW}
        thumbOffset={thumbX}
        trackLength={vpW}
        visible={hScrollVisible}
        onThumbMove={handleHThumbMove}
        onTrackClick={handleHTrackClick}
      />

      {/* Vertical scrollbar */}
      <CanvasScrollbar
        orientation="vertical"
        thumbSize={thumbH}
        thumbOffset={thumbY}
        trackLength={vpH}
        visible={vScrollVisible}
        onThumbMove={handleVThumbMove}
        onTrackClick={handleVTrackClick}
      />

      {/* Corner fill at the intersection of the two scrollbar tracks (AC 29) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: SCROLLBAR_SIZE,
          height: SCROLLBAR_SIZE,
          backgroundColor: '#E5E7EB',
          zIndex: 10,
        }}
        aria-hidden="true"
        data-testid="scrollbar-corner"
      />

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
