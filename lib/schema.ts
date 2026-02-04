import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  changeId: text("change_id"),
});

export const runsRelations = relations(runs, ({ many }) => ({
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
