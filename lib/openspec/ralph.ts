import { exec, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
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
  private async appendProgress(structuredLog: any, rawSummary: string) {
    const threadUrl = structuredLog.threadId
      ? `https://ampcode.com/threads/${structuredLog.threadId}`
      : "Unknown";

    const entry = `
---
## Iteration: ${new Date().toISOString()}
- **Thread**: ${threadUrl}
- **Task**: ${structuredLog.task || "N/A"}
- **Implemented**: ${(structuredLog.implemented || []).join(", ")}
- **Patterns Discovered**: ${(structuredLog.codebasePatterns || []).join(", ")}
- **Gotchas**: ${(structuredLog.gotchas || []).join(", ")}

### Summary
${rawSummary}
`;
    await fs.appendFile(this.progressFile, entry, "utf-8");
  }

  /**
   * Extract JSON log from agent output
   */
  private parseIterationLog(output: string): { structured: any; raw: string } {
    const sentinelRegex =
      /<RALPH_ITERATION_LOG_JSON>([\s\S]*?)<\/RALPH_ITERATION_LOG_JSON>/;
    const match = output.match(sentinelRegex);

    if (match && match[1]) {
      try {
        const structured = JSON.parse(match[1].trim());
        const raw = output.replace(sentinelRegex, "").slice(-1000).trim();
        return { structured, raw };
      } catch (e) {
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

  /**
   * Run the autonomous loop
   */
  async run(): Promise<{ success: boolean; message?: string }> {
    await this.log(
      "info",
      `Starting Ralph for change: ${this.changeId} in project: ${this.config.name}`,
    );

    for (let i = 1; i <= this.maxIterations; i++) {
      await this.log("info", `--- Iteration ${i} / ${this.maxIterations} ---`);

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
          `Running quality checks (${this.config.checkCommand}) and OpenSpec validation...`,
        );
        try {
          await execAsync(this.config.checkCommand, { cwd: this.config.path });
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
          await this.log("error", `Validation failed: ${msg}`);
          const { structured, raw } = this.parseIterationLog(response);
          await this.appendProgress(
            {
              ...structured,
              gotchas: [...(structured.gotchas || []), msg],
            },
            `Validation failed: ${msg}\n\n${raw}`,
          );
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
    status: ApplyInstructions,
    task: { id: string; description: string },
    memory: string,
    specContext: string,
  ): Promise<string> {
    const prompt = `
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
4. **Knowledge Management**:
   - **Update tasks.md**: Mark the task as complete (- [ ] to - [x]).
   - **Update AGENTS.md**: If you discover reusable patterns, conventions, or non-obvious requirements in the directory you modified, update the local AGENTS.md file.
   - **Capture Patterns**: If a pattern applies to the entire change, summarize it for the 'Codebase Patterns' section.

## STOP CONDITION
When the task is complete and quality checks pass:
1. Provide a structured log in JSON format inside the sentinel tags.
2. Output <promise>COMPLETE</promise>.

<RALPH_ITERATION_LOG_JSON>
{
  "threadId": "T-xxxx...", // Your current Amp thread ID
  "task": "${task.id}",
  "implemented": ["Action A", "Action B"],
  "codebasePatterns": ["New pattern discovered"],
  "gotchas": ["Non-obvious behavior found"],
  "complete": true
}
</RALPH_ITERATION_LOG_JSON>
`;

    let fullResponse = "";
    await new Promise<void>((resolve, reject) => {
      const child = spawn(this.getAmpBin(), ["--execute"], {
        cwd: this.config.path, // Run Amp in the target project directory
        env: { ...process.env },
        stdio: ["pipe", "pipe", "inherit"],
      });

      if (child.stdin) {
        child.stdin.write(prompt);
        child.stdin.end();
      }

      child.stdout.on("data", (data) => {
        const chunk = data.toString();
        process.stdout.write(chunk);
        fullResponse += chunk;
      });

      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Amp exited with code ${code}`));
      });

      child.on("error", (err) => reject(err));
    });

    return fullResponse;
  }
}
