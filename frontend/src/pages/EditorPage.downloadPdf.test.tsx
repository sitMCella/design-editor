import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EditorPage } from './EditorPage'
import { useCanvasStore } from '../stores/canvasStore'
import { downloadPdf } from '../utils/downloadPdf'
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

vi.mock('../utils/downloadPdf', () => ({
  downloadPdf: vi.fn(),
}))

vi.mock('../utils/downloadPng', () => ({
  downloadPng: vi.fn(),
  toFilename: vi.fn((n: string) => n.toLowerCase().replace(/\s+/g, '-') + '.png'),
}))

const mockDownloadPdf = vi.mocked(downloadPdf)
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
    { initialEntries: [`/editor/${storeDesignId}`] }
  )
  render(<RouterProvider router={router} />)
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockNavigate.mockReset()
  mockDownloadPdf.mockReset()
  mockDownloadPdf.mockResolvedValue(undefined)
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
// AC1 — Download PDF button is always visible in the editor header
// ---------------------------------------------------------------------------

describe('AC1 — Download PDF button visibility', () => {
  it('renders a "Download PDF" button in the editor header', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeInTheDocument()
  })

  it('the Download PDF button is always visible regardless of selection state', () => {
    useCanvasStore.setState({ selectedIds: [] })
    renderEditor()
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeVisible()
  })

  it('the Download PDF button is located in the banner (header)', () => {
    renderEditor()
    const header = screen.getByRole('banner')
    expect(header).toContainElement(screen.getByRole('button', { name: /download pdf/i }))
  })

  it('shows "Download PDF" text label when idle', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: /download pdf/i })).toHaveTextContent('Download PDF')
  })

  it('the Download PDF button is placed to the left of the Download PNG button', () => {
    renderEditor()
    const pdfButton = screen.getByRole('button', { name: /download pdf/i })
    const pngButton = screen.getByRole('button', { name: /download png/i })
    const pdfLeft = pdfButton.getBoundingClientRect().left
    const pngLeft = pngButton.getBoundingClientRect().left
    // PDF should appear before (to the left of) PNG in the DOM
    expect(
      pdfButton.compareDocumentPosition(pngButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    // Suppress unused variable warning — rect comparison is environment-dependent in jsdom
    void pdfLeft
    void pngLeft
  })
})

// ---------------------------------------------------------------------------
// AC13 — Empty/hidden canvas shows error notification
// ---------------------------------------------------------------------------

describe('AC13 — empty canvas export error', () => {
  it('shows an error alert when the canvas has no elements at all', async () => {
    useCanvasStore.setState({ elements: [] })
    renderEditor()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/nothing to export/i)
  })

  it('shows an error alert when all elements are hidden', async () => {
    useCanvasStore.setState({ elements: [makeText({ hidden: true })] })
    renderEditor()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/nothing to export/i)
  })

  it('does not call downloadPdf when there are no visible elements', () => {
    useCanvasStore.setState({ elements: [] })
    renderEditor()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })

    expect(mockDownloadPdf).not.toHaveBeenCalled()
  })

  it('does not call downloadPdf when all elements are hidden', () => {
    useCanvasStore.setState({ elements: [makeText({ hidden: true })] })
    renderEditor()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })

    expect(mockDownloadPdf).not.toHaveBeenCalled()
  })

  it('"Nothing to export" error auto-dismisses after 4 seconds', async () => {
    vi.useFakeTimers()
    useCanvasStore.setState({ elements: [] })
    renderEditor()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
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
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })

    await act(async () => {
      vi.advanceTimersByTime(3999)
    })

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC2 — Clicking with visible elements calls downloadPdf
// ---------------------------------------------------------------------------

describe('AC2 — triggering the export', () => {
  it('calls downloadPdf when there is at least one visible element', async () => {
    useCanvasStore.setState({ elements: [makeText()] })
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })

    expect(mockDownloadPdf).toHaveBeenCalledOnce()
  })

  it('calls downloadPdf when some elements are visible and some are hidden', async () => {
    useCanvasStore.setState({
      elements: [makeText({ id: 'v1' }), makeText({ id: 'h1', hidden: true })],
    })
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })

    expect(mockDownloadPdf).toHaveBeenCalledOnce()
  })

  it('does not show an error notification on a successful export', async () => {
    useCanvasStore.setState({ elements: [makeText()] })
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not call downloadPng when the PDF button is clicked', async () => {
    useCanvasStore.setState({ elements: [makeText()] })
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })

    expect(mockDownloadPng).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC10 — Button shows a spinner and is disabled during export
// ---------------------------------------------------------------------------

