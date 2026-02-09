/**
 * Ralph Engine v2
 *
 * New implementation using:
 * - Session persistence (atomic writes, crash recovery)
 * - Immutable iteration logs (append-only)
 * - Failure context propagation (rolling window)
 * - Lock file concurrency control
 */

import { exec } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import * as pty from "node-pty";
import { z } from "zod";
import type { ProjectConfig } from "../openspec/types.js";
import {
  createIterationPersistence,
  type IterationPersistence,
  type IterationPersistenceOptions,
} from "./iteration.js";
import {
  createPromptEngine,
  type PromptEngineOptions,
  type PromptTemplateEngine,
} from "./prompt.js";
import {
  createSessionManager,
  type SessionManager,
  type SessionManagerOptions,
} from "./session.js";
import type {
  ErrorStrategy,
  ErrorType,
  FailureAnalysis,
  IterationLog,
  SessionState,
} from "./types.js";
import { CURRENT_SCHEMA_VERSION } from "./types.js";

const execAsync = promisify(exec);

// ============================================================================
// OpenSpec Integration Types
// ============================================================================

export const ApplyInstructionsSchema = z.object({
  changeName: z.string(),
  changeDir: z.string(),
  schemaName: z.string(),
  progress: z.object({
    total: z.number(),
    complete: z.number(),
    remaining: z.number(),
  }),
  tasks: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      done: z.boolean(),
    }),
  ),
  state: z.enum(["ready", "blocked", "all_done"]),
  instruction: z.string(),
});

export type ApplyInstructions = z.infer<typeof ApplyInstructionsSchema>;

// ============================================================================
// Callbacks
// ============================================================================

export interface RalphCallbacks {
  onLog: (level: "info" | "warn" | "error", message: string) => Promise<void>;
  onTaskStart: (taskId: string, title: string) => Promise<void>;
  onTaskComplete: (taskId: string, success: boolean) => Promise<void>;
  onRunComplete: (success: boolean, message: string) => Promise<void>;
  onIterationComplete: (iteration: number) => Promise<void>;
}

// ============================================================================
// Engine Options
// ============================================================================

export interface RalphEngineOptions {
  config: ProjectConfig;
  changeId: string;
  callbacks: RalphCallbacks;
  maxIterations?: number;
  errorStrategy?: ErrorStrategy;
  maxRetries?: number;
  resume?: boolean;
  force?: boolean;
}

// ============================================================================
// Ralph Engine v2
// ============================================================================

export class RalphEngine {
  private config: ProjectConfig;
  private changeId: string;
  private callbacks: RalphCallbacks;
  private maxIterations: number;
  private errorStrategy: ErrorStrategy;
  private maxRetries: number;

  // Core components
  private sessionManager!: SessionManager;
  private iterationPersistence!: IterationPersistence;
  private promptEngine!: PromptTemplateEngine;

  // Paths
  private changeBasePath: string;
  private ralphDir: string;

