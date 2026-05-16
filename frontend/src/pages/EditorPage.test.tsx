import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EditorPage } from './EditorPage'
import { useCanvasStore } from '../stores/canvasStore'
import { getProject, patchProject } from '../api/projects'
import type { TextElement } from '../types/canvas'

vi.mock('../api/projects', () => ({
  patchProject: vi.fn(),
  getProject: vi.fn(),
}))

const mockPatchProject = vi.mocked(patchProject)
const mockGetProject = vi.mocked(getProject)

const mockNavigate = vi.fn()

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { mutations: { retry: false } } })
}

// Wraps EditorPage at /editor/:designId with the route matching the store's
// current designId — guarantees status starts as 'ready' in existing tests.
// Falls back to 'test-id' when the store has an empty designId so the route
// segment is always non-empty (avoids a React Router 404 in edge-case tests).
function renderEditor() {
  const storeDesignId = useCanvasStore.getState().designId || 'test-id'
  const queryClient = makeQueryClient()
  const router = createMemoryRouter(
    [
      {
        path: '/editor/:designId',
        element: (
          <QueryClientProvider client={queryClient}>
            <EditorPage />
          </QueryClientProvider>
        ),
      },
    ],
    { initialEntries: [`/editor/${storeDesignId}`] }
  )
  render(<RouterProvider router={router} />)
}

// Simulates a reload or direct URL navigation: the store is blank and the
// route carries a designId that the store does not yet know about.
function renderEditorOnReload(routeId: string) {
  useCanvasStore.setState({
    designId: '',
    name: 'Untitled Design',
    elements: [],
    selectedIds: [],
    isDirty: false,
  })
  const queryClient = makeQueryClient()
  const router = createMemoryRouter(
    [
      {
        path: '/editor/:designId',
        element: (
          <QueryClientProvider client={queryClient}>
            <EditorPage />
          </QueryClientProvider>
        ),
      },
    ],
    { initialEntries: [`/editor/${routeId}`] }
  )
  render(<RouterProvider router={router} />)
}

// A realistic project payload returned by GET /api/projects/:id
const RELOADED_PROJECT = {
  id: 'proj-123',
  name: 'Reloaded Design',
  canvas: {
    elements: [
      {
        id: 't1',
        type: 'text' as const,
        x: 100,
        y: 200,
        width: 160,
        height: 40,
        rotation: 0,
        opacity: 1,
        locked: false,
        content: 'Hello reload',
        fontSize: 16,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 'normal' as const,
        fontStyle: 'normal' as const,
        color: '#111827',
        align: 'left' as const,
      },
    ],
  },
  createdAt: '2026-05-10T10:00:00Z',
  updatedAt: '2026-05-10T10:05:00Z',
}

