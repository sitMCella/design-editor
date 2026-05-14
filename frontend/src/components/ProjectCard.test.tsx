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

beforeEach(() => {
  mockRelativeDate.mockReturnValue('2 days ago')
})

// ---------------------------------------------------------------------------
// AC 3 — card content: name, element count, relative date
// ---------------------------------------------------------------------------

describe('AC3 — card content', () => {
  it('renders the project name', () => {
    render(<ProjectCard project={baseProject} isLoading={false} onClick={vi.fn()} />)
    expect(screen.getByText('My Design')).toBeInTheDocument()
  })

  it('renders element count as plural when count > 1', () => {
    render(<ProjectCard project={baseProject} isLoading={false} onClick={vi.fn()} />)
    expect(screen.getByText(/3 elements/i)).toBeInTheDocument()
  })

  it('renders element count as singular when count is 1', () => {
    const project = { ...baseProject, elementCount: 1 }
    render(<ProjectCard project={project} isLoading={false} onClick={vi.fn()} />)
    expect(screen.getByText(/1 element[^s]/)).toBeInTheDocument()
  })

  it('renders the relative date from updatedAt', () => {
    mockRelativeDate.mockReturnValue('5 hours ago')
    render(<ProjectCard project={baseProject} isLoading={false} onClick={vi.fn()} />)
    expect(screen.getByText(/5 hours ago/)).toBeInTheDocument()
  })

  it('passes updatedAt to the relativeDate utility', () => {
    render(<ProjectCard project={baseProject} isLoading={false} onClick={vi.fn()} />)
    expect(mockRelativeDate).toHaveBeenCalledWith(baseProject.updatedAt)
  })
})

// ---------------------------------------------------------------------------
// AC 6 — spinner overlay visible while card is loading
// ---------------------------------------------------------------------------

describe('AC6 — spinner overlay during load', () => {
  it('shows a spinner when isLoading is true', () => {
    render(<ProjectCard project={baseProject} isLoading={true} onClick={vi.fn()} />)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('does not show a spinner when isLoading is false', () => {
    render(<ProjectCard project={baseProject} isLoading={false} onClick={vi.fn()} />)
    expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC 5 (feature 12) — no thumbnail: grey placeholder, no <img>
// ---------------------------------------------------------------------------

describe('AC5 — no thumbnail placeholder', () => {
  it('does not render an img when thumbnailUrl is null', () => {
    const project = { ...baseProject, thumbnailUrl: null }
    render(<ProjectCard project={project} isLoading={false} onClick={vi.fn()} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('does not render an img when thumbnailUrl is absent', () => {
    render(<ProjectCard project={baseProject} isLoading={false} onClick={vi.fn()} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC 2 / AC 12 (feature 12) — thumbnail image rendering
// ---------------------------------------------------------------------------

describe('AC2 & AC12 — thumbnail image', () => {
  it('renders an img with thumbnailUrl as src when thumbnailUrl is present', () => {
    const project = { ...baseProject, thumbnailUrl: '/api/projects/proj-1/thumbnail' }
    render(<ProjectCard project={project} isLoading={false} onClick={vi.fn()} />)
    expect(screen.getByRole('img')).toHaveAttribute('src', '/api/projects/proj-1/thumbnail')
  })

  it('sets alt text to the project name on the thumbnail img', () => {
    const project = { ...baseProject, thumbnailUrl: '/api/projects/proj-1/thumbnail' }
    render(<ProjectCard project={project} isLoading={false} onClick={vi.fn()} />)
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'My Design')
  })

  it('applies object-cover class to the thumbnail img', () => {
    const project = { ...baseProject, thumbnailUrl: '/api/projects/proj-1/thumbnail' }
    render(<ProjectCard project={project} isLoading={false} onClick={vi.fn()} />)
    expect(screen.getByRole('img')).toHaveClass('object-cover')
  })
})

// ---------------------------------------------------------------------------
// AC 13 (feature 12) — spinner visible alongside thumbnail when loading
// ---------------------------------------------------------------------------

describe('AC13 — spinner with thumbnail', () => {
  it('shows spinner over the thumbnail when isLoading is true', () => {
    const project = { ...baseProject, thumbnailUrl: '/api/projects/proj-1/thumbnail' }
    render(<ProjectCard project={project} isLoading={true} onClick={vi.fn()} />)
    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows thumbnail without spinner when isLoading is false', () => {
    const project = { ...baseProject, thumbnailUrl: '/api/projects/proj-1/thumbnail' }
    render(<ProjectCard project={project} isLoading={false} onClick={vi.fn()} />)
    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC 6 / AC 10 — card interactivity
// ---------------------------------------------------------------------------

describe('AC6 & AC10 — card interactivity', () => {
  it('calls onClick when clicked and not loading', () => {
    const onClick = vi.fn()
    render(<ProjectCard project={baseProject} isLoading={false} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled while isLoading is true', () => {
    render(<ProjectCard project={baseProject} isLoading={true} onClick={vi.fn()} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('does not call onClick when the button is disabled', () => {
    const onClick = vi.fn()
    render(<ProjectCard project={baseProject} isLoading={true} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('is enabled (not disabled) when isLoading is false', () => {
    render(<ProjectCard project={baseProject} isLoading={false} onClick={vi.fn()} />)
    expect(screen.getByRole('button')).not.toBeDisabled()
  })
})
