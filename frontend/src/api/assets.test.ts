import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchAssetFromUrl } from './assets'

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const assetRecord = {
  id: 'xyz789',
  name: 'photo.jpg',
  originalUrl: 'https://example.com/photo.jpg',
  url: '/api/assets/xyz789/content',
  mimeType: 'image/jpeg',
  sizeBytes: 204800,
  createdAt: '2026-05-10T10:06:00Z',
}

// ---------------------------------------------------------------------------
// fetchAssetFromUrl — happy path
// ---------------------------------------------------------------------------

describe('fetchAssetFromUrl — success', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: assetRecord }),
    })
  })

  it('sends POST /api/assets/fetch', async () => {
    await fetchAssetFromUrl('https://example.com/photo.jpg')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/assets/fetch',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('includes the URL in the request body', async () => {
    await fetchAssetFromUrl('https://example.com/photo.jpg')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/assets/fetch',
      expect.objectContaining({
        body: expect.stringContaining('"url":"https://example.com/photo.jpg"'),
      })
    )
  })

  it('includes the optional name in the request body', async () => {
    await fetchAssetFromUrl('https://example.com/photo.jpg', 'photo.jpg')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/assets/fetch',
      expect.objectContaining({
        body: JSON.stringify({ url: 'https://example.com/photo.jpg', name: 'photo.jpg' }),
      })
    )
  })

  it('returns the full asset record on success', async () => {
    const result = await fetchAssetFromUrl('https://example.com/photo.jpg')
    expect(result).toEqual(assetRecord)
  })

  it('returned url points to the local content endpoint', async () => {
    const result = await fetchAssetFromUrl('https://example.com/photo.jpg')
    expect(result.url).toBe('/api/assets/xyz789/content')
  })

  it('returned originalUrl matches the input URL', async () => {
    const result = await fetchAssetFromUrl('https://example.com/photo.jpg')
    expect(result.originalUrl).toBe('https://example.com/photo.jpg')
  })
})

// ---------------------------------------------------------------------------
// fetchAssetFromUrl — error path
// ---------------------------------------------------------------------------

describe('fetchAssetFromUrl — errors', () => {
  it('throws ApiError with INVALID_URL (400) for a non-http/https URL', async () => {
    mockFetch.mockResolvedValue({
      status: 400,
      json: () =>
        Promise.resolve({ ok: false, error: { code: 'INVALID_URL', message: 'invalid url' } }),
    })

    await expect(fetchAssetFromUrl('ftp://example.com/image.jpg')).rejects.toMatchObject({
      code: 'INVALID_URL',
      status: 400,
    })
  })

  it('throws ApiError with NOT_AN_IMAGE (400) when the response Content-Type is not image/*', async () => {
    mockFetch.mockResolvedValue({
      status: 400,
      json: () =>
        Promise.resolve({
          ok: false,
          error: { code: 'NOT_AN_IMAGE', message: 'not an image' },
        }),
    })

    await expect(fetchAssetFromUrl('https://example.com/page.html')).rejects.toMatchObject({
      code: 'NOT_AN_IMAGE',
      status: 400,
    })
  })

  it('throws ApiError with TOO_LARGE (400) when the image exceeds 10 MB', async () => {
    mockFetch.mockResolvedValue({
      status: 400,
      json: () =>
        Promise.resolve({ ok: false, error: { code: 'TOO_LARGE', message: 'too large' } }),
    })

    await expect(fetchAssetFromUrl('https://example.com/huge.jpg')).rejects.toMatchObject({
      code: 'TOO_LARGE',
      status: 400,
    })
  })

  it('throws ApiError with FETCH_FAILED (502) on a network error from the origin', async () => {
    mockFetch.mockResolvedValue({
      status: 502,
      json: () =>
        Promise.resolve({
          ok: false,
          error: { code: 'FETCH_FAILED', message: 'fetch failed' },
        }),
    })

    await expect(
      fetchAssetFromUrl('https://unreachable.example.com/image.jpg')
    ).rejects.toMatchObject({
      code: 'FETCH_FAILED',
      status: 502,
    })
  })
})
