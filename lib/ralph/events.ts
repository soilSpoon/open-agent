import { z } from "zod";

export const RalphEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("run:new"),
    runId: z.string(),
  }),
  z.object({
    type: z.literal("run:status"),
    runId: z.string(),
    status: z.enum(["running", "completed", "failed"]),
  }),
  z.object({
    type: z.literal("task:start"),
    runId: z.string(),
    taskId: z.string(),
    title: z.string(),
  }),
  z.object({
    type: z.literal("task:complete"),
    runId: z.string(),
    taskId: z.string(),
    success: z.boolean(),
  }),
  z.object({
    type: z.literal("log"),
    runId: z.string(),
    level: z.enum(["info", "warn", "error"]),
    message: z.string(),
  }),
]);

export type RalphEvent = z.infer<typeof RalphEventSchema>;
