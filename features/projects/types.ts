import type { ProjectConfig as BaseProjectConfig } from "@/lib/openspec/types";

// Re-export for convenience
export type ProjectConfig = BaseProjectConfig;

// Result type for mutations
export type Result<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E };

// Form state for creating/editing projects
export interface ProjectFormData {
  name: string;
  path: string;
  checkCommand: string;
  preCheckCommand?: string;
}
