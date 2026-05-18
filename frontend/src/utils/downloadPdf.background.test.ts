// Spec 20 — Canvas Background Colour: downloadPdf background option tests
// Covers: AC16 — PDF export uses canvas backgroundColor; transparent → '#FFFFFF' (white fallback)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { downloadPdf } from './downloadPdf'
import type { TextElement } from '../types/canvas'

vi.mock('html2canvas', () => ({ default: vi.fn() }))
vi.mock('jspdf', () => ({ jsPDF: vi.fn() }))

const mockHtml2canvas = vi.mocked(html2canvas)
const MockJsPDF = vi.mocked(jsPDF)

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

function makeWorldDom() {
  const worldLayer = document.createElement('div')
  const surfaceNode = document.createElement('div')
  worldLayer.appendChild(surfaceNode)
  document.body.appendChild(worldLayer)
  const worldRef = { current: surfaceNode }
  return {
    worldRef,
    cleanup() {
      if (document.body.contains(worldLayer)) document.body.removeChild(worldLayer)
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })

  mockHtml2canvas.mockResolvedValue({ __isFakeFullCanvas: true } as unknown as HTMLCanvasElement)

  const mockCtx = { drawImage: vi.fn() }
  const mockCroppedCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(mockCtx),
    toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,fakejpeg'),
  }

  const mockPdf = { addImage: vi.fn(), save: vi.fn() }
  MockJsPDF.mockImplementation(() => mockPdf as unknown as jsPDF)

  const originalCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') return mockCroppedCanvas as unknown as HTMLCanvasElement
    return originalCreateElement(tag)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// AC16 — PDF export passes backgroundColor; transparent → '#FFFFFF' (white)
// ---------------------------------------------------------------------------

describe('AC16 — downloadPdf backgroundColor handling', () => {
  it('passes the hex backgroundColor to html2canvas for a solid colour', async () => {
    const { worldRef, cleanup } = makeWorldDom()

    await downloadPdf(worldRef, [makeText()], 'My Design', '#BAE6FD')

    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.backgroundColor).toBe('#BAE6FD')
    cleanup()
  })

  it('passes #FFFFFF to html2canvas when backgroundColor is "transparent" (PDF cannot be transparent)', async () => {
    const { worldRef, cleanup } = makeWorldDom()

    await downloadPdf(worldRef, [makeText()], 'My Design', 'transparent')

    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.backgroundColor).toBe('#FFFFFF')
    cleanup()
  })

  it('does NOT pass null or "transparent" for a transparent canvas (PDF must be opaque)', async () => {
    const { worldRef, cleanup } = makeWorldDom()

    await downloadPdf(worldRef, [makeText()], 'My Design', 'transparent')

    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.backgroundColor).not.toBeNull()
    expect(opts.backgroundColor).not.toBe('transparent')
    cleanup()
  })

  it('passes the default grey (#F3F4F6) when no backgroundColor is provided', async () => {
    const { worldRef, cleanup } = makeWorldDom()

    await downloadPdf(worldRef, [makeText()], 'My Design')

    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.backgroundColor).toBe('#F3F4F6')
    cleanup()
  })

  it('passes black (#111827) when the canvas background is black', async () => {
    const { worldRef, cleanup } = makeWorldDom()

    await downloadPdf(worldRef, [makeText()], 'My Design', '#111827')

    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.backgroundColor).toBe('#111827')
    cleanup()
  })

  it('passes white (#FFFFFF) when the canvas background is white', async () => {
    const { worldRef, cleanup } = makeWorldDom()

    await downloadPdf(worldRef, [makeText()], 'My Design', '#FFFFFF')

    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.backgroundColor).toBe('#FFFFFF')
    cleanup()
  })

  it('uses white as the transparent fallback (not null), ensuring the PDF is always opaque', async () => {
    const { worldRef, cleanup } = makeWorldDom()

    await downloadPdf(worldRef, [makeText()], 'My Design', 'transparent')

    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.backgroundColor).toStrictEqual('#FFFFFF')
    cleanup()
  })
})
