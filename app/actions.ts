"use server";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { desc, eq } from "drizzle-orm";
import db from "@/lib/db";
import {
  fixAllArtifacts,
  generateArtifactInstructions,
} from "@/lib/openspec/generator";
import {
  createChange,
  deleteChange,
  getArtifactContent,
  getChangeStatus,
  getSpecsList,
  renameChange,
  saveArtifact,
} from "@/lib/openspec/service";
import type { ArtifactType, ProjectConfig } from "@/lib/openspec/types";
import { validateChange } from "@/lib/openspec/validator";
import { createIterationPersistence } from "@/lib/ralph/iteration";
import type { IterationLog } from "@/lib/ralph/types";
import { logs, projects, runs, tasks } from "@/lib/schema";

import { loadOpenSpecSchema } from "@/lib/openspec/schema-loader";

export async function getPipelineSchema() {
  return await loadOpenSpecSchema();
}

export async function getDashboardStats() {
  const [activeRunsCount, completedTasks] = await Promise.all([
    db.query.runs.findMany({
      where: eq(runs.status, "running"),
    }),
    db.query.tasks.findMany({
      where: eq(tasks.status, "completed"),
    }),
  ]);

  const totalTasks = await db.query.tasks.findMany();
  const successRate =
    totalTasks.length > 0
      ? (completedTasks.length / totalTasks.length) * 100
      : 0;

  return {
    activeRuns: activeRunsCount.length,
    completedTasks: completedTasks.length,
    successRate: successRate.toFixed(1),
  };
}

export async function createOpenSpecChange(title: string, description?: string) {
  return await createChange(title, description);
}

export async function generateInstructions(
  changeId: string,
  type: ArtifactType,
  language: "en" | "ko" = "en",
) {
  return await generateArtifactInstructions(changeId, type, language);
}

export interface FixResult {
  modifiedFiles: {
    type: ArtifactType;
    filePath?: string;
    description: string;
  }[];
  success: boolean;
}

export async function fixArtifact(
  changeId: string,
  errors: string[],
  language: "en" | "ko" = "en",
): Promise<FixResult> {
  return await fixAllArtifacts(changeId, errors, language);
}

export async function getOpenSpecChangeStatus(changeId: string) {
  return await getChangeStatus(changeId);
}

export async function validateOpenSpecChange(changeId: string) {
  return await validateChange(changeId);
}

export async function loadArtifact(
  changeId: string,
  type: ArtifactType,
  filePath?: string,
) {
  return await getArtifactContent(changeId, type, filePath);
}

export async function updateArtifact(
  changeId: string,
  type: ArtifactType,
  content: string,
  filePath?: string,
) {
  await saveArtifact(changeId, type, content, filePath);
}

export async function fetchSpecsList(changeId: string) {
  return await getSpecsList(changeId);
}

export async function deleteOpenSpecChange(id: string) {
  await deleteChange(id);
}

export async function renameOpenSpecChange(id: string, newTitle: string) {
  return await renameChange(id, newTitle);
}

export async function getActiveRunForChange(changeId: string) {
  const run = await db.query.runs.findFirst({
    where: (runs, { and, eq }) =>
      and(eq(runs.changeId, changeId), eq(runs.status, "running")),
    orderBy: desc(runs.createdAt),
  });

  return run ? { id: run.id } : null;
}

export async function stopRalphRun(runId: string) {
  await db.update(runs).set({ status: "stopped" }).where(eq(runs.id, runId));

  // Log the stop event
  const now = new Date().toISOString();
  await db.insert(logs).values({
    runId,
    level: "info",
    message: "Run stopped by user",
    timestamp: now,
  });
}

