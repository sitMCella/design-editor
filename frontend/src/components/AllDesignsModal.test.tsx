import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AllDesignsModal } from './AllDesignsModal'
import { patchProject, deleteProject } from '../api/projects'
import type { ProjectSummary } from '../api/projects'

vi.mock('../api/projects', () => ({
  patchProject: vi.fn(),
  deleteProject: vi.fn(),
}))

const mockPatchProject = vi.mocked(patchProject)
const mockDeleteProject = vi.mocked(deleteProject)

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
  mockDeleteProject.mockReset()
  mockPatchProject.mockResolvedValue({
    id: 'proj-1',
    name: 'Renamed',
    updatedAt: '2026-05-10T11:00:00Z',
  })
  mockDeleteProject.mockResolvedValue(undefined)
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

  // Regression: the KebabMenu dropdown is rendered via createPortal to
  // document.body, outside the panelRef in the DOM. Without the fix the
  // overlay's onMouseDown handler received the mousedown event (via React's
  // synthetic event propagation through the React tree), saw the target was
  // outside panelRef, and called onClose — closing the modal before the rename
  // modal could open. The fix adds e.stopPropagation() to the dropdown div.
  it('does not call onClose when mousedown occurs on the Rename button inside the open dropdown', () => {
    const { onClose } = setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.mouseDown(screen.getByRole('button', { name: /rename/i }))
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

// ---------------------------------------------------------------------------
// AC1 (feat24) — Delete item appears in the dropdown inside the modal
// ---------------------------------------------------------------------------

describe('AC1 (feat24) — Delete item in modal dropdown', () => {
  it('shows a "Delete" option in the dropdown when ⋮ is clicked on a card inside the modal', () => {
    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
  })

  it('Delete item has red text colour inside the modal dropdown', () => {
    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    expect(screen.getByRole('button', { name: /^delete$/i })).toHaveClass('text-red-600')
  })
})

// ---------------------------------------------------------------------------
// AC3 (feat24) — clicking Delete in the modal dropdown opens the confirmation dialog
// ---------------------------------------------------------------------------

describe('AC3 (feat24) — Delete opens confirmation dialog inside modal', () => {
  it('opens the confirmation dialog when Delete is clicked', () => {
    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(screen.getByRole('dialog', { name: /delete design\?/i })).toBeInTheDocument()
  })

  it('does not close the all-designs modal when the delete dialog opens', () => {
    const { onClose } = setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: /all designs/i })).toBeInTheDocument()
  })

  it('displays the correct project name in the confirmation dialog', () => {
    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(screen.getByRole('dialog', { name: /delete design\?/i })).toHaveTextContent('Design Alpha')
  })
})

// ---------------------------------------------------------------------------
// AC5 (feat24) — Cancel / Escape / backdrop close dialog without API call in modal
// ---------------------------------------------------------------------------

describe('AC5 (feat24) — Cancel in delete dialog inside modal', () => {
  it('closes the delete dialog when Cancel is clicked', () => {
    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog', { name: /delete design\?/i })).not.toBeInTheDocument()
  })

  it('does not call deleteProject when Cancel is clicked', () => {
    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(mockDeleteProject).not.toHaveBeenCalled()
  })
})

describe('AC5 (feat24) — Escape with delete dialog open', () => {
  it('does not close the all-designs modal via Escape when delete dialog is open', () => {
    const { onClose } = setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC6 (feat24) — clicking Delete in the dialog calls deleteProject
// ---------------------------------------------------------------------------

describe('AC6 (feat24) — Delete button in modal calls deleteProject', () => {
  it('calls deleteProject with the correct project id', async () => {
    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(mockDeleteProject).toHaveBeenCalledWith('proj-1'))
  })
})

// ---------------------------------------------------------------------------
// AC7 (feat24) — loading state inside the delete dialog in the modal
// ---------------------------------------------------------------------------

describe('AC7 (feat24) — loading state in delete dialog inside modal', () => {
  it('shows a spinner on the Delete button while the API call is pending', async () => {
    let resolveDelete!: () => void
    mockDeleteProject.mockReturnValue(new Promise<void>((r) => { resolveDelete = r }))

    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeInTheDocument())
    act(() => resolveDelete())
  })

  it('keeps the Cancel button interactive while deletion is pending', async () => {
    let resolveDelete!: () => void
    mockDeleteProject.mockReturnValue(new Promise<void>((r) => { resolveDelete = r }))

    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /cancel/i })).not.toBeDisabled()
    act(() => resolveDelete())
  })
})

// ---------------------------------------------------------------------------
// AC8 (feat24) — on success: dialog closes and designs query is invalidated
// ---------------------------------------------------------------------------

describe('AC8 (feat24) — successful deletion in modal', () => {
  it('closes the delete confirmation dialog after a successful delete', async () => {
    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /delete design\?/i })).not.toBeInTheDocument()
    )
  })

  it('keeps the all-designs modal open after a successful delete', async () => {
    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /delete design\?/i })).not.toBeInTheDocument()
    )
    expect(screen.getByRole('heading', { name: /all designs/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC9 (feat24) — on error: dialog closes and toast notification appears
// ---------------------------------------------------------------------------

describe('AC9 (feat24) — delete API error in modal', () => {
  it('closes the delete dialog after a failed delete', async () => {
    mockDeleteProject.mockRejectedValue(new Error('Network error'))
    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /delete design\?/i })).not.toBeInTheDocument()
    )
  })

  it('shows the error toast when deletion fails', async () => {
    mockDeleteProject.mockRejectedValue(new Error('Network error'))
    setup()
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() =>
      expect(
        screen.getByText(/could not delete the design. please try again./i)
      ).toBeInTheDocument()
    )
  })
})
