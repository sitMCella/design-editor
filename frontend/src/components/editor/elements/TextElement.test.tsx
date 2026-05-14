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

// ---------------------------------------------------------------------------
// AC 4 — selected element shows resize handles at four corners;
//         handles are hidden in editing mode
// ---------------------------------------------------------------------------

describe('AC4: resize handles visibility', () => {
  it('renders all four corner handles when selected and not editing', () => {
    renderElement({}, { isSelected: true })
    expect(screen.getByTestId('resize-handle-tl')).toBeInTheDocument()
    expect(screen.getByTestId('resize-handle-tr')).toBeInTheDocument()
    expect(screen.getByTestId('resize-handle-bl')).toBeInTheDocument()
    expect(screen.getByTestId('resize-handle-br')).toBeInTheDocument()
  })

  it('does not render resize handles when not selected', () => {
    renderElement({}, { isSelected: false })
    expect(screen.queryByTestId('resize-handle-tl')).not.toBeInTheDocument()
    expect(screen.queryByTestId('resize-handle-tr')).not.toBeInTheDocument()
    expect(screen.queryByTestId('resize-handle-bl')).not.toBeInTheDocument()
    expect(screen.queryByTestId('resize-handle-br')).not.toBeInTheDocument()
  })

  it('hides resize handles when editing mode is entered via double-click', () => {
    renderElement({}, { isSelected: true })
    expect(screen.getByTestId('resize-handle-tl')).toBeInTheDocument()
    fireEvent.dblClick(screen.getByTestId('text-element'))
    expect(screen.queryByTestId('resize-handle-tl')).not.toBeInTheDocument()
    expect(screen.queryByTestId('resize-handle-tr')).not.toBeInTheDocument()
    expect(screen.queryByTestId('resize-handle-bl')).not.toBeInTheDocument()
    expect(screen.queryByTestId('resize-handle-br')).not.toBeInTheDocument()
  })

  it('restores resize handles when editing mode is exited via Escape', () => {
    renderElement({}, { isSelected: true })
    fireEvent.dblClick(screen.getByTestId('text-element'))
    expect(screen.queryByTestId('resize-handle-tl')).not.toBeInTheDocument()
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    fireEvent.keyDown(editable, { key: 'Escape' })
    expect(screen.getByTestId('resize-handle-tl')).toBeInTheDocument()
    expect(screen.getByTestId('resize-handle-tr')).toBeInTheDocument()
    expect(screen.getByTestId('resize-handle-bl')).toBeInTheDocument()
    expect(screen.getByTestId('resize-handle-br')).toBeInTheDocument()
  })

  it('restores resize handles when editing mode is exited via blur', () => {
    renderElement({}, { isSelected: true })
    fireEvent.dblClick(screen.getByTestId('text-element'))
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editable.textContent = 'some text'
    fireEvent.blur(editable)
    expect(screen.getByTestId('resize-handle-tl')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC 5 — corner handles resize the element; min 40 × 20 px; bounded to surface
// ---------------------------------------------------------------------------

describe('AC5: resize behaviour', () => {
  const resize = (
    handle: HTMLElement,
    from: { x: number; y: number },
    to: { x: number; y: number }
  ) => {
    fireEvent.mouseDown(handle, { clientX: from.x, clientY: from.y })
    fireEvent.mouseMove(window, { clientX: to.x, clientY: to.y })
    fireEvent.mouseUp(window)
  }

  it('br handle grows width and height', () => {
    // baseElement: x:100, y:100, w:160, h:40 — drag br right 50, down 30
    const { onUpdate } = renderElement({}, { isSelected: true })
    resize(screen.getByTestId('resize-handle-br'), { x: 0, y: 0 }, { x: 50, y: 30 })
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ width: 210, height: 70 }))
  })

  it('tl handle moves the origin and shrinks both dimensions', () => {
    // drag tl right 20, down 10 → x+20, y+10, w-20, h-10
    const { onUpdate } = renderElement({}, { isSelected: true })
    resize(screen.getByTestId('resize-handle-tl'), { x: 0, y: 0 }, { x: 20, y: 10 })
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ x: 120, y: 110, width: 140, height: 30 })
    )
  })

  it('tr handle grows width and moves the top edge', () => {
    // drag tr right 30, down 10 → y+10, w+30, h-10; x is unchanged
    const { onUpdate } = renderElement({}, { isSelected: true })
    resize(screen.getByTestId('resize-handle-tr'), { x: 0, y: 0 }, { x: 30, y: 10 })
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ y: 110, width: 190, height: 30 })
    )
  })

  it('bl handle moves the left edge and grows height', () => {
    // drag bl right 20, down 20 → x+20, w-20, h+20; y is unchanged
    const { onUpdate } = renderElement({}, { isSelected: true })
    resize(screen.getByTestId('resize-handle-bl'), { x: 0, y: 0 }, { x: 20, y: 20 })
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ x: 120, width: 140, height: 60 })
    )
  })

  it('enforces minimum width of 40px when shrinking via br handle', () => {
    // w=60, drag br left 30 → w=30 < 40 → clamped to 40
    const { onUpdate } = renderElement({ width: 60, height: 60 }, { isSelected: true })
    resize(screen.getByTestId('resize-handle-br'), { x: 0, y: 0 }, { x: -30, y: 0 })
    const last = onUpdate.mock.calls.at(-1)![0]
    expect(last.width).toBe(40)
  })

  it('enforces minimum height of 20px when shrinking via br handle', () => {
    // h=40, drag br up 30 → h=10 < 20 → clamped to 20
    const { onUpdate } = renderElement({ width: 160, height: 40 }, { isSelected: true })
    resize(screen.getByTestId('resize-handle-br'), { x: 0, y: 0 }, { x: 0, y: -30 })
    const last = onUpdate.mock.calls.at(-1)![0]
    expect(last.height).toBe(20)
  })

  it('adjusts anchor x when tl handle would push width below minimum', () => {
    // x=100, w=60; drag tl right 30 → w=30 < 40 → w clamped to 40, x = 100+60-40 = 120
    const { onUpdate } = renderElement(
      { x: 100, y: 100, width: 60, height: 60 },
      { isSelected: true }
    )
    resize(screen.getByTestId('resize-handle-tl'), { x: 0, y: 0 }, { x: 30, y: 0 })
    const last = onUpdate.mock.calls.at(-1)![0]
    expect(last.width).toBe(40)
    expect(last.x).toBe(120)
  })

  it('adjusts anchor y when tl handle would push height below minimum', () => {
    // y=100, h=30; drag tl down 20 → h=10 < 20 → h clamped to 20, y = 100+30-20 = 110
    const { onUpdate } = renderElement(
      { x: 100, y: 100, width: 160, height: 30 },
      { isSelected: true }
    )
    resize(screen.getByTestId('resize-handle-tl'), { x: 0, y: 0 }, { x: 0, y: 20 })
    const last = onUpdate.mock.calls.at(-1)![0]
    expect(last.height).toBe(20)
    expect(last.y).toBe(110)
  })

  it('element cannot extend past the right edge of the design surface', () => {
    // x=1100, drag br far right → max width = 1280 - 1100 = 180
    const { onUpdate } = renderElement(
      { x: 1100, y: 100, width: 100, height: 40 },
      { isSelected: true }
    )
    resize(screen.getByTestId('resize-handle-br'), { x: 0, y: 0 }, { x: 500, y: 0 })
    const last = onUpdate.mock.calls.at(-1)![0]
    expect(last.width).toBe(180)
  })

  it('element cannot extend past the bottom edge of the design surface', () => {
    // y=700, drag br far down → max height = 720 - 700 = 20
    const { onUpdate } = renderElement(
      { x: 100, y: 700, width: 100, height: 10 },
      { isSelected: true }
    )
    resize(screen.getByTestId('resize-handle-br'), { x: 0, y: 0 }, { x: 0, y: 200 })
    const last = onUpdate.mock.calls.at(-1)![0]
    expect(last.height).toBe(20)
  })

  it('clamps x to 0 when tl handle is dragged past the left surface edge', () => {
    // x=50; drag tl far left (dx=-200) → x = 50-200 = -150 → clamped to 0
    const { onUpdate } = renderElement(
      { x: 50, y: 100, width: 160, height: 40 },
      { isSelected: true }
    )
    resize(screen.getByTestId('resize-handle-tl'), { x: 200, y: 0 }, { x: 0, y: 0 })
    const last = onUpdate.mock.calls.at(-1)![0]
    expect(last.x).toBe(0)
  })

  it('clamps y to 0 when tl handle is dragged past the top surface edge', () => {
    // y=50; drag tl far up (dy=-200) → y = 50-200 = -150 → clamped to 0
    const { onUpdate } = renderElement(
      { x: 100, y: 50, width: 160, height: 40 },
      { isSelected: true }
    )
    resize(screen.getByTestId('resize-handle-tl'), { x: 0, y: 200 }, { x: 0, y: 0 })
    const last = onUpdate.mock.calls.at(-1)![0]
    expect(last.y).toBe(0)
  })

  it('does not call onSelect when a resize handle is dragged', () => {
    const { onSelect } = renderElement({}, { isSelected: true })
    resize(screen.getByTestId('resize-handle-br'), { x: 0, y: 0 }, { x: 50, y: 30 })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('does not enter editing mode when a resize handle is dragged', () => {
    renderElement({}, { isSelected: true })
    resize(screen.getByTestId('resize-handle-br'), { x: 0, y: 0 }, { x: 50, y: 30 })
    expect(document.querySelector('[contenteditable="true"]')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC 6 — text content reflows naturally as the element width is resized
// ---------------------------------------------------------------------------

describe('AC6: text reflow styles', () => {
  it('applies word-break: break-word so text reflows when width changes', () => {
    const { container } = renderElement()
    const el = container.firstChild as HTMLElement
    expect(el.style.wordBreak).toBe('break-word')
  })

  it('applies overflow: hidden to contain text within the element bounds', () => {
    const { container } = renderElement()
    const el = container.firstChild as HTMLElement
    expect(el.style.overflow).toBe('hidden')
  })

  it('uses a fixed height (not minHeight) so the resize handle fully controls height', () => {
    const { container } = renderElement({ height: 40 })
    const el = container.firstChild as HTMLElement
    // jsdom reports height from the style attribute, not computed layout
    expect(el.style.height).toBe('40px')
    expect(el.style.minHeight).toBe('')
  })
})
