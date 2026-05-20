import { useCanvasStore } from '../../stores/canvasStore'
import { useUIStore } from '../../stores/uiStore'
import type { TextElement, ImageElement, ArrowElement, TableElement, ShapeElement } from '../../types/canvas'

function LayersIcon() {
  return (
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
      <path d="M2 10l8 4 8-4" />
      <path d="M2 6l8 4 8-4" />
      <path d="M2 14l8 4 8-4" />
    </svg>
  )
}

const SURFACE_WIDTH = 1280
const SURFACE_HEIGHT = 720

// Number of pixels to cascade each successive text element so they don't stack exactly.
const TEXT_CASCADE_STEP = 50
const TEXT_CASCADE_MAX = 8

export function Toolbar() {
  const activeTool = useUIStore((s) => s.activeTool)
  const setActiveTool = useUIStore((s) => s.setActiveTool)
  const activePanel = useUIStore((s) => s.activePanel)
  const setActivePanel = useUIStore((s) => s.setActivePanel)
  const addElement = useCanvasStore((s) => s.addElement)
  const selectElements = useCanvasStore((s) => s.selectElements)

  const handleTextTool = () => {
    setActiveTool('text')

    // Offset each new text element so successive ones don't stack exactly on top of each other.
    const existingTextCount = useCanvasStore
      .getState()
      .elements.filter((e) => e.type === 'text').length
    const cascadeIdx = existingTextCount % TEXT_CASCADE_MAX
    const cascade = cascadeIdx * TEXT_CASCADE_STEP

    const element: TextElement = {
      id: crypto.randomUUID(),
      type: 'text',
      x: (SURFACE_WIDTH - 160) / 2 + cascade,
      y: (SURFACE_HEIGHT - 40) / 2 + cascade,
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

  const handleShapeTool = () => {
    setActiveTool('shape')

    const existingShapeCount = useCanvasStore
      .getState()
      .elements.filter((e) => e.type === 'shape').length
    // Step must exceed the default shape dimension (160px) so successive shapes
    // don't overlap and pointer events can reach each independently.
    const SHAPE_CASCADE_STEP = 200
    const SHAPE_CASCADE_MAX = 6
    const cascade = (existingShapeCount % SHAPE_CASCADE_MAX) * SHAPE_CASCADE_STEP

    const element: ShapeElement = {
      id: crypto.randomUUID(),
      type: 'shape',
      shape: 'rect',
      x: 560 + cascade,
      y: 310 + cascade,
      width: 160,
      height: 160,
      rotation: 0,
      opacity: 1,
      locked: false,
      fill: '#3B82F6',
      stroke: '#000000',
      strokeWidth: 0,
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
      columnWidths: [200, 200],
      rows: [
        { isHeader: true, height: 40, cells: ['Header 1', 'Header 2'] },
        { isHeader: false, height: 40, cells: ['Cell 1', 'Cell 2'] },
        { isHeader: false, height: 40, cells: ['Cell 3', 'Cell 4'] },
      ],
    }

    addElement(element)
    selectElements([element.id])
    setActiveTool('select')
  }

  return (
    <aside className="flex w-14 flex-shrink-0 flex-col items-center gap-2 border-r bg-white py-3">
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
      <button
        onClick={handleShapeTool}
        title="Shape"
        className={`flex h-10 w-10 items-center justify-center rounded transition-colors ${
          activeTool === 'shape' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'
        }`}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="14" height="14" rx="1" />
        </svg>
      </button>
      <div className="mt-1 w-8 border-t border-gray-200" />
      <button
        onClick={() => setActivePanel('layers')}
        title="Layers"
        className={`flex h-10 w-10 items-center justify-center rounded transition-colors ${
          activePanel === 'layers' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'
        }`}
      >
        <LayersIcon />
      </button>
    </aside>
  )
}
