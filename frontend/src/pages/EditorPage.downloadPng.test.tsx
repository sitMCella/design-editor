import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EditorPage } from './EditorPage'
import { useCanvasStore } from '../stores/canvasStore'
import { downloadPng } from '../utils/downloadPng'
import type { TextElement } from '../types/canvas'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../api/projects', () => ({
  patchProject: vi.fn().mockResolvedValue({ id: 'test-id', updatedAt: '2026-05-10T10:05:00Z' }),
  getProject: vi.fn().mockReturnValue(new Promise(() => {})),
}))

vi.mock('../hooks/useThumbnail', () => ({
  useThumbnail: vi.fn(),
}))

vi.mock('../utils/downloadPng', () => ({
  downloadPng: vi.fn(),
  toFilename: vi.fn((n: string) => n.toLowerCase().replace(/\s+/g, '-') + '.png'),
}))

const mockDownloadPng = vi.mocked(downloadPng)

const mockNavigate = vi.fn()
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeText = (overrides: Partial<TextElement> = {}): TextElement => ({
  id: 't1',
  type: 'text',
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
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#111827',
  align: 'left',
  ...overrides,
})

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { mutations: { retry: false } } })
}

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
    { initialEntries: [`/editor/${storeDesignId}`] },
  )
  render(<RouterProvider router={router} />)
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockNavigate.mockReset()
  mockDownloadPng.mockReset()
  mockDownloadPng.mockResolvedValue(undefined)

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
// AC1 — Download PNG button is always visible in the editor header
// ---------------------------------------------------------------------------

describe('AC1 — Download PNG button visibility', () => {
  it('renders a "Download PNG" button in the editor header', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: /download png/i })).toBeInTheDocument()
  })

  it('the Download PNG button is always visible regardless of selection state', () => {
    useCanvasStore.setState({ selectedIds: [] })
    renderEditor()
    expect(screen.getByRole('button', { name: /download png/i })).toBeVisible()
  })

  it('the Download PNG button is located in the banner (header)', () => {
    renderEditor()
    const header = screen.getByRole('banner')
    expect(header).toContainElement(screen.getByRole('button', { name: /download png/i }))
  })

  it('shows "Download PNG" text label when idle', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: /download png/i })).toHaveTextContent('Download PNG')
  })
})

// ---------------------------------------------------------------------------
// AC10 — Clicking with no visible elements shows an error notification
// ---------------------------------------------------------------------------

describe('AC10 — empty canvas export error', () => {
  it('shows an error alert when the canvas has no elements at all', async () => {
    useCanvasStore.setState({ elements: [] })
    renderEditor()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/nothing to export/i)
  })

  it('shows an error alert when all elements are hidden', async () => {
    useCanvasStore.setState({ elements: [makeText({ hidden: true })] })
    renderEditor()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/nothing to export/i)
  })

  it('does not call downloadPng when there are no visible elements', () => {
    useCanvasStore.setState({ elements: [] })
    renderEditor()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    })

    expect(mockDownloadPng).not.toHaveBeenCalled()
  })

  it('does not call downloadPng when all elements are hidden', () => {
    useCanvasStore.setState({ elements: [makeText({ hidden: true })] })
    renderEditor()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    })

    expect(mockDownloadPng).not.toHaveBeenCalled()
  })

  it('"Nothing to export" error auto-dismisses after 4 seconds', async () => {
    vi.useFakeTimers()
    useCanvasStore.setState({ elements: [] })
    renderEditor()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(4000)
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('"Nothing to export" error is still visible before 4 seconds elapse', async () => {
    vi.useFakeTimers()
    useCanvasStore.setState({ elements: [] })
    renderEditor()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    })

    await act(async () => {
      vi.advanceTimersByTime(3999)
    })

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC2/AC4 — Clicking with visible elements calls downloadPng
// ---------------------------------------------------------------------------

describe('AC2/AC4 — triggering the export', () => {
  it('calls downloadPng when there is at least one visible element', async () => {
    useCanvasStore.setState({ elements: [makeText()] })
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    })

    expect(mockDownloadPng).toHaveBeenCalledOnce()
  })

  it('calls downloadPng when some elements are visible and some are hidden', async () => {
    useCanvasStore.setState({
      elements: [makeText({ id: 'v1' }), makeText({ id: 'h1', hidden: true })],
    })
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    })

    expect(mockDownloadPng).toHaveBeenCalledOnce()
  })

  it('does not show an error notification on a successful export', async () => {
    useCanvasStore.setState({ elements: [makeText()] })
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC8 — Button shows a spinner and is disabled during export
// ---------------------------------------------------------------------------

describe('AC8 — in-progress state', () => {
  it('disables the button while the export is in progress', () => {
    useCanvasStore.setState({ elements: [makeText()] })
    // Never resolves — export stays in-flight for the duration of the test.
    mockDownloadPng.mockReturnValue(new Promise(() => {}))
    renderEditor()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    })

    expect(screen.getByRole('button', { name: /download png/i })).toBeDisabled()
  })

  it('hides the "Download PNG" text label while the export is in progress', () => {
    useCanvasStore.setState({ elements: [makeText()] })
    mockDownloadPng.mockReturnValue(new Promise(() => {}))
    renderEditor()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    })

    expect(screen.getByRole('button', { name: /download png/i })).not.toHaveTextContent(
      'Download PNG',
    )
  })
})

