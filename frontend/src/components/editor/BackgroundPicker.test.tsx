// Spec 20 — Canvas Background Colour: BackgroundPicker component tests
// Covers: AC4, AC5, AC6, AC7, AC8, AC9

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BackgroundPicker } from './BackgroundPicker'
import { useCanvasStore } from '../../stores/canvasStore'

const PRESETS = [
  '#F3F4F6',
  '#FFFFFF',
  '#E5E7EB',
  '#64748B',
  '#111827',
  '#BAE6FD',
  '#BFDBFE',
  '#C7D2FE',
  '#E9D5FF',
  '#FECDD3',
  '#FDE68A',
  '#A7F3D0',
]

beforeEach(() => {
  useCanvasStore.setState({
    backgroundColor: '#F3F4F6',
    isDirty: false,
  })
})

// ---------------------------------------------------------------------------
// AC5 — preset palette, transparent swatch, and custom input are all present
// ---------------------------------------------------------------------------

describe('AC5 — palette contents', () => {
  it('renders all 12 preset colour swatches', () => {
    render(<BackgroundPicker onClose={vi.fn()} />)
    PRESETS.forEach((color) => {
      expect(screen.getByLabelText(`Set background to ${color}`)).toBeInTheDocument()
    })
  })

  it('renders a Transparent swatch', () => {
    render(<BackgroundPicker onClose={vi.fn()} />)
    expect(screen.getByLabelText('Set background to transparent')).toBeInTheDocument()
  })

  it('shows the text label "Transparent" next to the swatch', () => {
    render(<BackgroundPicker onClose={vi.fn()} />)
    expect(screen.getByText('Transparent')).toBeInTheDocument()
  })

  it('renders a custom colour input', () => {
    render(<BackgroundPicker onClose={vi.fn()} />)
    expect(screen.getByLabelText('Custom background colour')).toBeInTheDocument()
  })

  it('the custom input is of type "color"', () => {
    render(<BackgroundPicker onClose={vi.fn()} />)
    const input = screen.getByLabelText('Custom background colour')
    expect(input).toHaveAttribute('type', 'color')
  })

  it('renders a section heading', () => {
    render(<BackgroundPicker onClose={vi.fn()} />)
    expect(screen.getByText(/canvas background/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC6 — clicking a preset immediately changes backgroundColor
// ---------------------------------------------------------------------------

describe('AC6 — preset swatch click', () => {
  it('sets backgroundColor to the clicked preset hex', () => {
    render(<BackgroundPicker onClose={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Set background to #111827'))
    expect(useCanvasStore.getState().backgroundColor).toBe('#111827')
  })

  it('sets backgroundColor to white when the white preset is clicked', () => {
    render(<BackgroundPicker onClose={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Set background to #FFFFFF'))
    expect(useCanvasStore.getState().backgroundColor).toBe('#FFFFFF')
  })

  it('sets backgroundColor to sky blue (#BAE6FD)', () => {
    render(<BackgroundPicker onClose={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Set background to #BAE6FD'))
    expect(useCanvasStore.getState().backgroundColor).toBe('#BAE6FD')
  })

  it('marks the store as dirty after clicking a preset', () => {
    render(<BackgroundPicker onClose={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Set background to #111827'))
    expect(useCanvasStore.getState().isDirty).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AC7 — transparent swatch sets 'transparent'
// ---------------------------------------------------------------------------

describe('AC7 — transparent swatch', () => {
  it('sets backgroundColor to "transparent" when the Transparent button is clicked', () => {
    render(<BackgroundPicker onClose={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Set background to transparent'))
    expect(useCanvasStore.getState().backgroundColor).toBe('transparent')
  })

  it('marks the store as dirty when transparent is selected', () => {
    render(<BackgroundPicker onClose={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Set background to transparent'))
    expect(useCanvasStore.getState().isDirty).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AC8 — custom colour input updates backgroundColor in real time
// ---------------------------------------------------------------------------

describe('AC8 — custom colour input', () => {
  it('updates backgroundColor when the input value changes', () => {
    render(<BackgroundPicker onClose={vi.fn()} />)
    const input = screen.getByLabelText('Custom background colour')
    fireEvent.change(input, { target: { value: '#FF0000' } })
    // The native color input normalises hex values to lowercase
    expect(useCanvasStore.getState().backgroundColor).toMatch(/^#ff0000$/i)
  })

  it('marks the store as dirty when the custom input changes', () => {
    render(<BackgroundPicker onClose={vi.fn()} />)
    const input = screen.getByLabelText('Custom background colour')
    fireEvent.change(input, { target: { value: '#FF0000' } })
    expect(useCanvasStore.getState().isDirty).toBe(true)
  })

  it('falls back to #ffffff in the input when backgroundColor is "transparent"', () => {
    useCanvasStore.setState({ backgroundColor: 'transparent' })
    render(<BackgroundPicker onClose={vi.fn()} />)
    const input = screen.getByLabelText('Custom background colour')
    expect(input).toHaveValue('#ffffff')
  })

  it('reflects the current hex backgroundColor in the input', () => {
    useCanvasStore.setState({ backgroundColor: '#BAE6FD' })
    render(<BackgroundPicker onClose={vi.fn()} />)
    const input = screen.getByLabelText('Custom background colour')
    expect(input).toHaveValue('#bae6fd')
  })
})

// ---------------------------------------------------------------------------
// AC9 — active swatch is visually highlighted
// ---------------------------------------------------------------------------

describe('AC9 — active swatch highlighting', () => {
  it('highlights the matching preset with a blue ring (boxShadow)', () => {
    useCanvasStore.setState({ backgroundColor: '#BAE6FD' })
    render(<BackgroundPicker onClose={vi.fn()} />)
    const activeBtn = screen.getByLabelText('Set background to #BAE6FD')
    expect(activeBtn).toHaveStyle({
      boxShadow: '0 0 0 2px #ffffff, 0 0 0 4px #3B82F6',
    })
  })

  it('does not apply the ring to non-active preset swatches', () => {
    useCanvasStore.setState({ backgroundColor: '#BAE6FD' })
    render(<BackgroundPicker onClose={vi.fn()} />)
    const inactiveBtn = screen.getByLabelText('Set background to #FFFFFF')
    expect(inactiveBtn.style.boxShadow).not.toBe('0 0 0 2px #ffffff, 0 0 0 4px #3B82F6')
  })

  it('highlights the transparent swatch when backgroundColor is "transparent"', () => {
    useCanvasStore.setState({ backgroundColor: 'transparent' })
    render(<BackgroundPicker onClose={vi.fn()} />)
    const transparentBtn = screen.getByLabelText('Set background to transparent')
    // The ring is applied to the decorative span inside the button, not the button itself
    const swatch = transparentBtn.querySelector('span[aria-hidden="true"]')
    expect(swatch).toHaveStyle({
      boxShadow: '0 0 0 2px #ffffff, 0 0 0 4px #3B82F6',
    })
  })

  it('does not highlight the transparent swatch when a preset is active', () => {
    useCanvasStore.setState({ backgroundColor: '#F3F4F6' })
    render(<BackgroundPicker onClose={vi.fn()} />)
    const transparentBtn = screen.getByLabelText('Set background to transparent')
    const swatch = transparentBtn.querySelector('span[aria-hidden="true"]')
    expect(swatch!.style.boxShadow).not.toBe('0 0 0 2px #ffffff, 0 0 0 4px #3B82F6')
  })

  it('moves the ring when a new preset is selected', () => {
    useCanvasStore.setState({ backgroundColor: '#F3F4F6' })
    render(<BackgroundPicker onClose={vi.fn()} />)

    // Select sky blue
    fireEvent.click(screen.getByLabelText('Set background to #BAE6FD'))

    expect(screen.getByLabelText('Set background to #BAE6FD')).toHaveStyle({
      boxShadow: '0 0 0 2px #ffffff, 0 0 0 4px #3B82F6',
    })
    expect(screen.getByLabelText('Set background to #F3F4F6').style.boxShadow).not.toBe(
      '0 0 0 2px #ffffff, 0 0 0 4px #3B82F6'
    )
  })
})

// ---------------------------------------------------------------------------
// AC4 — clicking outside closes the popover; Escape also closes it
// ---------------------------------------------------------------------------

describe('AC4 — popover dismissal', () => {
  it('calls onClose when a mousedown event occurs outside the popover', () => {
    const onClose = vi.fn()
    render(<BackgroundPicker onClose={onClose} />)
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose when a mousedown event occurs inside the popover', () => {
    const onClose = vi.fn()
    render(<BackgroundPicker onClose={onClose} />)
    const dialog = screen.getByRole('dialog')
    fireEvent.mouseDown(dialog)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<BackgroundPicker onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose when a non-Escape key is pressed', () => {
    const onClose = vi.fn()
    render(<BackgroundPicker onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('renders a dialog role on the popover element', () => {
    render(<BackgroundPicker onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
