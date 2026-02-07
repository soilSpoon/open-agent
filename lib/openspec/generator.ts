"use server";
import { exec, spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { getArtifactContent, getChangeStatus, saveArtifact } from "./service";
import { getSpecsList } from "./specs-utils";
import { ExecErrorSchema } from "./types";

const execAsync = promisify(exec);

// Define schemas for Amp CLI --stream-json output
const TextContentSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

// Tool input type - key-value pairs with primitive values
type ToolInput = Record<string, string | number | boolean | null | undefined>;

const ToolUseContentSchema = z.object({
  type: z.literal("tool_use"),
  id: z.string(),
  name: z.string(),
  input: z.custom<ToolInput>((val) => {
    if (typeof val !== "object" || val === null) return false;
    return Object.entries(val).every(([_, v]) => {
      const type = typeof v;
      return (
        type === "string" ||
        type === "number" ||
        type === "boolean" ||
        v === null ||
        v === undefined
      );
    });
  }),
});

const AssistantMessageSchema = z.object({
  type: z.literal("assistant"),
  message: z.object({
    type: z.literal("message"),
    role: z.literal("assistant"),
    content: z.array(z.union([TextContentSchema, ToolUseContentSchema])),
  }),
});

const ErrorResultMessageSchema = z.object({
  type: z.literal("result"),
  is_error: z.literal(true),
  error: z.string(),
});

type AssistantMessage = z.infer<typeof AssistantMessageSchema>;
type ErrorResultMessage = z.infer<typeof ErrorResultMessageSchema>;
type TextContent = z.infer<typeof TextContentSchema>;

function isAssistantMessage(msg: unknown): msg is AssistantMessage {
  return AssistantMessageSchema.safeParse(msg).success;
}

function isErrorMessage(msg: unknown): msg is ErrorResultMessage {
  return ErrorResultMessageSchema.safeParse(msg).success;
}

const ArtifactTypeSchema = z.enum(["proposal", "specs", "design", "tasks"]);

const FixResponseSchema = z.object({
  modifiedFiles: z.array(
    z.object({
      type: ArtifactTypeSchema,
      filePath: z.string().optional(),
      description: z.string().optional(),
      content: z.string(),
    }),
  ),
});

async function getOpenSpecInstructions(
  changeId: string,
  artifactType: string,
): Promise<string> {
  const openspecBin = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    "openspec",
  );

  const parsedType = ArtifactTypeSchema.safeParse(artifactType);
  if (!parsedType.success) {
    throw new Error(`Unknown artifact type: ${artifactType}`);
  }

  const cliArtifact = parsedType.data;

  try {
    const { stdout } = await execAsync(
      `"${openspecBin}" instructions ${cliArtifact} --change "${changeId}"`,
    );
    return stdout;
  } catch (error) {
    const result = ExecErrorSchema.safeParse(error);
    const message = result.success
      ? result.data.message || result.data.stderr || "Unknown error"
      : "Failed to generate instructions from OpenSpec CLI";
    console.error("Failed to generate instructions:", error);
    throw new Error(message);
  }
}

export async function generateArtifactInstructions(
  changeId: string,
  artifactType: string,
  language: "en" | "ko" = "en",
): Promise<string> {
  // 1. Check status first to ensure it's ready
  const status = await getChangeStatus(changeId);
  const artifactStatus = status?.artifacts.find((a) => a.id === artifactType);

  if (!artifactStatus) {
    throw new Error(`Artifact ${artifactType} not found in change status.`);
  }

  if (artifactStatus.status === "pending") {
    throw new Error(
      `Artifact ${artifactType} is not ready yet. Please complete preceding steps.`,
    );
  }

  if (artifactStatus.status === "blocked") {
    const deps =
      artifactStatus.missingDeps?.join(", ") || "unknown dependencies";
    throw new Error(
      `Artifact ${artifactType} is blocked by: ${deps}. Please complete them first.`,
    );
  }

  const instructions = await getOpenSpecInstructions(changeId, artifactType);

  const languageInstruction =
    language === "ko"
      ? "IMPORTANT: Generate the content in Korean (한국어). However, for requirements, you MUST use the English keywords 'SHALL' or 'MUST' to satisfy the validator. Example: '시스템은 사용자가 테마를 전환할 수 있게 해야 한다 (SHALL).'"
      : "Generate the content in English.";

  const prompt = `
You are an expert software architect and product manager.
Please generate the content for the '${artifactType}' artifact based on the following instructions and context from OpenSpec.
Return ONLY the markdown content for the file. Do not include introductory text or wrapping "Here is the file" comments.

${languageInstruction}

${instructions}
`;

  return await runAmp(prompt);
}

