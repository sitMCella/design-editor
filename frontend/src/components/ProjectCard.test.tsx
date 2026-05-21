import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectCard } from './ProjectCard'
import type { ProjectSummary } from '../api/projects'

vi.mock('../utils/relativeDate', () => ({
  relativeDate: vi.fn(() => '2 days ago'),
}))

import { relativeDate } from '../utils/relativeDate'
const mockRelativeDate = vi.mocked(relativeDate)

const baseProject: ProjectSummary = {
  id: 'proj-1',
  name: 'My Design',
  elementCount: 3,
  createdAt: '2026-05-08T10:00:00Z',
  updatedAt: '2026-05-08T10:07:00Z',
}

const defaultProps = {
  project: baseProject,
  isLoading: false,
  onClick: vi.fn(),
  onRename: vi.fn(),
  isMenuOpen: false,
  onMenuOpenChange: vi.fn(),
}

beforeEach(() => {
  mockRelativeDate.mockReturnValue('2 days ago')
})

// ---------------------------------------------------------------------------
// AC 3 — card content: name, element count, relative date
// ---------------------------------------------------------------------------

describe('AC3 — card content', () => {
  it('renders the project name', () => {
    render(<ProjectCard {...defaultProps} />)
    expect(screen.getByText('My Design')).toBeInTheDocument()
  })

  it('renders element count as plural when count > 1', () => {
    render(<ProjectCard {...defaultProps} />)
    expect(screen.getByText(/3 elements/i)).toBeInTheDocument()
  })

  it('renders element count as singular when count is 1', () => {
    const project = { ...baseProject, elementCount: 1 }
    render(<ProjectCard {...defaultProps} project={project} />)
    expect(screen.getByText(/1 element[^s]/)).toBeInTheDocument()
  })

  it('renders the relative date from updatedAt', () => {
    mockRelativeDate.mockReturnValue('5 hours ago')
    render(<ProjectCard {...defaultProps} />)
    expect(screen.getByText(/5 hours ago/)).toBeInTheDocument()
  })

  it('passes updatedAt to the relativeDate utility', () => {
    render(<ProjectCard {...defaultProps} />)
    expect(mockRelativeDate).toHaveBeenCalledWith(baseProject.updatedAt)
  })
})

// ---------------------------------------------------------------------------
// AC 6 — spinner overlay visible while card is loading
// ---------------------------------------------------------------------------

