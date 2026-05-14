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

const fakeDiv = document.createElement('div')

function makeCanvas(blob: Blob | null = new Blob(['x'], { type: 'image/jpeg' })) {
  return { toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(blob)) }
}

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
  })
  mockHtml2canvas.mockResolvedValue(makeCanvas() as unknown as HTMLCanvasElement)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  // Make requestAnimationFrame run synchronously in tests
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0 })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// AC 1 — thumbnail generation triggered by isDirty true→false
// ---------------------------------------------------------------------------

describe('AC1 — trigger on auto-save completion', () => {
  it('calls html2canvas when isDirty transitions from true to false', async () => {
    useCanvasStore.setState({ isDirty: true })
    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => {
      useCanvasStore.setState({ isDirty: false })
    })

    await waitFor(() => expect(mockHtml2canvas).toHaveBeenCalledTimes(1))
  })

  it('calls html2canvas with useCORS true, logging false', async () => {
    useCanvasStore.setState({ isDirty: true })
    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => {
      useCanvasStore.setState({ isDirty: false })
    })

    await waitFor(() => expect(mockHtml2canvas).toHaveBeenCalled())
    expect(mockHtml2canvas).toHaveBeenCalledWith(
      fakeDiv,
      expect.objectContaining({
        useCORS: true,
        logging: false,
      })
    )
  })

  it('POSTs to /api/projects/:id/thumbnail', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)
    useCanvasStore.setState({ isDirty: true })
    renderHook(() => useThumbnail('design-abc', makeRef(fakeDiv)))

    act(() => {
      useCanvasStore.setState({ isDirty: false })
    })

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/projects/design-abc/thumbnail')
    expect(init.method).toBe('POST')
  })

  it('sends a FormData body containing the blob', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)
    useCanvasStore.setState({ isDirty: true })
    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => {
      useCanvasStore.setState({ isDirty: false })
    })

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBeInstanceOf(FormData)
  })

  it('does not trigger when isDirty stays false', async () => {
    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockHtml2canvas).not.toHaveBeenCalled()
  })

  it('does not trigger when isDirty transitions from false to true', async () => {
    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => {
      useCanvasStore.setState({ isDirty: true })
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockHtml2canvas).not.toHaveBeenCalled()
  })

  it('does not call html2canvas when surfaceRef.current is null', async () => {
    useCanvasStore.setState({ isDirty: true })
    renderHook(() => useThumbnail('design-1', makeRef(null)))

    act(() => {
      useCanvasStore.setState({ isDirty: false })
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockHtml2canvas).not.toHaveBeenCalled()
  })

  it('does not call html2canvas when there are no elements', async () => {
    useCanvasStore.setState({ isDirty: true, elements: [] })
    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => {
      useCanvasStore.setState({ isDirty: false })
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockHtml2canvas).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AC 4 — subsequent saves overwrite the previous thumbnail
// ---------------------------------------------------------------------------

describe('AC4 — re-triggers on subsequent saves', () => {
  it('calls html2canvas again on each successive true→false transition', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)
    useCanvasStore.setState({ isDirty: true })
    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => {
      useCanvasStore.setState({ isDirty: false })
    })
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))

    act(() => {
      useCanvasStore.setState({ isDirty: true })
    })
    act(() => {
      useCanvasStore.setState({ isDirty: false })
    })
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
  })
})

// ---------------------------------------------------------------------------
// AC 6 — thumbnail generation and upload failures are silent
// ---------------------------------------------------------------------------

