import { createRef } from 'react'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DesignSurface } from './DesignSurface'
import { useCanvasStore } from '../../stores/canvasStore'

beforeEach(() => {
  useCanvasStore.setState({
    designId: '',
    name: 'Test',
    elements: [],
    selectedIds: [],
    zoom: 1,
    panX: 0,
    panY: 0,
    isDirty: false,
  })
})

// ---------------------------------------------------------------------------
// Forwarded ref — required by useThumbnail to capture the DOM node
// ---------------------------------------------------------------------------

describe('forwarded ref', () => {
  it('populates the ref with the root div on mount', () => {
    const ref = createRef<HTMLDivElement>()
    render(<DesignSurface ref={ref} />)
    expect(ref.current).not.toBeNull()
    expect(ref.current!.tagName).toBe('DIV')
  })

  it('ref.current is attached to the document', () => {
    const ref = createRef<HTMLDivElement>()
    render(<DesignSurface ref={ref} />)
    expect(ref.current).toBeInTheDocument()
  })

  it('ref is null when no ref is provided', () => {
    expect(() => render(<DesignSurface />)).not.toThrow()
  })
})
