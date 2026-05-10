import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getProjects, getProject, createProject, patchProject } from './projects'

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const summaryRecord = {
  id: 'abc123',
  name: 'My Design',
  elementCount: 3,
  createdAt: '2026-05-10T10:00:00Z',
  updatedAt: '2026-05-10T10:07:00Z',
}

const projectRecord = {
  id: 'abc123',
  name: 'My Design',
  canvas: { elements: [] },
  createdAt: '2026-05-10T10:00:00Z',
  updatedAt: '2026-05-10T10:00:00Z',
}

// ---------------------------------------------------------------------------
// getProjects
// ---------------------------------------------------------------------------

describe('getProjects', () => {
  it('sends GET /api/projects', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: [summaryRecord] }),
    })

    await getProjects()

    expect(mockFetch).toHaveBeenCalledWith('/api/projects', expect.any(Object))
  })

  it('returns an array of project summaries', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: [summaryRecord] }),
    })

    const result = await getProjects()
    expect(result).toEqual([summaryRecord])
  })

  it('returns an empty array when no projects exist', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: [] }),
    })

    const result = await getProjects()
    expect(result).toHaveLength(0)
  })

  it('throws ApiError on server error', async () => {
    mockFetch.mockResolvedValue({
      status: 500,
      json: () =>
        Promise.resolve({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'oops' } }),
    })

    await expect(getProjects()).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
  })
})

// ---------------------------------------------------------------------------
// getProject
// ---------------------------------------------------------------------------

describe('getProject', () => {
  it('sends GET /api/projects/:id', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: projectRecord }),
    })

    await getProject('abc123')

    expect(mockFetch).toHaveBeenCalledWith('/api/projects/abc123', expect.any(Object))
  })

  it('returns the full project with canvas', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: projectRecord }),
    })

    const result = await getProject('abc123')
    expect(result).toEqual(projectRecord)
  })

  it('returns all canvas elements', async () => {
    const withElements = {
      ...projectRecord,
      canvas: {
        elements: [
          {
            id: 't1',
            type: 'text',
            x: 560,
            y: 320,
            width: 160,
            height: 40,
            rotation: 0,
            opacity: 1,
            locked: false,
            content: 'Hello',
            fontSize: 16,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 'bold',
            fontStyle: 'italic',
            color: '#111827',
            align: 'left',
          },
        ],
      },
    }
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: withElements }),
    })

    const result = await getProject('abc123')
    expect(result.canvas.elements).toHaveLength(1)
    expect(result.canvas.elements[0].id).toBe('t1')
  })

  it('throws ApiError with NOT_FOUND (404) for an unknown id', async () => {
    mockFetch.mockResolvedValue({
      status: 404,
      json: () =>
        Promise.resolve({ ok: false, error: { code: 'NOT_FOUND', message: 'not found' } }),
    })

    await expect(getProject('missing')).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 })
  })
})

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
