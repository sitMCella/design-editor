export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body != null
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (res.status === 204) {
    return undefined as T
  }
  const body = (await res.json()) as {
    ok: boolean
    data?: T
    error?: { code: string; message: string }
  }
  if (!body.ok) {
    const err = body.error ?? { code: 'UNKNOWN', message: 'Unknown error' }
    throw new ApiError(err.code, err.message, res.status)
  }
  return body.data as T
}
