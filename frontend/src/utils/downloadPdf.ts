import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import type { CanvasElement } from '../types/canvas'
import { elementsBBox } from './elementsBBox'

const EXPORT_PADDING = 24
const PX_TO_PT = 0.75
const CAPTURE_SCALE = 2

function toFilename(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-') + '.pdf'
}

export async function downloadPdf(
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
  const worldLayer = node.parentElement
  if (!worldLayer) throw new Error('no-ref')

  const captureX = bbox.x - EXPORT_PADDING
  const captureY = bbox.y - EXPORT_PADDING
  const captureW = bbox.width + EXPORT_PADDING * 2
  const captureH = bbox.height + EXPORT_PADDING * 2

  const prevLayerTransform = worldLayer.style.transform
  const prevNodeWidth = node.style.width
  const prevNodeHeight = node.style.height
  const prevNodeOverflow = node.style.overflow

  worldLayer.style.transform = 'none'

  const nodeRight = captureX + captureW
  const nodeBottom = captureY + captureH
  node.style.width = `${nodeRight}px`
  node.style.height = `${nodeBottom}px`
  node.style.overflow = 'visible'

  try {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    const fullCanvas = await html2canvas(node, {
      x: 0,
      y: 0,
      width: nodeRight,
      height: nodeBottom,
      scale: CAPTURE_SCALE,
      useCORS: true,
      logging: false,
      backgroundColor: '#F3F4F6',
    })

    const croppedCanvas = document.createElement('canvas')
    croppedCanvas.width = captureW * CAPTURE_SCALE
    croppedCanvas.height = captureH * CAPTURE_SCALE
    const ctx = croppedCanvas.getContext('2d')!
    ctx.drawImage(
      fullCanvas,
      captureX * CAPTURE_SCALE,
      captureY * CAPTURE_SCALE,
      captureW * CAPTURE_SCALE,
      captureH * CAPTURE_SCALE,
      0,
      0,
      captureW * CAPTURE_SCALE,
      captureH * CAPTURE_SCALE
    )

    const imgData = croppedCanvas.toDataURL('image/jpeg', 0.92)

    const pageW = captureW * PX_TO_PT
    const pageH = captureH * PX_TO_PT

    const pdf = new jsPDF({
      orientation: pageW >= pageH ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [pageW, pageH],
    })

    pdf.addImage(imgData, 'JPEG', 0, 0, pageW, pageH)
    pdf.save(toFilename(designName))
  } finally {
    worldLayer.style.transform = prevLayerTransform
    node.style.width = prevNodeWidth
    node.style.height = prevNodeHeight
    node.style.overflow = prevNodeOverflow
  }
}
