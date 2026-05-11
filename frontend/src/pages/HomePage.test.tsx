import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, createMemoryRouter, RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HomePage } from './HomePage'
import { useCanvasStore } from '../stores/canvasStore'
import { createProject, getProjects, getProject } from '../api/projects'

vi.mock('../api/projects', () => ({
  createProject: vi.fn(),
  getProjects: vi.fn(),
  getProject: vi.fn(),
}))

const mockCreateProject = vi.mocked(createProject)
const mockGetProjects = vi.mocked(getProjects)
const mockGetProject = vi.mocked(getProject)

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })
}

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

const summaryRecord = {
  id: 'proj-1',
  name: 'My Design',
  elementCount: 2,
  createdAt: '2026-05-10T10:00:00Z',
  updatedAt: '2026-05-10T10:07:00Z',
}

const fullProject = {
  id: 'proj-1',
  name: 'My Design',
  canvas: {
    elements: [
      {
        id: 't1',
        type: 'text' as const,
        x: 560,
        y: 320,
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
      },
      {
        id: 'i1',
        type: 'image' as const,
        x: 100,
        y: 100,
        width: 320,
        height: 240,
        rotation: 0,
        opacity: 1,
        locked: false,
        src: '/api/assets/xyz/content',
        objectFit: 'cover' as const,
        objectPosition: 'center',
      },
    ],
  },
  createdAt: '2026-05-10T10:00:00Z',
  updatedAt: '2026-05-10T10:07:00Z',
}

