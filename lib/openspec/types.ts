import { z } from "zod";

export const ArtifactTypeSchema = z.enum([
  "proposal",
  "specs",
  "design",
  "tasks",
]);
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

export const ArtifactStatusSchema = z.object({
  exists: z.boolean(),
  path: z.string(),
  lastModified: z.date().optional(),
});
export type ArtifactStatus = z.infer<typeof ArtifactStatusSchema>;

export const OpenSpecChangeSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["active", "archived"]),
  createdAt: z.date(),
  updatedAt: z.date(),
  artifacts: z.object({
    proposal: ArtifactStatusSchema,
    specs: ArtifactStatusSchema,
    design: ArtifactStatusSchema,
    tasks: ArtifactStatusSchema,
  }),
});
export type OpenSpecChange = z.infer<typeof OpenSpecChangeSchema>;

export const OpenSpecArtifactStatusSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "done", "ready", "blocked"]),
  outputPath: z.string().optional(),
  missingDeps: z.array(z.string()).optional(),
  description: z.string().optional(),
});
export type OpenSpecArtifactStatus = z.infer<
  typeof OpenSpecArtifactStatusSchema
>;

export const OpenSpecCLIStatusSchema = z.object({
  schemaName: z.string(),
  artifacts: z.array(OpenSpecArtifactStatusSchema),
  isComplete: z.boolean(),
});
export type OpenSpecCLIStatus = z.infer<typeof OpenSpecCLIStatusSchema>;

export const ArtifactContentSchema = z.object({
  type: ArtifactTypeSchema,
  content: z.string(),
  lastModified: z.date(),
});
export type ArtifactContent = z.infer<typeof ArtifactContentSchema>;

export const SpecEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(["file", "directory"]),
});
export type SpecEntry = z.infer<typeof SpecEntrySchema>;

export const RunLogSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  level: z.enum(["info", "warn", "error"]),
  message: z.string(),
});
export type RunLog = z.infer<typeof RunLogSchema>;

export const RunTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["pending", "running", "completed", "failed"]),
});
export type RunTask = z.infer<typeof RunTaskSchema>;

export const RunDataSchema = z.object({
  id: z.string(),
  status: z.string(),
  logs: z.array(RunLogSchema),
  tasks: z.array(RunTaskSchema),
});
export type RunData = z.infer<typeof RunDataSchema>;

export const ExecErrorSchema = z.object({
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  message: z.string().optional(),
});
export type ExecError = z.infer<typeof ExecErrorSchema>;

export const ProjectConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  checkCommand: z.string().optional(),
  preCheckCommand: z.string().optional(),
  context: z.string().optional(),
  rulesApply: z.string().optional(),
  rulesVerification: z.string().optional(),
});
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
