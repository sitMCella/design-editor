import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { CanvasElement, ArrowElement } from '../types/canvas'
import { anchorCoord, deriveBBox } from '../utils/anchorCoord'

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
  loadDesign: (id: string, name: string, elements: CanvasElement[]) => void
  addElement: (element: CanvasElement) => void
  updateElement: (id: string, patch: Partial<CanvasElement>) => void
  removeElements: (ids: string[]) => void
  selectElements: (ids: string[]) => void
  toggleElementSelection: (id: string) => void
  addToSelection: (ids: string[]) => void
  clearSelection: () => void
  toggleElementVisibility: (id: string) => void
  moveElementToIndex: (id: string, panelIndex: number) => void
  markSaved: () => void
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
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

    loadDesign: (id, name, elements) =>
      set((state) => {
        state.designId = id
        state.name = name
        state.elements = elements ?? []
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
        if (index === -1) return
        const el = state.elements[index]
        Object.assign(el, patch)
        state.isDirty = true

        if (el.type === 'arrow') {
          // Recalculate derived bounding box whenever endpoint or strokeWidth changes
          const arr = el as ArrowElement
          const bbox = deriveBBox(arr.x1, arr.y1, arr.x2, arr.y2, arr.strokeWidth)
          Object.assign(el, bbox)
        } else {
          // When a non-arrow element moves/resizes, pull connected arrow endpoints with it
          for (const other of state.elements) {
            if (other.type !== 'arrow') continue
            const arr = other as ArrowElement
            let changed = false
            if (arr.startAnchor?.elementId === id) {
              const coord = anchorCoord(el, arr.startAnchor.side)
              arr.x1 = coord.x
              arr.y1 = coord.y
              changed = true
            }
            if (arr.endAnchor?.elementId === id) {
              const coord = anchorCoord(el, arr.endAnchor.side)
              arr.x2 = coord.x
              arr.y2 = coord.y
              changed = true
            }
            if (changed) {
              const bbox = deriveBBox(arr.x1, arr.y1, arr.x2, arr.y2, arr.strokeWidth)
              Object.assign(arr, bbox)
            }
          }
        }
      }),

    removeElements: (ids) =>
      set((state) => {
        const idSet = new Set(ids)
        state.elements = state.elements.filter((el) => !idSet.has(el.id))
        state.selectedIds = state.selectedIds.filter((id) => !idSet.has(id))
        // Clear dangling anchor references on remaining arrows
        for (const el of state.elements) {
          if (el.type !== 'arrow') continue
          const arr = el as ArrowElement
          if (arr.startAnchor && idSet.has(arr.startAnchor.elementId)) {
            arr.startAnchor = undefined
          }
          if (arr.endAnchor && idSet.has(arr.endAnchor.elementId)) {
            arr.endAnchor = undefined
          }
        }
        state.isDirty = true
      }),

    selectElements: (ids) =>
      set((state) => {
        state.selectedIds = ids.filter(
          (id) => !state.elements.find((el) => el.id === id)?.hidden,
        )
      }),

    toggleElementSelection: (id) =>
      set((state) => {
        const el = state.elements.find((e) => e.id === id)
        if (el?.hidden) return
        const idx = state.selectedIds.indexOf(id)
        if (idx === -1) {
          state.selectedIds.push(id)
        } else {
          state.selectedIds.splice(idx, 1)
        }
      }),

    addToSelection: (ids) =>
      set((state) => {
        for (const id of ids) {
          const el = state.elements.find((e) => e.id === id)
          if (!el?.hidden && !state.selectedIds.includes(id)) {
            state.selectedIds.push(id)
          }
        }
      }),

    clearSelection: () =>
      set((state) => {
        state.selectedIds = []
      }),

    toggleElementVisibility: (id) =>
      set((state) => {
        const el = state.elements.find((e) => e.id === id)
        if (!el) return
        el.hidden = !el.hidden
        if (el.hidden) {
          state.selectedIds = state.selectedIds.filter((sid) => sid !== id)
        }
        state.isDirty = true
      }),

    moveElementToIndex: (id, panelIndex) =>
      set((state) => {
        const from = state.elements.findIndex((el) => el.id === id)
        if (from === -1) return
        const [el] = state.elements.splice(from, 1)
        // After splice, length is one less; panelIndex 0 = topmost = last array position
        const to = Math.max(0, state.elements.length - panelIndex)
        state.elements.splice(to, 0, el)
        state.isDirty = true
      }),

    markSaved: () =>
      set((state) => {
        state.isDirty = false
      }),

    setZoom: (zoom) =>
      set((state) => {
        state.zoom = Math.max(0.1, Math.min(5, zoom))
      }),

    setPan: (x, y) =>
      set((state) => {
        state.panX = x
        state.panY = y
      }),
  }))
)