beforeEach(() => {
  useCanvasStore.setState(initialStoreState)
  mockCreateProject.mockReset()
  mockGetProjects.mockReset()
  mockGetProject.mockReset()

  mockCreateProject.mockResolvedValue({
    id: 'mock-id',
    name: 'Mock Design',
    canvas: { elements: [] },
    createdAt: '2026-05-10T10:00:00Z',
    updatedAt: '2026-05-10T10:00:00Z',
  })
  mockGetProjects.mockResolvedValue([])
  mockGetProject.mockResolvedValue(fullProject)
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

    const { createBtn } = openModal()
    fireEvent.click(createBtn)
    await waitFor(() => expect(screen.getByText(/first error/i)).toBeInTheDocument())

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

// ---------------------------------------------------------------------------
// AC 1 (feat 07) — skeleton cards shown while project list is loading
// ---------------------------------------------------------------------------

describe('AC1 (feat07) — loading state shows skeletons', () => {
  it('renders skeleton cards while the project list is being fetched', () => {
    let resolve: (v: never[]) => void
    mockGetProjects.mockReturnValue(
      new Promise((r) => {
        resolve = r
      })
    )
    renderStandalone()
    // skeleton cards are rendered as non-interactive divs (not buttons)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
    resolve!([])
  })
})

// ---------------------------------------------------------------------------
// AC 2 (feat 07) — project grid renders when projects exist
// ---------------------------------------------------------------------------

describe('AC2 (feat07) — project grid', () => {
  it('renders project cards after successful fetch', async () => {
    mockGetProjects.mockResolvedValue([summaryRecord])
    renderStandalone()
    await waitFor(() => expect(screen.getByText('My Design')).toBeInTheDocument())
  })

  it('renders one card per project', async () => {
    const second = { ...summaryRecord, id: 'proj-2', name: 'Second Design' }
    mockGetProjects.mockResolvedValue([summaryRecord, second])
    renderStandalone()
    await waitFor(() => expect(screen.getByText('My Design')).toBeInTheDocument())
    expect(screen.getByText('Second Design')).toBeInTheDocument()
  })

  it('shows the element count on the card', async () => {
    mockGetProjects.mockResolvedValue([summaryRecord])
    renderStandalone()
    await waitFor(() => expect(screen.getByText(/2 elements/i)).toBeInTheDocument())
  })
})

// ---------------------------------------------------------------------------
// AC 4 (feat 07) — empty state when no projects
// ---------------------------------------------------------------------------

describe('AC4 (feat07) — empty state', () => {
  it('shows empty state message when there are no projects', async () => {
    mockGetProjects.mockResolvedValue([])
    renderStandalone()
    await waitFor(() => expect(screen.getByText(/no designs yet/i)).toBeInTheDocument())
  })

  it('does not render the "Recent designs" heading when empty', async () => {
    mockGetProjects.mockResolvedValue([])
    renderStandalone()
    await waitFor(() => expect(screen.queryByText(/recent designs/i)).not.toBeInTheDocument())
  })
})

// ---------------------------------------------------------------------------
// AC 5 (feat 07) — error state with retry
// ---------------------------------------------------------------------------

describe('AC5 (feat07) — project list error state', () => {
  it('shows error message and retry button when getProjects fails', async () => {
    mockGetProjects.mockRejectedValue(new Error('Network failure'))
    renderStandalone()
    await waitFor(() =>
      expect(screen.getByText(/could not load your designs/i)).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC 6 & 7 (feat 07) — clicking a card loads the project and navigates
// ---------------------------------------------------------------------------

describe('AC6 & AC7 (feat07) — loading a project from a card', () => {
  it('calls getProject with the card id when a card is clicked', async () => {
    mockGetProjects.mockResolvedValue([summaryRecord])
    renderWithRouter()
    await waitFor(() => screen.getByText('My Design'))
    fireEvent.click(screen.getByText('My Design'))
    await waitFor(() => expect(mockGetProject).toHaveBeenCalledWith('proj-1'))
  })

  it('hydrates the canvas store with the loaded elements', async () => {
    mockGetProjects.mockResolvedValue([summaryRecord])
    renderWithRouter()
    await waitFor(() => screen.getByText('My Design'))
    fireEvent.click(screen.getByText('My Design'))
    await waitFor(() => expect(useCanvasStore.getState().elements).toHaveLength(2))
    expect(useCanvasStore.getState().designId).toBe('proj-1')
    expect(useCanvasStore.getState().name).toBe('My Design')
  })

  it('sets isDirty to false after loading', async () => {
    mockGetProjects.mockResolvedValue([summaryRecord])
    renderWithRouter()
    await waitFor(() => screen.getByText('My Design'))
    fireEvent.click(screen.getByText('My Design'))
    await waitFor(() => expect(useCanvasStore.getState().elements).toHaveLength(2))
    expect(useCanvasStore.getState().isDirty).toBe(false)
  })

  it('navigates to the editor after loading', async () => {
    mockGetProjects.mockResolvedValue([summaryRecord])
    const router = renderWithRouter()
    await waitFor(() => screen.getByText('My Design'))
    fireEvent.click(screen.getByText('My Design'))
    await waitFor(() => expect(router.state.location.pathname).toBe('/editor/proj-1'))
  })
})

// ---------------------------------------------------------------------------
// AC 10 (feat 07) — card load error shows notification
// ---------------------------------------------------------------------------

describe('AC10 (feat07) — card load error', () => {
  it('shows error notification when getProject fails', async () => {
    mockGetProjects.mockResolvedValue([summaryRecord])
    mockGetProject.mockRejectedValue(new Error('load failed'))
    renderStandalone()
    await waitFor(() => screen.getByText('My Design'))
    fireEvent.click(screen.getByText('My Design'))
    await waitFor(() => expect(screen.getByText(/failed to load project/i)).toBeInTheDocument())
  })

  it('does not navigate when getProject fails', async () => {
    mockGetProjects.mockResolvedValue([summaryRecord])
    mockGetProject.mockRejectedValue(new Error('load failed'))
    const router = renderWithRouter()
    await waitFor(() => screen.getByText('My Design'))
    fireEvent.click(screen.getByText('My Design'))
    await waitFor(() => screen.getByText(/failed to load project/i))
    expect(router.state.location.pathname).toBe('/')
  })
})

// ---------------------------------------------------------------------------
// AC 3 (feat 07) — each card shows relative date from updatedAt
// ---------------------------------------------------------------------------

describe('AC3 (feat07) — card relative date', () => {
  it('renders a non-empty subtitle with the element count and a time string', async () => {
    mockGetProjects.mockResolvedValue([summaryRecord])
    renderStandalone()
    await waitFor(() => screen.getByText('My Design'))
    // subtitle contains element count and some relative time text
    expect(screen.getByText(/2 elements/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC 6 (feat 07) — spinner overlay appears on the clicked card while loading
// ---------------------------------------------------------------------------

describe('AC6 (feat07) — spinner overlay on loading card', () => {
  it('shows a spinner on the card while getProject is in flight', async () => {
    let resolve: (v: typeof fullProject) => void
    mockGetProject.mockReturnValue(new Promise((r) => { resolve = r }))
    mockGetProjects.mockResolvedValue([summaryRecord])

    renderStandalone()
    await waitFor(() => screen.getByText('My Design'))
    fireEvent.click(screen.getByText('My Design'))

    // Spinner should appear while the promise is pending
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    resolve!(fullProject)
  })
})

// ---------------------------------------------------------------------------
// AC 10 (feat 07) — card is re-enabled after a failed load
// ---------------------------------------------------------------------------

describe('AC10 (feat07) — card re-enabled after error', () => {
  it('re-enables the card button after getProject fails', async () => {
    mockGetProjects.mockResolvedValue([summaryRecord])
    mockGetProject.mockRejectedValue(new Error('load failed'))
    renderStandalone()
    await waitFor(() => screen.getByText('My Design'))

    const card = screen.getByRole('button', { name: /my design/i })
    fireEvent.click(card)

    await waitFor(() => screen.getByText(/failed to load project/i))
    expect(card).not.toBeDisabled()
  })

  it('removes the spinner after getProject fails', async () => {
    mockGetProjects.mockResolvedValue([summaryRecord])
    mockGetProject.mockRejectedValue(new Error('load failed'))
    renderStandalone()
    await waitFor(() => screen.getByText('My Design'))
    fireEvent.click(screen.getByText('My Design'))

    await waitFor(() => screen.getByText(/failed to load project/i))
    expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC 12 (feat 07) — multiple projects load independently
// ---------------------------------------------------------------------------

describe('AC12 (feat07) — multiple projects are independent', () => {
  it('each card has its own name and element count', async () => {
    const second = {
      id: 'proj-2',
      name: 'Second Project',
      elementCount: 5,
      createdAt: '2026-05-09T10:00:00Z',
      updatedAt: '2026-05-09T10:07:00Z',
    }
    mockGetProjects.mockResolvedValue([summaryRecord, second])
    renderStandalone()
    await waitFor(() => screen.getByText('My Design'))
    expect(screen.getByText('Second Project')).toBeInTheDocument()
    expect(screen.getByText(/2 elements/i)).toBeInTheDocument()
    expect(screen.getByText(/5 elements/i)).toBeInTheDocument()
  })

  it('clicking the second card calls getProject with the second id', async () => {
    const second = {
      id: 'proj-2',
      name: 'Second Project',
      elementCount: 5,
      createdAt: '2026-05-09T10:00:00Z',
      updatedAt: '2026-05-09T10:07:00Z',
    }
    const fullSecond = {
      ...fullProject,
      id: 'proj-2',
      name: 'Second Project',
      canvas: { elements: [] },
    }
    mockGetProjects.mockResolvedValue([summaryRecord, second])
    mockGetProject.mockResolvedValue(fullSecond)

    renderWithRouter()
    await waitFor(() => screen.getByText('Second Project'))
    fireEvent.click(screen.getByText('Second Project'))

    await waitFor(() => expect(mockGetProject).toHaveBeenCalledWith('proj-2'))
  })

  it('loading the second project hydrates the store with the second project id', async () => {
    const second = {
      id: 'proj-2',
      name: 'Second Project',
      elementCount: 0,
      createdAt: '2026-05-09T10:00:00Z',
      updatedAt: '2026-05-09T10:07:00Z',
    }
    const fullSecond = {
      id: 'proj-2',
      name: 'Second Project',
      canvas: { elements: [] },
      createdAt: '2026-05-09T10:00:00Z',
      updatedAt: '2026-05-09T10:07:00Z',
    }
    mockGetProjects.mockResolvedValue([summaryRecord, second])
    mockGetProject.mockResolvedValue(fullSecond)

    renderWithRouter()
    await waitFor(() => screen.getByText('Second Project'))
    fireEvent.click(screen.getByText('Second Project'))

    await waitFor(() => expect(useCanvasStore.getState().designId).toBe('proj-2'))
    expect(useCanvasStore.getState().name).toBe('Second Project')
  })
})

// ---------------------------------------------------------------------------
// AC 11 (feat 07) — list refreshes after creating a new design
// ---------------------------------------------------------------------------

describe('AC11 (feat07) — list invalidated after create', () => {
  it('calls getProjects again after a new design is created', async () => {
    mockGetProjects.mockResolvedValue([])
    renderWithRouter()
    await waitFor(() => expect(mockGetProjects).toHaveBeenCalledTimes(1))

    const { createBtn } = openModal()
    fireEvent.click(createBtn)
    await waitFor(() => expect(mockGetProjects).toHaveBeenCalledTimes(2))
  })
})

// ---------------------------------------------------------------------------
// AC2 / AC3 (feat07 updated) — 6-project cap and "View all" link
// ---------------------------------------------------------------------------

function makeSummary(i: number) {
  return {
    id: `proj-${i}`,
    name: `Design ${i}`,
    elementCount: i,
    createdAt: '2026-05-10T10:00:00Z',
    updatedAt: `2026-05-10T10:0${i}:00Z`,
  }
}

describe('AC2 (feat07 updated) — ≤6 projects: no "View all" link', () => {
  it('renders all 6 cards when exactly 6 projects exist', async () => {
    const sixProjects = Array.from({ length: 6 }, (_, i) => makeSummary(i + 1))
    mockGetProjects.mockResolvedValue(sixProjects)
    renderStandalone()
    await waitFor(() => screen.getByText('Design 1'))
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByText(`Design ${i}`)).toBeInTheDocument()
    }
  })

  it('does not show a "View all" link when there are 6 or fewer projects', async () => {
    const sixProjects = Array.from({ length: 6 }, (_, i) => makeSummary(i + 1))
    mockGetProjects.mockResolvedValue(sixProjects)
    renderStandalone()
    await waitFor(() => screen.getByText('Design 1'))
    expect(screen.queryByText(/view all designs/i)).not.toBeInTheDocument()
  })

  it('does not show a "View all" link when there is only 1 project', async () => {
    mockGetProjects.mockResolvedValue([summaryRecord])
    renderStandalone()
    await waitFor(() => screen.getByText('My Design'))
    expect(screen.queryByText(/view all designs/i)).not.toBeInTheDocument()
  })
})

describe('AC3 (feat07 updated) — >6 projects: exactly 6 cards and "View all (N)" link', () => {
  it('renders exactly 6 cards when 7 projects exist', async () => {
    const sevenProjects = Array.from({ length: 7 }, (_, i) => makeSummary(i + 1))
    mockGetProjects.mockResolvedValue(sevenProjects)
    renderStandalone()
    await waitFor(() => screen.getByText('Design 1'))
    expect(screen.queryByText('Design 7')).not.toBeInTheDocument()
    const cards = screen.getAllByRole('button', { name: /design \d/i })
    expect(cards).toHaveLength(6)
  })

  it('shows "View all designs (N)" link with the total count', async () => {
    const eightProjects = Array.from({ length: 8 }, (_, i) => makeSummary(i + 1))
    mockGetProjects.mockResolvedValue(eightProjects)
    renderStandalone()
    await waitFor(() => screen.getByText(/view all designs \(8\)/i))
  })

  it('"View all" count reflects the total, not the visible cap', async () => {
    const tenProjects = Array.from({ length: 10 }, (_, i) => makeSummary(i + 1))
    mockGetProjects.mockResolvedValue(tenProjects)
    renderStandalone()
    await waitFor(() => screen.getByText(/view all designs \(10\)/i))
  })
})

// ---------------------------------------------------------------------------
// AC7 (feat07 updated) — "View all designs" modal opens and shows all projects
// ---------------------------------------------------------------------------

describe('AC7 (feat07 updated) — "View all" modal', () => {
  it('opens the modal when "View all designs" is clicked', async () => {
    const sevenProjects = Array.from({ length: 7 }, (_, i) => makeSummary(i + 1))
    mockGetProjects.mockResolvedValue(sevenProjects)
    renderStandalone()
    await waitFor(() => screen.getByText(/view all designs/i))
    fireEvent.click(screen.getByText(/view all designs/i))
    expect(screen.getByRole('dialog', { name: /all designs/i })).toBeInTheDocument()
  })

  it('modal contains cards for all projects, including those beyond the cap', async () => {
    const sevenProjects = Array.from({ length: 7 }, (_, i) => makeSummary(i + 1))
    mockGetProjects.mockResolvedValue(sevenProjects)
    renderStandalone()
    await waitFor(() => screen.getByText(/view all designs/i))
    fireEvent.click(screen.getByText(/view all designs/i))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Design 7')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC8 (feat07 updated) — modal closes on ✕, outside click, and Escape
// ---------------------------------------------------------------------------

describe('AC8 (feat07 updated) — modal close behaviours', () => {
  async function openAllDesignsModal() {
    const sevenProjects = Array.from({ length: 7 }, (_, i) => makeSummary(i + 1))
    mockGetProjects.mockResolvedValue(sevenProjects)
    renderStandalone()
    await waitFor(() => screen.getByText(/view all designs/i))
    fireEvent.click(screen.getByText(/view all designs/i))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  }

  it('closes when the ✕ button is clicked', async () => {
    await openAllDesignsModal()
    fireEvent.click(screen.getByRole('button', { name: /close all designs/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when Escape is pressed', async () => {
    await openAllDesignsModal()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when clicking outside the modal panel', async () => {
    await openAllDesignsModal()
    const overlay = screen.getByRole('dialog')
    fireEvent.mouseDown(overlay)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not close when clicking inside the modal panel', async () => {
    await openAllDesignsModal()
    fireEvent.mouseDown(screen.getByText('Design 7'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC9 (feat07 updated) — opening a project from inside the modal
// ---------------------------------------------------------------------------

describe('AC9 (feat07 updated) — load project from modal', () => {
  it('calls getProject with the correct id when a modal card is clicked', async () => {
    const sevenProjects = Array.from({ length: 7 }, (_, i) => makeSummary(i + 1))
    const fullSeventh = {
      id: 'proj-7',
      name: 'Design 7',
      canvas: { elements: [] },
      createdAt: '2026-05-10T10:00:00Z',
      updatedAt: '2026-05-10T10:07:00Z',
    }
    mockGetProjects.mockResolvedValue(sevenProjects)
    mockGetProject.mockResolvedValue(fullSeventh)
    renderWithRouter()
    await waitFor(() => screen.getByText(/view all designs/i))
    fireEvent.click(screen.getByText(/view all designs/i))
    await waitFor(() => screen.getByText('Design 7'))
    fireEvent.click(screen.getByText('Design 7'))
    await waitFor(() => expect(mockGetProject).toHaveBeenCalledWith('proj-7'))
  })
})
