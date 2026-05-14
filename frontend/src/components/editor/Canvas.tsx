import type { RefObject } from 'react'
import { useCanvasStore } from '../../stores/canvasStore'
import { DesignSurface } from './DesignSurface'

type Props = {
  surfaceRef?: RefObject<HTMLDivElement | null>
}

export function Canvas({ surfaceRef }: Props) {
  const clearSelection = useCanvasStore((s) => s.clearSelection)

  return (
    <div
      className="flex flex-1 cursor-default items-center justify-center overflow-auto bg-gray-100"
      onClick={clearSelection}
    >
      <DesignSurface ref={surfaceRef} />
    </div>
  )
}
