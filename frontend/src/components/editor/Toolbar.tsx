import { useCanvasStore } from '../../stores/canvasStore'
import { useUIStore } from '../../stores/uiStore'
import type { TextElement, ImageElement, ArrowElement, TableElement } from '../../types/canvas'
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

    const x1 = 540
    const y1 = 360
    const x2 = 740
    const y2 = 360
    const strokeWidth = 2

    const element: ArrowElement = {
      id: crypto.randomUUID(),
      type: 'arrow',
      x1,
      y1,
      x2,
      y2,
      // Derived bounding box
      x: Math.min(x1, x2) - strokeWidth / 2,
      y: Math.min(y1, y2) - strokeWidth / 2,
      width: Math.abs(x2 - x1) + strokeWidth,
      height: Math.abs(y2 - y1) + strokeWidth,
      rotation: 0,
      opacity: 1,
      locked: false,
      stroke: '#111827',
      strokeWidth,
      arrowHead: 'end',
    }

    addElement(element)
    selectElements([element.id])
    setActiveTool('select')
  }

  const handleTableTool = () => {
    setActiveTool('table')

    const width = 400
    const height = 120

    const element: TableElement = {
      id: crypto.randomUUID(),
      type: 'table',
      x: (SURFACE_WIDTH - width) / 2,
      y: (SURFACE_HEIGHT - height) / 2,
      width,
      height,
      rotation: 0,
      opacity: 1,
      locked: false,
      columns: 2,
      rows: [
        { isHeader: true, cells: ['Header 1', 'Header 2'] },
        { isHeader: false, cells: ['Cell 1', 'Cell 2'] },
        { isHeader: false, cells: ['Cell 3', 'Cell 4'] },
      ],
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
      <button
        onClick={handleTableTool}
        title="Table"
        className={`flex h-10 w-10 items-center justify-center rounded transition-colors ${
          activeTool === 'table' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'
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
          <rect x="2" y="2" width="16" height="16" rx="1" />
          <line x1="2" y1="7" x2="18" y2="7" />
          <line x1="2" y1="13" x2="18" y2="13" />
          <line x1="10" y1="2" x2="10" y2="18" />
        </svg>
      </button>
    </aside>
  )
}
