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
  designName: string,
  backgroundColor = '#F3F4F6'
): Promise<void> {
  const visibleElements = elements.filter((el) => !el.hidden)
  const bbox = elementsBBox(visibleElements)
  if (!bbox) {
    throw new Error('empty')
  }

  // worldRef is the DesignSurface (position:relative, no transform of its own).
  // The actual zoom/pan transform sits on its parent (the world layer div).
  const node = worldRef.current
  if (!node) throw new Error('no-ref')
  const worldLayer = node.parentElement
  if (!worldLayer) throw new Error('no-ref')

  const captureX = bbox.x - EXPORT_PADDING
  const captureY = bbox.y - EXPORT_PADDING
  const captureW = bbox.width + EXPORT_PADDING * 2
  const captureH = bbox.height + EXPORT_PADDING * 2

  // Remember originals so we can restore them in the finally block.
  const prevLayerTransform = worldLayer.style.transform
  const prevNodeWidth = node.style.width
  const prevNodeHeight = node.style.height
  const prevNodeOverflow = node.style.overflow

  // 1. Clear the world-layer transform so html2canvas sees elements at their
  //    exact world-space CSS coordinates (zoom=1, pan=0).
  worldLayer.style.transform = 'none'

  // 2. Give DesignSurface explicit dimensions that fully contain the capture
  //    region. html2canvas uses the node's scroll/layout dimensions to decide
  //    how large a virtual canvas to allocate; without this, absolutely
  //    positioned children that fall outside the node's intrinsic (0×0) box
  //    can be missed or clipped.
  const nodeRight = captureX + captureW
  const nodeBottom = captureY + captureH
  node.style.width = `${nodeRight}px`
  node.style.height = `${nodeBottom}px`
  node.style.overflow = 'visible'

  try {
    // Wait one rAF so the style changes are applied before capture.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    // 3. Capture the full DesignSurface without an x/y crop — let html2canvas
    //    render everything at world-space coordinates and return a canvas whose
    //    pixel dimensions match nodeRight × nodeBottom.
    const fullCanvas = await html2canvas(node, {
      x: 0,
      y: 0,
      width: nodeRight,
      height: nodeBottom,
      scale: 1,
      useCORS: true,
      logging: false,
      backgroundColor: backgroundColor === 'transparent' ? null : backgroundColor,
    })

    // 4. Crop to the desired region (bounding box + padding) using the 2D API.
    //    This is more reliable than relying on html2canvas's own x/y crop,
    //    which can behave incorrectly for negative offsets or sizeless parents.
    const croppedCanvas = document.createElement('canvas')
    croppedCanvas.width = captureW
    croppedCanvas.height = captureH
    const ctx = croppedCanvas.getContext('2d')!
    ctx.drawImage(fullCanvas, captureX, captureY, captureW, captureH, 0, 0, captureW, captureH)

    await new Promise<void>((resolve, reject) => {
      croppedCanvas.toBlob((blob) => {
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
    worldLayer.style.transform = prevLayerTransform
    node.style.width = prevNodeWidth
    node.style.height = prevNodeHeight
    node.style.overflow = prevNodeOverflow
  }
}
