import { create } from "zustand";
import type { ArtifactType } from "@/lib/openspec/types";

interface PipelineState {
  stage: ArtifactType;
  viewMode: "visual" | "markdown";
  selectedSpecFile: string | null;
  setStage: (stage: ArtifactType) => void;
  setViewMode: (mode: "visual" | "markdown") => void;
  setSelectedSpecFile: (filePath: string | null) => void;
}

export const usePipelineStore = create<PipelineState>()((set) => ({
  stage: "proposal",
  viewMode: "visual",
  selectedSpecFile: null,
  setStage: (stage) => set({ stage }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedSpecFile: (filePath) => set({ selectedSpecFile: filePath }),
}));

export function useStage() {
  return usePipelineStore((state) => state.stage);
}

export function useViewMode() {
  return usePipelineStore((state) => state.viewMode);
}

export function useSelectedSpecFile() {
  return usePipelineStore((state) => state.selectedSpecFile);
}