// ---------------------------------------------------------------------------
// AC9 — Button returns to idle after a successful export
// ---------------------------------------------------------------------------

describe('AC9 — idle state after successful export', () => {
  it('re-enables the button after a successful export', async () => {
    useCanvasStore.setState({ elements: [makeText()] })
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    })

    expect(screen.getByRole('button', { name: /download png/i })).not.toBeDisabled()
  })

  it('shows the "Download PNG" text again after a successful export', async () => {
    useCanvasStore.setState({ elements: [makeText()] })
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    })

    expect(screen.getByRole('button', { name: /download png/i })).toHaveTextContent('Download PNG')
  })
})

// ---------------------------------------------------------------------------
// AC11 — Shows "Export failed" error when downloadPng rejects
// ---------------------------------------------------------------------------

describe('AC11 — export failure handling', () => {
  it('shows an "Export failed" alert when downloadPng rejects', async () => {
    useCanvasStore.setState({ elements: [makeText()] })
    mockDownloadPng.mockRejectedValue(new Error('html2canvas-error'))
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/export failed/i)
  })

  it('re-enables the button after a failed export', async () => {
    useCanvasStore.setState({ elements: [makeText()] })
    mockDownloadPng.mockRejectedValue(new Error('html2canvas-error'))
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    })

    expect(screen.getByRole('button', { name: /download png/i })).not.toBeDisabled()
  })

  it('"Export failed" error auto-dismisses after 4 seconds', async () => {
    vi.useFakeTimers()
    useCanvasStore.setState({ elements: [makeText()] })
    mockDownloadPng.mockRejectedValue(new Error('html2canvas-error'))
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
      vi.runAllTimers()
    })

    // error initially shown
    expect(screen.getByRole('alert')).toHaveTextContent(/export failed/i)

    await act(async () => {
      vi.advanceTimersByTime(4000)
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('"Export failed" error is still visible before 4 seconds elapse', async () => {
    vi.useFakeTimers()
    useCanvasStore.setState({ elements: [makeText()] })
    mockDownloadPng.mockRejectedValue(new Error('html2canvas-error'))
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
      vi.runAllTimers()
    })

    await act(async () => {
      vi.advanceTimersByTime(3999)
    })

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC15 — Multiple successive downloads
// ---------------------------------------------------------------------------

describe('AC15 — multiple successive downloads', () => {
  it('allows a second download after the first completes successfully', async () => {
    useCanvasStore.setState({ elements: [makeText()] })
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    })

    expect(mockDownloadPng).toHaveBeenCalledTimes(2)
  })
})
