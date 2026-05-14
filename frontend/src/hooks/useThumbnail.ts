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
    const node = worldRef.current

    // Temporarily clear the CSS transform so html2canvas sees zoom=1 world coords
    const prevTransform = node.style.transform
    node.style.transform = 'none'

    const captureX = bbox.x - THUMBNAIL_PADDING
    const captureY = bbox.y - THUMBNAIL_PADDING
    const captureW = bbox.width + THUMBNAIL_PADDING * 2
    const captureH = bbox.height + THUMBNAIL_PADDING * 2
    const scale = Math.min(THUMB_MAX_W / captureW, THUMB_MAX_H / captureH)

    // Use rAF so the style change is applied before capture
    requestAnimationFrame(() => {
      html2canvas(node, {
        x: captureX,
        y: captureY,
        width: captureW,
        height: captureH,
        scale,
        useCORS: true,
        logging: false,
        backgroundColor: '#F3F4F6',
      })
        .then((canvas) => {
          node.style.transform = prevTransform
          canvas.toBlob(
            (blob) => {
              if (!blob) { generating.current = false; return }
              const formData = new FormData()
              formData.append('file', blob, 'thumb.jpg')
              fetch(`/api/projects/${designId}/thumbnail`, { method: 'POST', body: formData })
                .catch(() => {})
                .finally(() => { generating.current = false })
            },
            'image/jpeg',
            0.7
          )
        })
        .catch(() => {
          node.style.transform = prevTransform
          generating.current = false
        })
    })
  }, [isDirty, designId, worldRef])
}
