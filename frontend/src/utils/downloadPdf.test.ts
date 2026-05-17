import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { downloadPdf } from './downloadPdf'
import type { TextElement } from '../types/canvas'

vi.mock('html2canvas', () => ({
  default: vi.fn(),
}))

vi.mock('jspdf', () => ({
  jsPDF: vi.fn(),
}))

const mockHtml2canvas = vi.mocked(html2canvas)
const MockJsPDF = vi.mocked(jsPDF)

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
// downloadPdf
// ---------------------------------------------------------------------------

describe('downloadPdf', () => {
  let mockCtx: { drawImage: ReturnType<typeof vi.fn> }
  let mockCroppedCanvas: {
    width: number
    height: number
    getContext: ReturnType<typeof vi.fn>
    toDataURL: ReturnType<typeof vi.fn>
  }
  let mockPdf: {
    addImage: ReturnType<typeof vi.fn>
    save: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    // Synchronous requestAnimationFrame so the internal rAF await resolves immediately.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })

    mockCtx = { drawImage: vi.fn() }
    mockCroppedCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCtx),
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,fakejpeg'),
    }

    mockPdf = {
      addImage: vi.fn(),
      save: vi.fn(),
    }
    MockJsPDF.mockImplementation(() => mockPdf as unknown as jsPDF)

    // Intercept createElement so downloadPdf gets our mock canvas.
    // Non-canvas tags fall through to the real implementation.
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return mockCroppedCanvas as unknown as HTMLCanvasElement
      return originalCreateElement(tag)
    })

    mockHtml2canvas.mockResolvedValue({ __isFakeFullCanvas: true } as unknown as HTMLCanvasElement)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // Early exit conditions
  // -------------------------------------------------------------------------

  describe('early exit conditions', () => {
    it('throws "empty" when the elements array is empty', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      await expect(downloadPdf(worldRef, [], 'My Design')).rejects.toThrow('empty')
      cleanup()
    })

    it('throws "empty" when all elements are hidden', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      const el = makeText({ hidden: true })
      await expect(downloadPdf(worldRef, [el], 'My Design')).rejects.toThrow('empty')
      cleanup()
    })

    it('throws "no-ref" when worldRef.current is null', async () => {
      const worldRef = { current: null }
      await expect(
        downloadPdf(worldRef as { current: HTMLDivElement | null }, [makeText()], 'My Design')
      ).rejects.toThrow('no-ref')
    })

    it('throws "no-ref" when the surface node has no parent element', async () => {
      const orphan = document.createElement('div')
      const worldRef = { current: orphan }
      await expect(
        downloadPdf(worldRef as { current: HTMLDivElement | null }, [makeText()], 'My Design')
      ).rejects.toThrow('no-ref')
    })

    it('does not call html2canvas when elements array is empty', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      await expect(downloadPdf(worldRef, [], 'My Design')).rejects.toThrow()
      expect(mockHtml2canvas).not.toHaveBeenCalled()
      cleanup()
    })
  })

  // -------------------------------------------------------------------------
  // World-layer transform management
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

      await downloadPdf(worldRef, [makeText()], 'My Design')

      expect(transformDuringCapture).toBe('none')
      cleanup()
    })

    it('restores the original world-layer transform after a successful capture', async () => {
      const { worldRef, worldLayer, cleanup } = makeWorldDom()
      worldLayer.style.transform = 'translate(100px, 50px) scale(1.5)'

      await downloadPdf(worldRef, [makeText()], 'My Design')

      expect(worldLayer.style.transform).toBe('translate(100px, 50px) scale(1.5)')
      cleanup()
    })

    it('restores the world-layer transform even when html2canvas throws', async () => {
      const { worldRef, worldLayer, cleanup } = makeWorldDom()
      worldLayer.style.transform = 'scale(2)'
      mockHtml2canvas.mockRejectedValue(new Error('capture failed'))

      await expect(downloadPdf(worldRef, [makeText()], 'My Design')).rejects.toThrow()

      expect(worldLayer.style.transform).toBe('scale(2)')
      cleanup()
    })

    it('restores the surface node overflow and dimensions after a successful capture', async () => {
      const { worldRef, surfaceNode, cleanup } = makeWorldDom()
      surfaceNode.style.width = '300px'
      surfaceNode.style.height = '200px'
      surfaceNode.style.overflow = 'hidden'

      await downloadPdf(worldRef, [makeText()], 'My Design')

      expect(surfaceNode.style.width).toBe('300px')
      expect(surfaceNode.style.height).toBe('200px')
      expect(surfaceNode.style.overflow).toBe('hidden')
      cleanup()
    })

    it('restores surface node dimensions even when jsPDF throws', async () => {
      const { worldRef, surfaceNode, cleanup } = makeWorldDom()
      surfaceNode.style.width = '400px'
      MockJsPDF.mockImplementation(() => {
        throw new Error('jspdf-error')
      })

      await expect(downloadPdf(worldRef, [makeText()], 'My Design')).rejects.toThrow()

      expect(surfaceNode.style.width).toBe('400px')
      cleanup()
    })
  })

  // -------------------------------------------------------------------------
  // html2canvas call parameters
  // -------------------------------------------------------------------------

  describe('html2canvas call', () => {
    it('calls html2canvas with the surface node as the target', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPdf(worldRef, [makeText()], 'My Design')

      expect(mockHtml2canvas).toHaveBeenCalledWith(worldRef.current, expect.any(Object))
      cleanup()
    })

    it('calls html2canvas with scale=1, useCORS=true, logging=false', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPdf(worldRef, [makeText()], 'My Design')

      expect(mockHtml2canvas).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ scale: 1, useCORS: true, logging: false })
      )
      cleanup()
    })

    it('calls html2canvas with backgroundColor #F3F4F6', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPdf(worldRef, [makeText()], 'My Design')

      expect(mockHtml2canvas).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ backgroundColor: '#F3F4F6' })
      )
      cleanup()
    })

    it('passes x=0 and y=0 to html2canvas (full-node capture, not offset)', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPdf(worldRef, [makeText()], 'My Design')

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
    it('passes width/height covering the full capture region to html2canvas', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      const el = makeText({ x: 100, y: 100, width: 160, height: 40 })

      await downloadPdf(worldRef, [el], 'My Design')

      expect(mockHtml2canvas).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ width: 284, height: 164 })
      )
      cleanup()
    })
  })

  // -------------------------------------------------------------------------
  // Canvas crop step
  // -------------------------------------------------------------------------

  describe('canvas crop step', () => {
    it('sets the cropped canvas dimensions to captureW × captureH', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      const el = makeText({ x: 100, y: 100, width: 160, height: 40 })
      // captureW = 208, captureH = 88

      await downloadPdf(worldRef, [el], 'My Design')

      expect(mockCroppedCanvas.width).toBe(208)
      expect(mockCroppedCanvas.height).toBe(88)
      cleanup()
    })

    it('crops the full canvas to the padded bounding-box region via drawImage', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      const el = makeText({ x: 100, y: 100, width: 160, height: 40 })
      // captureX=76, captureY=76, captureW=208, captureH=88

      await downloadPdf(worldRef, [el], 'My Design')

      expect(mockCtx.drawImage).toHaveBeenCalledWith(
        expect.anything(), // fullCanvas returned by html2canvas
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
      const el = makeText({ x: 200, y: 300, width: 100, height: 50 })
      // captureX=176, captureY=276, captureW=148, captureH=98

      await downloadPdf(worldRef, [el], 'My Design')

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

    it('exports the cropped canvas as JPEG at quality 0.92', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPdf(worldRef, [makeText()], 'My Design')

      expect(mockCroppedCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.92)
      cleanup()
    })
  })

  // -------------------------------------------------------------------------
  // jsPDF assembly
  // -------------------------------------------------------------------------

  describe('jsPDF assembly', () => {
    // Element at x:100, y:100, w:160, h:40
    // captureW=208, captureH=88
    // pageW = 208 * 0.75 = 156, pageH = 88 * 0.75 = 66
    // orientation = 'landscape' (156 >= 66)
    it('creates a jsPDF instance with unit "pt" and format matching the capture region in points', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      const el = makeText({ x: 100, y: 100, width: 160, height: 40 })

      await downloadPdf(worldRef, [el], 'My Design')

      expect(MockJsPDF).toHaveBeenCalledWith(
        expect.objectContaining({
          unit: 'pt',
          format: [156, 66],
        })
      )
      cleanup()
    })

    it('uses landscape orientation when captureW >= captureH', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      // Wide element: captureW=208, captureH=88 → pageW > pageH → landscape
      const el = makeText({ x: 100, y: 100, width: 160, height: 40 })

      await downloadPdf(worldRef, [el], 'My Design')

      expect(MockJsPDF).toHaveBeenCalledWith(expect.objectContaining({ orientation: 'landscape' }))
      cleanup()
    })

    it('uses portrait orientation when captureH > captureW', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      // Tall element: captureH > captureW
      // x:100, y:100, w:40, h:300 → captureW=40+48=88, captureH=300+48=348
      // pageW=66, pageH=261 → portrait
      const el = makeText({ x: 100, y: 100, width: 40, height: 300 })

      await downloadPdf(worldRef, [el], 'My Design')

      expect(MockJsPDF).toHaveBeenCalledWith(expect.objectContaining({ orientation: 'portrait' }))
      cleanup()
    })

    it('embeds the JPEG data URL into the PDF via addImage', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      const el = makeText({ x: 100, y: 100, width: 160, height: 40 })
      // pageW=156, pageH=66

      await downloadPdf(worldRef, [el], 'My Design')

      expect(mockPdf.addImage).toHaveBeenCalledWith(
        'data:image/jpeg;base64,fakejpeg',
        'JPEG',
        0,
        0,
        156,
        66
      )
      cleanup()
    })

    it('calls pdf.save() to trigger the browser download', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPdf(worldRef, [makeText()], 'My Design')

      expect(mockPdf.save).toHaveBeenCalledOnce()
      cleanup()
    })

    it('saves the file with a .pdf extension derived from the design name', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPdf(worldRef, [makeText()], 'My Design')

      expect(mockPdf.save).toHaveBeenCalledWith('my-design.pdf')
      cleanup()
    })

    it('converts spaces to hyphens and lowercases the filename', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPdf(worldRef, [makeText()], 'Untitled design')

      expect(mockPdf.save).toHaveBeenCalledWith('untitled-design.pdf')
      cleanup()
    })

    it('trims whitespace before building the filename', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPdf(worldRef, [makeText()], '  My Design  ')

      expect(mockPdf.save).toHaveBeenCalledWith('my-design.pdf')
      cleanup()
    })

    it('collapses multiple consecutive spaces into a single hyphen in the filename', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPdf(worldRef, [makeText()], 'My   Design')

      expect(mockPdf.save).toHaveBeenCalledWith('my-design.pdf')
      cleanup()
    })

    it('converts a single-word name to a lowercase .pdf filename', async () => {
      const { worldRef, cleanup } = makeWorldDom()

      await downloadPdf(worldRef, [makeText()], 'Poster')

      expect(mockPdf.save).toHaveBeenCalledWith('poster.pdf')
      cleanup()
    })

    it('converts pixels to points using 0.75 scale factor', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      // Element: x:0, y:0, w:400, h:400
      // captureW=400+48=448, captureH=400+48=448
      // pageW = 448 * 0.75 = 336, pageH = 448 * 0.75 = 336
      const el = makeText({ x: 0, y: 0, width: 400, height: 400 })

      await downloadPdf(worldRef, [el], 'Square')

      expect(MockJsPDF).toHaveBeenCalledWith(expect.objectContaining({ format: [336, 336] }))
      cleanup()
    })
  })

  // -------------------------------------------------------------------------
  // Hidden element filtering
  // -------------------------------------------------------------------------

  describe('hidden element filtering', () => {
    it('excludes hidden elements from the bounding box', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      // Visible at (100,100,160,40); hidden far away at (1000,1000,200,200)
      // If hidden element were included, dimensions would be much larger
      const visible = makeText({ id: 'v1', x: 100, y: 100, width: 160, height: 40 })
      const hidden = makeText({ id: 'h1', x: 1000, y: 1000, width: 200, height: 200, hidden: true })

      await downloadPdf(worldRef, [visible, hidden], 'My Design')

      // nodeRight based only on visible: 76+208=284
      expect(mockHtml2canvas).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ width: 284, height: 164 })
      )
      cleanup()
    })

    it('throws "empty" when every element in the list is hidden', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      const elements = [makeText({ id: 't1', hidden: true }), makeText({ id: 't2', hidden: true })]

      await expect(downloadPdf(worldRef, elements, 'My Design')).rejects.toThrow('empty')
      cleanup()
    })

    it('proceeds normally when at least one element is visible', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      const elements = [makeText({ id: 't1', hidden: true }), makeText({ id: 't2', hidden: false })]

      await expect(downloadPdf(worldRef, elements, 'My Design')).resolves.toBeUndefined()
      cleanup()
    })
  })

  // -------------------------------------------------------------------------
  // Multi-element bounding box
  // -------------------------------------------------------------------------

  describe('multi-element bounding box', () => {
    it('uses the union bbox of all visible elements when multiple are present', async () => {
      const { worldRef, cleanup } = makeWorldDom()
      // Element A: x:50, y:100, w:100, h:40 → right=150, bottom=140
      // Element B: x:200, y:50, w:80, h:60  → right=280, bottom=110
      // Union: x:50, y:50, w:230, h:90
      // captureX=26, captureY=26, captureW=278, captureH=138
      // nodeRight=304, nodeBottom=164
      const elA = makeText({ id: 'a', x: 50, y: 100, width: 100, height: 40 })
      const elB = makeText({ id: 'b', x: 200, y: 50, width: 80, height: 60 })

      await downloadPdf(worldRef, [elA, elB], 'My Design')

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
