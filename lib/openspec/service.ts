import fs from "node:fs/promises";
import path from "node:path";
import type {
  ArtifactContent,
  ArtifactStatus,
  ArtifactType,
  OpenSpecChange,
} from "./types.ts";

const OPENSPEC_ROOT = path.join(process.cwd(), "openspec");
const CHANGES_DIR = path.join(OPENSPEC_ROOT, "changes");

async function ensureDir() {
  try {
    await fs.access(CHANGES_DIR);
  } catch {
    await fs.mkdir(CHANGES_DIR, { recursive: true });
  }
}

export async function getChanges(): Promise<OpenSpecChange[]> {
  await ensureDir();
  const entries = await fs.readdir(CHANGES_DIR, { withFileTypes: true });
  const changes = await Promise.all(
    entries
      .filter((e) => e.isDirectory() && e.name !== "archive")
      .map((e) => getChange(e.name)),
  );

  return changes.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function getChange(id: string): Promise<OpenSpecChange> {
  const dir = path.join(CHANGES_DIR, id);
  const stats = await fs.stat(dir);

  const artifacts = {
    proposal: await checkArtifact(dir, "proposal.md"),
    specs: await checkArtifact(dir, "specs"),
    design: await checkArtifact(dir, "design.md"),
    tasks: await checkArtifact(dir, "tasks.md"),
  };

  return {
    id,
    title: id,
    status: "active",
    createdAt: stats.birthtime,
    updatedAt: stats.mtime,
    artifacts,
  };
}

async function checkArtifact(
  dir: string,
  name: string,
): Promise<ArtifactStatus> {
  const filePath = path.join(dir, name);
  try {
    const stats = await fs.stat(filePath);
    return { exists: true, path: filePath, lastModified: stats.mtime };
  } catch {
    return { exists: false, path: filePath };
  }
}

export async function createChange(title: string): Promise<OpenSpecChange> {
  const id = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const dir = path.join(CHANGES_DIR, id);
  await fs.mkdir(dir, { recursive: true });
  return getChange(id);
}

export async function getArtifactContent(
  changeId: string,
  type: ArtifactType,
): Promise<ArtifactContent | null> {
  // We need to fetch the change to ensure it exists, but we don't need the return value here.
  await getChange(changeId);
  const artifactName = type === "specs" ? "specs" : `${type}.md`;
  const artifactPath = path.join(CHANGES_DIR, changeId, artifactName);

  try {
    const stats = await fs.stat(artifactPath);
    if (stats.isDirectory()) {
      // For specs directory, we might return a summary or list of files
      // For MVP, just return a placeholder
      return { type, content: "(Specs directory)", lastModified: stats.mtime };
    }
    const content = await fs.readFile(artifactPath, "utf-8");
    return { type, content, lastModified: stats.mtime };
  } catch {
    return null;
  }
}

export async function saveArtifact(
  changeId: string,
  type: ArtifactType,
  content: string,
): Promise<void> {
  const artifactName = type === "specs" ? "specs/README.md" : `${type}.md`; // Simple fallback for specs
  const filePath = path.join(CHANGES_DIR, changeId, artifactName);

  // Ensure specs dir if writing to it
  if (type === "specs") {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  await fs.writeFile(filePath, content, "utf-8");
}
