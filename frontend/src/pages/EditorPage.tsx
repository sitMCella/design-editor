import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { Canvas } from '../components/editor/Canvas'
import { ContextualToolbar } from '../components/editor/ContextualToolbar'
import { Toolbar } from '../components/editor/Toolbar'
import { useCanvasStore } from '../stores/canvasStore'
import { patchProject } from '../api/projects'

const AUTOSAVE_DEBOUNCE_MS = 2000
const AUTOSAVE_RETRY_MS = 10000

export function EditorPage() {
  const name = useCanvasStore((s) => s.name)
  const isDirty = useCanvasStore((s) => s.isDirty)
  const designId = useCanvasStore((s) => s.designId)
  const elements = useCanvasStore((s) => s.elements)
  const markSaved = useCanvasStore((s) => s.markSaved)
  const navigate = useNavigate()

  const { mutate: save } = useMutation({
    mutationFn: () => patchProject(designId, { name, canvas: { elements } }),
    onSuccess: () => markSaved(),
  })

  // Refs to hold the latest values for the retry timer without re-creating effects
  const saveRef = useRef(save)
  saveRef.current = save

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced auto-save when isDirty flips to true
  useEffect(() => {
    if (!isDirty || !designId) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveRef.current()
    }, AUTOSAVE_DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [isDirty, designId, name, elements])

  // Fallback retry timer: if still dirty after 10 s, save again
  useEffect(() => {
    if (!isDirty || !designId) {
      if (retryRef.current) clearTimeout(retryRef.current)
      return
    }
    retryRef.current = setTimeout(() => {
      if (useCanvasStore.getState().isDirty) saveRef.current()
    }, AUTOSAVE_RETRY_MS)

    return () => {
      if (retryRef.current) clearTimeout(retryRef.current)
    }
  }, [isDirty, designId])

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b bg-white px-4 py-2 shadow-sm">
        <button
          onClick={() => void navigate('/')}
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
