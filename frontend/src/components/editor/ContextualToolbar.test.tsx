import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContextualToolbar } from './ContextualToolbar'
import { useCanvasStore } from '../../stores/canvasStore'
import type {
  TextElement,
  ImageElement as ImageElementType,
  CanvasElement,
} from '../../types/canvas'

const asText = (el: CanvasElement) => el as TextElement
const asImage = (el: CanvasElement) => el as ImageElementType

const makeElement = (id: string, overrides: Partial<TextElement> = {}): TextElement => ({
  id,
  type: 'text',
  x: 100,
  y: 100,
  width: 160,
  height: 40,
  rotation: 0,
  opacity: 1,
  locked: false,
  content: 'Hello',
  fontSize: 16,
  fontFamily: 'Inter, sans-serif',
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#111827',
  align: 'left',
  ...overrides,
})

beforeEach(() => {
  useCanvasStore.setState({ elements: [], selectedIds: [], isDirty: false })
})

// AC 4 — toolbar hidden with no selection, visible when an element is selected
describe('AC4: toolbar visibility', () => {
  it('renders nothing when no element is selected', () => {
    useCanvasStore.setState({ elements: [makeElement('el-1')], selectedIds: [] })
    const { container } = render(<ContextualToolbar />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the toolbar when an element is selected', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1')],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    expect(screen.getByTestId('contextual-toolbar')).toBeInTheDocument()
  })
})

// AC 5 — changing font family updates the element immediately
describe('AC5: font family', () => {
  it('calls updateElement with the new fontFamily when the select changes', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1')],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    fireEvent.change(screen.getByLabelText('Font family'), {
      target: { value: 'Georgia, serif' },
    })
    expect(asText(useCanvasStore.getState().elements[0]).fontFamily).toBe('Georgia, serif')
  })

  it('reflects the current fontFamily in the select', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { fontFamily: 'Arial, sans-serif' })],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    const select = screen.getByLabelText('Font family') as HTMLSelectElement
    expect(select.value).toBe('Arial, sans-serif')
  })
})

// AC 6 — changing font size via input or ± buttons updates immediately
describe('AC6: font size', () => {
  it('calls updateElement with new fontSize when the input changes', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { fontSize: 16 })],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    fireEvent.change(screen.getByLabelText('Font size'), { target: { value: '24' } })
    expect(asText(useCanvasStore.getState().elements[0]).fontSize).toBe(24)
  })

  it('increments fontSize by 1 when + is clicked', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { fontSize: 16 })],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    fireEvent.click(screen.getByLabelText('Increase font size'))
    expect(asText(useCanvasStore.getState().elements[0]).fontSize).toBe(17)
  })

  it('decrements fontSize by 1 when − is clicked', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { fontSize: 16 })],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    fireEvent.click(screen.getByLabelText('Decrease font size'))
    expect(asText(useCanvasStore.getState().elements[0]).fontSize).toBe(15)
  })

  it('does not go below the minimum font size of 8', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { fontSize: 8 })],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    fireEvent.click(screen.getByLabelText('Decrease font size'))
    expect(asText(useCanvasStore.getState().elements[0]).fontSize).toBe(8)
  })

  it('does not exceed the maximum font size of 200', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { fontSize: 200 })],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    fireEvent.click(screen.getByLabelText('Increase font size'))
    expect(asText(useCanvasStore.getState().elements[0]).fontSize).toBe(200)
  })
})

// AC 7 — Bold button toggles fontWeight; appears active when bold
describe('AC7: bold toggle', () => {
  it('sets fontWeight to bold when clicked in normal state', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { fontWeight: 'normal' })],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    fireEvent.click(screen.getByLabelText('Bold'))
    expect(asText(useCanvasStore.getState().elements[0]).fontWeight).toBe('bold')
  })

  it('sets fontWeight back to normal when clicked in bold state', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { fontWeight: 'bold' })],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    fireEvent.click(screen.getByLabelText('Bold'))
    expect(asText(useCanvasStore.getState().elements[0]).fontWeight).toBe('normal')
  })

  it('marks the Bold button as pressed when fontWeight is bold', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { fontWeight: 'bold' })],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    expect(screen.getByLabelText('Bold')).toHaveAttribute('aria-pressed', 'true')
  })

  it('marks the Bold button as not pressed when fontWeight is normal', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { fontWeight: 'normal' })],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    expect(screen.getByLabelText('Bold')).toHaveAttribute('aria-pressed', 'false')
  })
})

