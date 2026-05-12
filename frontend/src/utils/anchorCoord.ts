import type { AnchorSide } from '../types/canvas'

type Bbox = { x: number; y: number; width: number; height: number }

export function anchorCoord(el: Bbox, side: AnchorSide): { x: number; y: number } {
  switch (side) {
    case 'top':
      return { x: el.x + el.width / 2, y: el.y }
    case 'right':
      return { x: el.x + el.width, y: el.y + el.height / 2 }
    case 'bottom':
      return { x: el.x + el.width / 2, y: el.y + el.height }
    case 'left':
      return { x: el.x, y: el.y + el.height / 2 }
    case 'center':
      return { x: el.x + el.width / 2, y: el.y + el.height / 2 }
  }
}

export function deriveBBox(x1: number, y1: number, x2: number, y2: number, strokeWidth: number) {
  return {
    x: Math.min(x1, x2) - strokeWidth / 2,
    y: Math.min(y1, y2) - strokeWidth / 2,
    width: Math.abs(x2 - x1) + strokeWidth,
    height: Math.abs(y2 - y1) + strokeWidth,
  }
}

const ANCHOR_SIDES: AnchorSide[] = ['top', 'right', 'bottom', 'left', 'center']

export function getAllAnchorPoints(
  el: Bbox
): Array<{ side: AnchorSide; x: number; y: number }> {
  return ANCHOR_SIDES.map((side) => ({ side, ...anchorCoord(el, side) }))
}
