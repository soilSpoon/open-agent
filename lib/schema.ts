import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  changeId: text("change_id"),
  projectConfig: text("project_config"), // Deprecated: use projectId instead
  projectId: text("project_id").references(() => projects.id),
  currentIteration: integer("current_iteration").default(1),
  maxIterations: integer("max_iterations").default(10),
  lastTaskId: text("last_task_id"),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  path: text("path").notNull().unique(),
  checkCommand: text("check_command"),
  preCheckCommand: text("pre_check_command"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  runs: many(runs),
}));

export const runsRelations = relations(runs, ({ one, many }) => ({
  project: one(projects, {
    fields: [runs.projectId],
    references: [projects.id],
  }),
  tasks: many(tasks),
  logs: many(logs),
}));

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id),
  title: text("title").notNull(),
  status: text("status").notNull(),
});

export const tasksRelations = relations(tasks, ({ one }) => ({
  run: one(runs, {
    fields: [tasks.runId],
    references: [runs.id],
  }),
}));

export const logs = sqliteTable("logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id),
  level: text("level").notNull(),
  message: text("message").notNull(),
  timestamp: text("timestamp").notNull(),
});

export const logsRelations = relations(logs, ({ one }) => ({
  run: one(runs, {
    fields: [logs.runId],
    references: [runs.id],
  }),
}));
