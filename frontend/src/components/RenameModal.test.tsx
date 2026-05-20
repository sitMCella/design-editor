import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RenameModal } from './RenameModal'

function setup(overrides: Partial<React.ComponentProps<typeof RenameModal>> = {}) {
  const props = {
    currentName: 'My Design',
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    isLoading: false,
    error: null,
    ...overrides,
  }
  render(<RenameModal {...props} />)
  return props
}

// ---------------------------------------------------------------------------
// AC10 — modal renders pre-filled with the current name
// ---------------------------------------------------------------------------

describe('initial state', () => {
  it('renders with role="dialog"', () => {
    setup()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders the "Rename design" heading', () => {
    setup()
    expect(screen.getByRole('heading', { name: /rename design/i })).toBeInTheDocument()
  })

  it('renders the input pre-filled with the current name', () => {
    setup({ currentName: 'Existing Project' })
    expect(screen.getByLabelText(/design name/i)).toHaveValue('Existing Project')
  })

  it('renders Cancel and Save buttons', () => {
    setup()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC11 — Save is disabled when input is empty or whitespace
// AC12 — Save is disabled when trimmed value equals the current name
// ---------------------------------------------------------------------------

describe('Save disabled states', () => {
  it('is disabled when the input is cleared', () => {
    setup()
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: '' } })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('is disabled when the input contains only whitespace', () => {
    setup()
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('is disabled on open because the initial value equals the current name', () => {
    setup({ currentName: 'My Design' })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('is disabled when trimmed value with surrounding spaces equals the current name', () => {
    setup({ currentName: 'My Design' })
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: '  My Design  ' } })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('becomes disabled again when the user restores the original name after editing', () => {
    setup({ currentName: 'My Design' })
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'New Name' } })
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'My Design' } })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// AC13 — Save is enabled when input is non-empty and different from currentName
// ---------------------------------------------------------------------------

describe('Save enabled states', () => {
  it('is enabled when the user types a new valid name', () => {
    setup({ currentName: 'My Design' })
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'New Name' } })
    expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled()
  })

  it('is enabled when the input has different casing from the current name', () => {
    setup({ currentName: 'My Design' })
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'MY DESIGN' } })
    expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// AC15 — Cancel closes the modal without calling onConfirm
// ---------------------------------------------------------------------------

describe('Cancel button', () => {
  it('calls onClose when Cancel is clicked', () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onConfirm when Cancel is clicked', () => {
    const { onConfirm } = setup()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC15 — Escape closes the modal
// ---------------------------------------------------------------------------

describe('Escape key', () => {
  it('calls onClose when Escape is pressed on the input', () => {
    const { onClose } = setup()
    fireEvent.keyDown(screen.getByLabelText(/design name/i), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onConfirm when Escape is pressed', () => {
    const { onConfirm } = setup()
    fireEvent.keyDown(screen.getByLabelText(/design name/i), { key: 'Escape' })
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC15 — backdrop click closes the modal
// ---------------------------------------------------------------------------

describe('backdrop click', () => {
  it('calls onClose when the backdrop (dialog element) receives a mousedown', () => {
    const { onClose } = setup()
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when mousedown is on the inner panel', () => {
    const { onClose } = setup()
    fireEvent.mouseDown(screen.getByRole('heading', { name: /rename design/i }).closest('div')!)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not call onConfirm when the backdrop is clicked', () => {
    const { onConfirm } = setup()
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Save button — happy path (AC16)
// ---------------------------------------------------------------------------

describe('Save button — confirm', () => {
  it('calls onConfirm with the trimmed name when Save is clicked', () => {
    const { onConfirm } = setup({ currentName: 'Old Name' })
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: '  New Name  ' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onConfirm).toHaveBeenCalledWith('New Name')
  })

  it('does not call onConfirm when Save is disabled (unchanged name)', () => {
    const { onConfirm } = setup({ currentName: 'My Design' })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC14 — Enter key confirms the rename
// ---------------------------------------------------------------------------

describe('Enter key', () => {
  it('calls onConfirm with trimmed name when Enter is pressed with a valid input', () => {
    const { onConfirm } = setup({ currentName: 'Old Name' })
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: '  New Name  ' } })
    fireEvent.keyDown(screen.getByLabelText(/design name/i), { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledWith('New Name')
  })

  it('does not call onConfirm when Enter is pressed with an empty input', () => {
    const { onConfirm } = setup({ currentName: 'My Design' })
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: '' } })
    fireEvent.keyDown(screen.getByLabelText(/design name/i), { key: 'Enter' })
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('does not call onConfirm when Enter is pressed with the same name as current', () => {
    const { onConfirm } = setup({ currentName: 'My Design' })
    fireEvent.keyDown(screen.getByLabelText(/design name/i), { key: 'Enter' })
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC17 — API error is shown inline; modal stays open
// ---------------------------------------------------------------------------

describe('error state', () => {
  it('renders the error message when error prop is non-null', () => {
    setup({ error: 'Failed to rename project' })
    expect(screen.getByText('Failed to rename project')).toBeInTheDocument()
  })

  it('does not render an error paragraph when error is null', () => {
    setup({ error: null })
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Loading state — Save shows "Saving…" and is non-interactive
// ---------------------------------------------------------------------------

describe('loading state', () => {
  it('shows "Saving…" text on the Save button when isLoading is true', () => {
    setup({ isLoading: true })
    expect(screen.getByText('Saving…')).toBeInTheDocument()
  })

  it('Save button is disabled even with a valid new name when isLoading is true', () => {
    setup({ isLoading: true, currentName: 'Old Name' })
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'New Name' } })
    // Button text is "Saving…" so query by text content
    expect(screen.getByText('Saving…').closest('button')).toBeDisabled()
  })

  it('Cancel button is disabled when isLoading is true', () => {
    setup({ isLoading: true })
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })

  it('does not call onConfirm when Enter is pressed while isLoading', () => {
    const { onConfirm } = setup({ isLoading: true, currentName: 'Old Name' })
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'New Name' } })
    fireEvent.keyDown(screen.getByLabelText(/design name/i), { key: 'Enter' })
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
