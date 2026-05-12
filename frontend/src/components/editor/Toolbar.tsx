import { useCanvasStore } from '../../stores/canvasStore'
import { useUIStore } from '../../stores/uiStore'
import type { TextElement, ImageElement, ArrowElement } from '../../types/canvas'
import { SURFACE_WIDTH, SURFACE_HEIGHT } from './DesignSurface'

export function Toolbar() {
  const activeTool = useUIStore((s) => s.activeTool)
  const setActiveTool = useUIStore((s) => s.setActiveTool)
  const addElement = useCanvasStore((s) => s.addElement)
  const selectElements = useCanvasStore((s) => s.selectElements)

  const handleTextTool = () => {
    setActiveTool('text')

    const element: TextElement = {
      id: crypto.randomUUID(),
      type: 'text',
      x: (SURFACE_WIDTH - 160) / 2,
      y: (SURFACE_HEIGHT - 40) / 2,
      width: 160,
      height: 40,
      rotation: 0,
      opacity: 1,
      locked: false,
      content: 'Double-click to edit',
      fontSize: 16,
      fontFamily: 'Inter, sans-serif',
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: '#111827',
      align: 'left',
    }

    addElement(element)
    selectElements([element.id])
    setActiveTool('select')
  }

  const handleImageTool = () => {
    setActiveTool('image')

    const element: ImageElement = {
      id: crypto.randomUUID(),
      type: 'image',
      x: (SURFACE_WIDTH - 320) / 2,
      y: (SURFACE_HEIGHT - 240) / 2,
      width: 320,
      height: 240,
      rotation: 0,
      opacity: 1,
      locked: false,
      src: '',
      objectFit: 'cover',
      objectPosition: '50% 50%',
    }

    addElement(element)
    selectElements([element.id])
    setActiveTool('select')
  }

  const handleArrowTool = () => {
    setActiveTool('arrow')

    const element: ArrowElement = {
      id: crypto.randomUUID(),
      type: 'arrow',
      x: (SURFACE_WIDTH - 200) / 2,
      y: (SURFACE_HEIGHT - 10) / 2,
      width: 200,
      height: 10,
      rotation: 0,
      opacity: 1,
      locked: false,
      stroke: '#111827',
      strokeWidth: 2,
      arrowHead: 'end',
    }

    addElement(element)
    selectElements([element.id])
    setActiveTool('select')
  }

  return (
    <aside className="flex w-14 flex-col items-center gap-2 border-r bg-white py-3">
      <button
        onClick={handleTextTool}
        title="Text"
        className={`flex h-10 w-10 items-center justify-center rounded text-sm font-bold transition-colors ${
          activeTool === 'text' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        T
      </button>
      <button
        onClick={handleImageTool}
        title="Image"
        className={`flex h-10 w-10 items-center justify-center rounded transition-colors ${
          activeTool === 'image' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'
        }`}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="3" width="16" height="14" rx="2" />
          <circle cx="7" cy="8" r="1.5" />
          <path d="M2 14 l4-4 4 4 3-3 5 5" />
        </svg>
      </button>
      <button
        onClick={handleArrowTool}
        title="Arrow"
        className={`flex h-10 w-10 items-center justify-center rounded text-sm font-bold transition-colors ${
          activeTool === 'arrow' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        →
      </button>
    </aside>
  )
}
