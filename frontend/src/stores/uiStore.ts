import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

type ActiveTool = 'select' | 'text' | 'image' | 'arrow' | 'table'
type ActivePanel = 'layers' | 'assets' | 'templates' | null

type State = {
  activeTool: ActiveTool
  activePanel: ActivePanel
  isExportModalOpen: boolean
  isToolbarPinned: boolean
}

type Actions = {
  setActiveTool: (tool: ActiveTool) => void
  setActivePanel: (panel: ActivePanel) => void
  setExportModalOpen: (open: boolean) => void
  toggleToolbarPin: () => void
}

export const useUIStore = create<State & Actions>()(
  persist(
    (set) => ({
      activeTool: 'select',
      activePanel: null,
      isExportModalOpen: false,
      isToolbarPinned: false,

      setActiveTool: (tool) => set({ activeTool: tool }),
      setActivePanel: (panel) =>
        set((s) => ({ activePanel: s.activePanel === panel ? null : panel })),
      setExportModalOpen: (open) => set({ isExportModalOpen: open }),
      toggleToolbarPin: () => set((s) => ({ isToolbarPinned: !s.isToolbarPinned })),
    }),
    {
      name: 'ui-store',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ isToolbarPinned: state.isToolbarPinned }),
    }
  )
)