export async function startRalphRun(
  changeId: string,
  projectConfig?: ProjectConfig,
) {
  const runId = `run-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  // Create Run
  await db.insert(runs).values({
    id: runId,
    status: "running",
    createdAt: now,
    changeId,
    projectConfig: projectConfig ? JSON.stringify(projectConfig) : null,
  });

  // Initial Log
  await db.insert(logs).values({
    runId,
    level: "info",
    message: `Started Ralph run for change: ${changeId}`,
    timestamp: now,
  });

  return runId;
}

export async function retryRun(runId: string) {
  const oldRun = await db.query.runs.findFirst({
    where: eq(runs.id, runId),
  });

  if (!oldRun || !oldRun.changeId) {
    throw new Error("Run not found or missing change ID");
  }

  const projectConfig = oldRun.projectConfig
    ? (JSON.parse(oldRun.projectConfig) as ProjectConfig)
    : undefined;

  // Reset iteration count to 0 while preserving learned context
  if (projectConfig) {
    const sessionPath = path.join(
      projectConfig.path,
      "openspec",
      "changes",
      oldRun.changeId,
      ".ralph",
      "session.json",
    );
    try {
      const content = await fs.readFile(sessionPath, "utf-8");
      const session = JSON.parse(content) as {
        iteration: number;
        status: string;
        errorHandling: { currentRetryCount: number };
      };
      session.iteration = 0;
      session.status = "running";
      session.errorHandling.currentRetryCount = 0;
      await fs.writeFile(
        sessionPath,
        JSON.stringify(session, null, 2),
        "utf-8",
      );
    } catch {
      // Session file might not exist, which is fine - engine will create new one
    }
  }

  return await startRalphRun(oldRun.changeId, projectConfig);
}

export async function getRun(runId: string) {
  const run = await db.query.runs.findFirst({
    where: eq(runs.id, runId),
    with: {
      tasks: true,
      logs: true,
    },
  });

  if (!run) return null;

  let iterationLogs: (IterationLog & { id: string })[] = [];
  const allTasks: {
    id: string;
    title: string;
    status: string;
    run_id: string;
  }[] = [];

  // Try to load detailed iteration logs and tasks from files
  if (run.projectConfig && run.changeId) {
    try {
      const config = JSON.parse(run.projectConfig) as ProjectConfig;
      const changeBasePath = path.join(
        config.path,
        "openspec",
        "changes",
        run.changeId,
      );
      const ralphDir = path.join(changeBasePath, ".ralph");
      const iterationsDir = path.join(ralphDir, "iterations");

      const persistence = createIterationPersistence({
        iterationsDir,
        ralphDir,
        sessionId: runId,
      });

      iterationLogs = await persistence
        .listIterationLogs()
        .then(async (infos) => {
          const logs: (IterationLog & { id: string })[] = [];
          for (const info of infos) {
            const log = await persistence.readIteration(info.filename);
            if (log) {
              logs.push({
                ...log,
                id: info.filename,
                timestamp: log.timestamp || info.metadata.startedAt,
              });
            }
          }
          return logs.sort((a, b) => a.iteration - b.iteration);
        });

      // Parse tasks.md to get full task list
      const tasksPath = path.join(changeBasePath, "tasks.md");
      try {
        const tasksContent = await fs.readFile(tasksPath, "utf-8");
        const dbTasksMap = new Map(run.tasks.map((t) => [t.id, t]));

        // Parse markdown task items: - [x] or - [ ] followed by task number and title
        const taskRegex = /^-\s*\[(x| )\]\s*(\d+(?:\.\d+)?)\s+(.+?)$/gm;
        let match = taskRegex.exec(tasksContent);

        while (match !== null) {
          const isCompleted = match[1] === "x";
          const taskId = match[2];
          const title = match[3].trim();

          // Check if task exists in DB with current status
          const dbTask = dbTasksMap.get(taskId);
          const status =
            dbTask?.status ?? (isCompleted ? "completed" : "pending");

          allTasks.push({
            id: taskId,
            title,
            status,
            run_id: runId,
          });

          match = taskRegex.exec(tasksContent);
        }
      } catch {
        // tasks.md doesn't exist, fall back to DB tasks
      }
    } catch (e) {
      console.error("Failed to load iteration logs:", e);
    }
  }

  // Use parsed tasks if available, otherwise fall back to DB tasks
  const finalTasks =
    allTasks.length > 0
      ? allTasks
      : run.tasks.map((t) => ({ ...t, run_id: t.runId }));

  return {
    id: run.id,
    status: run.status,
    change_id: run.changeId,
    logs: iterationLogs,
    tasks: finalTasks,
  };
}

export async function getRuns() {
  const allRuns = await db.query.runs.findMany({
    orderBy: desc(runs.createdAt),
    with: {
      tasks: true,
    },
  });

  const runsWithDetails = allRuns.map((run) => {
    const total = run.tasks.length;
    const completed = run.tasks.filter((t) => t.status === "completed").length;

    return {
      id: run.id,
      created_at: run.createdAt,
      status: run.status,
      change_id: run.changeId,
      progress: `${completed}/${total}`,
    };
  });

  return runsWithDetails;
}

export async function getActiveRuns() {
  const activeRuns = await db.query.runs.findMany({
    where: eq(runs.status, "running"),
    orderBy: desc(runs.createdAt),
    with: {
      tasks: true,
    },
  });

  const runsWithDetails = activeRuns.map((run) => {
    const total = run.tasks.length;
    const completed = run.tasks.filter((t) => t.status === "completed").length;

    return {
      id: run.id,
      created_at: run.createdAt,
      status: run.status,
      change_id: run.changeId,
      progress: `${completed}/${total}`,
    };
  });

  return runsWithDetails;
}

// Project CRUD Actions

export async function getProjects() {
  return await db.query.projects.findMany({
    orderBy: desc(projects.updatedAt),
  });
}

export async function getProject(id: string) {
  return await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
}

export async function createProject(
  name: string,
  path: string,
  checkCommand?: string,
  preCheckCommand?: string,
) {
  const id = Math.random().toString(36).substring(7);
  const now = new Date().toISOString();

  await db.insert(projects).values({
    id,
    name,
    path,
    checkCommand,
    preCheckCommand,
    createdAt: now,
    updatedAt: now,
  });

  return id;
}

export async function updateProject(
  id: string,
  data: {
    name?: string;
    path?: string;
    checkCommand?: string;
    preCheckCommand?: string;
  },
) {
  const now = new Date().toISOString();

  await db
    .update(projects)
    .set({
      ...data,
      updatedAt: now,
    })
    .where(eq(projects.id, id));
}

export async function deleteProject(id: string) {
  await db.delete(projects).where(eq(projects.id, id));
}
