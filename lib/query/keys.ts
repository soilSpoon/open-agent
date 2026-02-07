// Centralized Query Keys for TanStack Query
// https://tkdodo.eu/blog/effective-react-query-keys

export const queryKeys = {
  projects: {
    all: ["projects"] as const,
    byId: (id: string) => ["projects", id] as const,
  },
  changes: {
    all: ["changes"] as const,
    byId: (id: string) => ["changes", id] as const,
    status: (id: string) => ["changes", id, "status"] as const,
    validation: (id: string) => ["changes", id, "validation"] as const,
    specs: (id: string) => ["changes", id, "specs"] as const,
    artifact: (id: string, type: string, filePath?: string) =>
      ["changes", id, "artifacts", type, filePath] as const,
  },
  runs: {
    all: ["runs"] as const,
    byId: (id: string) => ["runs", id] as const,
    byChange: (changeId: string) => ["runs", "change", changeId] as const,
    active: ["runs", "active"] as const,
  },
  dashboard: {
    stats: ["dashboard", "stats"] as const,
  },
};
