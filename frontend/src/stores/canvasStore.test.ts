import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from './canvasStore'
import type { TextElement } from '../types/canvas'

const makeElement = (overrides: Partial<TextElement> = {}): TextElement => ({
  id: 'el-1',
  type: 'text',
  x: 560,
  y: 340,
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
  useCanvasStore.setState({
    elements: [],
    selectedIds: [],
    isDirty: false,
    designId: '',
    name: 'Untitled Design',
    zoom: 1,
    panX: 0,
    panY: 0,
  })
})

// AC 10 — no persistence: initial state is always empty
describe('initial state', () => {
  it('starts with no elements', () => {
    expect(useCanvasStore.getState().elements).toHaveLength(0)
  })

  it('starts with no selection', () => {
    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })

  it('starts clean (isDirty = false)', () => {
    expect(useCanvasStore.getState().isDirty).toBe(false)
  })
})

describe('addElement', () => {
  it('appends the element to the list', () => {
    useCanvasStore.getState().addElement(makeElement())
    expect(useCanvasStore.getState().elements).toHaveLength(1)
    expect(useCanvasStore.getState().elements[0].id).toBe('el-1')
  })

  it('marks the store as dirty', () => {
    useCanvasStore.getState().addElement(makeElement())
    expect(useCanvasStore.getState().isDirty).toBe(true)
  })

  it('can add multiple independent elements', () => {
    useCanvasStore.getState().addElement(makeElement({ id: 'a' }))
    useCanvasStore.getState().addElement(makeElement({ id: 'b' }))
    const elements = useCanvasStore.getState().elements
    expect(elements).toHaveLength(2)
    expect(elements[0].id).toBe('a')
    expect(elements[1].id).toBe('b')
  })
})

describe('updateElement', () => {
  it('patches the matching element', () => {
    useCanvasStore.getState().addElement(makeElement())
    useCanvasStore.getState().updateElement('el-1', { content: 'Updated' })
    expect((useCanvasStore.getState().elements[0] as TextElement).content).toBe('Updated')
  })

  it('does not affect other elements', () => {
    useCanvasStore.getState().addElement(makeElement({ id: 'a', content: 'A' }))
    useCanvasStore.getState().addElement(makeElement({ id: 'b', content: 'B' }))
    useCanvasStore.getState().updateElement('a', { content: 'A updated' })
    expect((useCanvasStore.getState().elements[1] as TextElement).content).toBe('B')
  })

  it('marks the store as dirty', () => {
    useCanvasStore.getState().addElement(makeElement())
    useCanvasStore.setState({ isDirty: false })
    useCanvasStore.getState().updateElement('el-1', { content: 'X' })
    expect(useCanvasStore.getState().isDirty).toBe(true)
  })

  it('is a no-op for unknown ids', () => {
    useCanvasStore.getState().addElement(makeElement())
    useCanvasStore.getState().updateElement('does-not-exist', { content: 'X' })
    expect((useCanvasStore.getState().elements[0] as TextElement).content).toBe('Hello')
  })
})

describe('removeElements', () => {
  it('removes the matching elements', () => {
    useCanvasStore.getState().addElement(makeElement({ id: 'a' }))
    useCanvasStore.getState().addElement(makeElement({ id: 'b' }))
    useCanvasStore.getState().removeElements(['a'])
    const elements = useCanvasStore.getState().elements
    expect(elements).toHaveLength(1)
    expect(elements[0].id).toBe('b')
  })

  it('also removes the ids from selectedIds', () => {
    useCanvasStore.getState().addElement(makeElement({ id: 'a' }))
    useCanvasStore.getState().selectElements(['a'])
    useCanvasStore.getState().removeElements(['a'])
    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })
})

describe('selectElements / clearSelection', () => {
  it('selectElements sets selectedIds', () => {
    useCanvasStore.getState().selectElements(['a', 'b'])
    expect(useCanvasStore.getState().selectedIds).toEqual(['a', 'b'])
  })

  it('clearSelection empties selectedIds', () => {
    useCanvasStore.getState().selectElements(['a'])
    useCanvasStore.getState().clearSelection()
    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// initDesign — resets store for a new design
// ---------------------------------------------------------------------------

describe('initDesign', () => {
  it('sets designId and name', () => {
    useCanvasStore.getState().initDesign('new-id', 'New Design')
    expect(useCanvasStore.getState().designId).toBe('new-id')
    expect(useCanvasStore.getState().name).toBe('New Design')
  })

  it('clears any existing elements', () => {
    useCanvasStore.getState().addElement(makeElement())
    useCanvasStore.getState().initDesign('new-id', 'New Design')
    expect(useCanvasStore.getState().elements).toHaveLength(0)
  })

  it('clears selection', () => {
    useCanvasStore.getState().selectElements(['el-1'])
    useCanvasStore.getState().initDesign('new-id', 'New Design')
    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })

  it('resets isDirty to false', () => {
    useCanvasStore.getState().addElement(makeElement())
    expect(useCanvasStore.getState().isDirty).toBe(true)
    useCanvasStore.getState().initDesign('new-id', 'New Design')
    expect(useCanvasStore.getState().isDirty).toBe(false)
  })

  it('resets zoom and pan to defaults', () => {
    useCanvasStore.setState({ zoom: 2, panX: 100, panY: 200 })
    useCanvasStore.getState().initDesign('new-id', 'New Design')
    const { zoom, panX, panY } = useCanvasStore.getState()
    expect(zoom).toBe(1)
    expect(panX).toBe(0)
    expect(panY).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// markSaved — clears isDirty after a successful auto-save
// ---------------------------------------------------------------------------

describe('markSaved', () => {
  it('sets isDirty to false', () => {
    useCanvasStore.getState().addElement(makeElement())
    expect(useCanvasStore.getState().isDirty).toBe(true)
    useCanvasStore.getState().markSaved()
    expect(useCanvasStore.getState().isDirty).toBe(false)
  })

  it('does not affect elements', () => {
    useCanvasStore.getState().addElement(makeElement())
    useCanvasStore.getState().markSaved()
    expect(useCanvasStore.getState().elements).toHaveLength(1)
  })

  it('does not affect selection', () => {
    useCanvasStore.getState().addElement(makeElement())
    useCanvasStore.getState().selectElements(['el-1'])
    useCanvasStore.getState().markSaved()
    expect(useCanvasStore.getState().selectedIds).toEqual(['el-1'])
  })

  it('is a no-op when already clean', () => {
    expect(useCanvasStore.getState().isDirty).toBe(false)
    useCanvasStore.getState().markSaved()
    expect(useCanvasStore.getState().isDirty).toBe(false)
  })
})
