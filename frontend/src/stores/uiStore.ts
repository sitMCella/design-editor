import { create } from 'zustand'

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

export const useUIStore = create<State & Actions>((set) => ({
  activeTool: 'select',
  activePanel: null,
  isExportModalOpen: false,
  isToolbarPinned: false,

  setActiveTool: (tool) => set({ activeTool: tool }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setExportModalOpen: (open) => set({ isExportModalOpen: open }),
  toggleToolbarPin: () => set((s) => ({ isToolbarPinned: !s.isToolbarPinned })),
}))
