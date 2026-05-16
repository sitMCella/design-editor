import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { Canvas } from '../components/editor/Canvas'
import { ContextualToolbar } from '../components/editor/ContextualToolbar'
import { Toolbar } from '../components/editor/Toolbar'
import { useCanvasStore } from '../stores/canvasStore'
import { getProject, patchProject } from '../api/projects'
import { useThumbnail } from '../hooks/useThumbnail'

const AUTOSAVE_DEBOUNCE_MS = 2000
const AUTOSAVE_RETRY_MS = 10000
const MIN_ZOOM = 0.1
const MAX_ZOOM = 5
const ZOOM_STEP = 1.25

export function EditorPage() {
  const name = useCanvasStore((s) => s.name)
  const isDirty = useCanvasStore((s) => s.isDirty)
  const designId = useCanvasStore((s) => s.designId)
  const elements = useCanvasStore((s) => s.elements)
  const markSaved = useCanvasStore((s) => s.markSaved)
  const loadDesign = useCanvasStore((s) => s.loadDesign)
  const zoom = useCanvasStore((s) => s.zoom)
  const setZoom = useCanvasStore((s) => s.setZoom)
  const setPan = useCanvasStore((s) => s.setPan)
  const { designId: routeDesignId = '' } = useParams<{ designId: string }>()
  const navigate = useNavigate()
  const worldRef = useRef<HTMLDivElement>(null)
  useThumbnail(routeDesignId, worldRef)

  // 'loading' while fetching on reload; 'error' if fetch fails; 'ready' otherwise
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>(
    designId === routeDesignId ? 'ready' : 'loading'
  )

  // On mount: if the store doesn't already hold this project, fetch it
  useEffect(() => {
    if (designId === routeDesignId) {
      setStatus('ready')
      return
    }
    let cancelled = false
    getProject(routeDesignId)
      .then((project) => {
        if (cancelled) return
        loadDesign(project.id, project.name, project.canvas.elements)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [routeDesignId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Always-current refs so the mutationFn never closes over stale values
  const nameRef = useRef(name)
  nameRef.current = name
  const designIdRef = useRef(designId)
  designIdRef.current = designId
  const elementsRef = useRef(elements)
  elementsRef.current = elements
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  const { mutate: save } = useMutation({
    mutationFn: () =>
      patchProject(designIdRef.current, {
        name: nameRef.current,
        canvas: { elements: elementsRef.current },
      }),
    onSuccess: () => markSaved(),
  })

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
  }, [isDirty, designId])

  const handleZoomIn = () => setZoom(Math.min(MAX_ZOOM, zoom * ZOOM_STEP))
  const handleZoomOut = () => setZoom(Math.max(MIN_ZOOM, zoom / ZOOM_STEP))
  const handleZoomReset = () => {
    setZoom(1)
    setPan(0, 0)
  }

  if (status === 'loading') {
    return (
      <div
        className="flex h-screen items-center justify-center bg-gray-50"
        role="status"
        aria-label="Loading design"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50">
        <p className="text-sm text-gray-600">Could not load the design. It may have been deleted or the server is unavailable.</p>
        <button
          onClick={() => navigate('/')}
          className="rounded bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
        >
          Go home
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b bg-white px-4 py-2 shadow-sm">
        <button
          type="button"
          title="Close"
          aria-label="Close design"
          onClick={() => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            if (retryRef.current) clearTimeout(retryRef.current)
            if (isDirtyRef.current && designIdRef.current) saveRef.current()
            navigate('/')
          }}
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
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            title="Zoom out"
            aria-label="Zoom out"
            className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-40"
          >
            −
          </button>
          <button
            onClick={handleZoomReset}
            title="Reset zoom"
            aria-label="Reset zoom to 100%"
            className="h-7 min-w-[52px] rounded px-1 text-xs text-gray-600 hover:bg-gray-100"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            title="Zoom in"
            aria-label="Zoom in"
            className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-40"
          >
            +
          </button>
        </div>
      </header>
      <ContextualToolbar />
      <div className="flex flex-1 overflow-hidden">
        <Toolbar />
        <Canvas worldRef={worldRef} />
      </div>
    </div>
  )
}
