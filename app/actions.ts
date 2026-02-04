"use server";
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
import type { ArtifactType } from "@/lib/openspec/types";
import { validateChange } from "@/lib/openspec/validator";
import { logs, runs, tasks } from "@/lib/schema";

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

export async function createOpenSpecChange(title: string) {
  return await createChange(title);
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

export async function startRalphRun(changeId: string) {
  const runId = `run-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  // Create Run
  await db.insert(runs).values({
    id: runId,
    status: "running",
    createdAt: now,
    changeId,
  });

  // Create Tasks (Mocked initial tasks)
  const initialTasks = [
    {
      id: `task-${Math.random().toString(36).substring(2, 7)}`,
      title: "Analyze Requirements",
      status: "pending",
    },
    {
      id: `task-${Math.random().toString(36).substring(2, 7)}`,
      title: "Generate Code",
      status: "pending",
    },
    {
      id: `task-${Math.random().toString(36).substring(2, 7)}`,
      title: "Run Tests",
      status: "pending",
    },
  ];

  for (const task of initialTasks) {
    await db.insert(tasks).values({
      id: task.id,
      runId,
      title: task.title,
      status: task.status,
    });
  }

  // Initial Log
  await db.insert(logs).values({
    runId,
    level: "info",
    message: `Started Ralph run for change: ${changeId}`,
    timestamp: now,
  });

  return runId;
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

  return {
    id: run.id,
    status: run.status,
    change_id: run.changeId,
    logs: run.logs.map((l) => ({ ...l, id: String(l.id), run_id: l.runId })),
    tasks: run.tasks.map((t) => ({ ...t, run_id: t.runId })),
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
