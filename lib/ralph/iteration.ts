/**
 * Ralph Iteration Persistence
 *
 * Manages immutable iteration logs:
 * - JSONL format (line-by-line JSON for AI-native parsing)
 * - Atomic writes with YAML frontmatter metadata
 * - File naming: {sessionId.slice(0,8)}_{timestamp}_{taskId}.log
 * - Progress.md support (optional, agent-written)
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  type FailureAnalysis,
  type IterationLog,
  IterationLogSchema,
} from "./types";

function hasCode(error: unknown): error is { code: unknown } {
  return typeof error === "object" && error !== null && "code" in error;
}

function isENOENT(error: unknown): boolean {
  return hasCode(error) && error.code === "ENOENT";
}

export interface IterationPersistenceOptions {
  iterationsDir: string;
  ralphDir: string;
  sessionId: string;
}

/**
 * Iteration log metadata from YAML frontmatter
 */
export interface IterationLogMetadata {
  iteration: number;
  taskId: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  sessionId: string;
}

/**
 * Iteration log file info for listing
 */
export interface IterationLogInfo {
  filename: string;
  filepath: string;
  metadata: IterationLogMetadata;
  sizeBytes: number;
  modifiedAt: Date;
}

export class IterationPersistence {
  private iterationsDir: string;
  private progressPath: string;
  private sessionId: string;

  constructor(options: IterationPersistenceOptions) {
    this.iterationsDir = options.iterationsDir;
    this.progressPath = path.join(options.ralphDir, "progress.md");
    this.sessionId = options.sessionId;
  }

  // ========================================================================
  // Iteration Log CRUD (JSONL Format)
  // ========================================================================

  /**
   * Save a new iteration log (Individual JSON format)
   * File naming: 0001.json, 0002.json, ...
   */
  async saveIteration(log: IterationLog): Promise<string> {
    const filename = `${String(log.iteration).padStart(4, "0")}.json`;
    const filepath = path.join(this.iterationsDir, filename);

    // Build JSON content
    const content = JSON.stringify(log, null, 2);

    // Atomic write
    const tempPath = `${filepath}.tmp`;
    await fs.writeFile(tempPath, content, "utf-8");

    // Ensure data is flushed to disk
    const handle = await fs.open(tempPath, "r+");
    await handle.sync();
    await handle.close();

    await fs.rename(tempPath, filepath);

    return filename;
  }

