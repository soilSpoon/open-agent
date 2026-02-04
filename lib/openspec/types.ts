export interface OpenSpecChange {
  id: string; // Folder name (e.g., "add-dark-mode")
  title: string; // From .openspec.yaml or folder name
  status: "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
  artifacts: {
    proposal: ArtifactStatus;
    specs: ArtifactStatus;
    design: ArtifactStatus;
    tasks: ArtifactStatus;
  };
}

export interface ArtifactStatus {
  exists: boolean;
  path: string;
  lastModified?: Date;
}

export interface OpenSpecArtifactStatus {
  id: string;
  status: "pending" | "done" | "ready" | "blocked";
  path: string;
  missingDeps?: string[];
  description?: string;
}

export interface OpenSpecCLIStatus {
  schemaName: string;
  artifacts: OpenSpecArtifactStatus[];
  isComplete: boolean;
}

export type ArtifactType = "proposal" | "specs" | "design" | "tasks";

export interface ArtifactContent {
  type: ArtifactType;
  content: string;
  lastModified: Date;
}