describe('AC10 — in-progress state', () => {
  it('disables the PDF button while the export is in progress', () => {
    useCanvasStore.setState({ elements: [makeText()] })
    // Never resolves — export stays in-flight for the duration of the test
    mockDownloadPdf.mockReturnValue(new Promise(() => {}))
    renderEditor()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })

    expect(screen.getByRole('button', { name: /download pdf/i })).toBeDisabled()
  })

  it('hides the "Download PDF" text label while the export is in progress', () => {
    useCanvasStore.setState({ elements: [makeText()] })
    mockDownloadPdf.mockReturnValue(new Promise(() => {}))
    renderEditor()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })

    expect(screen.getByRole('button', { name: /download pdf/i })).not.toHaveTextContent(
      'Download PDF'
    )
  })

  it('clicking the PDF button again while in progress has no effect (idempotent)', () => {
    useCanvasStore.setState({ elements: [makeText()] })
    mockDownloadPdf.mockReturnValue(new Promise(() => {}))
    renderEditor()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })

    expect(mockDownloadPdf).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// AC11 — PNG button remains interactive while PDF export is in progress
// ---------------------------------------------------------------------------

describe('AC11 — PDF and PNG exports are independent', () => {
  it('the "Download PNG" button remains enabled while a PDF export is in progress', () => {
    useCanvasStore.setState({ elements: [makeText()] })
    mockDownloadPdf.mockReturnValue(new Promise(() => {}))
    renderEditor()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })

    expect(screen.getByRole('button', { name: /download png/i })).not.toBeDisabled()
  })

  it('the "Download PDF" button remains enabled while a PNG export is in progress', () => {
    useCanvasStore.setState({ elements: [makeText()] })
    mockDownloadPng.mockReturnValue(new Promise(() => {}))
    renderEditor()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    })

    expect(screen.getByRole('button', { name: /download pdf/i })).not.toBeDisabled()
  })

  it('can trigger a PNG export while a PDF export is in progress', async () => {
    useCanvasStore.setState({ elements: [makeText()] })
    mockDownloadPdf.mockReturnValue(new Promise(() => {}))
    renderEditor()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    })

    expect(mockDownloadPng).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// AC12 — Button returns to idle after a successful export
// ---------------------------------------------------------------------------

describe('AC12 — idle state after successful export', () => {
  it('re-enables the button after a successful export', async () => {
    useCanvasStore.setState({ elements: [makeText()] })
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })

    expect(screen.getByRole('button', { name: /download pdf/i })).not.toBeDisabled()
  })

  it('shows the "Download PDF" text again after a successful export', async () => {
    useCanvasStore.setState({ elements: [makeText()] })
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })

    expect(screen.getByRole('button', { name: /download pdf/i })).toHaveTextContent('Download PDF')
  })
})

// ---------------------------------------------------------------------------
// AC14 — Shows "Export failed" error when downloadPdf rejects
// ---------------------------------------------------------------------------

describe('AC14 — export failure handling', () => {
  it('shows an "Export failed" alert when downloadPdf rejects', async () => {
    useCanvasStore.setState({ elements: [makeText()] })
    mockDownloadPdf.mockRejectedValue(new Error('jspdf-error'))
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/export failed/i)
  })

  it('re-enables the button after a failed export', async () => {
    useCanvasStore.setState({ elements: [makeText()] })
    mockDownloadPdf.mockRejectedValue(new Error('jspdf-error'))
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })

    expect(screen.getByRole('button', { name: /download pdf/i })).not.toBeDisabled()
  })

  it('"Export failed" error auto-dismisses after 4 seconds', async () => {
    vi.useFakeTimers()
    useCanvasStore.setState({ elements: [makeText()] })
    mockDownloadPdf.mockRejectedValue(new Error('jspdf-error'))
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
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
    mockDownloadPdf.mockRejectedValue(new Error('jspdf-error'))
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
      vi.runAllTimers()
    })

    await act(async () => {
      vi.advanceTimersByTime(3999)
    })

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('a new error replaces any existing error notification', async () => {
    vi.useFakeTimers()
    useCanvasStore.setState({ elements: [makeText()] })
    mockDownloadPdf.mockRejectedValue(new Error('jspdf-error'))
    renderEditor()

    // First failure
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
      vi.runAllTimers()
    })

    // Advance partway through the first timer
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    // Second failure — should reset the 4-second countdown
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
      vi.runAllTimers()
    })

    // Only one alert should be visible
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// AC18 — Multiple successive downloads
// ---------------------------------------------------------------------------

describe('AC18 — multiple successive downloads', () => {
  it('allows a second download after the first completes successfully', async () => {
    useCanvasStore.setState({ elements: [makeText()] })
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    })

    expect(mockDownloadPdf).toHaveBeenCalledTimes(2)
  })
})

// ---------------------------------------------------------------------------
// AC20 — Download PNG continues to function (no regression)
// ---------------------------------------------------------------------------

describe('AC20 — Download PNG is not regressed by this feature', () => {
  it('Download PNG button still calls downloadPng independently', async () => {
    useCanvasStore.setState({ elements: [makeText()] })
    renderEditor()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    })

    expect(mockDownloadPng).toHaveBeenCalledOnce()
    expect(mockDownloadPdf).not.toHaveBeenCalled()
  })
})
