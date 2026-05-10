import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProject, patchProject } from './projects'

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const projectRecord = {
  id: 'abc123',
  name: 'My Design',
  canvas: { elements: [] },
  createdAt: '2026-05-10T10:00:00Z',
  updatedAt: '2026-05-10T10:00:00Z',
}

// ---------------------------------------------------------------------------
// createProject
// ---------------------------------------------------------------------------

describe('createProject', () => {
  it('sends POST /api/projects with id and name', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: projectRecord }),
    })

    await createProject('abc123', 'My Design')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id: 'abc123', name: 'My Design' }),
      })
    )
  })

  it('returns the project record on success', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: projectRecord }),
    })

    const result = await createProject('abc123', 'My Design')
    expect(result).toEqual(projectRecord)
  })

  it('canvas field contains an empty elements array on a new project', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: projectRecord }),
    })

    const result = await createProject('abc123', 'My Design')
    expect(result.canvas.elements).toHaveLength(0)
  })

  it('throws ApiError with CONFLICT (409) when the id already exists', async () => {
    mockFetch.mockResolvedValue({
      status: 409,
      json: () =>
        Promise.resolve({ ok: false, error: { code: 'CONFLICT', message: 'already exists' } }),
    })

    await expect(createProject('abc123', 'My Design')).rejects.toMatchObject({
      code: 'CONFLICT',
      status: 409,
    })
  })

  it('throws ApiError with INVALID_BODY (400) when id or name is missing', async () => {
    mockFetch.mockResolvedValue({
      status: 400,
      json: () =>
        Promise.resolve({ ok: false, error: { code: 'INVALID_BODY', message: 'bad request' } }),
    })

    await expect(createProject('', '')).rejects.toMatchObject({
      code: 'INVALID_BODY',
      status: 400,
    })
  })
})

// ---------------------------------------------------------------------------
// patchProject
// ---------------------------------------------------------------------------

describe('patchProject', () => {
  const patchResult = { id: 'abc123', updatedAt: '2026-05-10T10:05:00Z' }

  it('sends PATCH /api/projects/:id', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: patchResult }),
    })

    await patchProject('abc123', { name: 'Renamed' })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/projects/abc123',
      expect.objectContaining({ method: 'PATCH' })
    )
  })

  it('sends name in the patch body', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: patchResult }),
    })

    await patchProject('abc123', { name: 'Renamed' })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/projects/abc123',
      expect.objectContaining({ body: JSON.stringify({ name: 'Renamed' }) })
    )
  })

  it('sends canvas elements in the patch body', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: patchResult }),
    })

    const elements = [{ id: 'el-1', type: 'text' }] as never
    await patchProject('abc123', { canvas: { elements } })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/projects/abc123',
      expect.objectContaining({ body: JSON.stringify({ canvas: { elements } }) })
    )
  })

  it('returns id and updatedAt on success', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: patchResult }),
    })

    const result = await patchProject('abc123', { name: 'Renamed' })
    expect(result).toEqual(patchResult)
  })

  it('throws ApiError with NOT_FOUND (404) for an unknown project id', async () => {
    mockFetch.mockResolvedValue({
      status: 404,
      json: () =>
        Promise.resolve({ ok: false, error: { code: 'NOT_FOUND', message: 'not found' } }),
    })

    await expect(patchProject('nonexistent', { name: 'x' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    })
  })

  it('throws ApiError with INVALID_BODY (400) when no valid field is supplied', async () => {
    mockFetch.mockResolvedValue({
      status: 400,
      json: () =>
        Promise.resolve({ ok: false, error: { code: 'INVALID_BODY', message: 'no valid field' } }),
    })

    await expect(patchProject('abc123', {})).rejects.toMatchObject({
      code: 'INVALID_BODY',
      status: 400,
    })
  })
})
