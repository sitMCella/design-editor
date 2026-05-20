import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AllDesignsModal } from './AllDesignsModal'
import { patchProject } from '../api/projects'
import type { ProjectSummary } from '../api/projects'

vi.mock('../api/projects', () => ({
  patchProject: vi.fn(),
}))

const mockPatchProject = vi.mocked(patchProject)

const projectA: ProjectSummary = {
  id: 'proj-1',
  name: 'Design Alpha',
  elementCount: 3,
  createdAt: '2026-05-10T10:00:00Z',
  updatedAt: '2026-05-10T10:07:00Z',
}

const projectB: ProjectSummary = {
  id: 'proj-2',
  name: 'Design Beta',
  elementCount: 1,
  createdAt: '2026-05-11T10:00:00Z',
  updatedAt: '2026-05-11T10:07:00Z',
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })
}

function setup(overrides: Partial<React.ComponentProps<typeof AllDesignsModal>> = {}) {
  const props = {
    projects: [projectA, projectB],
    loadingCardId: null,
    onCardClick: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  const queryClient = makeQueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <AllDesignsModal {...props} />
    </QueryClientProvider>
  )
  return { ...props, queryClient }
}

beforeEach(() => {
  mockPatchProject.mockReset()
  mockPatchProject.mockResolvedValue({
    id: 'proj-1',
    name: 'Renamed',
    updatedAt: '2026-05-10T11:00:00Z',
  })
})

// ---------------------------------------------------------------------------
// Basic rendering
// ---------------------------------------------------------------------------

describe('basic rendering', () => {
  it('renders the modal with role="dialog"', () => {
    setup()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders an "All designs" heading', () => {
    setup()
    expect(screen.getByRole('heading', { name: /all designs/i })).toBeInTheDocument()
  })

  it('renders a card for each project', () => {
    setup()
    expect(screen.getByText('Design Alpha')).toBeInTheDocument()
    expect(screen.getByText('Design Beta')).toBeInTheDocument()
  })

  it('renders a close (✕) button', () => {
    setup()
    expect(screen.getByRole('button', { name: /close all designs/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Modal close behaviours
// ---------------------------------------------------------------------------

describe('close behaviours', () => {
  it('calls onClose when the ✕ button is clicked', () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: /close all designs/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed (no rename modal open)', () => {
    const { onClose } = setup()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when mousedown occurs on the overlay outside the panel', () => {
    const { onClose } = setup()
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when mousedown occurs inside the panel', () => {
    const { onClose } = setup()
    fireEvent.mouseDown(screen.getByText('Design Alpha'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC2 — ⋮ button is visible on cards inside the modal
// ---------------------------------------------------------------------------

describe('AC2 — ⋮ button on modal cards', () => {
  it('renders a ⋮ button for each card', () => {
    setup()
    expect(screen.getAllByRole('button', { name: /project options/i })).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// AC3 — clicking ⋮ opens dropdown with Rename option
// ---------------------------------------------------------------------------

describe('AC3 — dropdown in modal', () => {
  it('shows the Rename option when ⋮ is clicked on a card', () => {
    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC4 — only one dropdown open at a time inside the modal
// ---------------------------------------------------------------------------

describe('AC4 — one dropdown at a time', () => {
  it('opens the second dropdown and closes the first when a second ⋮ is clicked', () => {
    setup()
    const [kebabA, kebabB] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(kebabA)
    expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument()

    fireEvent.click(kebabB)
    expect(screen.getAllByRole('button', { name: /rename/i })).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// AC9 — selecting Rename opens the rename modal pre-filled with current name
// ---------------------------------------------------------------------------

describe('AC9 — Rename opens modal pre-filled', () => {
  function openRenameModalForAlpha() {
    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))
  }

  it('opens the rename modal', () => {
    openRenameModalForAlpha()
    expect(screen.getByRole('dialog', { name: /rename design/i })).toBeInTheDocument()
  })

  it('pre-fills the input with the project name', () => {
    openRenameModalForAlpha()
    expect(screen.getByLabelText(/design name/i)).toHaveValue('Design Alpha')
  })

  it('does not close the all-designs modal when the rename modal opens', () => {
    openRenameModalForAlpha()
    // "All designs" heading is still present
    expect(screen.getByRole('heading', { name: /all designs/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC15 — Cancel closes the rename modal without saving
// ---------------------------------------------------------------------------

describe('AC15 — Cancel in rename modal', () => {
  it('closes the rename modal when Cancel is clicked', () => {
    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog', { name: /rename design/i })).not.toBeInTheDocument()
  })

  it('does not call patchProject when Cancel is clicked', () => {
    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))

    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'Changed' } })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(mockPatchProject).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC6 — Escape does NOT close all-designs modal when rename modal is open
// ---------------------------------------------------------------------------

describe('AC6 — Escape with rename modal open', () => {
  it('does not close the all-designs modal via Escape when rename modal is open', async () => {
    const { onClose } = setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))

    fireEvent.keyDown(window, { key: 'Escape' })
    // The all-designs onClose should NOT have been called
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC16 — successful rename closes rename modal and invalidates designs query
// ---------------------------------------------------------------------------

describe('AC16 — successful rename in modal', () => {
  it('calls patchProject with the correct id and new name', async () => {
    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))

    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'New Alpha' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockPatchProject).toHaveBeenCalledWith('proj-1', { name: 'New Alpha' })
    )
  })

  it('closes the rename modal after a successful save', async () => {
    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))

    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'New Alpha' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /rename design/i })).not.toBeInTheDocument()
    )
  })

  it('keeps the all-designs modal open after a successful rename', async () => {
    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))

    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'New Alpha' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /rename design/i })).not.toBeInTheDocument()
    )
    expect(screen.getByRole('heading', { name: /all designs/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC17 — API error keeps rename modal open with inline error
// ---------------------------------------------------------------------------

describe('AC17 — API error in modal rename', () => {
  it('shows the error message when patchProject fails', async () => {
    mockPatchProject.mockRejectedValue(new Error('Rename failed'))
    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))

    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'New Alpha' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.getByText(/rename failed/i)).toBeInTheDocument())
  })

  it('keeps the rename modal open on error', async () => {
    mockPatchProject.mockRejectedValue(new Error('Rename failed'))
    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))

    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'New Alpha' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => screen.getByText(/rename failed/i))
    expect(screen.getByRole('dialog', { name: /rename design/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC18 — rename flow is independent per project card
// ---------------------------------------------------------------------------

describe('AC18 — rename is per project', () => {
  it('pre-fills with the correct name for each card', () => {
    setup()
    const [, kebabB] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(kebabB)
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))
    expect(screen.getByLabelText(/design name/i)).toHaveValue('Design Beta')
  })

  it('calls patchProject with the correct id for the selected card', async () => {
    setup()
    const [, kebabB] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(kebabB)
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))

    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'Renamed Beta' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockPatchProject).toHaveBeenCalledWith('proj-2', { name: 'Renamed Beta' })
    )
  })
})
