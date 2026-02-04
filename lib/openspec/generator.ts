"use server";
import { exec, spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

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
  input: Record<string, unknown>;
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
  const m = msg as Record<string, unknown>;
  return (
    m.type === "assistant" &&
    typeof m.message === "object" &&
    m.message !== null &&
    (m.message as Record<string, unknown>).type === "message"
  );
}

function isErrorMessage(msg: unknown): msg is ErrorResultMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return m.type === "result" && m.is_error === true;
}

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

  // Map internal types to CLI arguments
  const typeMap: Record<string, string> = {
    proposal: "proposal",
    specs: "specs",
    design: "design",
    tasks: "tasks",
  };

  const cliArtifact = typeMap[artifactType];
  if (!cliArtifact) {
    throw new Error(`Unknown artifact type: ${artifactType}`);
  }

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
  // 1. Get the prompt from OpenSpec
  const instructions = await getOpenSpecInstructions(changeId, artifactType);

  const languageInstruction =
    language === "ko"
      ? "IMPORTANT: Generate the content in Korean (한국어). However, for requirements, you MUST use the English keywords 'SHALL' or 'MUST' to satisfy the validator. Example: '시스템은 사용자가 테마를 전환할 수 있게 해야 한다 (SHALL).'"
      : "Generate the content in English.";

  // 2. Use Amp CLI directly via local binary
  // We wrap the instructions in a clear directive for the agent
  const prompt = `
You are an expert software architect and product manager.
Please generate the content for the '${artifactType}' artifact based on the following instructions and context from OpenSpec.
Return ONLY the markdown content for the file. Do not include introductory text or wrapping "Here is the file" comments.

${languageInstruction}

${instructions}
`;

  return await runAmp(prompt);
}

export async function fixArtifactContent(
  content: string,
  errors: string[],
  language: "en" | "ko" = "en",
): Promise<string> {
  const languageInstruction =
    language === "ko"
      ? "IMPORTANT: Provide the fixed content in Korean (한국어). However, for requirements, you MUST use the English keywords 'SHALL' or 'MUST' to satisfy the validator. Example: '시스템은 사용자가 테마를 전환할 수 있게 해야 한다 (SHALL).'"
      : "Provide the fixed content in English.";

  const prompt = `
You are an expert technical writer and software architect.
The following artifact content failed validation with the listed errors.
Please fix the content to resolve all errors.

Common fixes needed:
- For "must contain SHALL or MUST" errors: Rewrite requirements to use RFC 2119 keywords (MUST, SHALL, SHOULD, MAY) in uppercase.
  Example: "The system should do X" -> "The system SHALL do X".
- Keep the original meaning and structure.
- Return ONLY the fixed markdown content.

${languageInstruction}

Errors:
${errors.map((e) => `- ${e}`).join("\n")}

Content:
${content}
`;

  return await runAmp(prompt);
}

async function runAmp(prompt: string): Promise<string> {
  let fullResponse = "";

  try {
    // Resolve the local amp binary path
    const ampBin = path.join(process.cwd(), "node_modules", ".bin", "amp");

    // Spawn the process with --execute flag required for --stream-json
    // We pass the prompt via stdin.
    const child = spawn(ampBin, ["--execute", "--stream-json"], {
      env: { ...process.env }, // Use default env
    });

    // Write prompt to stdin to avoid argument length limits and ensure stability
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
        // Process all complete lines
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
          } catch (_) {
            // Ignore parse errors for incomplete lines or non-json output
          }
        }
      });

      child.stderr.on("data", (chunk) => {
        console.error("Amp CLI stderr:", chunk);
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
