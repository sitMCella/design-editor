import type { CanvasElement } from '../types/canvas'
import { elementsBBox } from './elementsBBox'

export const INITIAL_CANVAS_WIDTH = 4000
export const INITIAL_CANVAS_HEIGHT = 3000
const EXPAND_PADDING = 200

export type VirtualBounds = {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * Compute the navigable virtual canvas bounds.
 *
 * The result is the union of:
 *   1. The minimum initial size (0 → INITIAL_CANVAS_WIDTH, 0 → INITIAL_CANVAS_HEIGHT)
 *   2. All element bounding boxes padded by EXPAND_PADDING on every side
 *   3. The current viewport extent in world space (so the scrollbar never shows
 *      the user as being "outside" the canvas after a free pan)
 *
 * Bounds only grow — they are never stored, they are recomputed each render.
 */
export function computeVirtualBounds(
  elements: CanvasElement[],
  panX: number,
  panY: number,
  zoom: number,
  viewportWidth: number,
  viewportHeight: number
): VirtualBounds {
  const z = zoom || 1
  const bbox = elementsBBox(elements)

  // Current viewport extent in world space.
  // Add 0 to each negation so that panX/panY === 0 never produces −0.
  const vpLeft = (-panX + 0) / z
  const vpTop = (-panY + 0) / z
  const vpRight = vpLeft + viewportWidth / z
  const vpBottom = vpTop + viewportHeight / z

  const left = Math.min(0, vpLeft, bbox ? bbox.x - EXPAND_PADDING : 0)
  const top = Math.min(0, vpTop, bbox ? bbox.y - EXPAND_PADDING : 0)
  const right = Math.max(
    INITIAL_CANVAS_WIDTH,
    vpRight,
    bbox ? bbox.x + bbox.width + EXPAND_PADDING : INITIAL_CANVAS_WIDTH
  )
  const bottom = Math.max(
    INITIAL_CANVAS_HEIGHT,
    vpBottom,
    bbox ? bbox.y + bbox.height + EXPAND_PADDING : INITIAL_CANVAS_HEIGHT
  )

  return { left, top, right, bottom }
}
