import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import html2canvas from 'html2canvas'
import { useCanvasStore } from '../stores/canvasStore'
import { elementsBBox } from '../utils/elementsBBox'

const THUMBNAIL_PADDING = 24
const THUMB_MAX_W = 320
const THUMB_MAX_H = 180

export function useThumbnail(designId: string, worldRef: RefObject<HTMLDivElement | null>): void {
  const isDirty = useCanvasStore((s) => s.isDirty)
  const prevIsDirty = useRef(isDirty)
  const generating = useRef(false)

  useEffect(() => {
    const wasTrue = prevIsDirty.current
    prevIsDirty.current = isDirty

    if (!wasTrue || isDirty) return
    if (!worldRef.current || generating.current) return

    const elements = useCanvasStore.getState().elements
    const bbox = elementsBBox(elements)
    if (!bbox) return

    generating.current = true

    // worldRef is DesignSurface (no transform). The zoom/pan transform lives
    // on the parent world-layer div. We must clear that, not the node itself.
    const node = worldRef.current
    const worldLayer = node.parentElement
    if (!worldLayer) {
      generating.current = false
      return
    }

    const captureX = bbox.x - THUMBNAIL_PADDING
    const captureY = bbox.y - THUMBNAIL_PADDING
    const captureW = bbox.width + THUMBNAIL_PADDING * 2
    const captureH = bbox.height + THUMBNAIL_PADDING * 2
    const scale = Math.min(THUMB_MAX_W / captureW, THUMB_MAX_H / captureH)

    const prevLayerTransform = worldLayer.style.transform
    const prevNodeWidth = node.style.width
    const prevNodeHeight = node.style.height

    worldLayer.style.transform = 'none'

    const nodeRight = captureX + captureW
    const nodeBottom = captureY + captureH
    node.style.width = `${nodeRight}px`
    node.style.height = `${nodeBottom}px`

    requestAnimationFrame(() => {
      html2canvas(node, {
        x: 0,
        y: 0,
        width: nodeRight,
        height: nodeBottom,
        scale,
        useCORS: true,
        logging: false,
        backgroundColor: '#F3F4F6',
      })
        .then((fullCanvas) => {
          worldLayer.style.transform = prevLayerTransform
          node.style.width = prevNodeWidth
          node.style.height = prevNodeHeight

          // Crop to the desired region using 2D API.
          const croppedW = Math.round(captureW * scale)
          const croppedH = Math.round(captureH * scale)
          const croppedCanvas = document.createElement('canvas')
          croppedCanvas.width = croppedW
          croppedCanvas.height = croppedH
          const ctx = croppedCanvas.getContext('2d')!
          ctx.drawImage(
            fullCanvas,
            Math.round(captureX * scale),
            Math.round(captureY * scale),
            croppedW,
            croppedH,
            0,
            0,
            croppedW,
            croppedH,
          )

          croppedCanvas.toBlob(
            (blob) => {
              if (!blob) {
                generating.current = false
                return
              }
              const formData = new FormData()
              formData.append('file', blob, 'thumb.jpg')
              fetch(`/api/projects/${designId}/thumbnail`, { method: 'POST', body: formData })
                .catch(() => {})
                .finally(() => {
                  generating.current = false
                })
            },
            'image/jpeg',
            0.7,
          )
        })
        .catch(() => {
          worldLayer.style.transform = prevLayerTransform
          node.style.width = prevNodeWidth
          node.style.height = prevNodeHeight
          generating.current = false
        })
    })
  }, [isDirty, designId, worldRef])
}
