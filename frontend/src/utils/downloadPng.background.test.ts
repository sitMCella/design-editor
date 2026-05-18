// Spec 20 — Canvas Background Colour: downloadPng background option tests
// Covers: AC15 — PNG export uses canvas backgroundColor; transparent → null (alpha channel)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import html2canvas from 'html2canvas'
import { downloadPng } from './downloadPng'
import type { TextElement } from '../types/canvas'

vi.mock('html2canvas', () => ({ default: vi.fn() }))

const mockHtml2canvas = vi.mocked(html2canvas)

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

  mockHtml2canvas.mockResolvedValue({
    toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(new Blob(['x'], { type: 'image/png' }))),
  } as unknown as HTMLCanvasElement)

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) {
    cb(new Blob(['x'], { type: 'image/png' }))
  })

  const originalCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'a') {
      const a = originalCreateElement('a')
      vi.spyOn(a, 'click').mockImplementation(() => {})
      return a
    }
    return originalCreateElement(tag)
  })
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn().mockReturnValue('blob:fake'),
    revokeObjectURL: vi.fn(),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// AC15 — PNG export passes backgroundColor; transparent → null (alpha channel)
// ---------------------------------------------------------------------------

describe('AC15 — downloadPng backgroundColor handling', () => {
  it('passes the hex backgroundColor to html2canvas for a solid colour', async () => {
    const { worldRef, cleanup } = makeWorldDom()

    await downloadPng(worldRef, [makeText()], 'My Design', '#BAE6FD')

    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.backgroundColor).toBe('#BAE6FD')
    cleanup()
  })

  it('passes null to html2canvas when backgroundColor is "transparent" (preserves alpha)', async () => {
    const { worldRef, cleanup } = makeWorldDom()

    await downloadPng(worldRef, [makeText()], 'My Design', 'transparent')

    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.backgroundColor).toBeNull()
    cleanup()
  })

  it('does NOT pass "transparent" string as backgroundColor (must be null for alpha channel)', async () => {
    const { worldRef, cleanup } = makeWorldDom()

    await downloadPng(worldRef, [makeText()], 'My Design', 'transparent')

    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.backgroundColor).not.toBe('transparent')
    cleanup()
  })

  it('passes the default grey (#F3F4F6) when no backgroundColor is provided', async () => {
    const { worldRef, cleanup } = makeWorldDom()

    await downloadPng(worldRef, [makeText()], 'My Design')

    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.backgroundColor).toBe('#F3F4F6')
    cleanup()
  })

  it('passes black (#111827) when the canvas background is black', async () => {
    const { worldRef, cleanup } = makeWorldDom()

    await downloadPng(worldRef, [makeText()], 'My Design', '#111827')

    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.backgroundColor).toBe('#111827')
    cleanup()
  })

  it('passes white (#FFFFFF) when the canvas background is white', async () => {
    const { worldRef, cleanup } = makeWorldDom()

    await downloadPng(worldRef, [makeText()], 'My Design', '#FFFFFF')

    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    expect(opts.backgroundColor).toBe('#FFFFFF')
    cleanup()
  })

  it('passes null (not the string "transparent") so the PNG has a real alpha channel', async () => {
    const { worldRef, cleanup } = makeWorldDom()

    await downloadPng(worldRef, [makeText()], 'My Design', 'transparent')

    const opts = mockHtml2canvas.mock.calls[0][1] as Record<string, unknown>
    // null tells html2canvas to keep the canvas fully transparent
    expect(opts.backgroundColor).toStrictEqual(null)
    cleanup()
  })
})
