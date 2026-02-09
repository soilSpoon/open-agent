/**
 * Session Manager Tests
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createSessionManager, type SessionManager } from "./session.js";
import type { SessionState } from "./types.js";

const TEST_DIR = path.join(process.cwd(), ".test-ralph-session");

async function cleanup() {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch {
    // Ignore
  }
}

describe("SessionManager", () => {
  let manager: SessionManager;

  beforeEach(async () => {
    await cleanup();
    manager = await createSessionManager({
      changeId: "test-change",
      changeBasePath: TEST_DIR,
      maxIterations: 10,
      errorStrategy: "analyze-retry",
      maxRetries: 3,
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("initialization", () => {
    it("should create directories on init", async () => {
      const ralphDir = manager.getRalphDir();
      const iterationsDir = manager.getIterationsDir();

      const ralphStats = await fs.stat(ralphDir);
      const iterationsStats = await fs.stat(iterationsDir);

      expect(ralphStats.isDirectory()).toBe(true);
      expect(iterationsStats.isDirectory()).toBe(true);
    });

    it("should generate unique session ID", () => {
      const sessionId = manager.getSessionId();
      expect(sessionId).toStartWith("sess-");
      expect(sessionId.length).toBeGreaterThan(10);
    });
  });

  describe("session state", () => {
    it("should create initial state with correct defaults", () => {
      const state = manager.createInitialState();

      expect(state.schemaVersion).toBe(1);
      expect(state.status).toBe("running");
      expect(state.iteration).toBe(0);
      expect(state.maxIterations).toBe(10);
      expect(state.errorHandling.strategy).toBe("analyze-retry");
      expect(state.errorHandling.maxRetries).toBe(3);
      expect(state.context.recentFailures).toEqual([]);
      expect(state.context.codebasePatterns).toEqual([]);
    });

    it("should write and read session atomically", async () => {
      const state = manager.createInitialState();
      state.iteration = 5;
      state.currentTask = {
        id: "task-1",
        description: "Test task",
        attemptCount: 2,
      };

      await manager.writeSession(state);

      const readState = await manager.readSession();
      expect(readState).not.toBeNull();
      expect(readState!.iteration).toBe(5);
      expect(readState!.currentTask!.id).toBe("task-1");
      expect(readState!.currentTask!.attemptCount).toBe(2);
    });

    it("should return null when session does not exist", async () => {
      const state = await manager.readSession();
      expect(state).toBeNull();
    });

    it("should delete session", async () => {
      const state = manager.createInitialState();
      await manager.writeSession(state);

      let readState = await manager.readSession();
      expect(readState).not.toBeNull();

      await manager.deleteSession();

      readState = await manager.readSession();
      expect(readState).toBeNull();
    });
  });

  describe("lock file", () => {
    it("should acquire and release lock", async () => {
      await manager.acquireLock();

      const lockStatus = await manager.checkLock();
      expect(lockStatus.status).toBe("locked");
      if (lockStatus.status === "locked") {
        expect(lockStatus.stale).toBe(false);
      }

      await manager.releaseLock();

      const freeStatus = await manager.checkLock();
      expect(freeStatus.status).toBe("free");
    });

    it("should detect own process as running", async () => {
      await manager.acquireLock();

      const lockStatus = await manager.checkLock();
      expect(lockStatus.status).toBe("locked");

      // Our own process should be detected as running
      if (lockStatus.status === "locked") {
        expect(lockStatus.lock.pid).toBe(process.pid);
      }
    });

    it("should detect stale lock for non-existent process", async () => {
      // Create a lock with a fake PID
      const lockContent = JSON.stringify({
        pid: 99999, // Non-existent PID
        timestamp: new Date().toISOString(),
        sessionId: manager.getSessionId(),
      });

      const lockPath = path.join(manager.getRalphDir(), ".lock");
      await fs.mkdir(manager.getRalphDir(), { recursive: true });
      await fs.writeFile(lockPath, lockContent);

      const lockStatus = await manager.checkLock();
      expect(lockStatus.status).toBe("stale");
    });
  });

  describe("context management", () => {
    it("should add failure to context", () => {
      const state = manager.createInitialState();

      manager.addFailureToContext(state, {
        iteration: 1,
        taskId: "task-1",
        rootCause: "Missing import",
        fixPlan: "Add the missing import",
      });

      expect(state.context.recentFailures).toHaveLength(1);
      expect(state.context.recentFailures[0].rootCause).toBe("Missing import");
    });

    it("should keep only last 3 failures (rolling window)", () => {
      const state = manager.createInitialState();

      for (let i = 1; i <= 5; i++) {
        manager.addFailureToContext(state, {
          iteration: i,
          taskId: `task-${i}`,
          rootCause: `Error ${i}`,
          fixPlan: `Fix ${i}`,
        });
      }

      expect(state.context.recentFailures).toHaveLength(3);
      expect(state.context.recentFailures[0].rootCause).toBe("Error 3");
      expect(state.context.recentFailures[2].rootCause).toBe("Error 5");
    });

    it("should add pattern to context", () => {
      const state = manager.createInitialState();

      manager.addPatternToContext(state, "Use zod for validation");
      manager.addPatternToContext(state, "Prefer async/await");

      expect(state.context.codebasePatterns).toHaveLength(2);
      expect(state.context.codebasePatterns).toContain(
        "Use zod for validation",
      );
    });

    it("should not add duplicate patterns", () => {
      const state = manager.createInitialState();

      manager.addPatternToContext(state, "Use zod for validation");
      manager.addPatternToContext(state, "Use zod for validation");

      expect(state.context.codebasePatterns).toHaveLength(1);
    });
  });
});