// AC 8 — Italic button toggles fontStyle; appears active when italic
describe('AC8: italic toggle', () => {
  it('sets fontStyle to italic when clicked in normal state', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { fontStyle: 'normal' })],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    fireEvent.click(screen.getByLabelText('Italic'))
    expect(asText(useCanvasStore.getState().elements[0]).fontStyle).toBe('italic')
  })

  it('sets fontStyle back to normal when clicked in italic state', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { fontStyle: 'italic' })],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    fireEvent.click(screen.getByLabelText('Italic'))
    expect(asText(useCanvasStore.getState().elements[0]).fontStyle).toBe('normal')
  })

  it('marks the Italic button as pressed when fontStyle is italic', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { fontStyle: 'italic' })],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    expect(screen.getByLabelText('Italic')).toHaveAttribute('aria-pressed', 'true')
  })

  it('marks the Italic button as not pressed when fontStyle is normal', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { fontStyle: 'normal' })],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    expect(screen.getByLabelText('Italic')).toHaveAttribute('aria-pressed', 'false')
  })
})

// AC 9 — colour picker updates text colour immediately
describe('AC9: colour picker', () => {
  it('calls updateElement with the new color when the picker changes', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { color: '#111827' })],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    fireEvent.change(screen.getByLabelText('Text color'), { target: { value: '#ff0000' } })
    expect(asText(useCanvasStore.getState().elements[0]).color).toBe('#ff0000')
  })

  it('reflects the current color value in the picker', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { color: '#3b82f6' })],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    const input = screen.getByLabelText('Text color') as HTMLInputElement
    expect(input.value).toBe('#3b82f6')
  })
})

// AC 10 — alignment buttons update align; active button is highlighted
describe('AC10: alignment', () => {
  it('sets align to center when the center button is clicked', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { align: 'left' })],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    fireEvent.click(screen.getByLabelText('Align center'))
    expect(asText(useCanvasStore.getState().elements[0]).align).toBe('center')
  })

  it('sets align to right when the right button is clicked', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { align: 'left' })],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    fireEvent.click(screen.getByLabelText('Align right'))
    expect(asText(useCanvasStore.getState().elements[0]).align).toBe('right')
  })

  it('sets align to left when the left button is clicked', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { align: 'center' })],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    fireEvent.click(screen.getByLabelText('Align left'))
    expect(asText(useCanvasStore.getState().elements[0]).align).toBe('left')
  })

  it('marks the active alignment button as pressed', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { align: 'center' })],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    expect(screen.getByLabelText('Align center')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Align left')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText('Align right')).toHaveAttribute('aria-pressed', 'false')
  })
})

// AC 12 — multiple elements retain their individual formatting independently
describe('AC12: independent element formatting', () => {
  it('updating one element does not affect another', () => {
    useCanvasStore.setState({
      elements: [
        makeElement('el-1', { fontFamily: 'Inter, sans-serif' }),
        makeElement('el-2', { fontFamily: 'Arial, sans-serif' }),
      ],
      selectedIds: ['el-1'],
    })
    render(<ContextualToolbar />)
    fireEvent.change(screen.getByLabelText('Font family'), {
      target: { value: 'Georgia, serif' },
    })
    const elements = useCanvasStore.getState().elements
    expect(asText(elements.find((e) => e.id === 'el-1')!).fontFamily).toBe('Georgia, serif')
    expect(asText(elements.find((e) => e.id === 'el-2')!).fontFamily).toBe('Arial, sans-serif')
  })

  it('toolbar shows the properties of the selected element, not another', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1', { fontSize: 24 }), makeElement('el-2', { fontSize: 48 })],
      selectedIds: ['el-2'],
    })
    render(<ContextualToolbar />)
    const input = screen.getByLabelText('Font size') as HTMLInputElement
    expect(input.value).toBe('48')
  })
})

// ---------------------------------------------------------------------------
// Image element — helpers
// ---------------------------------------------------------------------------

const makeImageElement = (
  id: string,
  overrides: Partial<ImageElementType> = {}
): ImageElementType => ({
  id,
  type: 'image',
  x: 480,
  y: 240,
  width: 320,
  height: 240,
  rotation: 0,
  opacity: 1,
  locked: false,
  src: '',
  objectFit: 'cover',
  objectPosition: '50% 50%',
  ...overrides,
})

// ---------------------------------------------------------------------------
// AC 5 — image controls visible when image selected; hidden when nothing selected
// ---------------------------------------------------------------------------

