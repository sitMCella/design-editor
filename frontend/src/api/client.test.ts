import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, ApiError } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------

describe('ApiError', () => {
  it('has name "ApiError"', () => {
    const err = new ApiError('SOME_CODE', 'something went wrong', 400)
    expect(err.name).toBe('ApiError')
  })

  it('is an instance of Error', () => {
    const err = new ApiError('X', 'x', 500)
    expect(err).toBeInstanceOf(Error)
  })

  it('exposes code, message and status', () => {
    const err = new ApiError('NOT_FOUND', 'not found', 404)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.message).toBe('not found')
    expect(err.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// apiFetch — happy path
// ---------------------------------------------------------------------------

describe('apiFetch — success', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ ok: true, data: { id: 'abc' } }),
      })
    )
  })

  it('calls fetch with the given path', async () => {
    await apiFetch('/api/projects')
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/projects', expect.objectContaining({}))
  })

  it('omits Content-Type header when no body is provided', async () => {
    await apiFetch('/api/projects')
    const headers = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Record<
      string,
      string
    >
    expect(headers['Content-Type']).toBeUndefined()
  })

  it('includes Content-Type: application/json header when a body is provided', async () => {
    await apiFetch('/api/projects', { method: 'POST', body: '{"name":"x"}' })
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    )
  })

  it('returns the data property from the response body', async () => {
    const result = await apiFetch('/api/projects')
    expect(result).toEqual({ id: 'abc' })
  })

  it('forwards method and body from init options', async () => {
    await apiFetch('/api/projects', { method: 'POST', body: '{"name":"x"}' })
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({ method: 'POST', body: '{"name":"x"}' })
    )
  })

  it('merges caller headers and omits Content-Type when no body is provided', async () => {
    await apiFetch('/api/projects', { headers: { Authorization: 'Bearer token' } })
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      })
    )
    const headers = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Record<
      string,
      string
    >
    expect(headers['Content-Type']).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// apiFetch — error path
// ---------------------------------------------------------------------------

describe('apiFetch — error', () => {
  it('throws ApiError with code, message and status when ok is false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 404,
        json: () =>
          Promise.resolve({
            ok: false,
            error: { code: 'NOT_FOUND', message: 'not found' },
          }),
      })
    )

    await expect(apiFetch('/api/projects/xyz')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'NOT_FOUND',
      message: 'not found',
      status: 404,
    })
  })

  it('falls back to UNKNOWN code when the error object is absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 500,
        json: () => Promise.resolve({ ok: false }),
      })
    )

    await expect(apiFetch('/api/test')).rejects.toMatchObject({
      code: 'UNKNOWN',
      status: 500,
    })
  })

  it('throws an ApiError that is an instance of Error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 409,
        json: () =>
          Promise.resolve({ ok: false, error: { code: 'CONFLICT', message: 'conflict' } }),
      })
    )

    await expect(apiFetch('/api/projects')).rejects.toBeInstanceOf(Error)
  })
})
