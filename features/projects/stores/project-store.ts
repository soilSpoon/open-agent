import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ProjectState {
  selectedProjectId: string | null;
  setSelectedProject: (id: string) => void;
  clearSelectedProject: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      selectedProjectId: null,
      setSelectedProject: (id) => set({ selectedProjectId: id }),
      clearSelectedProject: () => set({ selectedProjectId: null }),
    }),
    {
      name: "open-agent-active-project",
    },
  ),
);

// Selector hook for derived state
export function useSelectedProjectId() {
  return useProjectStore((state) => state.selectedProjectId);
}

export function useSetSelectedProject() {
  return useProjectStore((state) => state.setSelectedProject);
}
