import html2canvas from 'html2canvas'
import type { CanvasElement } from '../types/canvas'
import { elementsBBox } from './elementsBBox'

const EXPORT_PADDING = 24

export function toFilename(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-') + '.png'
}

export async function downloadPng(
  worldRef: React.RefObject<HTMLDivElement | null>,
  elements: CanvasElement[],
  designName: string
): Promise<void> {
  const visibleElements = elements.filter((el) => !el.hidden)
  const bbox = elementsBBox(visibleElements)
  if (!bbox) {
    throw new Error('empty')
  }

  const node = worldRef.current
  if (!node) throw new Error('no-ref')

  const captureX = bbox.x - EXPORT_PADDING
  const captureY = bbox.y - EXPORT_PADDING
  const captureW = bbox.width + EXPORT_PADDING * 2
  const captureH = bbox.height + EXPORT_PADDING * 2

  const prevTransform = node.style.transform
  node.style.transform = 'none'

  try {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    const canvas = await html2canvas(node, {
      x: captureX,
      y: captureY,
      width: captureW,
      height: captureH,
      scale: 1,
      useCORS: true,
      logging: false,
      backgroundColor: '#F3F4F6',
    })

    await new Promise<void>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('blob-failed'))
          return
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = toFilename(designName)
        a.click()
        URL.revokeObjectURL(url)
        resolve()
      }, 'image/png')
    })
  } finally {
    node.style.transform = prevTransform
  }
}
