import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EditorPage } from './EditorPage'
import { useCanvasStore } from '../stores/canvasStore'
import { patchProject } from '../api/projects'

vi.mock('../api/projects', () => ({
  patchProject: vi.fn(),
}))

const mockPatchProject = vi.mocked(patchProject)

const mockNavigate = vi.fn()

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { mutations: { retry: false } } })
}

function renderEditor() {
  const queryClient = makeQueryClient()
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <QueryClientProvider client={queryClient}>
            <EditorPage />
          </QueryClientProvider>
        ),
      },
    ],
    { initialEntries: ['/'] }
  )
  render(<RouterProvider router={router} />)
}

beforeEach(() => {
  mockNavigate.mockReset()
  mockPatchProject.mockReset()
  mockPatchProject.mockResolvedValue({ id: 'test-id', updatedAt: '2026-05-10T10:05:00Z' })
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
