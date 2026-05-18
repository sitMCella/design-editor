// Spec 20 — Canvas Background Colour: useThumbnail background option tests
// Covers: AC14 — thumbnail always uses a solid background (transparent → #F3F4F6)

import { renderHook, act, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RefObject } from 'react'
import { useThumbnail } from './useThumbnail'
import { useCanvasStore } from '../stores/canvasStore'
import html2canvas from 'html2canvas'
import type { TextElement } from '../types/canvas'

vi.mock('html2canvas', () => ({ default: vi.fn() }))

const mockHtml2canvas = vi.mocked(html2canvas)

function makeRef(el: HTMLDivElement | null): RefObject<HTMLDivElement | null> {
  return { current: el }
}

// useThumbnail reads worldRef.current.parentElement for the world-layer transform.
const fakeParent = document.createElement('div')
const fakeDiv = document.createElement('div')
fakeParent.appendChild(fakeDiv)

const fakeElement: TextElement = {
  id: 'el-1',
  type: 'text',
  x: 100,
  y: 100,
  width: 200,
  height: 50,
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
}

beforeEach(() => {
  useCanvasStore.setState({
    designId: '',
    name: 'Test',
    elements: [fakeElement],
    selectedIds: [],
    zoom: 1,
    panX: 0,
    panY: 0,
    isDirty: false,
    backgroundColor: '#F3F4F6',
  })

  mockHtml2canvas.mockResolvedValue({
    toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(new Blob(['x'], { type: 'image/jpeg' }))),
  } as unknown as HTMLCanvasElement)

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) {
    cb(new Blob(['x'], { type: 'image/jpeg' }))
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// AC14 — thumbnail always uses a solid background colour
// ---------------------------------------------------------------------------

describe('AC14 — thumbnail uses solid background regardless of canvas setting', () => {
  it('passes the canvas backgroundColor when it is a solid hex colour', async () => {
    useCanvasStore.setState({ isDirty: true, backgroundColor: '#BAE6FD' })
    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => {
      useCanvasStore.setState({ isDirty: false })
    })

    await waitFor(() => expect(mockHtml2canvas).toHaveBeenCalled())
    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.backgroundColor).toBe('#BAE6FD')
  })

  it('passes #F3F4F6 when backgroundColor is "transparent" (never transparent thumbnail)', async () => {
    useCanvasStore.setState({ isDirty: true, backgroundColor: 'transparent' })
    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => {
      useCanvasStore.setState({ isDirty: false })
    })

    await waitFor(() => expect(mockHtml2canvas).toHaveBeenCalled())
    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.backgroundColor).toBe('#F3F4F6')
  })

  it('does NOT pass null for a transparent canvas (thumbnail must be opaque)', async () => {
    useCanvasStore.setState({ isDirty: true, backgroundColor: 'transparent' })
    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => {
      useCanvasStore.setState({ isDirty: false })
    })

    await waitFor(() => expect(mockHtml2canvas).toHaveBeenCalled())
    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.backgroundColor).not.toBeNull()
  })

  it('passes the default grey (#F3F4F6) when backgroundColor is the default', async () => {
    useCanvasStore.setState({ isDirty: true, backgroundColor: '#F3F4F6' })
    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => {
      useCanvasStore.setState({ isDirty: false })
    })

    await waitFor(() => expect(mockHtml2canvas).toHaveBeenCalled())
    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.backgroundColor).toBe('#F3F4F6')
  })

  it('passes black (#111827) when the canvas background is black', async () => {
    useCanvasStore.setState({ isDirty: true, backgroundColor: '#111827' })
    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => {
      useCanvasStore.setState({ isDirty: false })
    })

    await waitFor(() => expect(mockHtml2canvas).toHaveBeenCalled())
    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.backgroundColor).toBe('#111827')
  })

  it('passes white (#FFFFFF) when the canvas background is white', async () => {
    useCanvasStore.setState({ isDirty: true, backgroundColor: '#FFFFFF' })
    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => {
      useCanvasStore.setState({ isDirty: false })
    })

    await waitFor(() => expect(mockHtml2canvas).toHaveBeenCalled())
    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.backgroundColor).toBe('#FFFFFF')
  })
})
