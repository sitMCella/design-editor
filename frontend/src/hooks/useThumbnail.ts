import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import html2canvas from 'html2canvas'
import { useCanvasStore } from '../stores/canvasStore'

export function useThumbnail(designId: string, surfaceRef: RefObject<HTMLDivElement | null>): void {
  const isDirty = useCanvasStore((s) => s.isDirty)
  const prevIsDirty = useRef(isDirty)
  const generating = useRef(false)

  useEffect(() => {
    const wasTrue = prevIsDirty.current
    prevIsDirty.current = isDirty

    if (wasTrue && !isDirty) {
      if (!surfaceRef.current || generating.current) return
      generating.current = true
      html2canvas(surfaceRef.current, { scale: 0.25, useCORS: true, logging: false })
        .then((canvas) => {
          canvas.toBlob(
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
            0.7
          )
        })
        .catch(() => {
          generating.current = false
        })
    }
  }, [isDirty, designId, surfaceRef])
}
