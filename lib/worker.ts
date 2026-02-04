import { eq } from "drizzle-orm";
import PQueue from "p-queue";
import db from "./db";
import { logs, runs, tasks } from "./schema";

/**
 * RalphWorker handles background task execution using a queue.
 * Concurrency is limited to 20 to manage system resources.
 */
class RalphWorker {
  private queue: PQueue;
  private isProcessing = false;

  constructor() {
    this.queue = new PQueue({ concurrency: 20 });
    console.log("[RalphWorker] Initialized with concurrency 20");
  }

  /**
   * Starts the worker loop to pick up pending tasks from DB.
   * This ensures tasks are processed even if the web page is closed.
   */
  public async start() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    console.log("[RalphWorker] Starting task polling...");

    // Simple polling loop
    setInterval(async () => {
      try {
        await this.processPendingTasks();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[RalphWorker] Error in polling loop:", message);
      }
    }, 5000);
  }

  private async processPendingTasks() {
    // 1. Find runs that are 'running'
    const activeRuns = await db.query.runs.findMany({
      where: eq(runs.status, "running"),
      with: {
        tasks: true,
      },
    });

    for (const run of activeRuns) {
      const pendingTask = run.tasks.find((t) => t.status === "pending");
      const runningTask = run.tasks.find((t) => t.status === "running");

      // If there's already a task running for this run, skip (serial execution per run)
      if (runningTask) continue;

      if (pendingTask) {
        // Add to queue
        this.queue.add(() =>
          this.executeTask(run.id, pendingTask.id, pendingTask.title),
        );
      } else if (run.tasks.every((t) => t.status === "completed")) {
        // All tasks done, mark run as completed
        await db
          .update(runs)
          .set({ status: "completed" })
          .where(eq(runs.id, run.id));
        await this.log(
          run.id,
          "info",
          "All tasks in execution plan completed.",
        );
      }
    }
  }

  private async executeTask(runId: string, taskId: string, title: string) {
    console.log(`[RalphWorker] Executing task: ${title} (${taskId})`);

    // 1. Mark task as running
    await db
      .update(tasks)
      .set({ status: "running" })
      .where(eq(tasks.id, taskId));
    await this.log(runId, "info", `Starting task: ${title}`);

    // 2. Simulate task execution (replace with actual tool execution later)
    // We'll simulate 5-15 seconds of work
    const duration = Math.floor(Math.random() * 10000) + 5000;
    await new Promise((resolve) => setTimeout(resolve, duration));

    // 3. Mark task as completed
    await db
      .update(tasks)
      .set({ status: "completed" })
      .where(eq(tasks.id, taskId));
    await this.log(runId, "info", `Completed task: ${title}`);
  }

  private async log(
    runId: string,
    level: "info" | "warn" | "error",
    message: string,
  ) {
    await db.insert(logs).values({
      runId,
      level,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}

// Singleton instance
export const ralphWorker = new RalphWorker();
