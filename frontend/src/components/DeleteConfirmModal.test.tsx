import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DeleteConfirmModal } from './DeleteConfirmModal'

function setup(overrides: Partial<React.ComponentProps<typeof DeleteConfirmModal>> = {}) {
  const props = {
    projectName: 'My Design',
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    isLoading: false,
    ...overrides,
  }
  render(<DeleteConfirmModal {...props} />)
  return props
}

// ---------------------------------------------------------------------------
// AC4 — dialog content: heading and project name displayed in bold
// ---------------------------------------------------------------------------

describe('AC4 — dialog content', () => {
  it('renders with role="dialog"', () => {
    setup()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders the "Delete design?" heading', () => {
    setup()
    expect(screen.getByRole('heading', { name: /delete design\?/i })).toBeInTheDocument()
  })

  it('displays the project name in the warning message', () => {
    setup({ projectName: 'My Awesome Poster' })
    expect(screen.getByText(/my awesome poster/i)).toBeInTheDocument()
  })

  it('renders the project name in a bold element (font-semibold)', () => {
    setup({ projectName: 'Bold Name Test' })
    const bold = screen.getByText(/bold name test/i)
    expect(bold).toHaveClass('font-semibold')
  })

  it('includes the permanent deletion warning text', () => {
    setup()
    expect(screen.getByText(/permanently deleted/i)).toBeInTheDocument()
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC5 — Cancel, Escape, and backdrop close the dialog without an API call
// ---------------------------------------------------------------------------

describe('AC5 — Cancel button', () => {
  it('renders the Cancel button', () => {
    setup()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', () => {
    const { onClose, onConfirm } = setup()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

describe('AC5 — Escape key', () => {
  it('calls onClose when Escape is pressed', () => {
    const { onClose, onConfirm } = setup()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('does not call onConfirm when Escape is pressed', () => {
    const { onConfirm } = setup()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

describe('AC5 — backdrop click', () => {
  it('calls onClose when the backdrop (dialog element) is mousedown-ed', () => {
    const { onClose, onConfirm } = setup()
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('does not call onClose when mousedown occurs inside the dialog panel', () => {
    const { onClose } = setup()
    fireEvent.mouseDown(screen.getByRole('heading', { name: /delete design\?/i }))
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC6 — clicking Delete calls onConfirm
// ---------------------------------------------------------------------------

describe('AC6 — Delete button', () => {
  it('renders a Delete button', () => {
    setup()
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
  })

  it('calls onConfirm when the Delete button is clicked', () => {
    const { onConfirm, onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC7 — loading state: Delete button shows spinner and is non-interactive;
//        Cancel remains interactive
// ---------------------------------------------------------------------------

describe('AC7 — loading state', () => {
  it('disables the Delete button while isLoading is true', () => {
    setup({ isLoading: true })
    const deleteBtn = screen.getByRole('button', { name: /deleting/i })
    expect(deleteBtn).toBeDisabled()
  })

  it('shows a spinner inside the Delete button while isLoading is true', () => {
    setup({ isLoading: true })
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows "Deleting…" label instead of "Delete" while isLoading is true', () => {
    setup({ isLoading: true })
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /deleting/i })).toBeInTheDocument()
  })

  it('does not disable the Cancel button while isLoading is true', () => {
    setup({ isLoading: true })
    expect(screen.getByRole('button', { name: /cancel/i })).not.toBeDisabled()
  })

  it('does not show a spinner when isLoading is false', () => {
    setup({ isLoading: false })
    expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
  })

  it('shows "Delete" label (not "Deleting") when isLoading is false', () => {
    setup({ isLoading: false })
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /deleting/i })).not.toBeInTheDocument()
  })
})
