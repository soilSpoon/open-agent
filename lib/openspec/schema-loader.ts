import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as yaml from "yaml";
import { z } from "zod";

const ArtifactSchema = z.object({
  id: z.string(),
  generates: z.string(),
  description: z.string(),
  template: z.string().optional(),
  instruction: z.string(),
  requires: z.array(z.string()).default([]),
});

const ApplyConfigSchema = z.object({
  requires: z.array(z.string()),
  tracks: z.string(),
  instruction: z.string(),
});

const OpenSpecSchemaSchema = z.object({
  name: z.string(),
  version: z.number(),
  description: z.string(),
  artifacts: z.array(ArtifactSchema),
  apply: ApplyConfigSchema.optional(),
});

export type OpenSpecSchemaArtifact = z.infer<typeof ArtifactSchema>;
export type OpenSpecSchema = z.infer<typeof OpenSpecSchemaSchema>;

let cachedSchema: OpenSpecSchema | null = null;

export async function loadOpenSpecSchema(): Promise<OpenSpecSchema> {
  if (cachedSchema) return cachedSchema;

  const schemaPath = path.join(
    process.cwd(),
    "node_modules",
    "@fission-ai",
    "openspec",
    "schemas",
    "spec-driven",
    "schema.yaml"
  );

  const content = await fs.readFile(schemaPath, "utf-8");
  const parsed = yaml.parse(content);
  cachedSchema = OpenSpecSchemaSchema.parse(parsed);
  return cachedSchema;
}

export function getArtifactDependencies(schema: OpenSpecSchema): Map<string, string[]> {
  const deps = new Map<string, string[]>();
  for (const artifact of schema.artifacts) {
    deps.set(artifact.id, artifact.requires);
  }
  return deps;
}

export function getArtifactOrder(schema: OpenSpecSchema): string[] {
  return schema.artifacts.map((a) => a.id);
}

export function getArtifactById(
  schema: OpenSpecSchema,
  id: string
): OpenSpecSchemaArtifact | undefined {
  return schema.artifacts.find((a) => a.id === id);
}

export function clearSchemaCache(): void {
  cachedSchema = null;
}
