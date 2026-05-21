/**
 * Integration tests for the rename-design flow (feature 23) within HomePage.
 * Tests that are unrelated to rename (project list, create, load) are covered
 * in HomePage.test.tsx.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HomePage } from './HomePage'
import { getProjects, patchProject } from '../api/projects'

vi.mock('../api/projects', () => ({
  createProject: vi.fn(),
  getProjects: vi.fn(),
  getProject: vi.fn(),
  patchProject: vi.fn(),
}))

const mockGetProjects = vi.mocked(getProjects)
const mockPatchProject = vi.mocked(patchProject)

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

beforeEach(() => {
  mockGetProjects.mockReset()
  mockPatchProject.mockReset()
  mockGetProjects.mockResolvedValue([projectA])
  mockPatchProject.mockResolvedValue({
    id: 'proj-1',
    name: 'Renamed Design',
    updatedAt: '2026-05-10T11:00:00Z',
  })
})

// ---------------------------------------------------------------------------
// AC1 — ⋮ button is visible on every project card
// ---------------------------------------------------------------------------

describe('AC1 — kebab button on cards', () => {
  it('renders a ⋮ button on a project card after the list loads', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    expect(screen.getByRole('button', { name: /project options/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC3 — clicking ⋮ opens a dropdown with a "Rename" item
// ---------------------------------------------------------------------------

describe('AC3 — dropdown opens with Rename option', () => {
  it('shows the Rename option when ⋮ is clicked', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument()
  })

  it('clicking ⋮ again closes the dropdown', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    const kebab = screen.getByRole('button', { name: /project options/i })
    fireEvent.click(kebab)
    fireEvent.click(kebab)
    expect(screen.queryByRole('button', { name: /rename/i })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC4 — only one dropdown open at a time
// ---------------------------------------------------------------------------

describe('AC4 — only one dropdown open at once', () => {
  it('opening a second card dropdown closes the first one', async () => {
    mockGetProjects.mockResolvedValue([projectA, projectB])
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))

    const [kebabA, kebabB] = screen.getAllByRole('button', { name: /project options/i })
    fireEvent.click(kebabA)
    expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument()

    fireEvent.click(kebabB)
    // Only one Rename button should be present (card B's dropdown replaced card A's)
    expect(screen.getAllByRole('button', { name: /rename/i })).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// AC5 — clicking outside closes the dropdown
// ---------------------------------------------------------------------------

describe('AC5 — clicking outside closes dropdown', () => {
  it('closes the dropdown when mousedown occurs outside it', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('button', { name: /rename/i })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC6 — Escape closes the dropdown
// ---------------------------------------------------------------------------

describe('AC6 — Escape closes dropdown', () => {
  it('closes the dropdown when Escape is pressed', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('button', { name: /rename/i })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC7 — clicking ⋮ does not open the project
// ---------------------------------------------------------------------------

describe('AC7 — ⋮ click does not open the project', () => {
  it('does not trigger the card open action when ⋮ is clicked', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    // The card itself stays on the page — no navigation happens
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    expect(screen.getByText('Design Alpha')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC9 — selecting Rename opens the rename modal pre-filled with current name
// ---------------------------------------------------------------------------

describe('AC9 — Rename opens modal pre-filled', () => {
  async function openRenameModal() {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))
  }

  it('opens the rename modal when Rename is clicked', async () => {
    await openRenameModal()
    expect(screen.getByRole('dialog', { name: /rename design/i })).toBeInTheDocument()
  })

  it('pre-fills the rename modal input with the current project name', async () => {
    await openRenameModal()
    expect(screen.getByLabelText(/design name/i)).toHaveValue('Design Alpha')
  })

  it('closes the dropdown when Rename is selected', async () => {
    await openRenameModal()
    // The Rename item from the dropdown is gone; only the Save button from the modal remains
    expect(screen.queryAllByRole('button', { name: /rename/i })).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// AC15 — Cancel closes the rename modal without calling patchProject
// ---------------------------------------------------------------------------

describe('AC15 — Cancel closes rename modal without saving', () => {
  it('closes the modal when Cancel is clicked', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog', { name: /rename design/i })).not.toBeInTheDocument()
  })

  it('does not call patchProject when Cancel is clicked', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))

    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'Changed' } })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(mockPatchProject).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC16 — successful rename closes modal and refreshes the project list
// ---------------------------------------------------------------------------

describe('AC16 — successful rename', () => {
  it('calls patchProject with the project id and new name', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))

    fireEvent.change(screen.getByLabelText(/design name/i), {
      target: { value: 'Brand New Name' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockPatchProject).toHaveBeenCalledTimes(1))
    expect(mockPatchProject).toHaveBeenCalledWith('proj-1', { name: 'Brand New Name' })
  })

  it('closes the rename modal after a successful save', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))

    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'New Name' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /rename design/i })).not.toBeInTheDocument()
    )
  })

  it('triggers a re-fetch of the project list after a successful rename', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))

    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))

    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'New Name' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockGetProjects).toHaveBeenCalledTimes(2))
  })

  it('trims leading and trailing whitespace from the new name', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))

    fireEvent.change(screen.getByLabelText(/design name/i), {
      target: { value: '  Trimmed Name  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockPatchProject).toHaveBeenCalledWith('proj-1', { name: 'Trimmed Name' })
    )
  })
})

// ---------------------------------------------------------------------------
// AC14 — Enter key confirms the rename
// ---------------------------------------------------------------------------

describe('AC14 — Enter key confirms rename', () => {
  it('calls patchProject when Enter is pressed with a valid new name', async () => {
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))

    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'Enter Name' } })
    fireEvent.keyDown(screen.getByLabelText(/design name/i), { key: 'Enter' })

    await waitFor(() =>
      expect(mockPatchProject).toHaveBeenCalledWith('proj-1', { name: 'Enter Name' })
    )
  })
})

// ---------------------------------------------------------------------------
// AC17 — API error keeps modal open with an inline error message
// ---------------------------------------------------------------------------

describe('AC17 — API error on rename', () => {
  it('shows an inline error message when patchProject fails', async () => {
    mockPatchProject.mockRejectedValue(new Error('Server unavailable'))
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))

    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'New Name' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.getByText(/server unavailable/i)).toBeInTheDocument())
  })

  it('keeps the rename modal open after a failed save', async () => {
    mockPatchProject.mockRejectedValue(new Error('Network error'))
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))

    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'New Name' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => screen.getByText(/network error/i))
    expect(screen.getByRole('dialog', { name: /rename design/i })).toBeInTheDocument()
  })

  it('re-enables the Save button after a failed rename so the user can retry', async () => {
    mockPatchProject.mockRejectedValue(new Error('Failed'))
    renderPage()
    await waitFor(() => screen.getByText('Design Alpha'))
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))

    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'New Name' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => screen.getByText(/failed/i))
    expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled()
  })
})
