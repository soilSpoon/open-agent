"use server";
import { exec, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { getArtifactContent, saveArtifact } from "./service";
import { getSpecsList } from "./specs-utils";
import type { ArtifactType } from "./types";

const execAsync = promisify(exec);

// Define types compatible with Amp CLI --stream-json output
interface TextContent {
  type: "text";
  text: string;
}

interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, string | number | boolean | null>;
}

interface AssistantMessage {
  type: "assistant";
  message: {
    type: "message";
    role: "assistant";
    content: Array<TextContent | ToolUseContent>;
  };
}

interface ErrorResultMessage {
  type: "result";
  is_error: true;
  error: string;
}

function isAssistantMessage(msg: unknown): msg is AssistantMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, string | number | boolean | object | null>;
  return (
    m.type === "assistant" &&
    typeof m.message === "object" &&
    m.message !== null &&
    (m.message as Record<string, string | number | boolean | object | null>)
      .type === "message"
  );
}

function isErrorMessage(msg: unknown): msg is ErrorResultMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, string | number | boolean | object | null>;
  return m.type === "result" && m.is_error === true;
}

const ArtifactTypeSchema = z.enum(["proposal", "specs", "design", "tasks"]);

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
    console.error("Failed to generate instructions:", error);
    throw new Error("Failed to generate instructions from OpenSpec CLI");
  }
}

export async function generateArtifactInstructions(
  changeId: string,
  artifactType: string,
  language: "en" | "ko" = "en",
): Promise<string> {
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

    const result = JSON.parse(jsonMatch[0]);
    const modifiedFiles = [];

    for (const file of result.modifiedFiles) {
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
            const msg = JSON.parse(line);
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
