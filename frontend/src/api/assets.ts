import { apiFetch } from './client'

export type AssetResult = {
  id: string
  name: string
  originalUrl: string | null
  url: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

export function fetchAssetFromUrl(url: string, name?: string): Promise<AssetResult> {
  return apiFetch<AssetResult>('/api/assets/fetch', {
    method: 'POST',
    body: JSON.stringify({ url, name }),
  })
}
