import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getSpecsContent, getSpecsList } from "./specs-utils";
import {
  type ArtifactContent,
  type ArtifactStatus,
  type ArtifactType,
  ExecErrorSchema,
  type OpenSpecChange,
  type OpenSpecCLIStatus,
  OpenSpecCLIStatusSchema,
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

export async function createChange(
  title: string,
  description?: string,
): Promise<OpenSpecChange> {
  const id = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const openspecBin = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    "openspec",
  );
  try {
    await execAsync(`"${openspecBin}" new change "${id}"`);
  } catch (error) {
    const result = ExecErrorSchema.safeParse(error);
    if (result.success) {
      const { stdout = "", stderr = "" } = result.data;
      if (
        stderr.includes("already exists") ||
        stdout.includes("already exists")
      ) {
        return getChange(id);
      }
    }
    console.error("Failed to create change via openspec CLI:", error);
    throw error;
  }

  const dir = path.join(CHANGES_DIR, id);

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
    const [proposal, design, tasks] = await Promise.all([
      fs.readFile(path.join(templateDir, "proposal.md"), "utf-8"),
      fs.readFile(path.join(templateDir, "design.md"), "utf-8"),
      fs.readFile(path.join(templateDir, "tasks.md"), "utf-8"),
    ]);

    const descriptionSection = description
      ? `\n\n## Description\n\n${description}`
      : "";

    const proposalWithTitle = `# Proposal: ${title}${descriptionSection}\n\n${proposal}`;
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
  }

  return getChange(id);
}

export { getSpecsList };

export async function getArtifactContent(
  changeId: string,
  type: ArtifactType,
  filePath?: string,
): Promise<ArtifactContent | null> {
  await getChange(changeId);

  if (type === "specs" && filePath) {
    const fullPath = path.join(CHANGES_DIR, changeId, "specs", filePath);
    try {
      const stats = await fs.stat(fullPath);
      const content = await fs.readFile(fullPath, "utf-8");
      return { type, content, lastModified: stats.mtime };
    } catch {
      return null;
    }
  }

  const artifactName = type === "specs" ? "specs" : `${type}.md`;
  const artifactPath = path.join(CHANGES_DIR, changeId, artifactName);

  try {
    const stats = await fs.stat(artifactPath);
    if (stats.isDirectory()) {
      const content = await getSpecsContent(changeId);
      return { type, content, lastModified: stats.mtime };
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
  filePath?: string,
): Promise<void> {
  let artifactName = type === "specs" ? "specs/README.md" : `${type}.md`;

  if (type === "specs" && filePath) {
    artifactName = `specs/${filePath}`;
  }

  const fullPath = path.join(CHANGES_DIR, changeId, artifactName);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  await fs.writeFile(fullPath, content, "utf-8");
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
    const result = OpenSpecCLIStatusSchema.safeParse(JSON.parse(stdout));
    if (!result.success) {
      console.error("Failed to parse CLI status:", result.error);
      return null;
    }
    return result.data;
  } catch (error) {
    console.error("Failed to get change status:", error);
    return null;
  }
}