export async function fixAllArtifacts(
  changeId: string,
  errors: string[],
  language: "en" | "ko" = "en",
) {
  // 1. Get all artifact contents
  const [proposal, design, tasks, specsList] = await Promise.all([
    getArtifactContent(changeId, "proposal"),
    getArtifactContent(changeId, "design"),
    getArtifactContent(changeId, "tasks"),
    getSpecsList(changeId),
  ]);

  const specsContents = await Promise.all(
    specsList.map(async (f) => ({
      type: "specs" as const,
      filePath: f.path,
      content:
        (await getArtifactContent(changeId, "specs", f.path))?.content ?? "",
    })),
  );

  const artifacts = [
    {
      type: "proposal" as const,
      filePath: undefined,
      content: proposal?.content ?? "",
    },
    ...specsContents,
    {
      type: "design" as const,
      filePath: undefined,
      content: design?.content ?? "",
    },
    {
      type: "tasks" as const,
      filePath: undefined,
      content: tasks?.content ?? "",
    },
  ];

  // 2. Prepare AI prompt
  const languageInstruction =
    language === "ko"
      ? "IMPORTANT: Provide the fixed content in Korean (한국어). However, for requirements, you MUST use the English keywords 'SHALL' or 'MUST' to satisfy the validator. Example: '시스템은 사용자가 테마를 전환할 수 있게 해야 한다 (SHALL).'"
      : "Provide the fixed content in English.";

  const prompt = `
You are an expert technical writer and software architect.
The following OpenSpec artifacts failed validation with the listed errors.
Please fix the content across all files to resolve all errors and ensure consistency.

Errors:
${errors.map((e) => `- ${e}`).join("\n")}

Current artifacts:
${artifacts
  .map(
    (a) => `
--- FILE: ${a.type}${a.filePath ? ` (${a.filePath})` : ""} ---
${a.content}
`,
  )
  .join("\n")}

Instructions:
- Rewrite requirements to use RFC 2119 keywords (MUST, SHALL, SHOULD, MAY) in uppercase to satisfy validation.
- Maintain consistency across all files.
- Return ONLY a JSON object containing the modified files.
- Each item in 'modifiedFiles' must have 'type', 'filePath' (for specs), 'description' (what was fixed), and 'content' (full new content).

Expected JSON format:
{
  "modifiedFiles": [
    {
      "type": "specs",
      "filePath": "dark-mode/spec.md",
      "description": "Fixed requirement keywords",
      "content": "... full content ..."
    }
  ]
}

${languageInstruction}
`;

  // 3. Run AI
  const response = await runAmp(prompt);

  // 4. Parse response and save files
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in AI response");

    const parsed = JSON.parse(jsonMatch[0]);
    const validation = FixResponseSchema.safeParse(parsed);
    if (!validation.success) {
      throw new Error(
        `Invalid AI response format: ${validation.error.message}`,
      );
    }

    const { modifiedFiles: aiModifiedFiles } = validation.data;
    const modifiedFiles = [];

    for (const file of aiModifiedFiles) {
      await saveArtifact(changeId, file.type, file.content, file.filePath);
      modifiedFiles.push({
        type: file.type,
        filePath: file.filePath,
        description: file.description || "Fixed validation errors",
      });
    }

    return { success: true, modifiedFiles };
  } catch (error) {
    console.error("Failed to parse or save AI fix:", error);
    return { success: false, modifiedFiles: [] };
  }
}

async function runAmp(prompt: string): Promise<string> {
  let fullResponse = "";

  try {
    const ampBin = path.join(process.cwd(), "node_modules", ".bin", "amp");
    const child = spawn(ampBin, ["--execute", "--stream-json"], {
      env: { ...process.env },
    });

    if (child.stdin) {
      child.stdin.write(prompt);
      child.stdin.end();
    }

    let stdoutBuf = "";

    await new Promise<void>((resolve, reject) => {
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");

      child.stdout.on("data", (chunk) => {
        stdoutBuf += chunk;
        const lines = stdoutBuf.split("\n");
        stdoutBuf = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg: unknown = JSON.parse(line);
            if (isAssistantMessage(msg)) {
              const textParts = msg.message.content
                .filter((c): c is TextContent => c.type === "text")
                .map((c) => c.text)
                .join("");
              fullResponse += textParts;
            } else if (isErrorMessage(msg)) {
              console.error("Amp execution error:", msg.error);
            }
          } catch (_) {}
        }
      });

      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Amp CLI exited with code ${code}`));
      });

      child.on("error", (err) => reject(err));
    });
  } catch (error) {
    console.error("Amp SDK execution failed:", error);
    throw error;
  }

  return fullResponse.trim();
}
