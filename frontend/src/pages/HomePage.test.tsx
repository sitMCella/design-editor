import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, createMemoryRouter, RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HomePage } from './HomePage'
import { useCanvasStore } from '../stores/canvasStore'
import { createProject } from '../api/projects'

vi.mock('../api/projects', () => ({
  createProject: vi.fn(),
}))

const mockCreateProject = vi.mocked(createProject)

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { mutations: { retry: false } } })
}

// Render inside a memory router that also registers the editor route so
// navigation assertions can detect the route change.
function renderWithRouter() {
  const queryClient = makeQueryClient()
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <QueryClientProvider client={queryClient}>
            <HomePage />
          </QueryClientProvider>
        ),
      },
      { path: '/editor/:designId', element: <div data-testid="editor-page" /> },
    ],
    { initialEntries: ['/'] }
  )
  render(<RouterProvider router={router} />)
  return router
}

function renderStandalone() {
  const queryClient = makeQueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function openModal() {
  fireEvent.click(screen.getByRole('button', { name: /new design/i }))
  return {
    input: screen.getByLabelText(/design name/i),
    cancelBtn: screen.getByRole('button', { name: /cancel/i }),
    createBtn: screen.getByRole('button', { name: /^create$/i }),
  }
}

const initialStoreState = {
  designId: '',
  name: 'Untitled Design',
  elements: [],
  selectedIds: [],
  isDirty: false,
}

beforeEach(() => {
  useCanvasStore.setState(initialStoreState)
  mockCreateProject.mockReset()
  mockCreateProject.mockResolvedValue({
    id: 'mock-id',
    name: 'Mock Design',
    canvas: { elements: [] },
    createdAt: '2026-05-10T10:00:00Z',
    updatedAt: '2026-05-10T10:00:00Z',
  })
})

// ---------------------------------------------------------------------------
// AC 1 — home page displays the tagline and "New design" button
// ---------------------------------------------------------------------------

describe('AC1 — home page layout', () => {
  it('renders the main heading', () => {
    renderStandalone()
    expect(screen.getByRole('heading', { name: /design studio/i })).toBeInTheDocument()
  })

  it('renders the tagline "Start creating something great"', () => {
    renderStandalone()
    expect(screen.getByText(/start creating something great/i)).toBeInTheDocument()
  })

  it('renders the "New design" button', () => {
    renderStandalone()
    expect(screen.getByRole('button', { name: /new design/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC 2 — clicking "New design" opens the modal pre-filled with "Untitled design"
// ---------------------------------------------------------------------------

describe('AC2 — opening the modal', () => {
  it('modal is not visible on initial render', () => {
    renderStandalone()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('clicking "New design" opens the modal', () => {
    renderStandalone()
    fireEvent.click(screen.getByRole('button', { name: /new design/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('modal input is pre-filled with "Untitled design"', () => {
    renderStandalone()
    const { input } = openModal()
    expect(input).toHaveValue('Untitled design')
  })
})

// ---------------------------------------------------------------------------
// AC 5 — clicking "Create" calls POST /api/projects then navigates
// ---------------------------------------------------------------------------

describe('AC5 — creating a design', () => {
  it('calls createProject with a non-empty id and the supplied name', async () => {
    renderWithRouter()
    const { input, createBtn } = openModal()
    fireEvent.change(input, { target: { value: 'My Poster' } })
    fireEvent.click(createBtn)
    await waitFor(() => expect(mockCreateProject).toHaveBeenCalledTimes(1))
    const [calledId, calledName] = mockCreateProject.mock.calls[0]
    expect(calledId).not.toBe('')
    expect(calledName).toBe('My Poster')
  })

  it('initialises the canvas store with the supplied name on success', async () => {
    renderWithRouter()
    const { input, createBtn } = openModal()
    fireEvent.change(input, { target: { value: 'My Poster' } })
    fireEvent.click(createBtn)
    await waitFor(() => expect(useCanvasStore.getState().name).toBe('My Poster'))
  })

  it('generates a non-empty designId in the canvas store', async () => {
    renderWithRouter()
    const { createBtn } = openModal()
    fireEvent.click(createBtn)
    await waitFor(() => expect(useCanvasStore.getState().designId).not.toBe(''))
  })

  it('initialises elements as an empty array', async () => {
    renderWithRouter()
    const { createBtn } = openModal()
    fireEvent.click(createBtn)
    await waitFor(() => expect(useCanvasStore.getState().elements).toHaveLength(0))
  })

  it('navigates to /editor/:designId after creation', async () => {
    const router = renderWithRouter()
    const { createBtn } = openModal()
    fireEvent.click(createBtn)
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/editor\//))
  })

  it('the editor page is rendered after creation', async () => {
    renderWithRouter()
    const { createBtn } = openModal()
    fireEvent.click(createBtn)
    await waitFor(() => expect(screen.getByTestId('editor-page')).toBeInTheDocument())
  })
})

// ---------------------------------------------------------------------------
// AC 5 (spec 06) — error handling when createProject fails
// ---------------------------------------------------------------------------

describe('AC5 — createProject failure', () => {
  it('shows an error message when the API call fails', async () => {
    mockCreateProject.mockRejectedValue(new Error('Network error'))
    renderStandalone()
    const { createBtn } = openModal()
    fireEvent.click(createBtn)
    await waitFor(() => expect(screen.getByText(/network error/i)).toBeInTheDocument())
  })

  it('keeps the modal open after a failed creation', async () => {
    mockCreateProject.mockRejectedValue(new Error('Failed to create project'))
    renderStandalone()
    const { createBtn } = openModal()
    fireEvent.click(createBtn)
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })

  it('does not update the canvas store on failure', async () => {
    mockCreateProject.mockRejectedValue(new Error('Oops'))
    renderStandalone()
    const { createBtn } = openModal()
    fireEvent.click(createBtn)
    await waitFor(() => expect(screen.getByText(/oops/i)).toBeInTheDocument())
    expect(useCanvasStore.getState().designId).toBe('')
  })

  it('clears a previous error when the user clicks "New design" again', async () => {
    mockCreateProject.mockRejectedValueOnce(new Error('First error'))
    mockCreateProject.mockResolvedValue({
      id: 'ok-id',
      name: 'OK',
      canvas: { elements: [] },
      createdAt: '2026-05-10T10:00:00Z',
      updatedAt: '2026-05-10T10:00:00Z',
    })
    renderStandalone()

    // First attempt — fails
    const { createBtn } = openModal()
    fireEvent.click(createBtn)
    await waitFor(() => expect(screen.getByText(/first error/i)).toBeInTheDocument())

    // Close modal and reopen
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: /new design/i }))
    expect(screen.queryByText(/first error/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC 6 — clicking "Cancel" closes the modal without creating a design
// ---------------------------------------------------------------------------

describe('AC6 — cancel closes modal without creating', () => {
  it('clicking Cancel closes the modal', () => {
    renderStandalone()
    const { cancelBtn } = openModal()
    fireEvent.click(cancelBtn)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('clicking Cancel does not call createProject', () => {
    renderStandalone()
    const { cancelBtn } = openModal()
    fireEvent.click(cancelBtn)
    expect(mockCreateProject).not.toHaveBeenCalled()
  })

  it('clicking Cancel does not modify the canvas store', () => {
    renderStandalone()
    const { cancelBtn } = openModal()
    fireEvent.click(cancelBtn)
    expect(useCanvasStore.getState().designId).toBe('')
    expect(useCanvasStore.getState().name).toBe(initialStoreState.name)
  })
})

// ---------------------------------------------------------------------------
// AC 7 — pressing Escape closes the modal without creating a design
// ---------------------------------------------------------------------------

describe('AC7 — Escape closes modal without creating', () => {
  it('pressing Escape on the input closes the modal', () => {
    renderStandalone()
    const { input } = openModal()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('pressing Escape does not call createProject', () => {
    renderStandalone()
    const { input } = openModal()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(mockCreateProject).not.toHaveBeenCalled()
  })

  it('pressing Escape does not modify the canvas store', () => {
    renderStandalone()
    const { input } = openModal()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(useCanvasStore.getState().designId).toBe('')
  })
})

// ---------------------------------------------------------------------------
// AC 8 — clicking the backdrop closes the modal without creating a design
// ---------------------------------------------------------------------------

describe('AC8 — backdrop click closes modal without creating', () => {
  it('mouseDown on the backdrop closes the modal', () => {
    renderStandalone()
    openModal()
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('backdrop click does not call createProject', () => {
    renderStandalone()
    openModal()
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(mockCreateProject).not.toHaveBeenCalled()
  })

  it('backdrop click does not modify the canvas store', () => {
    renderStandalone()
    openModal()
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(useCanvasStore.getState().designId).toBe('')
  })
})

// ---------------------------------------------------------------------------
// AC 9 — pressing Enter creates the design (same as clicking "Create")
// ---------------------------------------------------------------------------

describe('AC9 — Enter key creates the design', () => {
  it('pressing Enter calls createProject with the entered name', async () => {
    renderWithRouter()
    const { input } = openModal()
    fireEvent.change(input, { target: { value: 'Enter Design' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(mockCreateProject).toHaveBeenCalledTimes(1))
    expect(mockCreateProject.mock.calls[0][1]).toBe('Enter Design')
  })

  it('pressing Enter navigates to /editor/:designId', async () => {
    const router = renderWithRouter()
    const { input } = openModal()
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/editor\//))
  })

  it('pressing Enter with an empty input does not call createProject', () => {
    renderWithRouter()
    const { input } = openModal()
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockCreateProject).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC 10 — no stale modal state when navigating back to /
// ---------------------------------------------------------------------------

describe('AC10 — no stale modal state on fresh render', () => {
  it('modal is closed when the home page mounts fresh', () => {
    renderStandalone()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
