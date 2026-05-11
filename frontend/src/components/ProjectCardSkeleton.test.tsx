import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ProjectCardSkeleton } from './ProjectCardSkeleton'

// ---------------------------------------------------------------------------
// AC 1 — three skeleton cards are shown while the project list is loading
// ---------------------------------------------------------------------------

describe('ProjectCardSkeleton', () => {
  it('renders animate-pulse placeholders', () => {
    const { container } = render(<ProjectCardSkeleton />)
    const pulseEls = container.querySelectorAll('.animate-pulse')
    expect(pulseEls.length).toBeGreaterThan(0)
  })

  it('is not an interactive element (no button role)', () => {
    const { container } = render(<ProjectCardSkeleton />)
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })

  it('renders without a name or any text content', () => {
    const { container } = render(<ProjectCardSkeleton />)
    expect(container.textContent).toBe('')
  })
})
