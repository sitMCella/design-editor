import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NewDesignModal } from './NewDesignModal'

function setup(overrides: Partial<React.ComponentProps<typeof NewDesignModal>> = {}) {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(<NewDesignModal onConfirm={onConfirm} onClose={onClose} {...overrides} />)
  return { onConfirm, onClose }
}

// ---------------------------------------------------------------------------
// AC 2 — modal pre-filled with "Untitled design"
// ---------------------------------------------------------------------------
describe('AC2 — modal initial state', () => {
  it('renders with "Untitled design" pre-filled in the input', () => {
    setup()
    expect(screen.getByLabelText(/design name/i)).toHaveValue('Untitled design')
  })

  it('has role="dialog" so it is discoverable as a modal', () => {
    setup()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders Cancel and Create buttons', () => {
    setup()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^create$/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC 3 — "Create" is disabled when input is empty or whitespace-only
// ---------------------------------------------------------------------------
describe('AC3 — Create button disabled state', () => {
  it('is disabled when the input is cleared', () => {
    setup()
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: '' } })
    expect(screen.getByRole('button', { name: /^create$/i })).toBeDisabled()
  })

  it('is disabled when the input contains only whitespace', () => {
    setup()
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: /^create$/i })).toBeDisabled()
  })

  it('does not call onConfirm when Create is clicked while disabled', () => {
    const { onConfirm } = setup()
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC 4 — "Create" is enabled when input has at least one non-whitespace character
// ---------------------------------------------------------------------------
describe('AC4 — Create button enabled state', () => {
  it('is enabled when the input has the default pre-filled value', () => {
    setup()
    expect(screen.getByRole('button', { name: /^create$/i })).not.toBeDisabled()
  })

  it('is enabled after the user types a new name', () => {
    setup()
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'My Design' } })
    expect(screen.getByRole('button', { name: /^create$/i })).not.toBeDisabled()
  })

  it('becomes enabled again after whitespace-only input is replaced with valid text', () => {
    setup()
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: '  ' } })
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: 'Hello' } })
    expect(screen.getByRole('button', { name: /^create$/i })).not.toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// AC 6 — Cancel closes modal without creating
// ---------------------------------------------------------------------------
describe('AC6 — Cancel button', () => {
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
// AC 7 — Escape closes modal without creating
// ---------------------------------------------------------------------------
describe('AC7 — Escape key', () => {
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
// AC 8 — backdrop click closes modal without creating
// ---------------------------------------------------------------------------
describe('AC8 — backdrop click', () => {
  it('calls onClose when the backdrop (dialog element) receives mouseDown', () => {
    const { onClose } = setup()
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when the inner panel receives mouseDown', () => {
    const { onClose } = setup()
    fireEvent.mouseDown(screen.getByText('New design').closest('div')!)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not call onConfirm when the backdrop is clicked', () => {
    const { onConfirm } = setup()
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC 9 — Enter key creates the design (same as clicking Create)
// ---------------------------------------------------------------------------
describe('AC9 — Enter key', () => {
  it('calls onConfirm with the trimmed name when Enter is pressed with a valid input', () => {
    const { onConfirm } = setup()
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: '  My Design  ' } })
    fireEvent.keyDown(screen.getByLabelText(/design name/i), { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledWith('My Design')
  })

  it('calls onConfirm with the pre-filled name when Enter is pressed without editing', () => {
    const { onConfirm } = setup()
    fireEvent.keyDown(screen.getByLabelText(/design name/i), { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledWith('Untitled design')
  })

  it('does not call onConfirm when Enter is pressed with an empty input', () => {
    const { onConfirm } = setup()
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: '' } })
    fireEvent.keyDown(screen.getByLabelText(/design name/i), { key: 'Enter' })
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('does not call onConfirm when Enter is pressed with whitespace-only input', () => {
    const { onConfirm } = setup()
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: '   ' } })
    fireEvent.keyDown(screen.getByLabelText(/design name/i), { key: 'Enter' })
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Create button — happy path
// ---------------------------------------------------------------------------
describe('Create button — happy path', () => {
  it('calls onConfirm with the trimmed name when Create is clicked', () => {
    const { onConfirm } = setup()
    fireEvent.change(screen.getByLabelText(/design name/i), { target: { value: '  My Design  ' } })
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }))
    expect(onConfirm).toHaveBeenCalledWith('My Design')
  })
})
