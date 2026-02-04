import { exec, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { OpenSpecCLIStatusSchema } from "./types";

const execAsync = promisify(exec);

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
  private changeId: string;
  private maxIterations: number;
  private openspecBin: string;
  private progressFile: string;

  constructor(changeId: string, maxIterations = 10) {
    this.changeId = changeId;
    this.maxIterations = maxIterations;
    this.openspecBin = path.join(
      process.cwd(),
      "node_modules",
      ".bin",
      "openspec",
    );
    this.progressFile = path.join(
      process.cwd(),
      "openspec",
      "changes",
      changeId,
      "progress.txt",
    );
  }

  /**
   * Get iteration memory from progress.txt
   */
  private async getProgressMemory(): Promise<string> {
    try {
      return await fs.readFile(this.progressFile, "utf-8");
    } catch {
      return "# Ralph Progress Log\nStarted: " + new Date().toISOString() + "\n---\n";
    }
  }

  /**
   * Append learnings to progress.txt
   */
  private async appendProgress(learnings: string) {
    const entry = `\nIteration: ${new Date().toISOString()}\n${learnings}\n---\n`;
    await fs.appendFile(this.progressFile, entry, "utf-8");
  }

  /**
   * Get current apply status and tasks via OpenSpec CLI
   */
  async getStatus(): Promise<ApplyInstructions> {
    const { stdout } = await execAsync(
      `"${this.openspecBin}" instructions apply --change "${this.changeId}" --json`,
    );
    return ApplyInstructionsSchema.parse(JSON.parse(stdout));
  }

  /**
   * Run the autonomous loop
   */
  async run() {
    console.log(`Starting Ralph for change: ${this.changeId}`);

    for (let i = 1; i <= this.maxIterations; i++) {
      console.log(`\n--- Iteration ${i} / ${this.maxIterations} ---`);

      const status = await this.getStatus();

      if (status.state === "all_done") {
        console.log("All tasks completed! Finalizing change...");
        try {
          await execAsync(`"${this.openspecBin}" validate "${this.changeId}"`);
          await execAsync(`"${this.openspecBin}" archive "${this.changeId}" --yes`);
          console.log("Change archived successfully.");
        } catch (error: any) {
          console.error("Final validation/archive failed:", error.message);
        }
        return { success: true, message: "All tasks completed and archived" };
      }

      if (status.state === "blocked") {
        console.warn("Ralph is blocked:", status.instruction);
        return { success: false, message: status.instruction };
      }

      const nextTask = status.tasks.find((t) => !t.done);
      if (!nextTask) {
        console.log("No pending tasks found.");
        return { success: true, message: "No pending tasks" };
      }

      console.log(`Executing task: ${nextTask.description}`);

      try {
        const memory = await this.getProgressMemory();
        const response = await this.executeTask(status, nextTask, memory);

        // Quality Check & Validation
        console.log("Running quality checks and OpenSpec validation...");
        try {
          // 1. Lint/Typecheck
          await execAsync("bun run check");
          // 2. OpenSpec Validation (Check if implementation matches spec)
          await execAsync(`"${this.openspecBin}" validate "${this.changeId}"`);

          console.log("Validation passed. Finalizing task...");

          // 3. Commit the changes
          const commitMsg = `feat: ${nextTask.id} - ${nextTask.description}`;
          await execAsync(`git add . && git commit -m "${commitMsg}"`);

          // 4. Capture learnings from response
          const learnings = response.slice(-500);
          await this.appendProgress(
            `Task "${nextTask.description}" completed and committed.\nLearnings: ${learnings}`,
          );
        } catch (checkError: any) {
          console.error("Validation failed. Learning from error...");
          await this.appendProgress(
            `Task "${nextTask.description}" failed validation.\nError: ${checkError.message}`,
          );
          // Loop continues to next iteration to fix the errors
        }
      } catch (error) {
        console.error(`Task execution failed:`, error);
        return { success: false, error };
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
    task: { description: string },
    memory: string,
  ): Promise<string> {
    const prompt = `
You are Ralph, an autonomous implementation agent.
Your goal is to complete the following task from the OpenSpec change "${this.changeId}".

TASK:
${task.description}

CONTEXT:
${status.instruction}

PROJECT CONTEXT:
- Change Directory: ${status.changeDir}
- Schema: ${status.schemaName}

ITERATION MEMORY (What happened in previous iterations):
${memory}

INSTRUCTIONS:
1. Implement the task described above.
2. After implementing, you MUST update the task status in the tasks.md file by marking the checkbox (e.g., - [ ] to - [x]).
3. If you discover important patterns or conventions, update AGENTS.md in the project root.
4. If you notice general reusable patterns, add them to the "## Codebase Patterns" section in your summary for memory.
5. Ensure the code passes quality checks (lint/format) by running 'bun run check'.
6. If you finish all work for this task, output <promise>COMPLETE</promise>.
7. Summarize your actions and CRITICAL learnings at the end of your response for iteration memory.
`;

    let fullResponse = "";
    await new Promise<void>((resolve, reject) => {
      const ampBin = path.join(process.cwd(), "node_modules", ".bin", "amp");
      const child = spawn(ampBin, ["--execute"], {
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

