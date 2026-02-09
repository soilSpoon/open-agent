/**
 * Iteration Persistence Tests (JSONL format)
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  createIterationPersistence,
  type IterationPersistence,
} from "./iteration";
import type { IterationLog } from "./types";

const TEST_DIR = path.join(process.cwd(), ".test-ralph-iteration");
const ITERATIONS_DIR = path.join(TEST_DIR, "iterations");
const TEST_SESSION_ID = "sess-test123";

async function cleanup() {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch {
    // Ignore
  }
}

function createTestLog(
  iteration: number,
  overrides: Partial<IterationLog> = {},
): IterationLog {
  return {
    schemaVersion: 2,
    sessionId: TEST_SESSION_ID,
    iteration,
    taskId: `task-${iteration}`,
    taskAttempt: 1,
    timestamp: new Date().toISOString(),
    status: "success",
    agentClaimedComplete: true,
    durationMs: 5000,
    ...overrides,
  };
}

describe("IterationPersistence", () => {
  let persistence: IterationPersistence;

  beforeEach(async () => {
    await cleanup();
    await fs.mkdir(ITERATIONS_DIR, { recursive: true });
    persistence = createIterationPersistence({
      iterationsDir: ITERATIONS_DIR,
      ralphDir: TEST_DIR,
      sessionId: TEST_SESSION_ID,
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("save and read", () => {
    it("should save iteration log in JSONL format", async () => {
      const log = createTestLog(1, {
        implemented: ["Added feature A"],
        codebasePatterns: ["Use composition over inheritance"],
        summary: "Successfully implemented feature A",
      });

      const filename = await persistence.saveIteration(log);

      // Check file was created with correct extension
      const files = await fs.readdir(ITERATIONS_DIR);
      expect(files).toContain(filename);
      expect(filename).toEndWith(".log");
      expect(filename).toStartWith(TEST_SESSION_ID.slice(0, 8));
    });

    it("should read saved iteration log", async () => {
      const log = createTestLog(1, {
        taskId: "test-task",
        status: "success",
      });

      const filename = await persistence.saveIteration(log);
      const readLog = await persistence.readIteration(filename);

      expect(readLog).not.toBeNull();
      expect(readLog?.taskId).toBe("test-task");
      expect(readLog?.status).toBe("success");
      expect(readLog?.sessionId).toBe(TEST_SESSION_ID);
      expect(readLog?.agentClaimedComplete).toBe(true);
    });

    it("should save failed iteration with failure analysis", async () => {
      const log = createTestLog(2, {
        status: "failed",
        agentClaimedComplete: false,
        failureAnalysis: {
          rootCause: "Type mismatch in props",
          fixPlan: "Add proper TypeScript interface",
          errorMessage: "Type 'string' is not assignable to type 'number'",
          errorType: "validation",
        },
      });

      const filename = await persistence.saveIteration(log);
      const readLog = await persistence.readIteration(filename);

      expect(readLog?.status).toBe("failed");
      expect(readLog?.agentClaimedComplete).toBe(false);
      expect(readLog?.failureAnalysis?.rootCause).toBe(
        "Type mismatch in props",
      );
    });

    it("should return null for non-existent iteration", async () => {
      const log = await persistence.readIteration("non-existent.log");
      expect(log).toBeNull();
    });

    it("should store verification evidence", async () => {
      const log = createTestLog(1, {
        verificationEvidence: {
          checkOutput: "All checks passed",
          checkOutputSummary: "All checks passed",
          specValidation: { passed: true },
          allChecksPassed: true,
          collectedAt: new Date().toISOString(),
        },
      });

      const filename = await persistence.saveIteration(log);
      const readLog = await persistence.readIteration(filename);

      expect(readLog?.verificationEvidence?.allChecksPassed).toBe(true);
      expect(readLog?.verificationEvidence?.specValidation?.passed).toBe(true);
    });

    it("should store structured context", async () => {
      const log = createTestLog(1, {
        context: {
          whatWasDone: ["Implemented feature A", "Added tests"],
          learnings: ["Use zod for validation"],
          filesChanged: ["src/feature.ts"],
          gotchas: ["Watch out for edge case"],
        },
      });

      const filename = await persistence.saveIteration(log);
      const readLog = await persistence.readIteration(filename);

      expect(readLog?.context?.whatWasDone).toEqual([
        "Implemented feature A",
        "Added tests",
      ]);
      expect(readLog?.context?.learnings).toEqual(["Use zod for validation"]);
    });
  });

  describe("list iteration logs", () => {
    it("should list all iterations with metadata", async () => {
      for (let i = 3; i >= 1; i--) {
        await persistence.saveIteration(createTestLog(i));
      }

      const logs = await persistence.listIterationLogs();
      expect(logs).toHaveLength(3);
      // Should be sorted by iteration number
      expect(logs[0].metadata.iteration).toBe(1);
      expect(logs[2].metadata.iteration).toBe(3);
    });

    it("should return empty array for empty directory", async () => {
      const logs = await persistence.listIterationLogs();
      expect(logs).toEqual([]);
    });
  });

  describe("load iteration logs", () => {
    it("should load logs with filtering", async () => {
      await persistence.saveIteration(createTestLog(1, { taskId: "task-a" }));
      await persistence.saveIteration(createTestLog(2, { taskId: "task-b" }));
      await persistence.saveIteration(
        createTestLog(3, { taskId: "task-a", status: "failed" }),
      );

      const taskALogs = await persistence.loadIterationLogs({
        taskId: "task-a",
      });
      expect(taskALogs).toHaveLength(2);

      const failedLogs = await persistence.loadIterationLogs({
        status: "failed",
      });
      expect(failedLogs).toHaveLength(1);
    });

    it("should support pagination", async () => {
      for (let i = 1; i <= 5; i++) {
        await persistence.saveIteration(createTestLog(i));
      }

      const page1 = await persistence.loadIterationLogs({
        limit: 2,
        offset: 0,
      });
      expect(page1).toHaveLength(2);

      const page2 = await persistence.loadIterationLogs({
        limit: 2,
        offset: 2,
      });
      expect(page2).toHaveLength(2);
    });
  });

  describe("get recent progress summary", () => {
    it("should return summary of recent iterations", async () => {
      for (let i = 1; i <= 5; i++) {
        await persistence.saveIteration(
          createTestLog(i, { summary: `Iteration ${i}` }),
        );
      }

      const { iterations, summary, stats } =
        await persistence.getRecentProgressSummary(3);

      expect(iterations).toHaveLength(3);
      expect(stats.total).toBe(5);
      expect(summary).toContain("Iteration 5");
    });
  });

  describe("task history", () => {
    it("should return iterations for specific task", async () => {
      // Task 1 - 3 attempts
      for (let i = 1; i <= 3; i++) {
        await persistence.saveIteration(
          createTestLog(i, {
            taskId: "task-1",
            taskAttempt: i,
            status: i === 3 ? "success" : "failed",
          }),
        );
      }

      // Task 2 - 1 attempt
      await persistence.saveIteration(createTestLog(4, { taskId: "task-2" }));

      const task1Logs = await persistence.readTaskIterations("task-1");
      expect(task1Logs).toHaveLength(3);
      expect(task1Logs[2].status).toBe("success");
    });

    it("should return failure history for task", async () => {
      await persistence.saveIteration(
        createTestLog(1, {
          taskId: "task-1",
          status: "failed",
          failureAnalysis: {
            rootCause: "Error 1",
            fixPlan: "Fix 1",
            errorMessage: "Message 1",
            errorType: "validation",
          },
        }),
      );

      await persistence.saveIteration(
        createTestLog(2, {
          taskId: "task-1",
          status: "failed",
          failureAnalysis: {
            rootCause: "Error 2",
            fixPlan: "Fix 2",
            errorMessage: "Message 2",
            errorType: "runtime",
          },
        }),
      );

      const failures = await persistence.getTaskFailureHistory("task-1", 2);
      expect(failures).toHaveLength(2);
      expect(failures[0].rootCause).toBe("Error 1");
      expect(failures[1].rootCause).toBe("Error 2");
    });
  });

  describe("get last failure", () => {
    it("should return most recent failed iteration", async () => {
      await persistence.saveIteration(createTestLog(1, { status: "success" }));
      await persistence.saveIteration(
        createTestLog(2, {
          status: "failed",
          failureAnalysis: {
            rootCause: "Test error",
            fixPlan: "Test fix",
            errorMessage: "Test message",
            errorType: "validation",
          },
        }),
      );

      const lastFailure = await persistence.getLastFailure();
      expect(lastFailure).not.toBeNull();
      expect(lastFailure?.iteration).toBe(2);
      expect(lastFailure?.failureAnalysis?.rootCause).toBe("Test error");
    });

    it("should return null when no failures exist", async () => {
      await persistence.saveIteration(createTestLog(1, { status: "success" }));
      const lastFailure = await persistence.getLastFailure();
      expect(lastFailure).toBeNull();
    });
  });

  describe("cleanup iteration logs", () => {
    it("should support dry-run cleanup", async () => {
      for (let i = 1; i <= 10; i++) {
        await persistence.saveIteration(createTestLog(i));
      }

      const result = await persistence.cleanupIterationLogs({
        maxIterations: 5,
        dryRun: true,
      });

      expect(result.kept).toHaveLength(5);
      expect(result.archived.length + result.deleted.length).toBe(5);

      // Verify files still exist
      const files = await fs.readdir(ITERATIONS_DIR);
      expect(files.filter((f) => f.endsWith(".log"))).toHaveLength(10);
    });
  });

  describe("progress.md support", () => {
    it("should read and write progress.md", async () => {
      const content = "# Progress\n\n## Codebase Patterns\n- Pattern 1\n";
      await persistence.writeProgressMd(content);

      const read = await persistence.readProgressMd();
      expect(read).toBe(content);
    });

    it("should extract codebase patterns from progress.md", async () => {
      const content = `## Codebase Patterns
- Use zod for validation
- Prefer async/await
- Use TypeScript strict mode`;

      await persistence.writeProgressMd(content);
      const patterns = await persistence.extractCodebasePatterns();

      expect(patterns).toContain("Use zod for validation");
      expect(patterns).toContain("Prefer async/await");
    });

    it("should return null for non-existent progress.md", async () => {
      const read = await persistence.readProgressMd();
      expect(read).toBeNull();
    });
  });
});
