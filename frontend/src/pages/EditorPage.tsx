import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { Canvas } from '../components/editor/Canvas'
import { ContextualToolbar } from '../components/editor/ContextualToolbar'
import { LayerPanel } from '../components/editor/LayerPanel'
import { Toolbar } from '../components/editor/Toolbar'
import { BackgroundPicker } from '../components/editor/BackgroundPicker'
import { useCanvasStore } from '../stores/canvasStore'
import { useUIStore } from '../stores/uiStore'
import { getProject, patchProject } from '../api/projects'
import { useThumbnail } from '../hooks/useThumbnail'
import { downloadPng } from '../utils/downloadPng'
import { downloadPdf } from '../utils/downloadPdf'

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
  const backgroundColor = useCanvasStore((s) => s.backgroundColor)
  const markSaved = useCanvasStore((s) => s.markSaved)
  const loadDesign = useCanvasStore((s) => s.loadDesign)
  const zoom = useCanvasStore((s) => s.zoom)
  const setZoom = useCanvasStore((s) => s.setZoom)
  const setPan = useCanvasStore((s) => s.setPan)
  const { designId: routeDesignId = '' } = useParams<{ designId: string }>()
  const navigate = useNavigate()
  const activePanel = useUIStore((s) => s.activePanel)
  const worldRef = useRef<HTMLDivElement>(null)
  useThumbnail(routeDesignId, worldRef)

  const [isExportingPng, setIsExportingPng] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [isBgPickerOpen, setIsBgPickerOpen] = useState(false)
  const exportErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Refs for synchronous guards — React state updates are async so a rapid
  // second click (e.g. force-clicked in tests) can see the old state value.
  const isExportingPngRef = useRef(false)
  const isExportingPdfRef = useRef(false)

  const showExportError = (msg: string) => {
    setExportError(msg)
    if (exportErrorTimerRef.current) clearTimeout(exportErrorTimerRef.current)
    exportErrorTimerRef.current = setTimeout(() => setExportError(null), 4000)
  }

  const handleDownloadPng = async () => {
    if (isExportingPngRef.current) return
    isExportingPngRef.current = true
    const currentElements = useCanvasStore.getState().elements
    const visibleCount = currentElements.filter((el) => !el.hidden).length
    if (visibleCount === 0) {
      isExportingPngRef.current = false
      showExportError('Nothing to export — add at least one visible element.')
      return
    }
    setIsExportingPng(true)
    try {
      await downloadPng(worldRef, currentElements, useCanvasStore.getState().name, useCanvasStore.getState().backgroundColor)
    } catch {
      showExportError('Export failed. Please try again.')
    } finally {
      isExportingPngRef.current = false
      setIsExportingPng(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (isExportingPdfRef.current) return
    isExportingPdfRef.current = true
    const currentElements = useCanvasStore.getState().elements
    const visibleCount = currentElements.filter((el) => !el.hidden).length
    if (visibleCount === 0) {
      isExportingPdfRef.current = false
      showExportError('Nothing to export — add at least one visible element.')
      return
    }
    setIsExportingPdf(true)
    try {
      await downloadPdf(worldRef, currentElements, useCanvasStore.getState().name, useCanvasStore.getState().backgroundColor)
    } catch {
      showExportError('Export failed. Please try again.')
    } finally {
      isExportingPdfRef.current = false
      setIsExportingPdf(false)
    }
  }

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
        loadDesign(project.id, project.name, project.canvas.elements, project.canvas.backgroundColor)
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
  const backgroundColorRef = useRef(backgroundColor)
  backgroundColorRef.current = backgroundColor

  const { mutate: save } = useMutation({
    mutationFn: () =>
      patchProject(designIdRef.current, {
        name: nameRef.current,
        canvas: { elements: elementsRef.current, backgroundColor: backgroundColorRef.current },
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
        <p className="text-sm text-gray-600">
          Could not load the design. It may have been deleted or the server is unavailable.
        </p>
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
          <div className="relative mr-1">
            <button
              type="button"
              title="Canvas background"
              aria-label="Canvas background"
              onClick={() => setIsBgPickerOpen((v) => !v)}
              className={`flex h-7 items-center gap-1.5 rounded border px-2.5 text-xs font-medium text-gray-700 ${
                isBgPickerOpen
                  ? 'border-gray-300 bg-gray-100'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              {backgroundColor === 'transparent' ? (
                <span
                  className="inline-block h-3.5 w-3.5 flex-shrink-0 rounded-sm border border-gray-300"
                  style={{
                    backgroundImage: [
                      'repeating-linear-gradient(45deg, #d1d5db 25%, transparent 25%)',
                      'repeating-linear-gradient(-45deg, #d1d5db 25%, transparent 25%)',
                      'repeating-linear-gradient(45deg, transparent 75%, #d1d5db 75%)',
                      'repeating-linear-gradient(-45deg, transparent 75%, #d1d5db 75%)',
                    ].join(', '),
                    backgroundSize: '6px 6px',
                    backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px',
                    backgroundColor: '#ffffff',
                  }}
                  aria-hidden="true"
                />
              ) : (
                <span
                  className="inline-block h-3.5 w-3.5 flex-shrink-0 rounded-sm border border-gray-200"
                  style={{ backgroundColor }}
                  aria-hidden="true"
                />
              )}
              Background
            </button>
            {isBgPickerOpen && (
              <BackgroundPicker onClose={() => setIsBgPickerOpen(false)} />
            )}
          </div>
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
          <button
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            title="Download PDF"
            aria-label="Download PDF"
            className="ml-2 flex h-7 items-center gap-1.5 rounded border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            style={isExportingPdf ? { pointerEvents: 'none' } : undefined}
          >
            {isExportingPdf ? (
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"
                aria-hidden="true"
              />
            ) : (
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 1v7M3 5l3 3 3-3M1 9v1a1 1 0 001 1h8a1 1 0 001-1V9" />
              </svg>
            )}
            {!isExportingPdf && 'Download PDF'}
          </button>
          <button
            onClick={handleDownloadPng}
            disabled={isExportingPng}
            title="Download PNG"
            aria-label="Download PNG"
            className="flex h-7 items-center gap-1.5 rounded border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            style={isExportingPng ? { pointerEvents: 'none' } : undefined}
          >
            {isExportingPng ? (
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"
                aria-hidden="true"
              />
            ) : (
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 1v7M3 5l3 3 3-3M1 9v1a1 1 0 001 1h8a1 1 0 001-1V9" />
              </svg>
            )}
            {!isExportingPng && 'Download PNG'}
          </button>
        </div>
      </header>
      <ContextualToolbar />
      <div className="flex flex-1 overflow-hidden">
        <Toolbar />
        {activePanel === 'layers' && <LayerPanel />}
        <Canvas worldRef={worldRef} />
      </div>
      {exportError && (
        <div
          role="alert"
          className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 shadow"
        >
          {exportError}
        </div>
      )}
    </div>
  )
}
