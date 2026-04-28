import { create } from 'zustand'

const useStore = create((set) => ({
  selectedTemplate: null,
  projectConfig: null,
  fileTree: null,
  setSelectedTemplate: (t) => set({ selectedTemplate: t }),
  setProjectConfig: (c) => set({ projectConfig: c }),
  setFileTree: (f) => set({ fileTree: f }),
}))

export default useStore