beforeEach(() => {
  mockNavigate.mockReset()
  mockPatchProject.mockReset()
  mockGetProject.mockReset()
  mockPatchProject.mockResolvedValue({ id: 'test-id', updatedAt: '2026-05-10T10:05:00Z' })
  // Default: getProject never resolves — tests that need a result configure it explicitly
  mockGetProject.mockReturnValue(new Promise(() => {}))
  useCanvasStore.setState({
    designId: 'test-id',
    name: 'My Design',
    elements: [],
    selectedIds: [],
    isDirty: false,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// AC 9 (feat 07) — editor renders the loaded design, not a blank canvas
// ---------------------------------------------------------------------------

describe('AC9 (feat07) — editor reflects loadDesign state', () => {
  it('shows the loaded design name in the header', () => {
    useCanvasStore.setState({ designId: 'proj-1', name: 'Loaded Design', isDirty: false })
    renderEditor()
    expect(screen.getByText('Loaded Design')).toBeInTheDocument()
  })

  it('does not show "Unsaved changes" immediately after loadDesign (isDirty=false)', () => {
    useCanvasStore.getState().loadDesign('proj-1', 'Loaded Design', [])
    renderEditor()
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
  })

  it('does not show "Unsaved changes" when loaded with elements (isDirty stays false)', () => {
    const el = {
      id: 't1',
      type: 'text' as const,
      x: 100,
      y: 100,
      width: 160,
      height: 40,
      rotation: 0,
      opacity: 1,
      locked: false,
      content: 'Hello',
      fontSize: 16,
      fontFamily: 'Inter, sans-serif',
      fontWeight: 'normal' as const,
      fontStyle: 'normal' as const,
      color: '#111827',
      align: 'left' as const,
    }
    useCanvasStore.getState().loadDesign('proj-1', 'Loaded Design', [el])
    renderEditor()
    expect(useCanvasStore.getState().isDirty).toBe(false)
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC11 — Close button is always visible in the editor header
// ---------------------------------------------------------------------------

describe('AC11 — Close button visibility', () => {
  it('renders a Close button in the header', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: /close design/i })).toBeInTheDocument()
  })

  it('the Close button is inside the header element', () => {
    renderEditor()
    const header = screen.getByRole('banner')
    expect(header).toContainElement(screen.getByRole('button', { name: /close design/i }))
  })

  it('the Close button is visible alongside the design name', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: /close design/i })).toBeVisible()
    expect(screen.getByText('My Design')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC12 — Clicking Close navigates to / without confirmation
// ---------------------------------------------------------------------------

describe('AC12 — Close navigates to home', () => {
  it('clicking Close calls navigate with "/"', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: /close design/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('clicking Close calls navigate exactly once', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: /close design/i }))
    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  it('no confirmation dialog is shown before navigating', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: /close design/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})

// ---------------------------------------------------------------------------
// AC10 (spec 06) — "Unsaved changes" indicator reflects isDirty
// ---------------------------------------------------------------------------

describe('AC10 — unsaved changes indicator', () => {
  it('shows "Unsaved changes" when isDirty is true', () => {
    useCanvasStore.setState({ isDirty: true })
    renderEditor()
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
  })

  it('does not show "Unsaved changes" when isDirty is false', () => {
    useCanvasStore.setState({ isDirty: false })
    renderEditor()
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
  })

  it('"Unsaved changes" disappears after markSaved clears the flag', async () => {
    useCanvasStore.setState({ isDirty: true })
    renderEditor()
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
    act(() => {
      useCanvasStore.getState().markSaved()
    })
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC10 (spec 06) — auto-save debounce fires patchProject after 2 s
// ---------------------------------------------------------------------------

describe('AC10 — auto-save', () => {
  it('does not call patchProject before the 2-second debounce', async () => {
    vi.useFakeTimers()
    renderEditor()

    act(() => {
      useCanvasStore.setState({ isDirty: true })
    })

    vi.advanceTimersByTime(1999)
    expect(mockPatchProject).not.toHaveBeenCalled()
  })

  it('calls patchProject after the 2-second debounce when isDirty becomes true', async () => {
    vi.useFakeTimers()
    renderEditor()

    act(() => {
      useCanvasStore.setState({ isDirty: true })
    })

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(mockPatchProject).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        name: 'My Design',
        canvas: expect.objectContaining({ elements: expect.any(Array) }),
      })
    )
  })

  it('does not call patchProject when isDirty is false', async () => {
    vi.useFakeTimers()
    renderEditor()

    // isDirty stays false — no patch should fire
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(mockPatchProject).not.toHaveBeenCalled()
  })

  it('does not call patchProject when designId is empty', async () => {
    vi.useFakeTimers()
    useCanvasStore.setState({ designId: '' })
    renderEditor()

    act(() => {
      useCanvasStore.setState({ isDirty: true })
    })

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(mockPatchProject).not.toHaveBeenCalled()
  })

  it('debounces rapid mutations — only one patchProject call after the final change', async () => {
    vi.useFakeTimers()
    renderEditor()

    // Simulate three rapid state changes
    act(() => {
      useCanvasStore.setState({ isDirty: true, name: 'Draft 1' })
    })
    vi.advanceTimersByTime(500)
    act(() => {
      useCanvasStore.setState({ name: 'Draft 2' })
    })
    vi.advanceTimersByTime(500)
    act(() => {
      useCanvasStore.setState({ name: 'Draft 3' })
    })

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(mockPatchProject).toHaveBeenCalledTimes(1)
  })

  it('clears isDirty (markSaved) after a successful patchProject', async () => {
    vi.useFakeTimers()
    renderEditor()

    act(() => {
      useCanvasStore.setState({ isDirty: true })
    })

    await act(async () => {
      vi.advanceTimersByTime(2000)
      // Flush the resolved promise from the mocked patchProject
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(useCanvasStore.getState().isDirty).toBe(false)
  })

  it('leaves isDirty true when patchProject rejects', async () => {
    vi.useFakeTimers()
    mockPatchProject.mockRejectedValue(new Error('Network error'))
    renderEditor()

    act(() => {
      useCanvasStore.setState({ isDirty: true })
    })

    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(useCanvasStore.getState().isDirty).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AC5 — zoom percentage readout
// ---------------------------------------------------------------------------

describe('AC5 — zoom percentage display', () => {
  it('shows 100% when zoom is 1', () => {
    useCanvasStore.setState({ zoom: 1 })
    renderEditor()
    expect(screen.getByRole('button', { name: /reset zoom/i })).toHaveTextContent('100%')
  })

  it('shows 50% when zoom is 0.5', () => {
    useCanvasStore.setState({ zoom: 0.5 })
    renderEditor()
    expect(screen.getByRole('button', { name: /reset zoom/i })).toHaveTextContent('50%')
  })

  it('shows 200% when zoom is 2', () => {
    useCanvasStore.setState({ zoom: 2 })
    renderEditor()
    expect(screen.getByRole('button', { name: /reset zoom/i })).toHaveTextContent('200%')
  })

  it('shows 500% when zoom is 5 (MAX_ZOOM)', () => {
    useCanvasStore.setState({ zoom: 5 })
    renderEditor()
    expect(screen.getByRole('button', { name: /reset zoom/i })).toHaveTextContent('500%')
  })

  it('shows 10% when zoom is 0.1 (MIN_ZOOM)', () => {
    useCanvasStore.setState({ zoom: 0.1 })
    renderEditor()
    expect(screen.getByRole('button', { name: /reset zoom/i })).toHaveTextContent('10%')
  })
})

// ---------------------------------------------------------------------------
// AC6 — zoom in / zoom out buttons
// ---------------------------------------------------------------------------

describe('AC6 — zoom in and zoom out buttons', () => {
  it('zoom in button increases zoom by ZOOM_STEP factor', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }))
    expect(useCanvasStore.getState().zoom).toBeCloseTo(1.25, 5)
  })

  it('zoom out button decreases zoom by ZOOM_STEP factor', () => {
    useCanvasStore.setState({ zoom: 1, panX: 0, panY: 0 })
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: /zoom out/i }))
    expect(useCanvasStore.getState().zoom).toBeCloseTo(1 / 1.25, 5)
  })

  it('reset button sets zoom back to 1', () => {
    useCanvasStore.setState({ zoom: 2, panX: 100, panY: 50 })
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: /reset zoom/i }))
    expect(useCanvasStore.getState().zoom).toBe(1)
  })

  it('reset button sets pan back to (0, 0)', () => {
    useCanvasStore.setState({ zoom: 2, panX: 100, panY: 50 })
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: /reset zoom/i }))
    expect(useCanvasStore.getState().panX).toBe(0)
    expect(useCanvasStore.getState().panY).toBe(0)
  })

  it('zoom in button is disabled at MAX_ZOOM (500%)', () => {
    useCanvasStore.setState({ zoom: 5 })
    renderEditor()
    expect(screen.getByRole('button', { name: /zoom in/i })).toBeDisabled()
  })

  it('zoom out button is disabled at MIN_ZOOM (10%)', () => {
    useCanvasStore.setState({ zoom: 0.1 })
    renderEditor()
    expect(screen.getByRole('button', { name: /zoom out/i })).toBeDisabled()
  })

  it('zoom in button is enabled below MAX_ZOOM', () => {
    useCanvasStore.setState({ zoom: 4 })
    renderEditor()
    expect(screen.getByRole('button', { name: /zoom in/i })).not.toBeDisabled()
  })

  it('zoom out button is enabled above MIN_ZOOM', () => {
    useCanvasStore.setState({ zoom: 0.5 })
    renderEditor()
    expect(screen.getByRole('button', { name: /zoom out/i })).not.toBeDisabled()
  })

  it('zoom controls are visible inside the header', () => {
    useCanvasStore.setState({ zoom: 1 })
    renderEditor()
    const header = screen.getByRole('banner')
    expect(header).toContainElement(screen.getByRole('button', { name: /zoom in/i }))
    expect(header).toContainElement(screen.getByRole('button', { name: /zoom out/i }))
    expect(header).toContainElement(screen.getByRole('button', { name: /reset zoom/i }))
  })
})

