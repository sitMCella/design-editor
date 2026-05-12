import { beforeEach, describe, expect, it } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Canvas } from './Canvas'
import { useCanvasStore } from '../../stores/canvasStore'
import type { TextElement, ImageElement, ArrowElement } from '../../types/canvas'

const makeTextElement = (id: string): TextElement => ({
  id,
  type: 'text',
  x: 100,
  y: 100,
  width: 160,
  height: 40,
  rotation: 0,
  opacity: 1,
  locked: false,
  content: 'Some text',
  fontSize: 16,
  fontFamily: 'Inter, sans-serif',
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#111827',
  align: 'left',
})

const makeImageElement = (id: string): ImageElement => ({
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
})

const makeArrowElement = (id: string): ArrowElement => ({
  id,
  type: 'arrow',
  x1: 540,
  y1: 360,
  x2: 740,
  y2: 360,
  x: 539,
  y: 359,
  width: 202,
  height: 2,
  rotation: 0,
  opacity: 1,
  locked: false,
  stroke: '#111827',
  strokeWidth: 2,
  arrowHead: 'end',
})

// keep old name as alias so existing tests compile unchanged
const makeElement = makeTextElement

beforeEach(() => {
  useCanvasStore.setState({ elements: [], selectedIds: [], isDirty: false })
})

// AC 6 — clicking the canvas background deselects all elements
describe('background click deselection', () => {
  it('clears selectedIds when the canvas background is clicked', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1')],
      selectedIds: ['el-1'],
    })

    const { container } = render(<Canvas />)
    // Click the outermost canvas div (the grey viewport, not an element)
    fireEvent.click(container.firstChild as HTMLElement)

    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })

  it('leaves elements in the store after deselection', () => {
    useCanvasStore.setState({
      elements: [makeElement('el-1')],
      selectedIds: ['el-1'],
    })

    const { container } = render(<Canvas />)
    fireEvent.click(container.firstChild as HTMLElement)

    expect(useCanvasStore.getState().elements).toHaveLength(1)
  })

  it('is a no-op when nothing is selected', () => {
    const { container } = render(<Canvas />)
    fireEvent.click(container.firstChild as HTMLElement)
    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })
})

// AC 5 (03-image-element) — clicking the canvas background deselects an image element
describe('background click deselects image element', () => {
  it('clears selectedIds when a selected image element is deselected via canvas click', () => {
    useCanvasStore.setState({
      elements: [makeImageElement('img-1')],
      selectedIds: ['img-1'],
    })

    const { container } = render(<Canvas />)
    fireEvent.click(container.firstChild as HTMLElement)

    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })

  it('leaves the image element in the store after deselection', () => {
    useCanvasStore.setState({
      elements: [makeImageElement('img-1')],
      selectedIds: ['img-1'],
    })

    const { container } = render(<Canvas />)
    fireEvent.click(container.firstChild as HTMLElement)

    expect(useCanvasStore.getState().elements).toHaveLength(1)
    expect(useCanvasStore.getState().elements[0].type).toBe('image')
  })
})

// AC 6 (08-toolbar-arrow-element) — clicking the canvas background deselects an arrow element
describe('background click deselects arrow element', () => {
  it('clears selectedIds when a selected arrow element is deselected via canvas click', () => {
    useCanvasStore.setState({
      elements: [makeArrowElement('arrow-1')],
      selectedIds: ['arrow-1'],
    })

    const { container } = render(<Canvas />)
    fireEvent.click(container.firstChild as HTMLElement)

    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })

  it('leaves the arrow element in the store after deselection', () => {
    useCanvasStore.setState({
      elements: [makeArrowElement('arrow-1')],
      selectedIds: ['arrow-1'],
    })

    const { container } = render(<Canvas />)
    fireEvent.click(container.firstChild as HTMLElement)

    expect(useCanvasStore.getState().elements).toHaveLength(1)
    expect(useCanvasStore.getState().elements[0].type).toBe('arrow')
  })
})
