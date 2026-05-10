import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, createMemoryRouter, RouterProvider } from 'react-router'
import { HomePage } from './HomePage'
import { useCanvasStore } from '../stores/canvasStore'

// Render HomePage inside a real memory router that also registers the editor
// route, so navigation assertions can detect the route change.
function renderWithRouter() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <HomePage /> },
      { path: '/editor/:designId', element: <div data-testid="editor-page" /> },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

// Open the modal and return handles to the input and action buttons.
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
})

// ---------------------------------------------------------------------------
// AC 1 — home page displays the tagline and "New design" button
// ---------------------------------------------------------------------------
describe('AC1 — home page layout', () => {
  it('renders the main heading', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /design studio/i })).toBeInTheDocument()
  })

  it('renders the tagline "Start creating something great"', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/start creating something great/i)).toBeInTheDocument()
  })

  it('renders the "New design" button', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: /new design/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC 2 — clicking "New design" opens the modal pre-filled with "Untitled design"
// ---------------------------------------------------------------------------
describe('AC2 — opening the modal', () => {
  it('modal is not visible on initial render', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('clicking "New design" opens the modal', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /new design/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('modal input is pre-filled with "Untitled design"', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    const { input } = openModal()
    expect(input).toHaveValue('Untitled design')
  })
})

// ---------------------------------------------------------------------------
// AC 5 — clicking "Create" initialises the canvas store and navigates
// ---------------------------------------------------------------------------
describe('AC5 — creating a design', () => {
  it('initialises the canvas store with the supplied name', () => {
    renderWithRouter()
    const { input, createBtn } = openModal()
    fireEvent.change(input, { target: { value: 'My Poster' } })
    fireEvent.click(createBtn)
    expect(useCanvasStore.getState().name).toBe('My Poster')
  })

  it('generates a non-empty designId in the canvas store', () => {
    renderWithRouter()
    const { createBtn } = openModal()
    fireEvent.click(createBtn)
    expect(useCanvasStore.getState().designId).not.toBe('')
  })

  it('initialises elements as an empty array', () => {
    renderWithRouter()
    const { createBtn } = openModal()
    fireEvent.click(createBtn)
    expect(useCanvasStore.getState().elements).toHaveLength(0)
  })

  it('navigates to /editor/:designId after creation', () => {
    const router = renderWithRouter()
    const { createBtn } = openModal()
    fireEvent.click(createBtn)
    expect(router.state.location.pathname).toMatch(/^\/editor\//)
  })

  it('the editor page is rendered after creation', () => {
    renderWithRouter()
    const { createBtn } = openModal()
    fireEvent.click(createBtn)
    expect(screen.getByTestId('editor-page')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC 6 — clicking "Cancel" closes the modal without creating a design
// ---------------------------------------------------------------------------
describe('AC6 — cancel closes modal without creating', () => {
  it('clicking Cancel closes the modal', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    const { cancelBtn } = openModal()
    fireEvent.click(cancelBtn)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('clicking Cancel does not modify the canvas store', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
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
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    const { input } = openModal()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('pressing Escape does not modify the canvas store', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
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
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    openModal()
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('backdrop click does not modify the canvas store', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    openModal()
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(useCanvasStore.getState().designId).toBe('')
  })
})

// ---------------------------------------------------------------------------
// AC 9 — pressing Enter creates the design (same as clicking "Create")
// ---------------------------------------------------------------------------
describe('AC9 — Enter key creates the design', () => {
  it('pressing Enter initialises the canvas store', () => {
    renderWithRouter()
    const { input } = openModal()
    fireEvent.change(input, { target: { value: 'Enter Design' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useCanvasStore.getState().name).toBe('Enter Design')
  })

  it('pressing Enter navigates to /editor/:designId', () => {
    const router = renderWithRouter()
    const { input } = openModal()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(router.state.location.pathname).toMatch(/^\/editor\//)
  })

  it('pressing Enter with an empty input does not create a design', () => {
    renderWithRouter()
    const { input } = openModal()
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useCanvasStore.getState().designId).toBe('')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC 10 — no stale modal state when navigating back to /
// ---------------------------------------------------------------------------
describe('AC10 — no stale modal state on fresh render', () => {
  it('modal is closed when the home page mounts fresh', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
