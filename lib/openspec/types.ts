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

export type ArtifactType = "proposal" | "specs" | "design" | "tasks";

export interface ArtifactContent {
  type: ArtifactType;
  content: string;
  lastModified: Date;
}
