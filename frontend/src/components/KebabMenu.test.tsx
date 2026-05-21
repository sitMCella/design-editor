import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KebabMenu } from './KebabMenu'

function setup(overrides: Partial<React.ComponentProps<typeof KebabMenu>> = {}) {
  const props = {
    isOpen: false,
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onRename: vi.fn(),
    ...overrides,
  }
  render(<KebabMenu {...props} />)
  return props
}

// ---------------------------------------------------------------------------
// AC1 — ⋮ button is always visible
// ---------------------------------------------------------------------------

describe('button rendering', () => {
  it('renders the ⋮ button with an accessible label', () => {
    setup()
    expect(screen.getByRole('button', { name: /project options/i })).toBeInTheDocument()
  })

  it('renders the ⋮ button even when isOpen is true', () => {
    setup({ isOpen: true })
    expect(screen.getByRole('button', { name: /project options/i })).toBeInTheDocument()
  })

  // The ⋮ button uses self-stretch (not a fixed h-5) so it fills the full
  // height of the flex container (the info bar), giving a larger hit area.
  it('uses self-stretch so it fills the container height instead of a fixed 20px', () => {
    setup()
    const button = screen.getByRole('button', { name: /project options/i })
    expect(button).toHaveClass('self-stretch')
    expect(button).not.toHaveClass('h-5')
  })
})

// ---------------------------------------------------------------------------
// AC3 — clicking ⋮ toggles the dropdown
// ---------------------------------------------------------------------------

describe('open/close toggle', () => {
  it('calls onOpen when ⋮ is clicked and the menu is closed', () => {
    const { onOpen, onClose } = setup({ isOpen: false })
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when ⋮ is clicked and the menu is open', () => {
    const { onOpen, onClose } = setup({ isOpen: true })
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC7 — clicking ⋮ does NOT open the project (stops event propagation)
// ---------------------------------------------------------------------------

describe('event propagation', () => {
  it('stops click propagation so the card open action is not triggered', () => {
    const parentClick = vi.fn()
    render(
      <div onClick={parentClick}>
        <KebabMenu isOpen={false} onOpen={vi.fn()} onClose={vi.fn()} onRename={vi.fn()} />
      </div>
    )
    fireEvent.click(screen.getByRole('button', { name: /project options/i }))
    expect(parentClick).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Dropdown portal — rendered when open, absent when closed
// ---------------------------------------------------------------------------

describe('dropdown portal', () => {
  it('renders the "Rename" option inside the dropdown when isOpen is true', () => {
    setup({ isOpen: true })
    expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument()
  })

  it('does not render the dropdown when isOpen is false', () => {
    setup({ isOpen: false })
    expect(screen.queryByRole('button', { name: /rename/i })).not.toBeInTheDocument()
  })

  // The dropdown div calls e.stopPropagation() on mousedown so that ancestor
  // React onMouseDown handlers (e.g. the AllDesignsModal overlay's outside-click
  // guard) are not triggered when the user clicks inside the dropdown.
  it('does not propagate mousedown to a parent React onMouseDown handler', () => {
    const parentMouseDown = vi.fn()
    render(
      <div onMouseDown={parentMouseDown}>
        <KebabMenu isOpen={true} onOpen={vi.fn()} onClose={vi.fn()} onRename={vi.fn()} />
      </div>
    )
    fireEvent.mouseDown(screen.getByRole('button', { name: /rename/i }))
    expect(parentMouseDown).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC9 — selecting Rename calls onRename
// ---------------------------------------------------------------------------

describe('Rename action', () => {
  it('calls onRename when the Rename option is clicked', () => {
    const { onRename } = setup({ isOpen: true })
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))
    expect(onRename).toHaveBeenCalledTimes(1)
  })

  it('stops click propagation from the Rename button', () => {
    const parentClick = vi.fn()
    render(
      <div onClick={parentClick}>
        <KebabMenu isOpen={true} onOpen={vi.fn()} onClose={vi.fn()} onRename={vi.fn()} />
      </div>
    )
    fireEvent.click(screen.getByRole('button', { name: /rename/i }))
    expect(parentClick).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC6 — pressing Escape closes the dropdown
// ---------------------------------------------------------------------------

describe('Escape key', () => {
  it('calls onClose when Escape is pressed while the dropdown is open', () => {
    const { onClose } = setup({ isOpen: true })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when Escape is pressed while the dropdown is closed', () => {
    const { onClose } = setup({ isOpen: false })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC5 — clicking outside the dropdown closes it
// ---------------------------------------------------------------------------

describe('click outside', () => {
  it('calls onClose when a mousedown occurs outside the button and dropdown', () => {
    const { onClose } = setup({ isOpen: true })
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when mousedown is on the ⋮ button itself', () => {
    const { onClose } = setup({ isOpen: true })
    fireEvent.mouseDown(screen.getByRole('button', { name: /project options/i }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not call onClose when mousedown is inside the dropdown', () => {
    const { onClose } = setup({ isOpen: true })
    fireEvent.mouseDown(screen.getByRole('button', { name: /rename/i }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not attach the outside-click listener when the menu is closed', () => {
    const { onClose } = setup({ isOpen: false })
    fireEvent.mouseDown(document.body)
    expect(onClose).not.toHaveBeenCalled()
  })
})
