import { useRef } from 'react'

/** Width of the vertical track / height of the horizontal track, in px. */
export const SCROLLBAR_SIZE = 12
const MIN_THUMB_SIZE = 32

type Props = {
  orientation: 'horizontal' | 'vertical'
  /** Length of the thumb along the scrolling axis, in px. */
  thumbSize: number
  /** Distance of the thumb from the track start, in px. */
  thumbOffset: number
  /** Total navigable track length (viewport width or height minus scrollbar thickness). */
  trackLength: number
  /** Whether the thumb should be visible. Hide when canvas fits entirely in viewport. */
  visible: boolean
  /** Called with the new desired thumb offset (px) during a drag. */
  onThumbMove: (newThumbOffset: number) => void
  /** Called with the click position along the track (px from track start) for page-jump. */
  onTrackClick: (clickPosPx: number) => void
}

export function CanvasScrollbar({
  orientation,
  thumbSize,
  thumbOffset,
  trackLength,
  visible,
  onThumbMove,
  onTrackClick,
}: Props) {
  const isH = orientation === 'horizontal'
  const dragStartRef = useRef<{ mouse: number; thumbOffset: number } | null>(null)

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragStartRef.current = { mouse: isH ? e.clientX : e.clientY, thumbOffset }

    const maxOffset = Math.max(0, trackLength - thumbSize)
    const onMove = (me: MouseEvent) => {
      if (!dragStartRef.current) return
      const current = isH ? me.clientX : me.clientY
      const delta = current - dragStartRef.current.mouse
      const newOffset = Math.max(0, Math.min(maxOffset, dragStartRef.current.thumbOffset + delta))
      onThumbMove(newOffset)
    }
    const onUp = () => {
      dragStartRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleTrackMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore clicks that land on the thumb itself — thumb has its own handler
    if ((e.target as HTMLElement).dataset.scrollbarThumb) return
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const clickPos = isH ? e.clientX - rect.left : e.clientY - rect.top
    onTrackClick(clickPos)
  }

  const trackStyle: React.CSSProperties = isH
    ? {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: SCROLLBAR_SIZE, // leave room for the corner fill
        height: SCROLLBAR_SIZE,
        zIndex: 10,
      }
    : {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: SCROLLBAR_SIZE, // leave room for the corner fill
        width: SCROLLBAR_SIZE,
        zIndex: 10,
      }

  const thumbStyle: React.CSSProperties = {
    position: 'absolute',
    borderRadius: MIN_THUMB_SIZE / 2,
    backgroundColor: 'rgba(0,0,0,0.25)',
    cursor: 'pointer',
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? 'auto' : 'none',
    transition: 'background-color 0.1s',
    ...(isH
      ? { top: 2, height: SCROLLBAR_SIZE - 4, left: thumbOffset, width: thumbSize }
      : { left: 2, width: SCROLLBAR_SIZE - 4, top: thumbOffset, height: thumbSize }),
  }

  return (
    <div
      style={trackStyle}
      onMouseDown={handleTrackMouseDown}
      aria-hidden="true"
      data-testid={isH ? 'scrollbar-h' : 'scrollbar-v'}
    >
      <div
        style={thumbStyle}
        data-scrollbar-thumb="true"
        data-testid={isH ? 'scrollbar-h-thumb' : 'scrollbar-v-thumb'}
        onMouseDown={handleThumbMouseDown}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.40)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.25)'
        }}
      />
    </div>
  )
}
