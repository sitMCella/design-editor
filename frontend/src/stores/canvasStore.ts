import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { CanvasElement } from '../types/canvas'

type State = {
  designId: string
  name: string
  elements: CanvasElement[]
  selectedIds: string[]
  zoom: number
  panX: number
  panY: number
  isDirty: boolean
}

type Actions = {
  initDesign: (id: string, name: string) => void
  addElement: (element: CanvasElement) => void
  updateElement: (id: string, patch: Partial<CanvasElement>) => void
  removeElements: (ids: string[]) => void
  selectElements: (ids: string[]) => void
  clearSelection: () => void
  markSaved: () => void
}

export const useCanvasStore = create<State & Actions>()(
  immer((set) => ({
    designId: '',
    name: 'Untitled Design',
    elements: [],
    selectedIds: [],
    zoom: 1,
    panX: 0,
    panY: 0,
    isDirty: false,

    initDesign: (id, name) =>
      set((state) => {
        state.designId = id
        state.name = name
        state.elements = []
        state.selectedIds = []
        state.zoom = 1
        state.panX = 0
        state.panY = 0
        state.isDirty = false
      }),

    addElement: (element) =>
      set((state) => {
        state.elements.push(element)
        state.isDirty = true
      }),

    updateElement: (id, patch) =>
      set((state) => {
        const index = state.elements.findIndex((el) => el.id === id)
        if (index !== -1) {
          Object.assign(state.elements[index], patch)
          state.isDirty = true
        }
      }),

    removeElements: (ids) =>
      set((state) => {
        state.elements = state.elements.filter((el) => !ids.includes(el.id))
        state.selectedIds = state.selectedIds.filter((id) => !ids.includes(id))
        state.isDirty = true
      }),

    selectElements: (ids) =>
      set((state) => {
        state.selectedIds = ids
      }),

    clearSelection: () =>
      set((state) => {
        state.selectedIds = []
      }),

    markSaved: () =>
      set((state) => {
        state.isDirty = false
      }),
  }))
)
