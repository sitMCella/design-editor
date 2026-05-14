import { apiFetch } from './client'
import type { CanvasElement } from '../types/canvas'

export type Project = {
  id: string
  name: string
  canvas: { elements: CanvasElement[] }
  createdAt: string
  updatedAt: string
}

export type ProjectSummary = {
  id: string
  name: string
  elementCount: number
  thumbnailUrl?: string | null
  createdAt: string
  updatedAt: string
}

export type PatchProjectResult = {
  id: string
  name?: string
  updatedAt: string
}

export function getProjects(): Promise<ProjectSummary[]> {
  return apiFetch<ProjectSummary[]>('/api/projects')
}

export function getProject(id: string): Promise<Project> {
  return apiFetch<Project>(`/api/projects/${id}`)
}

export function createProject(id: string, name: string): Promise<Project> {
  return apiFetch<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ id, name }),
  })
}

export function patchProject(
  id: string,
  patch: { name?: string; canvas?: { elements: CanvasElement[] } }
): Promise<PatchProjectResult> {
  return apiFetch<PatchProjectResult>(`/api/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}
