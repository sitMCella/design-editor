import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import html2canvas from 'html2canvas'
import { toFilename, downloadPng } from './downloadPng'
import type { TextElement } from '../types/canvas'

vi.mock('html2canvas', () => ({
  default: vi.fn(),
}))

const mockHtml2canvas = vi.mocked(html2canvas)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeText = (overrides: Partial<TextElement> = {}): TextElement => ({
  id: 't1',
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

// Creates a minimal world DOM: worldLayer (parent with transform) > surfaceNode (worldRef target).
// Both nodes are attached to document.body so parentElement is non-null.
function makeWorldDom() {
  const worldLayer = document.createElement('div')
  const surfaceNode = document.createElement('div')
  worldLayer.appendChild(surfaceNode)
  document.body.appendChild(worldLayer)
  const worldRef = { current: surfaceNode }
  return {
    worldRef,
    worldLayer,
    surfaceNode,
    cleanup() {
      if (document.body.contains(worldLayer)) document.body.removeChild(worldLayer)
    },
  }
}

// ---------------------------------------------------------------------------
// toFilename
// ---------------------------------------------------------------------------

describe('toFilename', () => {
  it('converts spaces to hyphens and lowercases the name', () => {
    expect(toFilename('My Design')).toBe('my-design.png')
  })

  it('appends a .png extension', () => {
    expect(toFilename('hello')).toBe('hello.png')
  })

  it('trims leading and trailing whitespace before converting', () => {
    expect(toFilename('  My Design  ')).toBe('my-design.png')
  })

  it('collapses multiple consecutive spaces into a single hyphen', () => {
    expect(toFilename('Untitled   Design')).toBe('untitled-design.png')
  })

  it('leaves already-lowercase names unchanged (apart from .png)', () => {
    expect(toFilename('my design')).toBe('my-design.png')
  })

  it('converts the default "Untitled design" name correctly', () => {
    expect(toFilename('Untitled design')).toBe('untitled-design.png')
  })

  it('handles a single-word name', () => {
    expect(toFilename('Poster')).toBe('poster.png')
  })
})

// ---------------------------------------------------------------------------
// downloadPng
// ---------------------------------------------------------------------------

describe('downloadPng', () => {
  // Mocks reset/configured per-test.
  let mockCtx: { drawImage: ReturnType<typeof vi.fn> }
  let mockCroppedCanvas: {
    width: number
    height: number
    getContext: ReturnType<typeof vi.fn>
    toBlob: ReturnType<typeof vi.fn>
  }
  let mockAnchor: { href: string; download: string; click: ReturnType<typeof vi.fn> }
  let mockCreateObjectURL: ReturnType<typeof vi.fn>
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Synchronous requestAnimationFrame so the internal rAF await resolves immediately.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })

    // jsdom does not implement URL.createObjectURL / revokeObjectURL — assign directly.
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:fake-url')
    mockRevokeObjectURL = vi.fn()
    URL.createObjectURL = mockCreateObjectURL
    URL.revokeObjectURL = mockRevokeObjectURL

    mockCtx = { drawImage: vi.fn() }
    mockCroppedCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCtx),
      toBlob: vi.fn((cb: (blob: Blob | null) => void) =>
        cb(new Blob(['fake-png'], { type: 'image/png' }))
      ),
    }
    mockAnchor = { href: '', download: '', click: vi.fn() }

    // Intercept createElement so downloadPng gets our mock canvas and anchor.
    // Non-canvas/a tags fall through to the real implementation so makeWorldDom
    // can still create real div nodes.
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return mockCroppedCanvas as unknown as HTMLCanvasElement
      if (tag === 'a') return mockAnchor as unknown as HTMLAnchorElement
      return originalCreateElement(tag)
    })

    // html2canvas returns a plain object — ctx.drawImage is mocked so pixel access
    // is never attempted.
    mockHtml2canvas.mockResolvedValue({ __isFakeFullCanvas: true } as unknown as HTMLCanvasElement)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // Empty / hidden elements
  // -------------------------------------------------------------------------

  describe('early exit conditions', () => {
    it('throws "empty" when the elements array is empty', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      await expect(downloadPng(worldRef, [], 'My Design')).rejects.toThrow('empty')
      cleanup()
    })

    it('throws "empty" when all elements are hidden', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      const el = makeText({ hidden: true })
      await expect(downloadPng(worldRef, [el], 'My Design')).rejects.toThrow('empty')
      cleanup()
    })

    it('throws "no-ref" when worldRef.current is null', async () => {
      const worldRef = { current: null }
      await expect(
        downloadPng(worldRef as { current: HTMLDivElement | null }, [makeText()], 'My Design')
      ).rejects.toThrow('no-ref')
    })

    it('throws "no-ref" when the surface node has no parent element', async () => {
      // An orphaned node (not attached to any parent).
      const orphan = document.createElement('div')
      const worldRef = { current: orphan }
      await expect(
        downloadPng(worldRef as { current: HTMLDivElement | null }, [makeText()], 'My Design')
      ).rejects.toThrow('no-ref')
    })
  })

  // -------------------------------------------------------------------------
  // Transform management (clear before capture, restore after)
  // -------------------------------------------------------------------------

  describe('world-layer transform management', () => {
    it('sets the world-layer transform to "none" before calling html2canvas', async () => {
      const { worldRef, worldLayer, cleanup } = makeWorldDom()
      worldLayer.style.transform = 'translate(100px, 50px) scale(1.5)'

      let transformDuringCapture = 'not-captured'
      mockHtml2canvas.mockImplementation(async () => {
        transformDuringCapture = worldLayer.style.transform
        return { __isFake: true } as unknown as HTMLCanvasElement
      })

      await downloadPng(worldRef, [makeText()], 'My Design')

      expect(transformDuringCapture).toBe('none')
      cleanup()
    })

    it('restores the original world-layer transform after a successful capture', async () => {
      const { worldRef, worldLayer, cleanup } = makeWorldDom()
      worldLayer.style.transform = 'translate(100px, 50px) scale(1.5)'

      await downloadPng(worldRef, [makeText()], 'My Design')

      expect(worldLayer.style.transform).toBe('translate(100px, 50px) scale(1.5)')
      cleanup()
    })

    it('restores the world-layer transform even when html2canvas throws', async () => {
      const { worldRef, worldLayer, cleanup } = makeWorldDom()
      worldLayer.style.transform = 'scale(2)'
      mockHtml2canvas.mockRejectedValue(new Error('capture failed'))

      await expect(downloadPng(worldRef, [makeText()], 'My Design')).rejects.toThrow()

      expect(worldLayer.style.transform).toBe('scale(2)')
      cleanup()
    })

    it('restores the surface node overflow and dimensions after a successful capture', async () => {
      const { worldRef, surfaceNode, cleanup } = makeWorldDom()
      surfaceNode.style.width = '300px'
      surfaceNode.style.height = '200px'
      surfaceNode.style.overflow = 'hidden'

      await downloadPng(worldRef, [makeText()], 'My Design')

      expect(surfaceNode.style.width).toBe('300px')
      expect(surfaceNode.style.height).toBe('200px')
      expect(surfaceNode.style.overflow).toBe('hidden')
      cleanup()
    })
  })

  // -------------------------------------------------------------------------
  // html2canvas call parameters
  // -------------------------------------------------------------------------

  describe('html2canvas call', () => {
    it('calls html2canvas with the surface node as the target', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPng(worldRef, [makeText()], 'My Design')

      expect(mockHtml2canvas).toHaveBeenCalledWith(worldRef.current, expect.any(Object))
      cleanup()
    })

    it('calls html2canvas with scale=1, useCORS=true, logging=false', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPng(worldRef, [makeText()], 'My Design')

      expect(mockHtml2canvas).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ scale: 1, useCORS: true, logging: false })
      )
      cleanup()
    })

    it('calls html2canvas with backgroundColor #F3F4F6', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPng(worldRef, [makeText()], 'My Design')

      expect(mockHtml2canvas).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ backgroundColor: '#F3F4F6' })
      )
      cleanup()
    })

    it('passes x=0 and y=0 to html2canvas (full-node capture, not offset)', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPng(worldRef, [makeText()], 'My Design')

      expect(mockHtml2canvas).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ x: 0, y: 0 })
      )
      cleanup()
    })

    // Element at x:100, y:100, w:160, h:40
    // captureX = 100-24 = 76, captureY = 100-24 = 76
    // captureW = 160+48 = 208, captureH = 40+48 = 88
    // nodeRight = 76+208 = 284, nodeBottom = 76+88 = 164
    it('passes width/height covering the full capture region (bbox + padding) to html2canvas', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      const el = makeText({ x: 100, y: 100, width: 160, height: 40 })

      await downloadPng(worldRef, [el], 'My Design')

      expect(mockHtml2canvas).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ width: 284, height: 164 })
      )
      cleanup()
    })
  })

  // -------------------------------------------------------------------------
  // Cropped canvas and 2D drawing
  // -------------------------------------------------------------------------

  describe('canvas crop step', () => {
    it('sets the cropped canvas dimensions to captureW × captureH', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      const el = makeText({ x: 100, y: 100, width: 160, height: 40 })
      // captureW=208, captureH=88

      await downloadPng(worldRef, [el], 'My Design')

      expect(mockCroppedCanvas.width).toBe(208)
      expect(mockCroppedCanvas.height).toBe(88)
      cleanup()
    })

    it('crops the full canvas to the padded bounding-box region via drawImage', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      const el = makeText({ x: 100, y: 100, width: 160, height: 40 })
      // captureX=76, captureY=76, captureW=208, captureH=88

      await downloadPng(worldRef, [el], 'My Design')

      expect(mockCtx.drawImage).toHaveBeenCalledWith(
        expect.anything(), // fullCanvas object returned by html2canvas
        76, // source x (captureX)
        76, // source y (captureY)
        208, // source width
        88, // source height
        0, // dest x
        0, // dest y
        208, // dest width
        88 // dest height
      )
      cleanup()
    })

    it('accounts for 24px padding on all sides of the element bounding box', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      // Place element at known position.
      const el = makeText({ x: 200, y: 300, width: 100, height: 50 })
      // captureX=176, captureY=276, captureW=148, captureH=98
      // nodeRight=324, nodeBottom=374

      await downloadPng(worldRef, [el], 'My Design')

      expect(mockHtml2canvas).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ width: 324, height: 374 })
      )
      expect(mockCtx.drawImage).toHaveBeenCalledWith(
        expect.anything(),
        176,
        276,
        148,
        98,
        0,
        0,
        148,
        98
      )
      cleanup()
    })
  })

  // -------------------------------------------------------------------------
  // Hidden element filtering
  // -------------------------------------------------------------------------

  describe('hidden element filtering', () => {
    it('excludes hidden elements from the bounding box (only visible element drives the region)', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      // Visible element at (100,100,160,40); hidden element at (500,500,200,200).
      // If hidden element were included, dimensions would be much larger.
      const visible = makeText({ id: 'v1', x: 100, y: 100, width: 160, height: 40 })
      const hidden = makeText({ id: 'h1', x: 500, y: 500, width: 200, height: 200, hidden: true })

      await downloadPng(worldRef, [visible, hidden], 'My Design')

      // nodeRight based only on visible element: 76+208=284
      expect(mockHtml2canvas).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ width: 284, height: 164 })
      )
      cleanup()
    })

    it('throws "empty" when every element in the list is hidden', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      const elements = [makeText({ id: 't1', hidden: true }), makeText({ id: 't2', hidden: true })]

      await expect(downloadPng(worldRef, elements, 'My Design')).rejects.toThrow('empty')
      cleanup()
    })

    it('proceeds normally when at least one element is visible', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      const elements = [makeText({ id: 't1', hidden: true }), makeText({ id: 't2', hidden: false })]

      await expect(downloadPng(worldRef, elements, 'My Design')).resolves.toBeUndefined()
      cleanup()
    })
  })

  // -------------------------------------------------------------------------
  // Download trigger
  // -------------------------------------------------------------------------

  describe('download trigger', () => {
    it('sets the anchor download attribute to the converted filename', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPng(worldRef, [makeText()], 'My Design')

      expect(mockAnchor.download).toBe('my-design.png')
      cleanup()
    })

    it('programmatically clicks the anchor to trigger the browser download', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPng(worldRef, [makeText()], 'My Design')

      expect(mockAnchor.click).toHaveBeenCalledOnce()
      cleanup()
    })

    it('sets the anchor href to the blob URL', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPng(worldRef, [makeText()], 'My Design')

      expect(mockAnchor.href).toBe('blob:fake-url')
      cleanup()
    })

    it('creates a blob URL via URL.createObjectURL', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPng(worldRef, [makeText()], 'My Design')

      expect(mockCreateObjectURL).toHaveBeenCalledOnce()
      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob))
      cleanup()
    })

    it('revokes the blob URL after download to release memory', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPng(worldRef, [makeText()], 'My Design')

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
      cleanup()
    })

    it('exports as image/png (not jpeg)', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPng(worldRef, [makeText()], 'My Design')

      expect(mockCroppedCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png')
      cleanup()
    })

    it('throws "blob-failed" when toBlob returns null', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      mockCroppedCanvas.toBlob.mockImplementationOnce((cb: (blob: Blob | null) => void) => cb(null))

      await expect(downloadPng(worldRef, [makeText()], 'My Design')).rejects.toThrow('blob-failed')
      cleanup()
    })
  })

  // -------------------------------------------------------------------------
  // Multi-element bounding box
  // -------------------------------------------------------------------------

  describe('multi-element bounding box', () => {
    it('uses the union bbox of all visible elements when multiple are present', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      // Element A: x:50,  y:100, w:100, h:40  → right=150, bottom=140
      // Element B: x:200, y:50,  w:80,  h:60  → right=280, bottom=110
      // Union: x:50, y:50, w:230, h:90
      // captureX=26, captureY=26, captureW=278, captureH=138
      // nodeRight=304, nodeBottom=164
      const elA = makeText({ id: 'a', x: 50, y: 100, width: 100, height: 40 })
      const elB = makeText({ id: 'b', x: 200, y: 50, width: 80, height: 60 })

      await downloadPng(worldRef, [elA, elB], 'My Design')

      expect(mockHtml2canvas).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ width: 304, height: 164 })
      )
      expect(mockCtx.drawImage).toHaveBeenCalledWith(
        expect.anything(),
        26,
        26,
        278,
        138,
        0,
        0,
        278,
        138
      )
      cleanup()
    })
  })
})
