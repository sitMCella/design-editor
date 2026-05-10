import { useCanvasStore } from '../../stores/canvasStore'
import { DesignSurface } from './DesignSurface'

export function Canvas() {
  const clearSelection = useCanvasStore((s) => s.clearSelection)

  return (
    <div
      className="flex flex-1 cursor-default items-center justify-center overflow-auto bg-gray-100"
      onClick={clearSelection}
    >
      <DesignSurface />
    </div>
  )
}
