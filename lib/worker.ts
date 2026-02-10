import { eq } from "drizzle-orm";
import PQueue from "p-queue";
import db from "./db";
import { ProjectConfigSchema } from "./openspec/types";
import { createRalphEngine, type RalphCallbacks } from "./ralph";
import { workerEvents } from "./ralph/worker-events";
import { logs, runs, tasks } from "./schema";

/**
 * RalphWorker handles background task execution using a queue.
 */
class RalphWorker {
  private queue: PQueue;
  private isProcessing = false;

  constructor() {
    this.queue = new PQueue({ concurrency: 20 });
    console.log("[RalphWorker] Initialized with concurrency 20");
  }

  /**
   * Notifies the worker of a new run to process immediately.
   */
  public notifyNewRun(runId: string) {
    console.log(`[RalphWorker] Notified of new run: ${runId}`);
    workerEvents.emit("event", { type: "run:new", runId });
    this.processPendingRuns();
  }

  public async start() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    console.log(
      "[RalphWorker] Ready and listening for new runs via notifyNewRun()",
    );

    // Polling loop removed in favor of event-based processing via notifyNewRun()
    // Initial check for any pending runs on startup
    await this.processPendingRuns();
  }

  private async processPendingRuns() {
    const activeRuns = await db.query.runs.findMany({
      where: eq(runs.status, "running"),
    });

    for (const run of activeRuns) {
      if (this.activeRunIds.has(run.id)) {
        console.log(
          `[RalphWorker] Run ${run.id} is already processing, skipping...`,
        );
        continue;
      }

      console.log(`[RalphWorker] Adding run ${run.id} to queue...`);
      this.queue.add(() => this.executeRalphLoop(run));
    }
  }

  private async executeRalphLoop(run: typeof runs.$inferSelect) {
    const runId = run.id; // local copy for callback safety
    // Double check inside queue
    if (this.activeRunIds.has(runId)) return;
    this.activeRunIds.add(runId);

    console.log(`[RalphWorker] [${runId}] Starting execution loop (v2)`);

    try {
      if (!run.projectConfig || !run.changeId) {
        await this.log(
          run.id,
          "error",
          "Missing projectConfig or changeId for run",
        );
        await db
          .update(runs)
          .set({ status: "failed" })
          .where(eq(runs.id, run.id));
        return;
      }

      const config = ProjectConfigSchema.parse(JSON.parse(run.projectConfig));

      // Create callbacks
      const callbacks: RalphCallbacks = {
        onLog: async (level, message) => {
          await this.log(runId, level, `[Ralph] ${message}`);
        },
        onIterationComplete: async (iteration) => {
          await db
            .update(runs)
            .set({ currentIteration: iteration })
            .where(eq(runs.id, runId));
          workerEvents.emit("event", {
            type: "run:status",
            runId,
            status: "running",
          });
        },
        onTaskStart: async (taskId, title) => {
          console.log(`[RalphWorker] [${runId}] Task Start: ${taskId}`);
          workerEvents.emit("event", {
            type: "task:start",
            runId,
            taskId,
            title,
          });
          await db
            .update(runs)
            .set({ lastTaskId: taskId })
            .where(eq(runs.id, runId));

          const existingTask = await db.query.tasks.findFirst({
            where: eq(tasks.id, taskId),
          });
          if (existingTask) {
            await db
              .update(tasks)
              .set({ status: "running" })
              .where(eq(tasks.id, taskId));
          } else {
            await db.insert(tasks).values({
              id: taskId,
              runId: runId,
              title: title,
              status: "running",
            });
          }
        },
        onTaskComplete: async (taskId, success) => {
          console.log(
            `[RalphWorker] [${runId}] Task Complete: ${taskId} (success: ${success})`,
          );
          workerEvents.emit("event", {
            type: "task:complete",
            runId,
            taskId,
            success,
          });
          await db
            .update(tasks)
            .set({
              status: success ? "completed" : "failed",
            })
            .where(eq(tasks.id, taskId));
        },
        onRunComplete: async (success, message) => {
          console.log(`[RalphWorker] [${runId}] Run Complete: ${message}`);
          workerEvents.emit("event", {
            type: "run:status",
            runId,
            status: success ? "completed" : "failed",
          });
          await db
            .update(runs)
            .set({
              status: success ? "completed" : "failed",
            })
            .where(eq(runs.id, runId));
          await this.log(
            runId,
            success ? "info" : "error",
            `Loop terminated: ${message}`,
          );
        },
      };

      // Create and run Ralph Engine v2
      const engine = await createRalphEngine({
        config,
        changeId: run.changeId,
        callbacks,
        maxIterations: run.maxIterations || 10,
        errorStrategy: "analyze-retry",
        maxRetries: 3,
        resume: !!run.currentIteration,
      });

      const result = await engine.run();
      console.log(`[RalphWorker] [${run.id}] engine.run() finished:`, result);

      // Ensure run is marked as complete in DB using the result from the engine
      await callbacks.onRunComplete(
        result.success,
        result.message ?? (result.success ? "Run completed" : "Run failed"),
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[RalphWorker] [${run.id}] Fatal error:`, error);
      await this.log(run.id, "error", `Worker fatal error: ${errorMessage}`);
      await db
        .update(runs)
        .set({ status: "failed" })
        .where(eq(runs.id, run.id));
    } finally {
      this.activeRunIds.delete(run.id);
      console.log(`[RalphWorker] [${run.id}] Released from activeRunIds`);
    }
  }

  private activeRunIds = new Set<string>();

  private async log(
    runId: string,
    level: "info" | "warn" | "error",
    message: string,
  ) {
    workerEvents.emit("event", { type: "log", runId, level, message });
    await db.insert(logs).values({
      runId,
      level,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}

export const ralphWorker = new RalphWorker();