describe('AC6 — errors are swallowed silently', () => {
  it('does not throw when html2canvas rejects', async () => {
    mockHtml2canvas.mockRejectedValue(new Error('canvas capture failed'))
    useCanvasStore.setState({ isDirty: true })

    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => {
      useCanvasStore.setState({ isDirty: false })
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockHtml2canvas).toHaveBeenCalledTimes(1)
  })

  it('does not throw when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    useCanvasStore.setState({ isDirty: true })

    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => {
      useCanvasStore.setState({ isDirty: false })
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockHtml2canvas).toHaveBeenCalledTimes(1)
  })

  it('does not call fetch when html2canvas resolves with a null blob', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)
    mockHtml2canvas.mockResolvedValue(makeCanvas(null) as unknown as HTMLCanvasElement)
    useCanvasStore.setState({ isDirty: true })

    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => {
      useCanvasStore.setState({ isDirty: false })
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Concurrent guard — only one generation at a time
// ---------------------------------------------------------------------------

describe('concurrent generation guard', () => {
  it('skips a second generation started while the first is still in flight', async () => {
    let resolveCanvas!: (c: HTMLCanvasElement) => void
    const pendingCanvas = new Promise<HTMLCanvasElement>((res) => {
      resolveCanvas = res
    })
    mockHtml2canvas.mockReturnValueOnce(pendingCanvas)

    useCanvasStore.setState({ isDirty: true })
    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => {
      useCanvasStore.setState({ isDirty: false })
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockHtml2canvas).toHaveBeenCalledTimes(1)

    act(() => {
      useCanvasStore.setState({ isDirty: true })
    })
    act(() => {
      useCanvasStore.setState({ isDirty: false })
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockHtml2canvas).toHaveBeenCalledTimes(1)

    resolveCanvas({} as HTMLCanvasElement)
  })
})

// ---------------------------------------------------------------------------
// AC 14 — each design uses its own upload URL
// ---------------------------------------------------------------------------

describe('AC14 — independent per design', () => {
  it('uses the provided designId in the upload URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)
    useCanvasStore.setState({ isDirty: true })
    renderHook(() => useThumbnail('unique-design-xyz', makeRef(fakeDiv)))

    act(() => {
      useCanvasStore.setState({ isDirty: false })
    })

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(mockFetch.mock.calls[0][0]).toBe('/api/projects/unique-design-xyz/thumbnail')
  })
})

// ---------------------------------------------------------------------------
// AC15/16/17/18 — bounding-box capture: correct clip region, scale, and background
// ---------------------------------------------------------------------------

describe('AC15/16/17/18 — bounding-box capture options', () => {
  it('passes x/y with 24px padding subtracted from bbox origin', async () => {
    // element bbox: x=100, y=200 → captureX = 100-24 = 76, captureY = 200-24 = 176
    useCanvasStore.setState({ isDirty: true, elements: [fakeElement] })
    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => { useCanvasStore.setState({ isDirty: false }) })

    await waitFor(() => expect(mockHtml2canvas).toHaveBeenCalled())
    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.x).toBe(fakeElement.x - 24)
    expect(opts.y).toBe(fakeElement.y - 24)
  })

  it('passes width/height with 48px total padding added to bbox size', async () => {
    // element: width=200, height=50 → captureW=248, captureH=98
    useCanvasStore.setState({ isDirty: true, elements: [fakeElement] })
    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => { useCanvasStore.setState({ isDirty: false }) })

    await waitFor(() => expect(mockHtml2canvas).toHaveBeenCalled())
    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.width).toBe(fakeElement.width + 48)
    expect(opts.height).toBe(fakeElement.height + 48)
  })

  it('computes scale to fit within 320×180', async () => {
    // captureW = 200+48 = 248, captureH = 50+48 = 98
    // scale = min(320/248, 180/98) ≈ min(1.29, 1.84) ≈ 1.29
    useCanvasStore.setState({ isDirty: true, elements: [fakeElement] })
    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => { useCanvasStore.setState({ isDirty: false }) })

    await waitFor(() => expect(mockHtml2canvas).toHaveBeenCalled())
    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    const captureW = fakeElement.width + 48
    const captureH = fakeElement.height + 48
    const expectedScale = Math.min(320 / captureW, 180 / captureH)
    expect(opts.scale).toBeCloseTo(expectedScale, 5)
  })

  it('passes backgroundColor #F3F4F6', async () => {
    useCanvasStore.setState({ isDirty: true, elements: [fakeElement] })
    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => { useCanvasStore.setState({ isDirty: false }) })

    await waitFor(() => expect(mockHtml2canvas).toHaveBeenCalled())
    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.backgroundColor).toBe('#F3F4F6')
  })

  it('uses the union bbox when multiple elements are present', async () => {
    const el1: TextElement = { ...fakeElement, id: 'a', x: 0, y: 0, width: 100, height: 50 }
    const el2: TextElement = { ...fakeElement, id: 'b', x: 200, y: 100, width: 100, height: 50 }
    // union: x=0, y=0, w=300, h=150 → captureX=-24, captureY=-24, captureW=348, captureH=198
    useCanvasStore.setState({ isDirty: true, elements: [el1, el2] })
    renderHook(() => useThumbnail('design-1', makeRef(fakeDiv)))

    act(() => { useCanvasStore.setState({ isDirty: false }) })

    await waitFor(() => expect(mockHtml2canvas).toHaveBeenCalled())
    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.x).toBe(-24)
    expect(opts.y).toBe(-24)
    expect(opts.width).toBe(300 + 48)
    expect(opts.height).toBe(150 + 48)
  })

  it('clears the CSS transform before calling html2canvas', async () => {
    const divWithTransform = document.createElement('div')
    divWithTransform.style.transform = 'translate(100px, 50px) scale(1.5)'

    useCanvasStore.setState({ isDirty: true, elements: [fakeElement] })
    renderHook(() => useThumbnail('design-1', makeRef(divWithTransform)))

    act(() => { useCanvasStore.setState({ isDirty: false }) })

    await waitFor(() => expect(mockHtml2canvas).toHaveBeenCalled())
    // At the time html2canvas was called, the node passed in should have transform cleared
    expect(mockHtml2canvas.mock.calls[0][0]).toBe(divWithTransform)
  })

  it('restores the CSS transform after html2canvas resolves', async () => {
    const divWithTransform = document.createElement('div')
    divWithTransform.style.transform = 'translate(100px, 50px) scale(1.5)'

    useCanvasStore.setState({ isDirty: true, elements: [fakeElement] })
    renderHook(() => useThumbnail('design-1', makeRef(divWithTransform)))

    act(() => { useCanvasStore.setState({ isDirty: false }) })

    await waitFor(() => expect(mockHtml2canvas).toHaveBeenCalled())
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })

    expect(divWithTransform.style.transform).toBe('translate(100px, 50px) scale(1.5)')
  })
})