describe('AC5: image toolbar visibility', () => {
  it('renders image controls when an image element is selected', () => {
    useCanvasStore.setState({
      elements: [makeImageElement('img-1')],
      selectedIds: ['img-1'],
    })
    render(<ContextualToolbar />)
    expect(screen.getByLabelText('Image URL')).toBeInTheDocument()
    expect(screen.getByLabelText('Upload image')).toBeInTheDocument()
    expect(screen.getByLabelText('Object fit')).toBeInTheDocument()
  })

  it('renders nothing when an image element exists but nothing is selected', () => {
    useCanvasStore.setState({
      elements: [makeImageElement('img-1')],
      selectedIds: [],
    })
    const { container } = render(<ContextualToolbar />)
    expect(container.firstChild).toBeNull()
  })

  it('pre-populates the URL input with the element src', () => {
    useCanvasStore.setState({
      elements: [makeImageElement('img-1', { src: 'https://example.com/photo.jpg' })],
      selectedIds: ['img-1'],
    })
    render(<ContextualToolbar />)
    const input = screen.getByLabelText('Image URL') as HTMLInputElement
    expect(input.value).toBe('https://example.com/photo.jpg')
  })

  it('shows "Uploaded file" label and makes the URL input read-only for data: URLs', () => {
    useCanvasStore.setState({
      elements: [makeImageElement('img-1', { src: 'data:image/jpeg;base64,abc' })],
      selectedIds: ['img-1'],
    })
    render(<ContextualToolbar />)
    expect(screen.getByText('Uploaded file')).toBeInTheDocument()
    expect((screen.getByLabelText('Image URL') as HTMLInputElement).readOnly).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AC 6 — entering a URL and pressing Enter or blurring updates src immediately
// ---------------------------------------------------------------------------

describe('AC6: URL input', () => {
  it('updates src when Enter is pressed', () => {
    useCanvasStore.setState({
      elements: [makeImageElement('img-1', { src: '' })],
      selectedIds: ['img-1'],
    })
    render(<ContextualToolbar />)
    const input = screen.getByLabelText('Image URL')
    fireEvent.change(input, { target: { value: 'https://example.com/photo.jpg' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(asImage(useCanvasStore.getState().elements[0]).src).toBe('https://example.com/photo.jpg')
  })

  it('updates src when the input blurs', () => {
    useCanvasStore.setState({
      elements: [makeImageElement('img-1', { src: '' })],
      selectedIds: ['img-1'],
    })
    render(<ContextualToolbar />)
    const input = screen.getByLabelText('Image URL')
    fireEvent.change(input, { target: { value: 'https://example.com/photo.jpg' } })
    fireEvent.blur(input)
    expect(asImage(useCanvasStore.getState().elements[0]).src).toBe('https://example.com/photo.jpg')
  })

  it('does not call update when the value has not changed from the current src', () => {
    const url = 'https://example.com/photo.jpg'
    useCanvasStore.setState({
      elements: [makeImageElement('img-1', { src: url })],
      selectedIds: ['img-1'],
    })
    render(<ContextualToolbar />)
    const input = screen.getByLabelText('Image URL')
    // No change event — blur with the existing value
    fireEvent.blur(input)
    // isDirty should remain false since nothing changed
    expect(useCanvasStore.getState().isDirty).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// AC 7 — clicking Upload and selecting a file updates src with a data URL
// ---------------------------------------------------------------------------

describe('AC7: file upload', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads the selected file as a data URL and updates src', () => {
    useCanvasStore.setState({
      elements: [makeImageElement('img-1', { src: '' })],
      selectedIds: ['img-1'],
    })
    render(<ContextualToolbar />)

    const dataUrl = 'data:image/jpeg;base64,abc123'
    class MockFileReader {
      result = dataUrl
      onload: (() => void) | null = null
      readAsDataURL() {
        this.onload?.()
      }
    }
    vi.stubGlobal('FileReader', MockFileReader)

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('File picker'), { target: { files: [file] } })

    expect(asImage(useCanvasStore.getState().elements[0]).src).toBe(dataUrl)
  })
})

// ---------------------------------------------------------------------------
// AC 8 — changing the object-fit selector updates the element immediately
// ---------------------------------------------------------------------------

describe('AC8: object-fit selector', () => {
  it('updates objectFit when the selector changes', () => {
    useCanvasStore.setState({
      elements: [makeImageElement('img-1', { objectFit: 'cover' })],
      selectedIds: ['img-1'],
    })
    render(<ContextualToolbar />)
    fireEvent.change(screen.getByLabelText('Object fit'), { target: { value: 'contain' } })
    expect(asImage(useCanvasStore.getState().elements[0]).objectFit).toBe('contain')
  })

  it('reflects the current objectFit in the selector', () => {
    useCanvasStore.setState({
      elements: [makeImageElement('img-1', { objectFit: 'fill' })],
      selectedIds: ['img-1'],
    })
    render(<ContextualToolbar />)
    const select = screen.getByLabelText('Object fit') as HTMLSelectElement
    expect(select.value).toBe('fill')
  })
})

// ---------------------------------------------------------------------------
// AC 12 — customisations persist for the lifetime of the session
// ---------------------------------------------------------------------------

describe('AC12: session persistence', () => {
  it('image customisations remain in the store after the toolbar unmounts', () => {
    useCanvasStore.setState({
      elements: [makeImageElement('img-1', { objectFit: 'cover' })],
      selectedIds: ['img-1'],
    })
    const { unmount } = render(<ContextualToolbar />)
    fireEvent.change(screen.getByLabelText('Object fit'), { target: { value: 'fill' } })
    unmount()
    expect(asImage(useCanvasStore.getState().elements[0]).objectFit).toBe('fill')
  })
})
