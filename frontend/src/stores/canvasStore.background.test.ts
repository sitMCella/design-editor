// Spec 20 — Canvas Background Colour: canvas store unit tests
// Covers: AC10, AC11 (isDirty), AC12, AC13, AC18

import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from './canvasStore'

beforeEach(() => {
  useCanvasStore.setState({
    designId: '',
    name: '',
    elements: [],
    selectedIds: [],
    zoom: 1,
    panX: 0,
    panY: 0,
    isDirty: false,
    backgroundColor: '#F3F4F6',
  })
})

// ---------------------------------------------------------------------------
// setBackgroundColor — AC10
// ---------------------------------------------------------------------------

describe('setBackgroundColor (AC10)', () => {
  it('updates backgroundColor to the given hex value', () => {
    useCanvasStore.getState().setBackgroundColor('#111827')
    expect(useCanvasStore.getState().backgroundColor).toBe('#111827')
  })

  it('sets isDirty to true', () => {
    useCanvasStore.getState().setBackgroundColor('#111827')
    expect(useCanvasStore.getState().isDirty).toBe(true)
  })

  it('accepts "transparent" as a valid value', () => {
    useCanvasStore.getState().setBackgroundColor('transparent')
    expect(useCanvasStore.getState().backgroundColor).toBe('transparent')
  })

  it('sets isDirty even when setting transparent', () => {
    useCanvasStore.getState().setBackgroundColor('transparent')
    expect(useCanvasStore.getState().isDirty).toBe(true)
  })

  it('accepts white (#FFFFFF)', () => {
    useCanvasStore.getState().setBackgroundColor('#FFFFFF')
    expect(useCanvasStore.getState().backgroundColor).toBe('#FFFFFF')
  })

  it('does not affect elements', () => {
    useCanvasStore.getState().setBackgroundColor('#111827')
    expect(useCanvasStore.getState().elements).toHaveLength(0)
  })

  it('does not affect selection', () => {
    useCanvasStore.getState().setBackgroundColor('#111827')
    expect(useCanvasStore.getState().selectedIds).toHaveLength(0)
  })

  it('successive calls update to the latest value', () => {
    useCanvasStore.getState().setBackgroundColor('#FFFFFF')
    useCanvasStore.getState().setBackgroundColor('#BAE6FD')
    expect(useCanvasStore.getState().backgroundColor).toBe('#BAE6FD')
  })
})

// ---------------------------------------------------------------------------
// initDesign — resets backgroundColor to default — AC18
// ---------------------------------------------------------------------------

describe('initDesign resets backgroundColor (AC18)', () => {
  it('resets backgroundColor to #F3F4F6 regardless of the previous value', () => {
    useCanvasStore.setState({ backgroundColor: '#FF0000' })
    useCanvasStore.getState().initDesign('new-id', 'New Design')
    expect(useCanvasStore.getState().backgroundColor).toBe('#F3F4F6')
  })

  it('resets a transparent background to #F3F4F6', () => {
    useCanvasStore.setState({ backgroundColor: 'transparent' })
    useCanvasStore.getState().initDesign('new-id', 'New Design')
    expect(useCanvasStore.getState().backgroundColor).toBe('#F3F4F6')
  })

  it('keeps backgroundColor at #F3F4F6 if it was already the default', () => {
    useCanvasStore.getState().initDesign('new-id', 'New Design')
    expect(useCanvasStore.getState().backgroundColor).toBe('#F3F4F6')
  })
})

// ---------------------------------------------------------------------------
// loadDesign — restores saved backgroundColor — AC12 & AC13
// ---------------------------------------------------------------------------

describe('loadDesign restores backgroundColor (AC12)', () => {
  it('AC12: restores a persisted hex backgroundColor', () => {
    useCanvasStore.getState().loadDesign('id', 'Name', [], '#BAE6FD')
    expect(useCanvasStore.getState().backgroundColor).toBe('#BAE6FD')
  })

  it('AC12: restores a persisted transparent backgroundColor', () => {
    useCanvasStore.getState().loadDesign('id', 'Name', [], 'transparent')
    expect(useCanvasStore.getState().backgroundColor).toBe('transparent')
  })

  it('AC12: restores black (#111827)', () => {
    useCanvasStore.getState().loadDesign('id', 'Name', [], '#111827')
    expect(useCanvasStore.getState().backgroundColor).toBe('#111827')
  })

  it('AC12: sets isDirty to false after loading', () => {
    useCanvasStore.setState({ isDirty: true })
    useCanvasStore.getState().loadDesign('id', 'Name', [], '#BAE6FD')
    expect(useCanvasStore.getState().isDirty).toBe(false)
  })
})

describe('loadDesign falls back to default for old designs (AC13)', () => {
  it('AC13: uses #F3F4F6 when backgroundColor is undefined', () => {
    useCanvasStore.getState().loadDesign('id', 'Name', [], undefined)
    expect(useCanvasStore.getState().backgroundColor).toBe('#F3F4F6')
  })

  it('AC13: uses #F3F4F6 when no backgroundColor argument is passed', () => {
    useCanvasStore.getState().loadDesign('id', 'Name', [])
    expect(useCanvasStore.getState().backgroundColor).toBe('#F3F4F6')
  })
})

// ---------------------------------------------------------------------------
// Multiple designs maintain independent backgroundColor — AC18
// ---------------------------------------------------------------------------

describe('multiple designs are independent (AC18)', () => {
  it('reinitializing with initDesign resets backgroundColor to the default', () => {
    useCanvasStore.getState().initDesign('design-a', 'A')
    useCanvasStore.getState().setBackgroundColor('#FF0000')
    expect(useCanvasStore.getState().backgroundColor).toBe('#FF0000')

    useCanvasStore.getState().initDesign('design-b', 'B')
    expect(useCanvasStore.getState().backgroundColor).toBe('#F3F4F6')
  })

  it("loadDesign replaces the backgroundColor with the new design's value", () => {
    useCanvasStore.getState().loadDesign('design-a', 'A', [], '#FF0000')
    expect(useCanvasStore.getState().backgroundColor).toBe('#FF0000')

    useCanvasStore.getState().loadDesign('design-b', 'B', [], '#00FF00')
    expect(useCanvasStore.getState().backgroundColor).toBe('#00FF00')
  })

  it("loading a design with no backgroundColor does not inherit the previous design's colour", () => {
    useCanvasStore.getState().loadDesign('design-a', 'A', [], '#FF0000')
    useCanvasStore.getState().loadDesign('design-b', 'B', [], undefined)
    expect(useCanvasStore.getState().backgroundColor).toBe('#F3F4F6')
  })
})
