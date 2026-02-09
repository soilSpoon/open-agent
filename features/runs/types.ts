import { z } from "zod";
import { IterationLogSchema, SessionStatusSchema } from "@/lib/ralph/types";

export const RunTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  run_id: z.string().optional(),
});

export type RunTask = z.infer<typeof RunTaskSchema>;

export const RunLogSchema = IterationLogSchema.extend({
  id: z.string(),
});

export type RunLog = z.infer<typeof RunLogSchema>;

export const RunSchema = z.object({
  id: z.string(),
  status: SessionStatusSchema,
  change_id: z.string().nullable(),
  logs: z.array(RunLogSchema),
  tasks: z.array(RunTaskSchema),
});

export type Run = z.infer<typeof RunSchema>;