  /**
   * Read a specific iteration log by filename
   */
  async readIteration(filename: string): Promise<IterationLog | null> {
    const filepath = path.join(this.iterationsDir, filename);

    try {
      const content = await fs.readFile(filepath, "utf-8");
      // Individual JSON files are simple JSON objects
      return IterationLogSchema.parse(JSON.parse(content));
    } catch (error) {
      if (isENOENT(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Read iteration log by iteration number (finds matching file)
   */
  async readIterationByNumber(iteration: number): Promise<IterationLog | null> {
    const logs = await this.listIterationLogs();
    const match = logs.find((l) => l.metadata.iteration === iteration);
    if (!match) return null;
    return this.readIteration(match.filename);
  }

  // ========================================================================
  // Listing and Filtering (US-005)
  // ========================================================================

  /**
   * List all iteration logs with metadata
   */
  async listIterationLogs(): Promise<IterationLogInfo[]> {
    try {
      const files = await fs.readdir(this.iterationsDir);
      const logFiles = files.filter(
        (f) => f.endsWith(".json") && !f.endsWith(".tmp"),
      );

      const infos: IterationLogInfo[] = [];
      for (const filename of logFiles) {
        const info = await this.getLogInfo(filename);
        if (info) infos.push(info);
      }

      // Sort by iteration number
      return infos.sort((a, b) => a.metadata.iteration - b.metadata.iteration);
    } catch {
      return [];
    }
  }

  /**
   * Load iteration logs with filtering options
   */
  async loadIterationLogs(
    options: {
      taskId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<IterationLog[]> {
    let logs = await this.listIterationLogs();

    // Apply filters
    if (options.taskId) {
      logs = logs.filter((l) => l.metadata.taskId === options.taskId);
    }
    if (options.status) {
      logs = logs.filter((l) => l.metadata.status === options.status);
    }

    // Apply pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? logs.length;
    const paginated = logs.slice(offset, offset + limit);

    // Load full content
    const results: IterationLog[] = [];
    for (const info of paginated) {
      const log = await this.readIteration(info.filename);
      if (log) results.push(log);
    }

    return results;
  }

  /**
   * Get recent progress summary (last N iterations)
   */
  async getRecentProgressSummary(count: number = 5): Promise<{
    iterations: IterationLog[];
    summary: string;
    stats: {
      total: number;
      success: number;
      failed: number;
      inProgress: number;
    };
  }> {
    const logs = await this.listIterationLogs();
    const recent = logs.slice(-count);

    const iterations: IterationLog[] = [];
    for (const info of recent) {
      const log = await this.readIteration(info.filename);
      if (log) iterations.push(log);
    }

    // Calculate stats
    const allLogs = await this.loadIterationLogs();
    const stats = {
      total: allLogs.length,
      success: allLogs.filter((l) => l.status === "success").length,
      failed: allLogs.filter((l) => l.status === "failed").length,
      inProgress: allLogs.filter((l) => l.status === "in_progress").length,
    };

    // Generate summary text
    const summary = this.generateSummaryText(iterations, stats);

    return { iterations, summary, stats };
  }

  // ========================================================================
  // Task-based Queries
  // ========================================================================

  /**
   * Read all iterations for a specific task
   */
  async readTaskIterations(taskId: string): Promise<IterationLog[]> {
    return this.loadIterationLogs({ taskId });
  }

  /**
   * Read recent iterations across all tasks
   */
  async readRecentIterations(count: number = 5): Promise<IterationLog[]> {
    return this.loadIterationLogs({ limit: count });
  }

  /**
   * Get failure analysis for a specific task's recent attempts
   */
  async getTaskFailureHistory(
    taskId: string,
    maxAttempts: number = 3,
  ): Promise<FailureAnalysis[]> {
    const taskLogs = await this.readTaskIterations(taskId);
    const failures = taskLogs
      .filter(
        (
          log,
        ): log is IterationLog & {
          failureAnalysis: NonNullable<IterationLog["failureAnalysis"]>;
        } => log.status === "failed" && !!log.failureAnalysis,
      )
      .slice(-maxAttempts)
      .map((log) => log.failureAnalysis);
    return failures;
  }

  /**
   * Extract failure analysis from the most recent failed iteration
   */
  async getLastFailure(): Promise<
    | (IterationLog & {
        failureAnalysis: NonNullable<IterationLog["failureAnalysis"]>;
      })
    | null
  > {
    const logs = await this.listIterationLogs();

    // Search backwards for failed iteration with analysis
    for (let i = logs.length - 1; i >= 0; i--) {
      const log = await this.readIteration(logs[i].filename);
      if (log && log.status === "failed" && log.failureAnalysis) {
        return { ...log, failureAnalysis: log.failureAnalysis };
      }
    }
    return null;
  }

  // ========================================================================
  // Progress.md Support (US-006 - Optional, Agent-written)
  // ========================================================================

  /**
   * Read progress.md if it exists (agent-written)
   */
  async readProgressMd(): Promise<string | null> {
    try {
      return await fs.readFile(this.progressPath, "utf-8");
    } catch (error) {
      if (isENOENT(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write progress.md (for agent to update)
   */
  async writeProgressMd(content: string): Promise<void> {
    const tempPath = `${this.progressPath}.tmp`;
    await fs.writeFile(tempPath, content, "utf-8");
    await fs.rename(tempPath, this.progressPath);
  }

  /**
   * Extract codebase patterns from progress.md
   */
  async extractCodebasePatterns(): Promise<string[]> {
    const content = await this.readProgressMd();
    if (!content) return [];

    // Match "## Codebase Patterns" section
    const pattern = /##\s*Codebase Patterns.*?\n([^#]+)/i;
    const match = content.match(pattern);
    if (!match?.[1]) return [];

    // Extract list items
    return match[1]
      .split("\n")
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .filter((line) => line.length > 0);
  }

  // ========================================================================
  // Log Retention and Cleanup
  // ========================================================================

  /**
   * Cleanup old iteration logs (default: keep 50 iterations or 30 days)
   */
  async cleanupIterationLogs(
    options: {
      maxIterations?: number;
      maxAgeDays?: number;
      dryRun?: boolean;
    } = {},
  ): Promise<{
    deleted: string[];
    archived: string[];
    kept: string[];
  }> {
    const maxIterations = options.maxIterations ?? 50;
    const maxAgeDays = options.maxAgeDays ?? 30;
    const dryRun = options.dryRun ?? false;

    const logs = await this.listIterationLogs();
    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

    const toDelete: IterationLogInfo[] = [];
    const toArchive: IterationLogInfo[] = [];
    const toKeep: IterationLogInfo[] = [];

    // Sort by modification time (oldest first)
    const sorted = [...logs].sort(
      (a, b) => a.modifiedAt.getTime() - b.modifiedAt.getTime(),
    );

    for (let i = 0; i < sorted.length; i++) {
      const log = sorted[i];
      const age = now - log.modifiedAt.getTime();

      // Keep recent N iterations
      if (sorted.length - i <= maxIterations) {
        toKeep.push(log);
        continue;
      }

      // Archive if within age limit
      if (age < maxAgeMs) {
        toArchive.push(log);
      } else {
        toDelete.push(log);
      }
    }

    const result = {
      deleted: toDelete.map((l) => l.filename),
      archived: toArchive.map((l) => l.filename),
      kept: toKeep.map((l) => l.filename),
    };

    if (dryRun) {
      return result;
    }

    // Create archive directory
    const archiveDir = path.join(this.iterationsDir, "archive");
    await fs.mkdir(archiveDir, { recursive: true });

    // Archive old logs
    for (const log of toArchive) {
      const src = log.filepath;
      const dst = path.join(archiveDir, log.filename);
      await fs.rename(src, dst);
    }

    // Delete very old logs
    for (const log of toDelete) {
      await fs.unlink(log.filepath);
    }

    return result;
  }

  // ========================================================================
  // Internal Formatting and Parsing
  // ========================================================================

  private async getLogInfo(filename: string): Promise<IterationLogInfo | null> {
    const filepath = path.join(this.iterationsDir, filename);

    try {
      const stats = await fs.stat(filepath);
      const content = await fs.readFile(filepath, "utf-8");
      const log = IterationLogSchema.parse(JSON.parse(content));

      const metadata: IterationLogMetadata = {
        iteration: log.iteration,
        taskId: log.taskId,
        status: log.status,
        startedAt: log.timestamp,
        sessionId: log.sessionId,
      };

      return {
        filename,
        filepath,
        metadata,
        sizeBytes: stats.size,
        modifiedAt: stats.mtime,
      };
    } catch {
      return null;
    }
  }

  private generateSummaryText(
    iterations: IterationLog[],
    stats: {
      total: number;
      success: number;
      failed: number;
      inProgress: number;
    },
  ): string {
    const lines: string[] = [
      `Recent iterations: ${iterations.length}`,
      `Total: ${stats.total} (✓ ${stats.success}, ✗ ${stats.failed}, ⏳ ${stats.inProgress})`,
      "",
    ];

    for (const log of iterations.slice(-5)) {
      const icon =
        log.status === "success" ? "✓" : log.status === "failed" ? "✗" : "⏳";
      lines.push(
        `${icon} Iteration ${log.iteration}: ${log.taskId} - ${log.summary || "No summary"}`,
      );

      if (log.status === "failed" && log.failureAnalysis) {
        lines.push(`  → Failed: ${log.failureAnalysis.rootCause}`);
      }
    }

    return lines.join("\n");
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createIterationPersistence(
  options: IterationPersistenceOptions,
): IterationPersistence {
  return new IterationPersistence(options);
}
