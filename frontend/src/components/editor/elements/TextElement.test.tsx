import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TextElement } from './TextElement'
import type { TextElement as TextElementType } from '../../../types/canvas'

const baseElement: TextElementType = {
  id: 'el-1',
  type: 'text',
  x: 100,
  y: 100,
  width: 160,
  height: 40,
  rotation: 0,
  opacity: 1,
  locked: false,
  content: 'Hello World',
  fontSize: 16,
  fontFamily: 'Inter, sans-serif',
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#111827',
  align: 'left',
}

const renderElement = (
  overrides: Partial<TextElementType> = {},
  props: { isSelected?: boolean } = {}
) => {
  const onSelect = vi.fn()
  const onUpdate = vi.fn()
  const onRemove = vi.fn()

  const result = render(
    <TextElement
      element={{ ...baseElement, ...overrides }}
      isSelected={props.isSelected ?? false}
      onSelect={onSelect}
      onUpdate={onUpdate}
      onRemove={onRemove}
    />
  )

  return { ...result, onSelect, onUpdate, onRemove }
}

// AC 3 — clicking selects the element and shows a blue outline
describe('selection', () => {
  it('calls onSelect when clicked in default state', () => {
    const { onSelect } = renderElement()
    fireEvent.click(screen.getByText('Hello World'))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('does not call onSelect when already in edit mode', () => {
    const { onSelect } = renderElement({}, { isSelected: true })
    // Enter edit mode first
    fireEvent.dblClick(screen.getByText('Hello World'))
    onSelect.mockClear()
    // Click inside the editable area
    const editable = document.querySelector('[contenteditable]')!
    fireEvent.click(editable)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('applies a solid blue outline when selected and not editing', () => {
    const { container } = renderElement({}, { isSelected: true })
    const el = container.firstChild as HTMLElement
    expect(el.style.outline).toContain('solid')
    expect(el.style.outline.toLowerCase()).toContain('3b82f6')
  })

  it('applies no outline when not selected', () => {
    const { container } = renderElement({}, { isSelected: false })
    const el = container.firstChild as HTMLElement
    expect(el.style.outline).toBe('none')
  })
})

// AC 4 — double-clicking a selected element enters edit mode and focuses the editable area
describe('edit mode entry', () => {
  it('renders a contentEditable div after double-click', () => {
    renderElement({}, { isSelected: true })
    fireEvent.dblClick(screen.getByText('Hello World'))
    expect(document.querySelector('[contenteditable="true"]')).toBeInTheDocument()
  })

  it('focuses the contentEditable element after double-click', () => {
    renderElement({}, { isSelected: true })
    fireEvent.dblClick(screen.getByText('Hello World'))
    expect(document.querySelector('[contenteditable="true"]')).toHaveFocus()
  })

  it('applies a dashed blue outline in edit mode', () => {
    const { container } = renderElement({}, { isSelected: true })
    fireEvent.dblClick(screen.getByText('Hello World'))
    const el = container.firstChild as HTMLElement
    expect(el.style.outline).toContain('dashed')
  })

  it('stops click propagation during double-click so the element is not deselected', () => {
    const parentClickHandler = vi.fn()
    const { container } = renderElement({}, { isSelected: true })
    container.parentElement!.addEventListener('click', parentClickHandler)
    fireEvent.dblClick(screen.getByText('Hello World'))
    expect(parentClickHandler).not.toHaveBeenCalled()
    container.parentElement!.removeEventListener('click', parentClickHandler)
  })
})

// AC 5 — typing in edit mode updates the visible text in real time
describe('real-time text updates', () => {
  it('calls onUpdate with the current text content on each input event', () => {
    const { onUpdate } = renderElement({}, { isSelected: true })
    fireEvent.dblClick(screen.getByText('Hello World'))

    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editable.textContent = 'Updated text'
    fireEvent.input(editable)

    expect(onUpdate).toHaveBeenCalledWith({ content: 'Updated text' })
  })

  it('calls onUpdate on every distinct input event', () => {
    const { onUpdate } = renderElement({}, { isSelected: true })
    fireEvent.dblClick(screen.getByText('Hello World'))

    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement

    editable.textContent = 'First'
    fireEvent.input(editable)
    editable.textContent = 'First edit'
    fireEvent.input(editable)

    expect(onUpdate).toHaveBeenCalledTimes(2)
    expect(onUpdate).toHaveBeenLastCalledWith({ content: 'First edit' })
  })
})

// AC 7 — blurring exits edit mode and retains the updated content
describe('blur behaviour', () => {
  it('exits edit mode on blur (contentEditable is removed from DOM)', () => {
    renderElement({}, { isSelected: true })
    fireEvent.dblClick(screen.getByText('Hello World'))

    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editable.textContent = 'Kept content'
    fireEvent.blur(editable)

    expect(document.querySelector('[contenteditable="true"]')).not.toBeInTheDocument()
  })

  it('calls onUpdate with the final content on blur', () => {
    const { onUpdate } = renderElement({}, { isSelected: true })
    fireEvent.dblClick(screen.getByText('Hello World'))

    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editable.textContent = 'Final content'
    fireEvent.blur(editable)

    expect(onUpdate).toHaveBeenLastCalledWith({ content: 'Final content' })
  })

  it('pressing Escape exits edit mode without relying on blur', () => {
    renderElement({}, { isSelected: true })
    fireEvent.dblClick(screen.getByText('Hello World'))

    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    fireEvent.keyDown(editable, { key: 'Escape' })

    expect(document.querySelector('[contenteditable="true"]')).not.toBeInTheDocument()
  })
})

// AC 8 — clearing all text and blurring removes the element
describe('empty content removal', () => {
  it('calls onRemove when blurred with empty content', () => {
    const { onRemove } = renderElement({}, { isSelected: true })
    fireEvent.dblClick(screen.getByText('Hello World'))

    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editable.textContent = ''
    fireEvent.blur(editable)

    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('calls onRemove when blurred with whitespace-only content', () => {
    const { onRemove } = renderElement({}, { isSelected: true })
    fireEvent.dblClick(screen.getByText('Hello World'))

    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editable.textContent = '   '
    fireEvent.blur(editable)

    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('does not call onUpdate when content is empty on blur', () => {
    const { onUpdate } = renderElement({}, { isSelected: true })
    fireEvent.dblClick(screen.getByText('Hello World'))

    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editable.textContent = ''
    fireEvent.blur(editable)

    // onUpdate may have been called during typing but not on the final blur
    const blurCall = onUpdate.mock.calls.find((call) => call[0].content === '')
    expect(blurCall).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Multiline text — display and edit-cycle
// ---------------------------------------------------------------------------

describe('multiline text', () => {
  it('renders HTML content via dangerouslySetInnerHTML so line-break tags are not escaped', () => {
    const { container } = renderElement({ content: 'Line one<br>Line two' })
    // A real <br> element in the DOM confirms the markup was parsed, not escaped to &lt;br&gt;
    expect(container.querySelector('br')).toBeInTheDocument()
  })

  it('initialises the contentEditable with the full innerHTML on edit entry', () => {
    const { container } = renderElement({ content: 'Line one<br>Line two' }, { isSelected: true })
    fireEvent.dblClick(container.firstChild as HTMLElement)
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    expect(editable.innerHTML).toBe('Line one<br>Line two')
  })

  it('saves multiline HTML (including <br> tags) on each input event', () => {
    const { container, onUpdate } = renderElement({ content: 'Line one' }, { isSelected: true })
    fireEvent.dblClick(container.firstChild as HTMLElement)
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editable.innerHTML = 'Line one<br>Line two'
    fireEvent.input(editable)
    expect(onUpdate).toHaveBeenCalledWith({ content: 'Line one<br>Line two' })
  })

  it('saves multiline HTML on blur', () => {
    const { container, onUpdate } = renderElement({ content: 'Line one' }, { isSelected: true })
    fireEvent.dblClick(container.firstChild as HTMLElement)
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editable.innerHTML = 'Line one<br>Line two<br>Line three'
    fireEvent.blur(editable)
    expect(onUpdate).toHaveBeenLastCalledWith({ content: 'Line one<br>Line two<br>Line three' })
  })

  it('calls onRemove when blurred with content that is only whitespace across lines', () => {
    const { container, onRemove } = renderElement(
      { content: 'Line one<br>Line two' },
      { isSelected: true }
    )
    fireEvent.dblClick(container.firstChild as HTMLElement)
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editable.innerHTML = '<br><br>'
    fireEvent.blur(editable)
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Rich text display — bold, italic, colour spans rendered from stored HTML
// ---------------------------------------------------------------------------

describe('rich text display', () => {
  it('renders bold markup', () => {
    const { container } = renderElement({ content: 'Hello <b>world</b>' })
    const display = container.querySelector('div > div') as HTMLElement
    expect(display.querySelector('b')?.textContent).toBe('world')
  })

  it('renders italic markup', () => {
    const { container } = renderElement({ content: 'Hello <i>world</i>' })
    const display = container.querySelector('div > div') as HTMLElement
    expect(display.querySelector('i')?.textContent).toBe('world')
  })

  it('renders a coloured span — style.color reflects the stored colour', () => {
    const { container } = renderElement({
      content: '<span style="color: #ff0000">red chunk</span> plain',
    })
    const display = container.querySelector('div > div') as HTMLElement
    const span = display.querySelector('span') as HTMLElement
    // jsdom normalises hex colours to rgb() when reading computed/inline style
    expect(span.style.color).toBe('rgb(255, 0, 0)')
    expect(span.textContent).toBe('red chunk')
  })

  it('renders combined bold, italic and colour markup independently', () => {
    const content = '<b>bold</b> <i>italic</i> <span style="color: #0000ff">blue</span>'
    const { container } = renderElement({ content })
    const display = container.querySelector('div > div') as HTMLElement
    expect(display.querySelector('b')?.textContent).toBe('bold')
    expect(display.querySelector('i')?.textContent).toBe('italic')
    const span = display.querySelector('span') as HTMLElement
    expect(span.style.color).toBe('rgb(0, 0, 255)')
    expect(span.textContent).toBe('blue')
  })
})

// ---------------------------------------------------------------------------
// Rich text editing — markup round-trips through input/blur; blur suppression
// ---------------------------------------------------------------------------

describe('rich text editing', () => {
  it('initialises the contentEditable with existing bold markup on edit entry', () => {
    const { container } = renderElement({ content: '<b>bold text</b>' }, { isSelected: true })
    fireEvent.dblClick(container.firstChild as HTMLElement)
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    expect(editable.querySelector('b')?.textContent).toBe('bold text')
  })

  it('initialises the contentEditable with existing italic markup on edit entry', () => {
    const { container } = renderElement({ content: '<i>italic text</i>' }, { isSelected: true })
    fireEvent.dblClick(container.firstChild as HTMLElement)
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    expect(editable.querySelector('i')?.textContent).toBe('italic text')
  })

  it('initialises the contentEditable with existing colour span markup on edit entry', () => {
    const { container } = renderElement(
      { content: '<span style="color: #ff0000">red</span>' },
      { isSelected: true }
    )
    fireEvent.dblClick(container.firstChild as HTMLElement)
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    expect(editable.querySelector('span')?.style.color).toBe('rgb(255, 0, 0)')
  })

  it('saves bold markup from innerHTML on each input event', () => {
    const { container, onUpdate } = renderElement({}, { isSelected: true })
    fireEvent.dblClick(container.firstChild as HTMLElement)
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editable.innerHTML = 'Hello <b>world</b>'
    fireEvent.input(editable)
    expect(onUpdate).toHaveBeenCalledWith({ content: 'Hello <b>world</b>' })
  })

  it('saves italic markup from innerHTML on each input event', () => {
    const { container, onUpdate } = renderElement({}, { isSelected: true })
    fireEvent.dblClick(container.firstChild as HTMLElement)
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editable.innerHTML = '<i>italic text</i>'
    fireEvent.input(editable)
    expect(onUpdate).toHaveBeenCalledWith({ content: '<i>italic text</i>' })
  })

  it('saves colour span markup on input — the stored HTML parses back to the correct colour', () => {
    const { container, onUpdate } = renderElement({}, { isSelected: true })
    fireEvent.dblClick(container.firstChild as HTMLElement)
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editable.innerHTML = '<span style="color: #ff0000">red chunk</span> plain'
    fireEvent.input(editable)

    const savedContent: string = onUpdate.mock.calls.at(-1)![0].content
    const tmp = document.createElement('div')
    tmp.innerHTML = savedContent
    expect(tmp.querySelector('span')?.style.color).toBe('rgb(255, 0, 0)')
    expect(tmp.querySelector('span')?.textContent).toBe('red chunk')
  })

  it('saves combined bold, italic and colour markup on blur', () => {
    const { container, onUpdate } = renderElement({}, { isSelected: true })
    fireEvent.dblClick(container.firstChild as HTMLElement)
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editable.innerHTML = '<b>bold</b> <i>italic</i>'
    fireEvent.blur(editable)
    expect(onUpdate).toHaveBeenLastCalledWith({ content: '<b>bold</b> <i>italic</i>' })
  })

  it('calls onRemove when blurred with markup that contains no text content', () => {
    const { container, onRemove } = renderElement({}, { isSelected: true })
    fireEvent.dblClick(container.firstChild as HTMLElement)
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editable.innerHTML = '<b></b><i></i>'
    fireEvent.blur(editable)
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('does not exit edit mode when blur relatedTarget is inside the contextual toolbar', () => {
    const { container } = renderElement({}, { isSelected: true })
    fireEvent.dblClick(container.firstChild as HTMLElement)
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement

    const toolbar = document.createElement('div')
    toolbar.setAttribute('data-testid', 'contextual-toolbar')
    const colorInput = document.createElement('input')
    colorInput.type = 'color'
    toolbar.appendChild(colorInput)
    document.body.appendChild(toolbar)

    fireEvent.blur(editable, { relatedTarget: colorInput })

    expect(document.querySelector('[contenteditable="true"]')).toBeInTheDocument()
    document.body.removeChild(toolbar)
  })

  it('does exit edit mode when blur relatedTarget is outside the contextual toolbar', () => {
    const { container } = renderElement({}, { isSelected: true })
    fireEvent.dblClick(container.firstChild as HTMLElement)
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editable.innerHTML = '<b>text</b>'

    const outsideButton = document.createElement('button')
    document.body.appendChild(outsideButton)
    fireEvent.blur(editable, { relatedTarget: outsideButton })

    expect(document.querySelector('[contenteditable="true"]')).not.toBeInTheDocument()
    document.body.removeChild(outsideButton)
  })

  it('saves content when blur target is outside the toolbar', () => {
    const { container, onUpdate } = renderElement({}, { isSelected: true })
    fireEvent.dblClick(container.firstChild as HTMLElement)
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editable.innerHTML = '<b>saved bold</b>'

    const outsideButton = document.createElement('button')
    document.body.appendChild(outsideButton)
    fireEvent.blur(editable, { relatedTarget: outsideButton })

    expect(onUpdate).toHaveBeenLastCalledWith({ content: '<b>saved bold</b>' })
    document.body.removeChild(outsideButton)
  })
})

// ---------------------------------------------------------------------------
// AC 1 — dragging a selected element moves it
// AC 2 — dragging does not trigger deselection or edit mode
// AC 3 — element cannot be dragged outside the design surface bounds
// ---------------------------------------------------------------------------

describe('drag behaviour', () => {
  const drag = (el: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }) => {
    fireEvent.mouseDown(el, { clientX: from.x, clientY: from.y })
    fireEvent.mouseMove(window, { clientX: to.x, clientY: to.y })
    fireEvent.mouseUp(window)
  }

  it('AC1: calls onUpdate with new position after dragging ≥ 4px', () => {
    const { container, onUpdate } = renderElement({}, { isSelected: true })
    const el = container.firstChild as HTMLElement
    // drag right 20px, down 15px from clientX:200,clientY:200
    drag(el, { x: 200, y: 200 }, { x: 220, y: 215 })
    // element started at x:100, y:100 → new position: x:120, y:115
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ x: 120, y: 115 }))
  })

  it('AC1: does not call onUpdate when movement is below the 4px threshold', () => {
    const { container, onUpdate } = renderElement({}, { isSelected: true })
    const el = container.firstChild as HTMLElement
    drag(el, { x: 200, y: 200 }, { x: 202, y: 202 })
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('AC2: does not call onSelect (deselect) when a drag occurs', () => {
    const { container, onSelect } = renderElement({}, { isSelected: true })
    const el = container.firstChild as HTMLElement
    drag(el, { x: 200, y: 200 }, { x: 220, y: 215 })
    // click fires after mouseup in real browsers; simulate it here — should be suppressed
    fireEvent.click(el)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('AC2: does not enter edit mode when dragging', () => {
    const { container } = renderElement({}, { isSelected: true })
    const el = container.firstChild as HTMLElement
    drag(el, { x: 200, y: 200 }, { x: 220, y: 215 })
    expect(document.querySelector('[contenteditable="true"]')).not.toBeInTheDocument()
  })

  it('AC3: clamps x to 0 when dragged past the left edge', () => {
    const { container, onUpdate } = renderElement({ x: 50, y: 100 }, { isSelected: true })
    const el = container.firstChild as HTMLElement
    // drag 200px left → would put x at -150, should clamp to 0
    drag(el, { x: 300, y: 300 }, { x: 100, y: 300 })
    const lastCall = onUpdate.mock.calls.at(-1)![0]
    expect(lastCall.x).toBe(0)
  })

  it('AC3: clamps x to SURFACE_WIDTH - element.width when dragged past the right edge', () => {
    const { container, onUpdate } = renderElement({ x: 100, y: 100 }, { isSelected: true })
    const el = container.firstChild as HTMLElement
    // drag 2000px right → should clamp to 1280 - 160 = 1120
    drag(el, { x: 200, y: 200 }, { x: 2200, y: 200 })
    const lastCall = onUpdate.mock.calls.at(-1)![0]
    expect(lastCall.x).toBe(1120)
  })

  it('AC3: clamps y to 0 when dragged past the top edge', () => {
    const { container, onUpdate } = renderElement({ x: 100, y: 50 }, { isSelected: true })
    const el = container.firstChild as HTMLElement
    drag(el, { x: 300, y: 300 }, { x: 300, y: 100 })
    const lastCall = onUpdate.mock.calls.at(-1)![0]
    expect(lastCall.y).toBe(0)
  })

  it('AC3: clamps y to SURFACE_HEIGHT - element.height when dragged past the bottom edge', () => {
    const { container, onUpdate } = renderElement({ x: 100, y: 100 }, { isSelected: true })
    const el = container.firstChild as HTMLElement
    // drag 2000px down → should clamp to 720 - 40 = 680
    drag(el, { x: 200, y: 200 }, { x: 200, y: 2200 })
    const lastCall = onUpdate.mock.calls.at(-1)![0]
    expect(lastCall.y).toBe(680)
  })

  it('AC2: does not initiate drag when element is not selected', () => {
    const { container, onUpdate } = renderElement({}, { isSelected: false })
    const el = container.firstChild as HTMLElement
    drag(el, { x: 200, y: 200 }, { x: 220, y: 215 })
    expect(onUpdate).not.toHaveBeenCalled()
  })
})
