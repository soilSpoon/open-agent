import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type {
  ArtifactContent,
  ArtifactStatus,
  ArtifactType,
  OpenSpecChange,
  OpenSpecCLIStatus,
} from "./types";

const execAsync = promisify(exec);

const OPENSPEC_ROOT = path.join(process.cwd(), "openspec");
const CHANGES_DIR = path.join(OPENSPEC_ROOT, "changes");

async function ensureDir() {
  try {
    await fs.access(CHANGES_DIR);
  } catch {
    await fs.mkdir(CHANGES_DIR, { recursive: true });
  }
}

export async function deleteChange(id: string): Promise<void> {
  const dir = path.join(CHANGES_DIR, id);
  await fs.rm(dir, { recursive: true, force: true });
}

export async function renameChange(
  id: string,
  newTitle: string,
): Promise<OpenSpecChange> {
  const newId = newTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (id === newId) {
    return getChange(id);
  }

  const oldDir = path.join(CHANGES_DIR, id);
  const newDir = path.join(CHANGES_DIR, newId);

  await fs.rename(oldDir, newDir);
  return getChange(newId);
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

  // 1. Run openspec CLI to create change directory and metadata
  const openspecBin = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    "openspec",
  );
  try {
    await execAsync(`"${openspecBin}" new change "${id}"`);
  } catch (error) {
    const err = error as { stderr?: string; stdout?: string };
    // Check if error is because it already exists
    if (
      err.stderr?.includes("already exists") ||
      err.stdout?.includes("already exists")
    ) {
      // It exists, just return it
      return getChange(id);
    }
    console.error("Failed to create change via openspec CLI:", error);
    throw error;
  }

  const dir = path.join(CHANGES_DIR, id);

  // 2. Read templates from installed openspec package
  // We use the 'spec-driven' schema templates by default
  const templateDir = path.join(
    process.cwd(),
    "node_modules",
    "@fission-ai",
    "openspec",
    "schemas",
    "spec-driven",
    "templates",
  );

  try {
    // Read standard templates
    const [proposal, design, tasks] = await Promise.all([
      fs.readFile(path.join(templateDir, "proposal.md"), "utf-8"),
      fs.readFile(path.join(templateDir, "design.md"), "utf-8"),
      fs.readFile(path.join(templateDir, "tasks.md"), "utf-8"),
    ]);

    // 3. Write files to the new change directory
    // Prepend title for better UX
    const proposalWithTitle = `# Proposal: ${title}\n\n${proposal}`;
    const designWithTitle = `# Design: ${title}\n\n${design}`;
    const tasksWithTitle = `# Tasks: ${title}\n\n${tasks}`;

    await Promise.all([
      fs.writeFile(path.join(dir, "proposal.md"), proposalWithTitle, "utf-8"),
      fs.writeFile(path.join(dir, "design.md"), designWithTitle, "utf-8"),
      fs.writeFile(path.join(dir, "tasks.md"), tasksWithTitle, "utf-8"),
      fs.mkdir(path.join(dir, "specs"), { recursive: true }),
    ]);
  } catch (e) {
    console.warn("Failed to copy templates from openspec package", e);
    // Continue even if template copying fails, as the change itself was created
  }

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

export async function getChangeStatus(
  id: string,
): Promise<OpenSpecCLIStatus | null> {
  const openspecBin = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    "openspec",
  );

  try {
    const { stdout } = await execAsync(
      `"${openspecBin}" status --change "${id}" --json`,
    );
    return JSON.parse(stdout) as OpenSpecCLIStatus;
  } catch (error) {
    console.error("Failed to get change status:", error);
    return null;
  }
}
