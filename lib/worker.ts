import { eq } from "drizzle-orm";
import PQueue from "p-queue";
import db from "./db";
import { Ralph } from "./openspec/ralph";
import { ProjectConfigSchema } from "./openspec/types";
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

  public async start() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    console.log("[RalphWorker] Starting task polling...");

    setInterval(async () => {
      try {
        await this.processPendingRuns();
      } catch (error: unknown) {
        console.error("[RalphWorker] Error in polling loop:", error);
      }
    }, 5000);
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
    // Double check inside queue
    if (this.activeRunIds.has(run.id)) return;
    this.activeRunIds.add(run.id);

    console.log(`[RalphWorker] [${run.id}] Starting execution loop`);

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
      const ralph = new Ralph(
        config,
        run.changeId,
        {
          onLog: async (level, message) => {
            await this.log(run.id, level, `[Ralph] ${message}`);
          },
          onIterationComplete: async (iteration) => {
            await db
              .update(runs)
              .set({ currentIteration: iteration })
              .where(eq(runs.id, run.id));
          },
          onTaskStart: async (taskId, title) => {
            console.log(`[RalphWorker] [${run.id}] Task Start: ${taskId}`);
            await db
              .update(runs)
              .set({ lastTaskId: taskId })
              .where(eq(runs.id, run.id));

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
                runId: run.id,
                title: title,
                status: "running",
              });
            }
          },
          onTaskComplete: async (taskId, success) => {
            console.log(
              `[RalphWorker] [${run.id}] Task Complete: ${taskId} (success: ${success})`,
            );
            await db
              .update(tasks)
              .set({
                status: success ? "completed" : "failed",
              })
              .where(eq(tasks.id, taskId));
          },
          onRunComplete: async (success, message) => {
            console.log(`[RalphWorker] [${run.id}] Run Complete: ${message}`);
            await db
              .update(runs)
              .set({
                status: success ? "completed" : "failed",
              })
              .where(eq(runs.id, run.id));
            await this.log(
              run.id,
              success ? "info" : "error",
              `Loop terminated: ${message}`,
            );
          },
        },
        run.maxIterations || 10,
      );

      // Restore session state
      if (run.currentIteration) {
        ralph.setStartIteration(run.currentIteration);
      }

      await ralph.run();
      console.log(`[RalphWorker] [${run.id}] ralph.run() finished`);
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
    await db.insert(logs).values({
      runId,
      level,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}

export const ralphWorker = new RalphWorker();
