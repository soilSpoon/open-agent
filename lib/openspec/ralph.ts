import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import * as pty from "node-pty";
import { z } from "zod";
import type { ProjectConfig } from "./types";

const execAsync = promisify(exec);

/**
 * Callbacks for Ralph to report progress externally
 */
export interface RalphCallbacks {
  onLog: (level: "info" | "warn" | "error", message: string) => Promise<void>;
  onTaskStart: (taskId: string, title: string) => Promise<void>;
  onTaskComplete: (taskId: string, success: boolean) => Promise<void>;
  onRunComplete: (success: boolean, message: string) => Promise<void>;
  onIterationComplete: (iteration: number) => Promise<void>;
}

/**
 * OpenSpec Apply Instructions Schema
 */
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

export interface RalphIterationLog {
  threadId?: string;
  task: string;
  implemented: string[];
  codebasePatterns: string[];
  gotchas: string[];
  summary?: string;
  complete?: boolean;
}

/**
 * Ralph Agent for OpenSpec
 * Autonomous loop that implements tasks from OpenSpec with iteration memory
 */
export class Ralph {
  private config: ProjectConfig;
  private changeId: string;
  private maxIterations: number;
  private progressFile: string;
  private changeFile: string;
  private callbacks: RalphCallbacks;
  private currentIteration: number;

  constructor(
    config: ProjectConfig,
    changeId: string,
    callbacks: RalphCallbacks,
    maxIterations = 10,
  ) {
    this.config = config;
    this.changeId = changeId;
    this.callbacks = callbacks;
    this.maxIterations = maxIterations;
    this.currentIteration = 1;

    const changeBasePath = path.join(
      config.path,
      "openspec",
      "changes",
      changeId,
    );
    this.progressFile = path.join(changeBasePath, "progress.txt");
    this.changeFile = path.join(changeBasePath, "change.json");
  }

  private async log(
    level: "info" | "warn" | "error",
    message: string,
  ): Promise<void> {
    console.log(`[Ralph] [${level}] ${message}`);
    await this.callbacks.onLog(level, message);
  }

  private getOpenspecBin(): string {
    return path.join(this.config.path, "node_modules", ".bin", "openspec");
  }

  private getAmpBin(): string {
    // We prefer the amp binary in the project if it exists, otherwise use the one in open-agent
    const projectAmp = path.join(
      this.config.path,
      "node_modules",
      ".bin",
      "amp",
    );
    return projectAmp;
  }

  /**
   * Get full context from change.json
   */
  private async getSpecContext(): Promise<string> {
    try {
      const changeContent = await fs.readFile(this.changeFile, "utf-8");
      return `### Authoritative Spec (change.json)\n${changeContent}\n`;
    } catch {
      return "### Spec context not found on disk.\n";
    }
  }

  /**
   * Get iteration memory from progress.txt
   */
  private async getProgressMemory(): Promise<string> {
    try {
      const content = await fs.readFile(this.progressFile, "utf-8");
      const sections = content.split("---");
      const patterns =
        sections[0] || "## Codebase Patterns\n- (No patterns discovered yet)\n";
      const recentLogs = sections.slice(-3).join("---");
      return `${patterns}\n\n### Recent Iteration Logs\n${recentLogs}`;
    } catch {
      return "## Codebase Patterns\n- (No patterns discovered yet)\n\n### Recent Iteration Logs\n(None)\n";
    }
  }

  /**
   * Append structured log to progress.txt
   */
  private async appendProgress(
    structuredLog: RalphIterationLog,
    rawSummary: string,
  ) {
    const threadUrl = structuredLog.threadId
      ? `https://ampcode.com/threads/${structuredLog.threadId}`
      : "Unknown";

    const entry = `
---
## Iteration: ${new Date().toISOString()}
- **Thread**: ${threadUrl}
- **Task**: ${structuredLog.task || "N/A"}
- **Implemented**: ${(structuredLog.implemented || []).join(", ")}
- **Insights & Patterns**: ${(structuredLog.codebasePatterns || []).join(", ")}
- **Root Cause & Resolution**: ${(structuredLog.gotchas || []).join(", ")}

### Synthesis
${structuredLog.summary || rawSummary}
`;
    await fs.appendFile(this.progressFile, entry, "utf-8");
  }

  /**
   * Extract JSON log from agent output
   */
  private parseIterationLog(output: string): {
    structured: RalphIterationLog;
    raw: string;
  } {
    const sentinelRegex =
      /<RALPH_ITERATION_LOG_JSON>([\s\S]*?)<\/RALPH_ITERATION_LOG_JSON>/;
    const match = output.match(sentinelRegex);

    if (match?.[1]) {
      try {
        const structured = JSON.parse(match[1].trim());
        const raw = output.replace(sentinelRegex, "").slice(-1000).trim();
        return { structured, raw };
      } catch (_e) {
        console.error("Failed to parse agent's JSON log.");
      }
    }

    return {
      structured: {
        task: "Unknown",
        implemented: [],
        codebasePatterns: [],
        gotchas: [],
      },
      raw: output.slice(-500).trim(),
    };
  }

