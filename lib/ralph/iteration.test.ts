/**
 * Iteration Persistence Tests
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  createIterationPersistence,
  type IterationPersistence,
} from "./iteration.js";
import type { IterationLog } from "./types.js";

const TEST_DIR = path.join(process.cwd(), ".test-ralph-iteration");
const ITERATIONS_DIR = path.join(TEST_DIR, "iterations");

async function cleanup() {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch {
    // Ignore
  }
}

describe("IterationPersistence", () => {
  let persistence: IterationPersistence;

  beforeEach(async () => {
    await cleanup();
    await fs.mkdir(ITERATIONS_DIR, { recursive: true });
    persistence = createIterationPersistence({
      iterationsDir: ITERATIONS_DIR,
      ralphDir: TEST_DIR,
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("save and read", () => {
    it("should save iteration log", async () => {
      const log: IterationLog = {
        schemaVersion: 1,
        iteration: 1,
        taskId: "task-1",
        taskAttempt: 1,
        timestamp: new Date().toISOString(),
        status: "success",
        durationMs: 5000,
        implemented: ["Added feature A"],
        codebasePatterns: ["Use composition over inheritance"],
        summary: "Successfully implemented feature A",
      };

      await persistence.saveIteration(log);

      const readLog = await persistence.readIteration(1);
      expect(readLog).not.toBeNull();
      expect(readLog!.taskId).toBe("task-1");
      expect(readLog!.status).toBe("success");
    });

    it("should save failed iteration with failure analysis", async () => {
      const log: IterationLog = {
        schemaVersion: 1,
        iteration: 2,
        taskId: "task-1",
        taskAttempt: 2,
        timestamp: new Date().toISOString(),
        status: "failed",
        durationMs: 3000,
        failureAnalysis: {
          rootCause: "Type mismatch in props",
          fixPlan: "Add proper TypeScript interface",
          errorMessage: "Type 'string' is not assignable to type 'number'",
          errorType: "validation",
        },
      };

      await persistence.saveIteration(log);

      const readLog = await persistence.readIteration(2);
      expect(readLog!.status).toBe("failed");
      expect(readLog!.failureAnalysis!.rootCause).toBe(
        "Type mismatch in props",
      );
    });

    it("should return null for non-existent iteration", async () => {
      const log = await persistence.readIteration(999);
      expect(log).toBeNull();
    });

    it("should use zero-padded filenames for sorting", async () => {
      const log1: IterationLog = {
        schemaVersion: 1,
        iteration: 1,
        taskId: "task-1",
        taskAttempt: 1,
        timestamp: new Date().toISOString(),
        status: "success",
        durationMs: 1000,
      };

      const log99: IterationLog = {
        schemaVersion: 1,
        iteration: 99,
        taskId: "task-1",
        taskAttempt: 1,
        timestamp: new Date().toISOString(),
        status: "success",
        durationMs: 1000,
      };

      await persistence.saveIteration(log1);
      await persistence.saveIteration(log99);

      const files = await fs.readdir(ITERATIONS_DIR);
      expect(files).toContain("0001.json");
      expect(files).toContain("0099.json");
    });
  });

  describe("list iterations", () => {
    it("should list all iterations in order", async () => {
      for (let i = 3; i >= 1; i--) {
        await persistence.saveIteration({
          schemaVersion: 1,
          iteration: i,
          taskId: `task-${i}`,
          taskAttempt: 1,
          timestamp: new Date().toISOString(),
          status: "success",
          durationMs: 1000,
        });
      }

      const iterations = await persistence.listIterations();
      expect(iterations).toEqual([1, 2, 3]);
    });

    it("should return empty array for empty directory", async () => {
      const iterations = await persistence.listIterations();
      expect(iterations).toEqual([]);
    });
  });

  describe("read recent iterations", () => {
    it("should return last N iterations", async () => {
      for (let i = 1; i <= 5; i++) {
        await persistence.saveIteration({
          schemaVersion: 1,
          iteration: i,
          taskId: `task-${i}`,
          taskAttempt: 1,
          timestamp: new Date().toISOString(),
          status: "success",
          durationMs: 1000,
        });
      }

      const recent = await persistence.readRecentIterations(3);
      expect(recent).toHaveLength(3);
      expect(recent[0].iteration).toBe(3);
      expect(recent[2].iteration).toBe(5);
    });
  });

  describe("task history", () => {
    it("should return iterations for specific task", async () => {
      // Task 1 - 3 attempts
      for (let i = 1; i <= 3; i++) {
        await persistence.saveIteration({
          schemaVersion: 1,
          iteration: i,
          taskId: "task-1",
          taskAttempt: i,
          timestamp: new Date().toISOString(),
          status: i === 3 ? "success" : "failed",
          durationMs: 1000,
        });
      }

      // Task 2 - 1 attempt
      await persistence.saveIteration({
        schemaVersion: 1,
        iteration: 4,
        taskId: "task-2",
        taskAttempt: 1,
        timestamp: new Date().toISOString(),
        status: "success",
        durationMs: 1000,
      });

      const task1Logs = await persistence.readTaskIterations("task-1");
      expect(task1Logs).toHaveLength(3);
      expect(task1Logs[2].status).toBe("success");
    });

    it("should return failure history for task", async () => {
      await persistence.saveIteration({
        schemaVersion: 1,
        iteration: 1,
        taskId: "task-1",
        taskAttempt: 1,
        timestamp: new Date().toISOString(),
        status: "failed",
        durationMs: 1000,
        failureAnalysis: {
          rootCause: "Error 1",
          fixPlan: "Fix 1",
          errorMessage: "Message 1",
          errorType: "validation",
        },
      });

      await persistence.saveIteration({
        schemaVersion: 1,
        iteration: 2,
        taskId: "task-1",
        taskAttempt: 2,
        timestamp: new Date().toISOString(),
        status: "failed",
        durationMs: 1000,
        failureAnalysis: {
          rootCause: "Error 2",
          fixPlan: "Fix 2",
          errorMessage: "Message 2",
          errorType: "runtime",
        },
      });

      const failures = await persistence.getTaskFailureHistory("task-1", 2);
      expect(failures).toHaveLength(2);
      expect(failures[0].rootCause).toBe("Error 1");
      expect(failures[1].rootCause).toBe("Error 2");
    });
  });

  describe("get last failure", () => {
    it("should return most recent failed iteration", async () => {
      await persistence.saveIteration({
        schemaVersion: 1,
        iteration: 1,
        taskId: "task-1",
        taskAttempt: 1,
        timestamp: new Date().toISOString(),
        status: "success",
        durationMs: 1000,
      });

      await persistence.saveIteration({
        schemaVersion: 1,
        iteration: 2,
        taskId: "task-1",
        taskAttempt: 2,
        timestamp: new Date().toISOString(),
        status: "failed",
        durationMs: 1000,
        failureAnalysis: {
          rootCause: "Test error",
          fixPlan: "Test fix",
          errorMessage: "Test message",
          errorType: "validation",
        },
      });

      const lastFailure = await persistence.getLastFailure();
      expect(lastFailure).not.toBeNull();
      expect(lastFailure!.iteration).toBe(2);
      expect(lastFailure!.failureAnalysis!.rootCause).toBe("Test error");
    });

    it("should return null when no failures exist", async () => {
      const lastFailure = await persistence.getLastFailure();
      expect(lastFailure).toBeNull();
    });
  });

  describe("next iteration number", () => {
    it("should return 1 for empty directory", async () => {
      const next = await persistence.getNextIterationNumber();
      expect(next).toBe(1);
    });

    it("should return max + 1", async () => {
      await persistence.saveIteration({
        schemaVersion: 1,
        iteration: 5,
        taskId: "task-1",
        taskAttempt: 1,
        timestamp: new Date().toISOString(),
        status: "success",
        durationMs: 1000,
      });

      const next = await persistence.getNextIterationNumber();
      expect(next).toBe(6);
    });
  });
});
