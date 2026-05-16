import type { CanvasElement } from '../types/canvas'

export function elementsBBox(
  elements: CanvasElement[]
): { x: number; y: number; width: number; height: number } | null {
  const visible = elements.filter((el) => !el.hidden)
  if (visible.length === 0) return null
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const el of visible) {
    minX = Math.min(minX, el.x)
    minY = Math.min(minY, el.y)
    maxX = Math.max(maxX, el.x + el.width)
    maxY = Math.max(maxY, el.y + el.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
