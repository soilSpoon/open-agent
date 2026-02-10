/**
 * Prompt Template Engine Tests
 */

import { describe, expect, it } from "bun:test";
import { createPromptEngine } from "./prompt";
import type { IterationLog, SessionState } from "./types";

describe("PromptTemplateEngine", () => {
  const engine = createPromptEngine({
    projectName: "Test Project",
    projectPath: "/test/path",
    checkCommand: "bun run check",
  });

  describe("buildVariables", () => {
    it("should build variables from session", () => {
      const session: SessionState = {
        schemaVersion: 2,
        sessionId: "sess-test",
        changeId: "test-change",
        status: "running",
        currentTask: {
          id: "task-1",
          description: "Test task description",
          attemptCount: 2,
        },
        iteration: 5,
        maxIterations: 10,
        errorHandling: {
          strategy: "analyze-retry",
          maxRetries: 3,
          currentRetryCount: 1,
        },
        context: {
          codebasePatterns: ["Use TypeScript strict mode"],
          recentFailures: [
            {
              iteration: 3,
              taskId: "task-1",
              rootCause: "Missing type annotation",
              fixPlan: "Add proper types",
            },
          ],
        },
      };

      const recentLogs: IterationLog[] = [];
      const specContext = "### Test Spec\nSome content";
      const instruction = "Implement feature X";
      const taskList = "- [ ] task-1";

      const vars = engine.buildVariables(
        session,
        specContext,
        instruction,
        taskList,
        recentLogs,
      );

      expect(vars.taskId).toBe("task-1");
      expect(vars.taskDescription).toBe("Test task description");
      expect(vars.attemptCount).toBe(2);
      expect(vars.iteration).toBe(5);
      expect(vars.maxIterations).toBe(10);
      expect(vars.hasRecentFailures).toBe(true);
      expect(vars.hasCodebasePatterns).toBe(true);
    });

    it("should handle empty failures and patterns", () => {
      const session: SessionState = {
        schemaVersion: 2,
        sessionId: "sess-test",
        changeId: "test-change",
        status: "running",
        currentTask: {
          id: "task-1",
          description: "Test task",
          attemptCount: 1,
        },
        iteration: 1,
        maxIterations: 10,
        errorHandling: {
          strategy: "analyze-retry",
          maxRetries: 3,
          currentRetryCount: 0,
        },
        context: {
          codebasePatterns: [],
          recentFailures: [],
        },
      };

      const vars = engine.buildVariables(session, "", "", "", []);

      expect(vars.hasRecentFailures).toBe(false);
      expect(vars.hasCodebasePatterns).toBe(false);
    });
  });

  describe("generateMainPrompt", () => {
    it("should include failure context when failures exist", () => {
      const vars = {
        taskId: "task-1",
        taskDescription: "Test task",
        attemptCount: 2,
        iteration: 5,
        maxIterations: 10,
        projectName: "Test",
        projectPath: "/test",
        checkCommand: "bun run check",
        specContext: "### Spec",
        instruction: "Instruction",
        taskList: "Tasks",
        recentFailures: [
          {
            iteration: 4,
            taskId: "task-1",
            rootCause: "Import error",
            fixPlan: "Add missing import",
            errorMessage: "Module not found",
            errorType: "runtime",
          },
        ],
        hasRecentFailures: true,
        codebasePatterns: [],
        hasCodebasePatterns: false,
        recentProgress: "",
        hasRecentProgress: false,
        hasVerifierFeedback: false,
      };

      const prompt = engine.generateMainPrompt(vars);

      expect(prompt).toContain("CONTEXT FROM PREVIOUS ATTEMPTS");
      expect(prompt).toContain("Import error");
      expect(prompt).toContain("Add missing import");
    });

    it("should include codebase patterns when they exist", () => {
      const vars = {
        taskId: "task-1",
        taskDescription: "Test task",
        attemptCount: 1,
        iteration: 1,
        maxIterations: 10,
        projectName: "Test",
        projectPath: "/test",
        checkCommand: "bun run check",
        specContext: "### Spec",
        instruction: "Instruction",
        taskList: "Tasks",
        recentFailures: [],
        hasRecentFailures: false,
        codebasePatterns: ["Use zod for validation", "Prefer async/await"],
        hasCodebasePatterns: true,
        recentProgress: "",
        hasRecentProgress: false,
        hasVerifierFeedback: false,
      };

      const prompt = engine.generateMainPrompt(vars);

      expect(prompt).toContain("ACCUMULATED CODEBASE PATTERNS");
      expect(prompt).toContain("Use zod for validation");
      expect(prompt).toContain("Prefer async/await");
    });

    it("should include RALPH_ITERATION_LOG_JSON format", () => {
      const vars = {
        taskId: "task-1",
        taskDescription: "Test task",
        attemptCount: 1,
        iteration: 1,
        maxIterations: 10,
        projectName: "Test",
        projectPath: "/test",
        checkCommand: "bun run check",
        specContext: "### Spec",
        instruction: "Instruction",
        taskList: "Tasks",
        recentFailures: [],
        hasRecentFailures: false,
        codebasePatterns: [],
        hasCodebasePatterns: false,
        recentProgress: "",
        hasRecentProgress: false,
        hasVerifierFeedback: false,
      };

      const prompt = engine.generateMainPrompt(vars);

      expect(prompt).toContain("<RALPH_ITERATION_LOG_JSON>");
      expect(prompt).toContain('"task": "task-1"');
      expect(prompt).toContain('"complete": true');
    });

    it("should include execution workflow", () => {
      const vars = {
        taskId: "task-1",
        taskDescription: "Test task",
        attemptCount: 1,
        iteration: 1,
        maxIterations: 10,
        projectName: "Test",
        projectPath: "/test",
        checkCommand: "bun run check",
        specContext: "### Spec",
        instruction: "Instruction",
        taskList: "Tasks",
        recentFailures: [],
        hasRecentFailures: false,
        codebasePatterns: [],
        hasCodebasePatterns: false,
        recentProgress: "",
        hasRecentProgress: false,
        hasVerifierFeedback: false,
      };

      const prompt = engine.generateMainPrompt(vars);

      expect(prompt).toContain("EXECUTION WORKFLOW");
      expect(prompt).toContain("Explore & Plan");
      expect(prompt).toContain("Implement");
      expect(prompt).toContain("Quality Assurance");
    });
  });

  describe("generateAnalysisPrompt", () => {
    it("should include error message and context", () => {
      const session: SessionState = {
        schemaVersion: 2,
        sessionId: "sess-test",
        changeId: "test-change",
        status: "running",
        currentTask: {
          id: "task-1",
          description: "Test task",
          attemptCount: 2,
        },
        iteration: 5,
        maxIterations: 10,
        errorHandling: {
          strategy: "analyze-retry",
          maxRetries: 3,
          currentRetryCount: 1,
        },
        context: {
          codebasePatterns: [],
          recentFailures: [],
        },
      };

      const errorMessage = "Type error: string not assignable to number";
      const prompt = engine.generateAnalysisPrompt(session, errorMessage);

      expect(prompt).toContain("Failure Analysis Mode");
      expect(prompt).toContain(errorMessage);
      expect(prompt).toContain("Root Cause");
      expect(prompt).toContain("Fix Plan");
      expect(prompt).toContain('"complete": false');
      expect(prompt).toContain("failureAnalysis");
    });

    it("should include previous failure context when provided", () => {
      const session: SessionState = {
        schemaVersion: 2,
        sessionId: "sess-test",
        changeId: "test-change",
        status: "running",
        currentTask: {
          id: "task-1",
          description: "Test task",
          attemptCount: 3,
        },
        iteration: 6,
        maxIterations: 10,
        errorHandling: {
          strategy: "analyze-retry",
          maxRetries: 3,
          currentRetryCount: 2,
        },
        context: {
          codebasePatterns: [],
          recentFailures: [],
        },
      };

      const lastFailure = {
        rootCause: "Previous error",
        fixPlan: "Previous fix",
        errorMessage: "Previous message",
        errorType: "validation" as const,
      };

      const prompt = engine.generateAnalysisPrompt(
        session,
        "New error",
        lastFailure,
      );

      expect(prompt).toContain("PREVIOUS ATTEMPT FAILURE");
      expect(prompt).toContain("Previous error");
      expect(prompt).toContain("Previous fix");
    });
  });

  describe("token estimation", () => {
    it("should estimate tokens based on character count", () => {
      const prompt = "a".repeat(400); // ~100 tokens (4 chars per token)
      const estimate = engine.estimateTokens(prompt);
      expect(estimate).toBe(100);
    });
  });
});