describe('AC6 — spinner overlay during load', () => {
  it('shows a spinner when isLoading is true', () => {
    render(<ProjectCard {...defaultProps} isLoading={true} />)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('does not show a spinner when isLoading is false', () => {
    render(<ProjectCard {...defaultProps} />)
    expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC 5 (feature 12) — no thumbnail: grey placeholder, no <img>
// ---------------------------------------------------------------------------

describe('AC5 — no thumbnail placeholder', () => {
  it('does not render an img when thumbnailUrl is null', () => {
    const project = { ...baseProject, thumbnailUrl: null }
    render(<ProjectCard {...defaultProps} project={project} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('does not render an img when thumbnailUrl is absent', () => {
    render(<ProjectCard {...defaultProps} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC 2 / AC 12 (feature 12) — thumbnail image rendering
// ---------------------------------------------------------------------------

describe('AC2 & AC12 — thumbnail image', () => {
  it('renders an img with thumbnailUrl as src when thumbnailUrl is present', () => {
    const project = { ...baseProject, thumbnailUrl: '/api/projects/proj-1/thumbnail' }
    render(<ProjectCard {...defaultProps} project={project} />)
    expect(screen.getByRole('img')).toHaveAttribute('src', '/api/projects/proj-1/thumbnail')
  })

  it('sets alt text to the project name on the thumbnail img', () => {
    const project = { ...baseProject, thumbnailUrl: '/api/projects/proj-1/thumbnail' }
    render(<ProjectCard {...defaultProps} project={project} />)
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'My Design')
  })

  it('applies object-cover class to the thumbnail img', () => {
    const project = { ...baseProject, thumbnailUrl: '/api/projects/proj-1/thumbnail' }
    render(<ProjectCard {...defaultProps} project={project} />)
    expect(screen.getByRole('img')).toHaveClass('object-cover')
  })
})

// ---------------------------------------------------------------------------
// AC 13 (feature 12) — spinner visible alongside thumbnail when loading
// ---------------------------------------------------------------------------

describe('AC13 — spinner with thumbnail', () => {
  it('shows spinner over the thumbnail when isLoading is true', () => {
    const project = { ...baseProject, thumbnailUrl: '/api/projects/proj-1/thumbnail' }
    render(<ProjectCard {...defaultProps} project={project} isLoading={true} />)
    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows thumbnail without spinner when isLoading is false', () => {
    const project = { ...baseProject, thumbnailUrl: '/api/projects/proj-1/thumbnail' }
    render(<ProjectCard {...defaultProps} project={project} />)
    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Card interactivity — clicking the info bar or thumbnail calls onClick
// ---------------------------------------------------------------------------

describe('Card interactivity', () => {
  it('calls onClick when the info bar is clicked', () => {
    const onClick = vi.fn()
    render(<ProjectCard {...defaultProps} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: /my design/i }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('calls onClick when the thumbnail area is clicked', () => {
    const onClick = vi.fn()
    render(<ProjectCard {...defaultProps} onClick={onClick} />)
    // The thumbnail div has role="button" and no accessible text; target it by querying all buttons
    const buttons = screen.getAllByRole('button')
    // thumbnail is the first role=button (before info bar and kebab)
    const thumbnailBtn = buttons.find((b) => !b.textContent?.trim() || b.textContent.trim() === '')
    if (thumbnailBtn) fireEvent.click(thumbnailBtn)
    expect(onClick).toHaveBeenCalled()
  })

  it('calls onClick even when isLoading is true (loading is shown as spinner, not disabled)', () => {
    const onClick = vi.fn()
    render(<ProjectCard {...defaultProps} isLoading={true} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: /my design/i }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// AC 1 (feature 23) — kebab menu button is always visible
// ---------------------------------------------------------------------------

describe('AC1 (feat23) — kebab menu button', () => {
  it('renders the ⋮ button', () => {
    render(<ProjectCard {...defaultProps} />)
    expect(screen.getByRole('button', { name: /project options/i })).toBeInTheDocument()
  })

  it('does not call onClick when ⋮ is clicked', () => {
    const onClick = vi.fn()
    render(<ProjectCard {...defaultProps} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('calls onMenuOpenChange(true) when ⋮ is clicked and menu is closed', () => {
    const onMenuOpenChange = vi.fn()
    render(<ProjectCard {...defaultProps} onMenuOpenChange={onMenuOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    expect(onMenuOpenChange).toHaveBeenCalledWith(true)
  })

  it('calls onMenuOpenChange(false) when ⋮ is clicked and menu is open', () => {
    const onMenuOpenChange = vi.fn()
    render(<ProjectCard {...defaultProps} isMenuOpen={true} onMenuOpenChange={onMenuOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    expect(onMenuOpenChange).toHaveBeenCalledWith(false)
  })

  // The ⋮ button stretches to the full info-bar height (self-stretch), giving
  // it a hit area that spans both the name and subtitle rows. The info-bar
  // flex container must use items-stretch to enable this.
  it('⋮ button has self-stretch so it spans the full info-bar height', () => {
    render(<ProjectCard {...defaultProps} />)
    const kebab = screen.getByRole('button', { name: /project options/i })
    expect(kebab).toHaveClass('self-stretch')
    expect(kebab).not.toHaveClass('h-5')
  })

  it('info-bar container uses items-stretch so the ⋮ button fills the full row height', () => {
    render(<ProjectCard {...defaultProps} />)
    const kebab = screen.getByRole('button', { name: /project options/i })
    expect(kebab.parentElement).toHaveClass('items-stretch')
  })
})
