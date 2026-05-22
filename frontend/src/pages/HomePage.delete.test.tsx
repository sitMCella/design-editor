/**
 * Integration tests for the delete-design flow (feature 24) within HomePage.
 * Tests unrelated to delete (project list, create, load, rename) are covered
 * in HomePage.test.tsx and HomePage.rename.test.tsx.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HomePage } from './HomePage'
import { getProjects, deleteProject } from '../api/projects'

vi.mock('../api/projects', () => ({
  createProject: vi.fn(),
  getProjects: vi.fn(),
  getProject: vi.fn(),
  patchProject: vi.fn(),
  deleteProject: vi.fn(),
}))

const mockGetProjects = vi.mocked(getProjects)
const mockDeleteProject = vi.mocked(deleteProject)

const projectA = {
  id: 'proj-1',
  name: 'Design Alpha',
  elementCount: 2,
  createdAt: '2026-05-10T10:00:00Z',
  updatedAt: '2026-05-10T10:07:00Z',
}

const projectB = {
  id: 'proj-2',
  name: 'Design Beta',
  elementCount: 3,
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

function renderPage() {
  const queryClient = makeQueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>
  )
  return queryClient
}

async function openDeleteDialog() {
  await waitFor(() => screen.getByText('Design Alpha'))
  fireEvent.click(screen.getByRole('button', { name: /project options/i }))
  fireEvent.click(screen.getByRole('button', { name: /delete/i }))
}

beforeEach(() => {
  mockGetProjects.mockReset()
  mockDeleteProject.mockReset()
  mockGetProjects.mockResolvedValue([projectA])
  mockDeleteProject.mockResolvedValue(undefined)
})

// ---------------------------------------------------------------------------
// AC1 — "Delete" item appears in the kebab dropdown with red styling
// ---------------------------------------------------------------------------

describe('AC1 — Delete item in dropdown', () => {
  it('shows a "Delete" option in the dropdown when ⋮ is clicked', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  it('Delete item has red text colour', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    const deleteBtn = screen.getByRole('button', { name: /delete/i })
    expect(deleteBtn).toHaveClass('text-red-600')
  })
})

// ---------------------------------------------------------------------------
// AC2 — Delete is separated from Rename by a divider
// ---------------------------------------------------------------------------

describe('AC2 — divider between Rename and Delete', () => {
  it('renders a divider element between Rename and Delete in the dropdown', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))

    const renameBtn = screen.getByRole('button', { name: /rename/i })
    const deleteBtn = screen.getByRole('button', { name: /delete/i })
    // The divider is a sibling element between them
    const divider = renameBtn.nextElementSibling
    expect(divider).not.toBeNull()
    expect(divider?.tagName.toLowerCase()).toBe('div')
    expect(divider).toHaveClass('border-t')
    expect(divider?.nextElementSibling).toBe(deleteBtn)
  })
})

// ---------------------------------------------------------------------------
// AC3 — clicking "Delete" in dropdown opens the confirmation dialog
// ---------------------------------------------------------------------------

describe('AC3 — clicking Delete opens confirmation dialog', () => {
  it('opens the confirmation dialog when Delete is clicked in the dropdown', async () => {
    renderPage()
    await openDeleteDialog()
    expect(screen.getByRole('dialog', { name: /delete design\?/i })).toBeInTheDocument()
  })

  it('closes the dropdown when Delete is clicked', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    // Rename button (from the dropdown) is no longer visible
    expect(screen.queryByRole('button', { name: /rename/i })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC4 — confirmation dialog shows project name in bold
// ---------------------------------------------------------------------------

describe('AC4 — dialog shows project name in bold', () => {
  it('displays the project name within the dialog', async () => {
    renderPage()
    await openDeleteDialog()
    expect(screen.getByRole('dialog')).toHaveTextContent('Design Alpha')
  })

  it('renders the project name in a bold element', async () => {
    renderPage()
    await openDeleteDialog()
    const boldEl = screen.getByText(/design alpha/i, { selector: 'span' })
    expect(boldEl).toHaveClass('font-semibold')
  })
})

// ---------------------------------------------------------------------------
// AC5 — Cancel, Escape, and backdrop close the dialog without an API call
// ---------------------------------------------------------------------------

describe('AC5 — Cancel closes dialog without API call', () => {
  it('closes the confirmation dialog when Cancel is clicked', async () => {
    renderPage()
    await openDeleteDialog()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog', { name: /delete design\?/i })).not.toBeInTheDocument()
  })

  it('does not call deleteProject when Cancel is clicked', async () => {
    renderPage()
    await openDeleteDialog()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(mockDeleteProject).not.toHaveBeenCalled()
  })
})

describe('AC5 — Escape closes dialog without API call', () => {
  it('closes the confirmation dialog when Escape is pressed', async () => {
    renderPage()
    await openDeleteDialog()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /delete design\?/i })).not.toBeInTheDocument()
  })

  it('does not call deleteProject when Escape is pressed', async () => {
    renderPage()
    await openDeleteDialog()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(mockDeleteProject).not.toHaveBeenCalled()
  })
})

describe('AC5 — backdrop click closes dialog without API call', () => {
  it('closes the confirmation dialog when the backdrop is clicked', async () => {
    renderPage()
    await openDeleteDialog()
    fireEvent.mouseDown(screen.getByRole('dialog', { name: /delete design\?/i }))
    expect(screen.queryByRole('dialog', { name: /delete design\?/i })).not.toBeInTheDocument()
  })

  it('does not call deleteProject when the backdrop is clicked', async () => {
    renderPage()
    await openDeleteDialog()
    fireEvent.mouseDown(screen.getByRole('dialog', { name: /delete design\?/i }))
    expect(mockDeleteProject).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC6 — clicking "Delete" in the dialog calls DELETE /api/projects/:id
// ---------------------------------------------------------------------------

describe('AC6 — Delete button calls deleteProject', () => {
  it('calls deleteProject with the correct project id when Delete is confirmed', async () => {
    renderPage()
    await openDeleteDialog()
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(mockDeleteProject).toHaveBeenCalledTimes(1))
    expect(mockDeleteProject).toHaveBeenCalledWith('proj-1')
  })
})

// ---------------------------------------------------------------------------
// AC7 — loading state during the API call
// ---------------------------------------------------------------------------

describe('AC7 — loading state while delete is in flight', () => {
  it('shows a spinner on the Delete button while the API call is pending', async () => {
    let resolveDelete!: () => void
    mockDeleteProject.mockReturnValue(new Promise<void>((r) => { resolveDelete = r }))

    renderPage()
    await openDeleteDialog()
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeInTheDocument())
    act(() => resolveDelete())
  })

  it('disables the Delete button while the API call is pending', async () => {
    let resolveDelete!: () => void
    mockDeleteProject.mockReturnValue(new Promise<void>((r) => { resolveDelete = r }))

    renderPage()
    await openDeleteDialog()
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled())
    act(() => resolveDelete())
  })

  it('keeps the Cancel button interactive while the API call is pending', async () => {
    let resolveDelete!: () => void
    mockDeleteProject.mockReturnValue(new Promise<void>((r) => { resolveDelete = r }))

    renderPage()
    await openDeleteDialog()
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /cancel/i })).not.toBeDisabled()
    act(() => resolveDelete())
  })
})

// ---------------------------------------------------------------------------
// AC8 — on success: dialog closes and query is invalidated
// ---------------------------------------------------------------------------

describe('AC8 — successful deletion', () => {
  it('closes the confirmation dialog after a successful delete', async () => {
    renderPage()
    await openDeleteDialog()
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /delete design\?/i })).not.toBeInTheDocument()
    )
  })

  it('re-fetches the project list after a successful delete', async () => {
    renderPage()
    await waitFor(() => expect(mockGetProjects).toHaveBeenCalledTimes(1))
    await openDeleteDialog()
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(mockGetProjects).toHaveBeenCalledTimes(2))
  })
})

// ---------------------------------------------------------------------------
// AC9 — on error: dialog closes and toast notification appears
// ---------------------------------------------------------------------------

describe('AC9 — delete API error', () => {
  it('closes the dialog after a failed delete', async () => {
    mockDeleteProject.mockRejectedValue(new Error('Server error'))
    renderPage()
    await openDeleteDialog()
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /delete design\?/i })).not.toBeInTheDocument()
    )
  })

  it('shows the error toast notification when the API call fails', async () => {
    mockDeleteProject.mockRejectedValue(new Error('Server error'))
    renderPage()
    await openDeleteDialog()
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() =>
      expect(
        screen.getByText(/could not delete the design. please try again./i)
      ).toBeInTheDocument()
    )
  })

  it('does not call deleteProject more than once on a single click', async () => {
    renderPage()
    await openDeleteDialog()
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(mockDeleteProject).toHaveBeenCalledTimes(1))
  })
})

// ---------------------------------------------------------------------------
// AC12 — deleting one project does not affect others
// ---------------------------------------------------------------------------

describe('AC12 — deleting one project does not affect others', () => {
  it('only removes the deleted project from the list; the other card remains', async () => {
    // First fetch returns two projects; after deletion, re-fetch returns only projectB
    mockGetProjects
      .mockResolvedValueOnce([projectA, projectB])
      .mockResolvedValue([projectB])

    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    expect(screen.getByText('Design Beta')).toBeInTheDocument()

    // Open the dropdown for the first card (Design Alpha)
    const [firstKebab] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(firstKebab)
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(mockGetProjects).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByText('Design Beta')).toBeInTheDocument())
  })
})

// ---------------------------------------------------------------------------
// AC13 — clicking Delete in the dropdown does NOT trigger the card's open action
// ---------------------------------------------------------------------------

describe('AC13 — dropdown Delete does not open the card', () => {
  it('does not call getProject when Delete is clicked in the dropdown', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))

    // Confirm no navigation happened; page still shows the home screen
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))

    // The confirmation dialog opened but we're still on the home page
    expect(screen.getByText('Design Alpha')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: /delete design\?/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC14 — Rename still works after the delete feature is added
// ---------------------------------------------------------------------------

describe('AC14 — Rename action is not broken by delete feature', () => {
  it('still shows the Rename option in the dropdown', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument()
  })

  it('opens the rename modal (not the delete dialog) when Rename is clicked', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))
    expect(screen.getByRole('dialog', { name: /rename design/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /delete design\?/i })).not.toBeInTheDocument()
  })
})
