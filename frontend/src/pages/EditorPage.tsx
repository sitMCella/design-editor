import { useNavigate } from 'react-router'
import { Canvas } from '../components/editor/Canvas'
import { ContextualToolbar } from '../components/editor/ContextualToolbar'
import { Toolbar } from '../components/editor/Toolbar'
import { useCanvasStore } from '../stores/canvasStore'

export function EditorPage() {
  const name = useCanvasStore((s) => s.name)
  const isDirty = useCanvasStore((s) => s.isDirty)
  const navigate = useNavigate()

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b bg-white px-4 py-2 shadow-sm">
        <button
          onClick={() => navigate('/')}
          title="Close"
          aria-label="Close design"
          className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
        <span className="text-sm font-medium text-gray-700">{name}</span>
        {isDirty && <span className="text-xs text-gray-400">Unsaved changes</span>}
      </header>
      <ContextualToolbar />
      <div className="flex flex-1 overflow-hidden">
        <Toolbar />
        <Canvas />
      </div>
    </div>
  )
}