  constructor(options: RalphEngineOptions) {
    this.config = options.config;
    this.changeId = options.changeId;
    this.callbacks = options.callbacks;
    this.maxIterations = options.maxIterations ?? 10;
    this.errorStrategy = options.errorStrategy ?? "analyze-retry";
    this.maxRetries = options.maxRetries ?? 3;

    this.changeBasePath = path.join(
      this.config.path,
      "openspec",
      "changes",
      this.changeId,
    );
    this.ralphDir = path.join(this.changeBasePath, ".ralph");
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  async initialize(): Promise<void> {
    // Initialize session manager
    const sessionOptions: SessionManagerOptions = {
      changeId: this.changeId,
      changeBasePath: this.changeBasePath,
      maxIterations: this.maxIterations,
      errorStrategy: this.errorStrategy,
      maxRetries: this.maxRetries,
    };
    this.sessionManager = await createSessionManager(sessionOptions);

    // Initialize iteration persistence
    const iterationOptions: IterationPersistenceOptions = {
      iterationsDir: this.sessionManager.getIterationsDir(),
      ralphDir: this.ralphDir,
    };
    this.iterationPersistence = createIterationPersistence(iterationOptions);

    // Initialize prompt engine
    const promptOptions: PromptEngineOptions = {
      projectName: this.config.name,
      projectPath: this.config.path,
      checkCommand: this.config.checkCommand,
    };
    this.promptEngine = createPromptEngine(promptOptions);
  }

  // ========================================================================
  // Main Run Loop
  // ========================================================================

  async run(): Promise<{ success: boolean; message?: string }> {
    await this.log("info", `Starting Ralph for change: ${this.changeId}`);

    // Check lock
    const lockStatus = await this.sessionManager.checkLock();
    if (lockStatus.status === "locked" && !lockStatus.stale) {
      const msg = `Another Ralph process is running (PID: ${lockStatus.lock.pid})`;
      await this.log("error", msg);
      return { success: false, message: msg };
    }

    // Acquire lock
    await this.sessionManager.acquireLock();

    try {
      // Read or create session
      let session = await this.sessionManager.readSession();

      if (session) {
        await this.log(
          "info",
          `Resuming session from iteration ${session.iteration}`,
        );
      } else {
        session = this.sessionManager.createInitialState();
        await this.sessionManager.writeSession(session);
      }

      // Main loop
      for (let i = session.iteration + 1; i <= this.maxIterations; i++) {
        session.iteration = i;
        await this.sessionManager.writeSession(session);
        await this.callbacks.onIterationComplete(i);

        // Check OpenSpec state
        const status = await this.getOpenSpecStatus();
        if (status.state === "blocked") {
          await this.log("warn", `Change is blocked: ${status.instruction}`);
          session.status = "paused";
          await this.sessionManager.writeSession(session);
          return { success: false, message: status.instruction };
        }

        if (status.state === "all_done") {
          await this.log("info", "All tasks completed!");
          session.status = "completed";
          await this.sessionManager.writeSession(session);
          await this.finalizeChange();
          return { success: true, message: "All tasks completed" };
        }

        // Get next task
        const nextTask = status.tasks.find((t) => !t.done);
        if (!nextTask) {
          await this.log("info", "No pending tasks found.");
          session.status = "completed";
          await this.sessionManager.writeSession(session);
          return { success: true, message: "No pending tasks" };
        }

        // Update current task in session
        session.currentTask = {
          id: nextTask.id,
          description: nextTask.description,
          attemptCount: (session.currentTask?.attemptCount ?? 0) + 1,
        };
        await this.sessionManager.writeSession(session);

        await this.log(
          "info",
          `Executing task: [${nextTask.id}] ${nextTask.description} (attempt ${session.currentTask.attemptCount})`,
        );
        await this.callbacks.onTaskStart(nextTask.id, nextTask.description);

        // Execute task with error handling
        const result = await this.executeTaskWithErrorHandling(
          session,
          status,
          nextTask,
        );

        if (result.taskCompleted) {
          this.sessionManager.addPatternToContext(
            session,
            `Task ${nextTask.id} completed successfully`,
          );
          session.errorHandling.currentRetryCount = 0;
          await this.callbacks.onTaskComplete(nextTask.id, true);
        } else if (result.shouldSkip) {
          await this.log("warn", `Skipping task ${nextTask.id}`);
          await this.callbacks.onTaskComplete(nextTask.id, false);
        } else if (result.shouldEscalate) {
          await this.log(
            "error",
            `Escalating task ${nextTask.id} to blocked state`,
          );
          await this.escalateChange(
            result.failureAnalysis?.rootCause ?? "Unknown error",
          );
          session.status = "failed";
          await this.sessionManager.writeSession(session);
          return { success: false, message: result.failureAnalysis?.rootCause };
        }

        // Update session
        await this.sessionManager.writeSession(session);
      }

      await this.log("warn", "Reached max iterations");
      session.status = "failed";
      await this.sessionManager.writeSession(session);
      return { success: false, message: "Max iterations reached" };
    } finally {
      // Release lock
      await this.sessionManager.releaseLock();
    }
  }

  // ========================================================================
  // Task Execution with Error Handling
  // ========================================================================

  private async executeTaskWithErrorHandling(
    session: SessionState,
    status: ApplyInstructions,
    task: { id: string; description: string },
  ): Promise<{
    taskCompleted: boolean;
    shouldSkip: boolean;
    shouldEscalate: boolean;
    failureAnalysis?: FailureAnalysis;
  }> {
    const startTime = Date.now();
    const commitBefore = await this.getCurrentGitSha();

    try {
      // Generate and execute prompt
      const specContext = await this.getSpecContext();
      const recentLogs =
        await this.iterationPersistence.readRecentIterations(3);

      const variables = this.promptEngine.buildVariables(
        session,
        specContext,
        recentLogs,
      );
      const prompt = this.promptEngine.generateMainPrompt(variables);

      const response = await this.executeAgent(prompt);

      // Parse response
      const { structured, raw } = this.parseIterationLog(response);

      // Run quality checks
      await this.log("info", "Running quality checks and validation...");
      await this.runQualityChecks();
      await this.validateOpenSpec();

      // Commit changes
      const commitMsg = `feat: ${task.id} - ${task.description}`;
      await execAsync(`git add . && git commit -m "${commitMsg}"`, {
        cwd: this.config.path,
      });
      const commitAfter = await this.getCurrentGitSha();

      // Save successful iteration log
      const iterationLog: IterationLog = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        iteration: session.iteration,
        taskId: task.id,
        taskAttempt: session.currentTask?.attemptCount ?? 1,
        timestamp: new Date().toISOString(),
        threadId: structured.threadId,
        status: "success",
        promptTokens: this.promptEngine.estimateTokens(prompt),
        implemented: structured.implemented ?? [],
        codebasePatterns: structured.codebasePatterns ?? [],
        summary: structured.summary,
        commitBefore,
        commitAfter,
        durationMs: Date.now() - startTime,
      };

      await this.iterationPersistence.saveIteration(iterationLog);

      // Update session patterns
      for (const pattern of structured.codebasePatterns ?? []) {
        this.sessionManager.addPatternToContext(session, pattern);
      }

      // Mark task complete in tasks.md
      await this.markTaskComplete(task.id);

      return { taskCompleted: true, shouldSkip: false, shouldEscalate: false };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - startTime;

      await this.log("error", `Task failed: ${errorMessage}`);

      // Analyze failure if strategy is analyze-retry
      let failureAnalysis: FailureAnalysis | undefined;

      if (this.errorStrategy === "analyze-retry") {
        failureAnalysis = await this.analyzeFailure(session, errorMessage);
      }

      // Save failed iteration log
      const iterationLog: IterationLog = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        iteration: session.iteration,
        taskId: task.id,
        taskAttempt: session.currentTask?.attemptCount ?? 1,
        timestamp: new Date().toISOString(),
        status: "failed",
        promptTokens: undefined,
        failureAnalysis,
        commitBefore,
        durationMs,
      };

      await this.iterationPersistence.saveIteration(iterationLog);

      // Update session with failure
      if (failureAnalysis) {
        this.sessionManager.addFailureToContext(session, {
          iteration: session.iteration,
          taskId: task.id,
          rootCause: failureAnalysis.rootCause,
          fixPlan: failureAnalysis.fixPlan,
        });
      }

      // Increment retry count
      session.errorHandling.currentRetryCount++;

      // Determine next action
      if (session.errorHandling.currentRetryCount >= this.maxRetries) {
        if (
          this.errorStrategy === "escalate" ||
          this.errorStrategy === "analyze-retry"
        ) {
          return {
            taskCompleted: false,
            shouldSkip: false,
            shouldEscalate: true,
            failureAnalysis,
          };
        } else if (this.errorStrategy === "skip") {
          await this.markTaskSkipped(task.id, errorMessage);
          return {
            taskCompleted: false,
            shouldSkip: true,
            shouldEscalate: false,
          };
        }
      }

      // Will retry on next iteration
      return {
        taskCompleted: false,
        shouldSkip: false,
        shouldEscalate: false,
        failureAnalysis,
      };
    }
  }

  // ========================================================================
  // Failure Analysis
  // ========================================================================

  private async analyzeFailure(
    session: SessionState,
    errorMessage: string,
  ): Promise<FailureAnalysis> {
    await this.log("info", "Analyzing failure...");

    const lastFailure =
      session.context.recentFailures[session.context.recentFailures.length - 1];
    // Convert to FailureAnalysis type for the prompt
    const lastFailureAnalysis: FailureAnalysis | undefined = lastFailure
      ? {
          rootCause: lastFailure.rootCause,
          fixPlan: lastFailure.fixPlan,
          errorMessage: "Previous failure",
          errorType: "unknown",
        }
      : undefined;
    const prompt = this.promptEngine.generateAnalysisPrompt(
      session,
      errorMessage,
      lastFailureAnalysis,
    );

    const response = await this.executeAgent(prompt);
    const { structured } = this.parseIterationLog(response);

    if (structured.failureAnalysis) {
      return structured.failureAnalysis;
    }

    // Fallback if parsing fails
    return {
      rootCause: errorMessage,
      fixPlan: "Retry with careful attention to the error",
      errorMessage,
      errorType: "unknown",
    };
  }

  // ========================================================================
  // Agent Execution
  // ========================================================================

  private async executeAgent(prompt: string): Promise<string> {
    const ampBin = this.getAmpBin();
    let fullResponse = "";

    return new Promise<string>((resolve, reject) => {
      const ptyProcess = pty.spawn(ampBin, ["--execute", prompt], {
        name: "xterm-color",
        cols: 120,
        rows: 40,
        cwd: this.config.path,
      });

      ptyProcess.onData((data) => {
        fullResponse += data;
        process.stdout.write(data);
      });

      ptyProcess.onExit(({ exitCode }) => {
        if (exitCode === 0) {
          // Strip ANSI codes
          const cleanResponse = fullResponse.replace(
            /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
            "",
          );
          resolve(cleanResponse);
        } else {
          reject(new Error(`Amp PTY exited with code ${exitCode}`));
        }
      });
    });
  }

  // ========================================================================
  // Log Parsing
  // ========================================================================

  private parseIterationLog(output: string): {
    structured: Partial<IterationLog>;
    raw: string;
  } {
    const sentinelRegex =
      /<RALPH_ITERATION_LOG_JSON>([\s\S]*?)<\/RALPH_ITERATION_LOG_JSON>/;
    const match = output.match(sentinelRegex);

    if (match?.[1]) {
      try {
        const structured = JSON.parse(match[1].trim()) as Partial<IterationLog>;
        const raw = output.replace(sentinelRegex, "").slice(-1000).trim();
        return { structured, raw };
      } catch (_e) {
        console.error("Failed to parse agent's JSON log.");
      }
    }

    return {
      structured: {
        taskId: "unknown",
        implemented: [],
        codebasePatterns: [],
      },
      raw: output.slice(-500).trim(),
    };
  }

  // ========================================================================
  // OpenSpec Integration
  // ========================================================================

  private async getOpenSpecStatus(): Promise<ApplyInstructions> {
    const { stdout } = await execAsync(
      `"${this.getOpenspecBin()}" instructions apply --change "${this.changeId}" --json`,
      { cwd: this.config.path },
    );
    return ApplyInstructionsSchema.parse(JSON.parse(stdout));
  }

  private async validateOpenSpec(): Promise<void> {
    await execAsync(`"${this.getOpenspecBin()}" validate "${this.changeId}"`, {
      cwd: this.config.path,
    });
  }

  private async escalateChange(reason: string): Promise<void> {
    await execAsync(
      `"${this.getOpenspecBin()}" block "${this.changeId}" --reason "${reason}"`,
      { cwd: this.config.path },
    );
  }

  private async finalizeChange(): Promise<void> {
    await this.validateOpenSpec();
    await execAsync(
      `"${this.getOpenspecBin()}" archive "${this.changeId}" --yes`,
      { cwd: this.config.path },
    );
    await this.log("info", "Change archived successfully.");
  }

  private async markTaskComplete(taskId: string): Promise<void> {
    // Update tasks.md directly
    const tasksPath = path.join(this.changeBasePath, "tasks.md");
    try {
      let content = await fs.readFile(tasksPath, "utf-8");
      // Mark task as complete
      const taskPattern = new RegExp(`(- \\[ \\]) ${taskId}[:\\s]`, "i");
      content = content.replace(taskPattern, "- [x] $1 ");
      await fs.writeFile(tasksPath, content, "utf-8");
    } catch {
      // tasks.md might not exist, ignore
    }
  }

  private async markTaskSkipped(taskId: string, reason: string): Promise<void> {
    const tasksPath = path.join(this.changeBasePath, "tasks.md");
    try {
      let content = await fs.readFile(tasksPath, "utf-8");
      const taskPattern = new RegExp(`(- \\[ \\]) ${taskId}[:\\s]`, "i");
      content = content.replace(
        taskPattern,
        `- [ ] ~~${taskId}~~ (skipped: ${reason}) `,
      );
      await fs.writeFile(tasksPath, content, "utf-8");
    } catch {
      // Ignore
    }
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private async getSpecContext(): Promise<string> {
    const changeFile = path.join(this.changeBasePath, "change.json");
    try {
      const content = await fs.readFile(changeFile, "utf-8");
      return `### Authoritative Spec (change.json)\n${content}\n`;
    } catch {
      return "### Spec context not found on disk.\n";
    }
  }

  private async runQualityChecks(): Promise<void> {
    if (!this.config.checkCommand) return;

    const { stdout: changedFiles } = await execAsync("git diff --name-only", {
      cwd: this.config.path,
    });

    if (!changedFiles.trim()) return;

    const files = changedFiles
      .split("\n")
      .filter((f) => f.trim() && (f.endsWith(".ts") || f.endsWith(".tsx")));

    if (files.length === 0) return;

    try {
      const baseCmd = this.config.checkCommand.includes("biome")
        ? "biome check --write --unsafe"
        : this.config.checkCommand;

      await execAsync(`${baseCmd} ${files.join(" ")}`, {
        cwd: this.config.path,
      });
    } catch {
      // Fallback to full check
      await execAsync(this.config.checkCommand, {
        cwd: this.config.path,
      });
    }
  }

  private async getCurrentGitSha(): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync("git rev-parse HEAD", {
        cwd: this.config.path,
      });
      return stdout.trim();
    } catch {
      return undefined;
    }
  }

  private getOpenspecBin(): string {
    return path.join(this.config.path, "node_modules", ".bin", "openspec");
  }

  private getAmpBin(): string {
    const homeAmp = path.join(os.homedir(), ".amp", "bin", "amp");
    if (require("node:fs").existsSync(homeAmp)) {
      return homeAmp;
    }

    const projectAmp = path.join(
      this.config.path,
      "node_modules",
      ".bin",
      "amp",
    );
    if (require("node:fs").existsSync(projectAmp)) {
      return projectAmp;
    }

    return "amp";
  }

  private async log(
    level: "info" | "warn" | "error",
    message: string,
  ): Promise<void> {
    console.log(`[Ralph] [${level}] ${message}`);
    await this.callbacks.onLog(level, message);
  }
}

// ============================================================================
// Factory
// ============================================================================

export async function createRalphEngine(
  options: RalphEngineOptions,
): Promise<RalphEngine> {
  const engine = new RalphEngine(options);
  await engine.initialize();
  return engine;
}
