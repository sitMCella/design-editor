// Spec 20 — Canvas Background Colour: EditorPage integration tests
// Covers: AC1, AC2, AC3, AC11

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EditorPage } from './EditorPage'
import { useCanvasStore } from '../stores/canvasStore'
import { patchProject } from '../api/projects'

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
  downloadPng: vi.fn().mockResolvedValue(undefined),
  toFilename: vi.fn((n: string) => n.toLowerCase().replace(/\s+/g, '-') + '.png'),
}))

vi.mock('../utils/downloadPdf', () => ({
  downloadPdf: vi.fn().mockResolvedValue(undefined),
}))

const mockNavigate = vi.fn()
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  vi.mocked(patchProject).mockReset()
  vi.mocked(patchProject).mockResolvedValue({ id: 'test-id', updatedAt: '2026-05-10T10:05:00Z' })

  useCanvasStore.setState({
    designId: 'test-id',
    name: 'My Design',
    elements: [],
    selectedIds: [],
    isDirty: false,
    backgroundColor: '#F3F4F6',
  })
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// AC1 — "Background" button is always visible in the editor header
// ---------------------------------------------------------------------------

describe('AC1 — Background button visibility', () => {
  it('renders a "Canvas background" button in the editor header', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: /canvas background/i })).toBeInTheDocument()
  })

  it('the Background button is visible regardless of selection state', () => {
    useCanvasStore.setState({ selectedIds: [] })
    renderEditor()
    expect(screen.getByRole('button', { name: /canvas background/i })).toBeVisible()
  })

  it('the Background button is located inside the banner (header)', () => {
    renderEditor()
    const header = screen.getByRole('banner')
    expect(header).toContainElement(screen.getByRole('button', { name: /canvas background/i }))
  })

  it('the Background button shows the text label "Background"', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: /canvas background/i })).toHaveTextContent(
      'Background'
    )
  })
})

// ---------------------------------------------------------------------------
// AC2 — Button colour swatch reflects the current backgroundColor
// ---------------------------------------------------------------------------

describe('AC2 — Button swatch reflects backgroundColor', () => {
  it('renders a colour swatch element inside the button for a hex background', () => {
    useCanvasStore.setState({ backgroundColor: '#BAE6FD' })
    renderEditor()
    const btn = screen.getByRole('button', { name: /canvas background/i })
    // A decorative span inside the button carries the background colour
    const swatch = btn.querySelector('span[aria-hidden="true"]')
    expect(swatch).toBeInTheDocument()
  })

  it('swatch reflects the current hex backgroundColor via inline style', () => {
    useCanvasStore.setState({ backgroundColor: '#111827' })
    renderEditor()
    const btn = screen.getByRole('button', { name: /canvas background/i })
    const swatch = btn.querySelector('span[aria-hidden="true"]')
    expect(swatch).toHaveStyle({ backgroundColor: '#111827' })
  })

  it('still renders "Background" label text when backgroundColor is "transparent"', () => {
    useCanvasStore.setState({ backgroundColor: 'transparent' })
    renderEditor()
    expect(screen.getByRole('button', { name: /canvas background/i })).toHaveTextContent(
      'Background'
    )
  })

  it('swatch for transparent has a checkerboard background-image pattern', () => {
    useCanvasStore.setState({ backgroundColor: 'transparent' })
    renderEditor()
    const btn = screen.getByRole('button', { name: /canvas background/i })
    const swatch = btn.querySelector('span[aria-hidden="true"]')
    // The checkerboard is implemented with repeating-linear-gradient background-image
    expect(swatch).toHaveStyle({
      backgroundImage: expect.stringContaining('repeating-linear-gradient'),
    })
  })
})

// ---------------------------------------------------------------------------
// AC3 — Toggle popover open and closed
// ---------------------------------------------------------------------------

describe('AC3 — Toggle popover', () => {
  it('does not show the BackgroundPicker popover initially', () => {
    renderEditor()
    expect(
      screen.queryByRole('dialog', { name: /canvas background colour picker/i })
    ).not.toBeInTheDocument()
  })

  it('opens the BackgroundPicker popover when the Background button is clicked', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: /canvas background/i }))
    expect(
      screen.getByRole('dialog', { name: /canvas background colour picker/i })
    ).toBeInTheDocument()
  })

  it('closes the popover when the Background button is clicked a second time', () => {
    renderEditor()
    const btn = screen.getByRole('button', { name: /canvas background/i })
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(
      screen.queryByRole('dialog', { name: /canvas background colour picker/i })
    ).not.toBeInTheDocument()
  })

  it('closes the popover when Escape is pressed while it is open', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: /canvas background/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the popover when clicking outside of it', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: /canvas background/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Click the header (outside the popover) to dismiss
    fireEvent.mouseDown(screen.getByRole('banner'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC11 — Auto-save persists backgroundColor to the backend
// ---------------------------------------------------------------------------

describe('AC11 — Auto-save includes backgroundColor', () => {
  it('sends the current backgroundColor in the canvas payload when auto-save fires', async () => {
    vi.useFakeTimers()
    useCanvasStore.setState({ backgroundColor: '#BAE6FD', isDirty: false })
    renderEditor()

    act(() => {
      useCanvasStore.getState().setBackgroundColor('#BAE6FD')
    })

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(patchProject).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        canvas: expect.objectContaining({ backgroundColor: '#BAE6FD' }),
      })
    )
  })

  it('persists "transparent" backgroundColor via auto-save', async () => {
    vi.useFakeTimers()
    renderEditor()

    act(() => {
      useCanvasStore.getState().setBackgroundColor('transparent')
    })

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(patchProject).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        canvas: expect.objectContaining({ backgroundColor: 'transparent' }),
      })
    )
  })

  it('persists a custom hex backgroundColor (#111827) via auto-save', async () => {
    vi.useFakeTimers()
    renderEditor()

    act(() => {
      useCanvasStore.getState().setBackgroundColor('#111827')
    })

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(patchProject).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        canvas: expect.objectContaining({ backgroundColor: '#111827' }),
      })
    )
  })

  it('auto-save does not fire before the 2-second debounce', async () => {
    vi.useFakeTimers()
    renderEditor()

    act(() => {
      useCanvasStore.getState().setBackgroundColor('#111827')
    })

    await act(async () => {
      vi.advanceTimersByTime(1999)
    })

    expect(patchProject).not.toHaveBeenCalled()
  })
})
