/**
 * Ralph Session Persistence
 *
 * Manages session.json read/write with:
 * - Atomic file operations (crash-safe)
 * - Schema versioning
 * - Lock file coordination
 */

import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  CURRENT_SCHEMA_VERSION,
  type ErrorStrategy,
  type LockFile,
  LockFileSchema,
  type LockStatus,
  type SessionState,
  SessionStateSchema,
} from "./types";

const SESSION_FILENAME = "session.json";
const LOCK_FILENAME = ".lock";

function hasCode(error: unknown): error is { code: unknown } {
  return typeof error === "object" && error !== null && "code" in error;
}

function isENOENT(error: unknown): boolean {
  return hasCode(error) && error.code === "ENOENT";
}

export interface SessionManagerOptions {
  changeId: string;
  changeBasePath: string;
  maxIterations?: number;
  errorStrategy?: ErrorStrategy;
  maxRetries?: number;
}

export class SessionManager {
  private ralphDir: string;
  private sessionPath: string;
  private lockPath: string;
  private options: SessionManagerOptions;
  private sessionId: string;

  constructor(options: SessionManagerOptions) {
    this.options = options;
    this.ralphDir = path.join(options.changeBasePath, ".ralph");
    this.sessionPath = path.join(this.ralphDir, SESSION_FILENAME);
    this.lockPath = path.join(this.ralphDir, LOCK_FILENAME);
    this.sessionId = `sess-${randomUUID().slice(0, 8)}`;
  }

  // ========================================================================
  // Directory Setup
  // ========================================================================

  async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.ralphDir, { recursive: true });
    await fs.mkdir(path.join(this.ralphDir, "iterations"), { recursive: true });
  }

  // ========================================================================
  // Session CRUD (Atomic Operations)
  // ========================================================================

  async readSession(): Promise<SessionState | null> {
    try {
      const content = await fs.readFile(this.sessionPath, "utf-8");
      const session = SessionStateSchema.parse(JSON.parse(content));

      // Schema migration check
      if (session.schemaVersion !== CURRENT_SCHEMA_VERSION) {
        console.warn(
          `[Session] Schema version mismatch: ${session.schemaVersion} vs ${CURRENT_SCHEMA_VERSION}`,
        );
        // TODO: Implement migration logic here
      }

      return session;
    } catch (error) {
      if (isENOENT(error)) {
        return null;
      }
      throw error;
    }
  }

  async writeSession(state: SessionState): Promise<void> {
    // Atomic write: write to temp file, then rename
    const tempPath = `${this.sessionPath}.tmp`;

    await fs.writeFile(tempPath, JSON.stringify(state, null, 2), "utf-8");

    // Ensure data is flushed to disk before renaming
    const handle = await fs.open(tempPath, "r+");
    await handle.sync();
    await handle.close();

    // Atomic rename
    await fs.rename(tempPath, this.sessionPath);
  }

  async deleteSession(): Promise<void> {
    try {
      await fs.unlink(this.sessionPath);
    } catch (error) {
      if (!isENOENT(error)) {
        throw error;
      }
    }
  }

  // ========================================================================
  // Session Initialization
  // ========================================================================

  createInitialState(): SessionState {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sessionId: this.sessionId,
      changeId: this.options.changeId,
      status: "running",
      currentTask: null,
      iteration: 0,
      maxIterations: this.options.maxIterations ?? 10,
      errorHandling: {
        strategy: this.options.errorStrategy ?? "analyze-retry",
        maxRetries: this.options.maxRetries ?? 3,
        currentRetryCount: 0,
      },
      context: {
        codebasePatterns: [],
        recentFailures: [],
      },
    };
  }

  // ========================================================================
  // Lock File Operations
  // ========================================================================

  async acquireLock(): Promise<void> {
    const lock: LockFile = {
      pid: process.pid,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
    };

    // Atomic write for lock file too
    const tempPath = `${this.lockPath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(lock, null, 2), "utf-8");
    await fs.rename(tempPath, this.lockPath);
  }

  async releaseLock(): Promise<void> {
    try {
      await fs.unlink(this.lockPath);
    } catch (error) {
      if (!isENOENT(error)) {
        throw error;
      }
    }
  }

  async checkLock(): Promise<LockStatus> {
    try {
      const content = await fs.readFile(this.lockPath, "utf-8");
      const lock = LockFileSchema.parse(JSON.parse(content));

      // Check if process is still running
      const isRunning = await this.isProcessRunning(lock.pid);

      if (isRunning) {
        return { status: "locked", lock, stale: false };
      }

      // Process not running - check staleness
      const lockAge = Date.now() - new Date(lock.timestamp).getTime();
      const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

      if (lockAge < STALE_THRESHOLD) {
        return { status: "stale", lock };
      }

      return { status: "stale", lock };
    } catch (error) {
      if (isENOENT(error)) {
        return { status: "free" };
      }
      throw error;
    }
  }

  private async isProcessRunning(pid: number): Promise<boolean> {
    try {
      // Send signal 0 to check if process exists (no actual signal sent)
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  // ========================================================================
  // Context Management
  // ========================================================================

  addFailureToContext(
    state: SessionState,
    failure: {
      iteration: number;
      taskId: string;
      rootCause: string;
      fixPlan: string;
    },
  ): void {
    // Add to recent failures
    state.context.recentFailures.push(failure);

    // Keep only last 3 (rolling window)
    if (state.context.recentFailures.length > 3) {
      state.context.recentFailures.shift();
    }
  }

  addPatternToContext(state: SessionState, pattern: string): void {
    // Avoid duplicates
    if (!state.context.codebasePatterns.includes(pattern)) {
      state.context.codebasePatterns.push(pattern);
    }
  }

  // ========================================================================
  // Path Accessors
  // ========================================================================

  getRalphDir(): string {
    return this.ralphDir;
  }

  getIterationsDir(): string {
    return path.join(this.ralphDir, "iterations");
  }

  getSessionId(): string {
    return this.sessionId;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export async function createSessionManager(
  options: SessionManagerOptions,
): Promise<SessionManager> {
  const manager = new SessionManager(options);
  await manager.ensureDirectories();
  return manager;
}
