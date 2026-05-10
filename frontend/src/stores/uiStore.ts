import { create } from 'zustand'

type ActiveTool = 'select' | 'text' | 'image'
type ActivePanel = 'layers' | 'assets' | 'templates' | null

type State = {
  activeTool: ActiveTool
  activePanel: ActivePanel
  isExportModalOpen: boolean
}

type Actions = {
  setActiveTool: (tool: ActiveTool) => void
  setActivePanel: (panel: ActivePanel) => void
  setExportModalOpen: (open: boolean) => void
}

export const useUIStore = create<State & Actions>((set) => ({
  activeTool: 'select',
  activePanel: null,
  isExportModalOpen: false,

  setActiveTool: (tool) => set({ activeTool: tool }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setExportModalOpen: (open) => set({ isExportModalOpen: open }),
}))