// ---------------------------------------------------------------------------
// AC17 (feat07) — browser reload restores the canvas from the backend
// ---------------------------------------------------------------------------

describe('AC17 (feat07) — browser reload fetches and restores the project', () => {
  it('shows a full-page loading spinner immediately while fetching', () => {
    mockGetProject.mockReturnValue(new Promise(() => {})) // never resolves
    renderEditorOnReload('proj-123')
    expect(screen.getByRole('status', { name: /loading design/i })).toBeInTheDocument()
  })

  it('does not render the editor shell while loading', () => {
    mockGetProject.mockReturnValue(new Promise(() => {}))
    renderEditorOnReload('proj-123')
    expect(screen.queryByRole('button', { name: /close design/i })).not.toBeInTheDocument()
  })

  it('calls getProject with the designId from the URL', () => {
    mockGetProject.mockReturnValue(new Promise(() => {}))
    renderEditorOnReload('proj-123')
    expect(mockGetProject).toHaveBeenCalledWith('proj-123')
  })

  it('calls getProject exactly once on mount', () => {
    // Use a never-resolving promise — we only assert the call count here
    mockGetProject.mockReturnValue(new Promise(() => {}))
    renderEditorOnReload('proj-123')
    expect(mockGetProject).toHaveBeenCalledTimes(1)
  })

  it('removes the spinner after the project is fetched successfully', async () => {
    mockGetProject.mockResolvedValue(RELOADED_PROJECT)
    renderEditorOnReload('proj-123')
    await screen.findByRole('button', { name: /close design/i })
    expect(screen.queryByRole('status', { name: /loading design/i })).not.toBeInTheDocument()
  })

  it('renders the editor header after a successful fetch', async () => {
    mockGetProject.mockResolvedValue(RELOADED_PROJECT)
    renderEditorOnReload('proj-123')
    expect(await screen.findByRole('button', { name: /close design/i })).toBeInTheDocument()
  })

  it('shows the loaded design name in the header', async () => {
    mockGetProject.mockResolvedValue(RELOADED_PROJECT)
    renderEditorOnReload('proj-123')
    await screen.findByRole('button', { name: /close design/i })
    expect(screen.getByText('Reloaded Design')).toBeInTheDocument()
  })

  it('hydrates the canvas store with all elements from the fetched project', async () => {
    mockGetProject.mockResolvedValue(RELOADED_PROJECT)
    renderEditorOnReload('proj-123')
    await screen.findByRole('button', { name: /close design/i })
    expect(useCanvasStore.getState().elements).toHaveLength(1)
    expect(useCanvasStore.getState().elements[0].id).toBe('t1')
  })

  it('restores all element properties exactly as saved', async () => {
    mockGetProject.mockResolvedValue(RELOADED_PROJECT)
    renderEditorOnReload('proj-123')
    await screen.findByRole('button', { name: /close design/i })
    const el = useCanvasStore.getState().elements[0] as TextElement
    expect(el.content).toBe('Hello reload')
    expect(el.x).toBe(100)
    expect(el.y).toBe(200)
    expect(el.fontSize).toBe(16)
  })

  it('sets isDirty to false after loading', async () => {
    mockGetProject.mockResolvedValue(RELOADED_PROJECT)
    renderEditorOnReload('proj-123')
    await screen.findByRole('button', { name: /close design/i })
    expect(useCanvasStore.getState().isDirty).toBe(false)
  })

  it('does not show "Unsaved changes" after loading', async () => {
    mockGetProject.mockResolvedValue(RELOADED_PROJECT)
    renderEditorOnReload('proj-123')
    await screen.findByRole('button', { name: /close design/i })
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC18 (feat07) — failed fetch shows error state, not a blank/broken canvas
// ---------------------------------------------------------------------------

describe('AC18 (feat07) — project fetch failure shows error state', () => {
  it('shows an error message when getProject rejects', async () => {
    mockGetProject.mockRejectedValue(new Error('Not found'))
    renderEditorOnReload('proj-123')
    expect(await screen.findByText(/could not load the design/i)).toBeInTheDocument()
  })

  it('shows a "Go home" button in the error state', async () => {
    mockGetProject.mockRejectedValue(new Error('Not found'))
    renderEditorOnReload('proj-123')
    expect(await screen.findByRole('button', { name: /go home/i })).toBeInTheDocument()
  })

  it('does not render the editor shell in the error state', async () => {
    mockGetProject.mockRejectedValue(new Error('Not found'))
    renderEditorOnReload('proj-123')
    await screen.findByRole('button', { name: /go home/i })
    expect(screen.queryByRole('button', { name: /close design/i })).not.toBeInTheDocument()
  })

  it('clicking "Go home" navigates to /', async () => {
    mockGetProject.mockRejectedValue(new Error('Not found'))
    renderEditorOnReload('proj-123')
    fireEvent.click(await screen.findByRole('button', { name: /go home/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('the loading spinner is gone once the error state is shown', async () => {
    mockGetProject.mockRejectedValue(new Error('Not found'))
    renderEditorOnReload('proj-123')
    await screen.findByRole('button', { name: /go home/i })
    expect(screen.queryByRole('status', { name: /loading design/i })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC19 (feat07) — direct URL navigation behaves identically to a reload
// ---------------------------------------------------------------------------

describe('AC19 (feat07) — direct URL navigation restores the project', () => {
  it('fetches the project when the store holds no design (fresh page load via URL)', () => {
    mockGetProject.mockReturnValue(new Promise(() => {}))
    renderEditorOnReload('proj-123')
    expect(mockGetProject).toHaveBeenCalledWith('proj-123')
  })

  it('fetches the project when the store holds a stale design from a previous session', async () => {
    useCanvasStore.setState({
      designId: 'old-design',
      name: 'Old Design',
      elements: [],
      isDirty: false,
    })
    mockGetProject.mockResolvedValue(RELOADED_PROJECT)
    const queryClient = makeQueryClient()
    const router = createMemoryRouter(
      [
        {
          path: '/editor/:designId',
          element: (
            <QueryClientProvider client={queryClient}>
              <EditorPage />
            </QueryClientProvider>
          ),
        },
      ],
      { initialEntries: ['/editor/proj-123'] }
    )
    render(<RouterProvider router={router} />)
    expect(mockGetProject).toHaveBeenCalledWith('proj-123')
    await screen.findByRole('button', { name: /close design/i })
    expect(screen.getByText('Reloaded Design')).toBeInTheDocument()
  })

  it('shows the spinner before the project resolves on direct URL navigation', () => {
    mockGetProject.mockReturnValue(new Promise(() => {}))
    renderEditorOnReload('proj-123')
    expect(screen.getByRole('status', { name: /loading design/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /close design/i })).not.toBeInTheDocument()
  })

  it('renders the full editor after the project resolves on direct URL navigation', async () => {
    mockGetProject.mockResolvedValue(RELOADED_PROJECT)
    renderEditorOnReload('proj-123')
    expect(await screen.findByRole('button', { name: /close design/i })).toBeInTheDocument()
    expect(useCanvasStore.getState().isDirty).toBe(false)
  })
})
