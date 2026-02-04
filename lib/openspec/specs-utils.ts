import fs from "node:fs/promises";
import path from "node:path";
import type { SpecEntry } from "./types";

const OPENSPEC_ROOT = path.join(process.cwd(), "openspec");
const CHANGES_DIR = path.join(OPENSPEC_ROOT, "changes");

export async function getSpecsList(changeId: string): Promise<SpecEntry[]> {
  const specsDir = path.join(CHANGES_DIR, changeId, "specs");
  try {
    const entries = await fs.readdir(specsDir, { withFileTypes: true });

    // Sort directories first, then files
    const sortedEntries = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    const result: SpecEntry[] = [];

    for (const entry of sortedEntries) {
      if (entry.isDirectory()) {
        result.push({
          name: entry.name,
          path: `${entry.name}/spec.md`, // Convention: spec directory has spec.md
          type: "directory",
        });
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        result.push({
          name: entry.name,
          path: entry.name,
          type: "file",
        });
      }
    }

    return result;
  } catch {
    return [];
  }
}

export async function getSpecsContent(changeId: string): Promise<string> {
  const specsDir = path.join(CHANGES_DIR, changeId, "specs");
  try {
    const entries = await fs.readdir(specsDir, { withFileTypes: true });

    // Sort directories first, then files
    const sortedEntries = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    let content = "# Specs\n\n";

    if (sortedEntries.length === 0) {
      content += "_No specs defined yet._";
      return content;
    }

    for (const entry of sortedEntries) {
      const fullPath = path.join(specsDir, entry.name);

      if (entry.isDirectory()) {
        // Check for spec.md inside
        const specMdPath = path.join(fullPath, "spec.md");
        try {
          await fs.access(specMdPath);
          content += `- [${entry.name}](specs/${entry.name}/spec.md)\n`;
        } catch {
          content += `- ${entry.name}/\n`;
        }
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        entry.name !== "README.md"
      ) {
        content += `- [${entry.name}](specs/${entry.name})\n`;
      }
    }

    // If we have a README.md, append its content or use it as main content?
    // For now, let's keep it simple listing.

    return content;
  } catch {
    return "# Specs\n\n_Specs directory not created yet._";
  }
}