  /**
   * Get current apply status and tasks via OpenSpec CLI
   */
  async getStatus(): Promise<ApplyInstructions> {
    const { stdout } = await execAsync(
      `"${this.getOpenspecBin()}" instructions apply --change "${this.changeId}" --json`,
      { cwd: this.config.path },
    );
    return ApplyInstructionsSchema.parse(JSON.parse(stdout));
  }

  public setStartIteration(iteration: number) {
    this.currentIteration = iteration;
  }

  /**
   * Run the autonomous loop
   */
  async run(): Promise<{ success: boolean; message?: string }> {
    await this.log(
      "info",
      `Starting Ralph for change: ${this.changeId} in project: ${this.config.name}`,
    );

    for (let i = this.currentIteration; i <= this.maxIterations; i++) {
      await this.log("info", `--- Iteration ${i} / ${this.maxIterations} ---`);
      await this.callbacks.onIterationComplete(i);

      // 0. Optional Pre-check before task execution
      if (this.config.preCheckCommand) {
        await this.log(
          "info",
          `Running pre-check: ${this.config.preCheckCommand}`,
        );
        try {
          await execAsync(this.config.preCheckCommand, {
            cwd: this.config.path,
          });
          await this.log("info", "Pre-check passed.");
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          await this.log("warn", `Pre-check failed: ${msg}`);
          // We continue anyway, as the agent might fix the issues
        }
      }

      const status = await this.getStatus();

      if (status.state === "all_done") {
        await this.log("info", "All tasks completed! Finalizing change...");
        try {
          await execAsync(
            `"${this.getOpenspecBin()}" validate "${this.changeId}"`,
            { cwd: this.config.path },
          );
          await execAsync(
            `"${this.getOpenspecBin()}" archive "${this.changeId}" --yes`,
            { cwd: this.config.path },
          );
          await this.log("info", "Change archived successfully.");
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          await this.log("error", `Final validation/archive failed: ${msg}`);
        }
        await this.callbacks.onRunComplete(
          true,
          "All tasks completed and archived",
        );
        return { success: true, message: "All tasks completed and archived" };
      }

      if (status.state === "blocked") {
        await this.log("warn", `Ralph is blocked: ${status.instruction}`);
        await this.callbacks.onRunComplete(false, status.instruction);
        return { success: false, message: status.instruction };
      }

      const nextTask = status.tasks.find((t) => !t.done);
      if (!nextTask) {
        await this.log("info", "No pending tasks found.");
        await this.callbacks.onRunComplete(true, "No pending tasks");
        return { success: true, message: "No pending tasks" };
      }

      await this.log(
        "info",
        `Executing task: [${nextTask.id}] ${nextTask.description}`,
      );
      await this.callbacks.onTaskStart(nextTask.id, nextTask.description);

      try {
        const memory = await this.getProgressMemory();
        const specContext = await this.getSpecContext();
        const response = await this.executeTask(
          status,
          nextTask,
          memory,
          specContext,
        );

        await this.log(
          "info",
          "Running targeted quality checks and OpenSpec validation...",
        );
        try {
          // 1. Only check modified files to avoid noise from existing codebase errors
          const { stdout: changedFiles } = await execAsync(
            "git diff --name-only",
            { cwd: this.config.path },
          );

          if (this.config.checkCommand && changedFiles.trim()) {
            const files = changedFiles
              .split("\n")
              .filter(
                (f) => f.trim() && (f.endsWith(".ts") || f.endsWith(".tsx")),
              );
            if (files.length > 0) {
              // Use the configured check command but targeted at specific files if possible
              try {
                // Infer the tool (biome, eslint, etc.) from checkCommand or use it as base
                const baseCmd = this.config.checkCommand.includes("biome")
                  ? "biome check --write --unsafe"
                  : this.config.checkCommand;

                await execAsync(`${baseCmd} ${files.join(" ")}`, {
                  cwd: this.config.path,
                });
              } catch {
                // Fallback to full check if targeted check is not supported
                await execAsync(this.config.checkCommand, {
                  cwd: this.config.path,
                });
              }
            }
          }

          await execAsync(
            `"${this.getOpenspecBin()}" validate "${this.changeId}"`,
            { cwd: this.config.path },
          );

          await this.log("info", "Validation passed. Finalizing task...");

          const commitMsg = `feat: ${nextTask.id} - ${nextTask.description}`;
          await execAsync(`git add . && git commit -m "${commitMsg}"`, {
            cwd: this.config.path,
          });

          const { structured, raw } = this.parseIterationLog(response);
          await this.appendProgress(structured, raw);
          await this.callbacks.onTaskComplete(nextTask.id, true);
        } catch (checkError: unknown) {
          const msg =
            checkError instanceof Error
              ? checkError.message
              : String(checkError);

          await this.log(
            "error",
            "Task failed validation. Requesting agent analysis...",
          );

          // Request a synthesized analysis from the agent about the failure
          const analysisPrompt = `
The previous implementation failed quality checks with the following error:
---
${msg}
---

Please analyze this error and provide:
1. The root cause of the failure.
2. What needs to be fixed in the next iteration.
3. A synthesized summary for the progress log.

Provide your response in the same <RALPH_ITERATION_LOG_JSON> format.
`;
          const analysisResponse = await this.executeTask(
            status,
            nextTask,
            memory,
            specContext,
            analysisPrompt,
          );

          const { structured, raw } = this.parseIterationLog(analysisResponse);
          await this.appendProgress(structured, raw);
          await this.callbacks.onTaskComplete(nextTask.id, false);
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        await this.log("error", `Task execution failed: ${msg}`);
        await this.callbacks.onTaskComplete(nextTask.id, false);
      }
    }

    console.log("Reached max iterations.");
    return { success: false, message: "Max iterations reached" };
  }

  /**
   * Execute a single task using Amp CLI
   */
  private async executeTask(
    _status: ApplyInstructions,
    task: { id: string; description: string },
    memory: string,
    specContext: string,
    customPrompt?: string,
  ): Promise<string> {
    const prompt =
      customPrompt ||
      `
# Ralph Autonomous Agent Mode

You are an autonomous implementation agent working on the OpenSpec change "${this.changeId}".

## YOUR MISSION
Complete the following task with high precision and quality:
[${task.id}] ${task.description}

## CONTEXT & MEMORY
- **Project**: ${this.config.name} (${this.config.path})
- **Authoritative Spec**: 
${specContext}
- **Iteration Memory (Patterns & History)**:
${memory}

## EXECUTION WORKFLOW
1. **Explore & Plan**: Read the current codebase at ${this.config.path}. Identify existing patterns and conventions.
2. **Implement**: Perform the requested changes. Ensure your code is distinctive, production-grade, and follows existing styles.
3. **Quality Assurance**:
   - Run the project's quality check: \`${this.config.checkCommand}\`.
   - Ensure the implementation matches the spec by running: \`openspec validate "${this.changeId}"\`.
4. **Knowledge Management & Insights**:
   - **Update tasks.md**: Mark the task as complete (- [ ] to - [x]).
   - **Update AGENTS.md**: If you discover reusable patterns, conventions, or non-obvious requirements, update the local AGENTS.md file.
   - **Insight Synthesis**: In your final response, provide a clear synthesis of what was learned, any architectural decisions made, and how potential issues (like lint errors) were handled. Do not just dump raw logs.

## STOP CONDITION
When the task is complete and quality checks pass:
1. Provide a structured log in JSON format inside the sentinel tags. **The "summary" field should contain your high-level insight synthesis.**
2. Output <promise>COMPLETE</promise>.

<RALPH_ITERATION_LOG_JSON>
{
  "threadId": "T-xxxx...", 
  "task": "${task.id}",
  "implemented": ["Action A", "Action B"],
  "codebasePatterns": ["Reasoning behind architectural choice"],
  "gotchas": ["Root cause of any encountered errors and how they were bypassed"],
  "summary": "Synthesized insight for the developer about this iteration",
  "complete": true
}
</RALPH_ITERATION_LOG_JSON>
`;

    let fullResponse = "";
    const ptyProcess = pty.spawn(this.getAmpBin(), ["--execute"], {
      name: "xterm-color",
      cols: 120,
      rows: 40,
      cwd: this.config.path,
      env: { ...process.env } as Record<string, string>,
    });

    return new Promise<string>((resolve, reject) => {
      ptyProcess.onData((data) => {
        fullResponse += data;
        process.stdout.write(data);
      });

      // Write prompt to agent's stdin via pty
      ptyProcess.write(prompt);
      // We need to signal EOF if the agent expects it to start processing
      // For Amp --execute, it might need a specific sequence or just wait
      // Most PTY agents listen for the full input then start.
      // Since we don't have a direct "end" for PTY stdin like child_process,
      // we rely on the agent reading the prompt.

      ptyProcess.onExit(({ exitCode }) => {
        if (exitCode === 0) {
          resolve(fullResponse);
        } else {
          reject(new Error(`Amp PTY exited with code ${exitCode}`));
        }
      });
    });
  }
}
