"use server";
import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

export async function validateChange(
  changeId: string,
): Promise<ValidationResult> {
  const openspecBin = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    "openspec",
  );

  try {
    // We expect this to fail if invalid, so we catch the error
    await execAsync(`"${openspecBin}" validate "${changeId}"`);
    return { valid: true, errors: [] };
  } catch (error) {
    let output = "";
    if (error && typeof error === "object") {
      if ("stdout" in error && typeof error.stdout === "string") {
        output += error.stdout;
      }
      if ("stderr" in error && typeof error.stderr === "string") {
        output += error.stderr;
      }
      if (
        output === "" &&
        "message" in error &&
        typeof error.message === "string"
      ) {
        output = error.message;
      }
    }
    // Simple parsing of lines that look like errors
    // We want to extract the meaningful error message, removing stack traces or redundant info
    const lines = output.toString().split("\n");
    const errors: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Look for lines starting with ✖ or [ERROR] or explicit "Error:"
      if (
        trimmed.startsWith("✖") ||
        trimmed.includes("[ERROR]") ||
        (trimmed.startsWith("Error:") && !trimmed.includes("Command failed"))
      ) {
        // Clean up the line
        const cleanMsg = trimmed
          .replace(/^✖\s*/, "")
          .replace(/^Error:\s*/, "")
          .replace(/\[ERROR\]\s*/, "");

        if (cleanMsg.length > 0 && !errors.includes(cleanMsg)) {
          errors.push(cleanMsg);
        }
      }
    }

    return {
      valid: false,
      errors:
        errors.length > 0
          ? errors
          : ["Validation failed. Check console for details."],
    };
  }
}
