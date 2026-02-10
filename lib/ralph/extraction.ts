/**
 * Ralph Output Extraction (Flexible Parsing Strategy)
 *
 * Flexible parsing with priority:
 * 1. JSON block extraction
 * 2. Regex section extraction
 * 3. Raw preservation
 */

import { z } from "zod";
import {
  type FailureAnalysis,
  FailureAnalysisSchema,
  type IterationLog,
  IterationStatusSchema,
} from "./types";

// ============================================================================
// Internal Normalized Schemas (for partial mapping from LLM)
// ============================================================================

const ExtractedIterationLogSchema = z.object({
  threadId: z.string().optional(),
  task: z.string().optional(),
  taskId: z.string().optional(),
  id: z.string().optional(),
  status: IterationStatusSchema.optional(),
  complete: z.boolean().optional(),
  completed: z.boolean().optional(),
  success: z.boolean().optional(),
  implemented: z.array(z.string()).optional(),
  whatWasDone: z.array(z.string()).optional(),
  codebasePatterns: z.array(z.string()).optional(),
  learnings: z.array(z.string()).optional(),
  gotchas: z.array(z.string()).optional(),
  summary: z.string().optional(),
  failureAnalysis: FailureAnalysisSchema.optional(),
});

// ============================================================================
// Regex Patterns (from ralph-tui benchmark)
// ============================================================================

export const SUMMARY_PATTERNS = {
  /** Pattern for extracting what was done */
  whatWasDone:
    /(?:what\s*(?:was\s*)?done|implemented|changes?\s*made)[\s:]*\n+((?:[-*]\s*.+\n?)+)/i,

  /** Pattern for extracting learnings */
  learnings:
    /(?:learnings?|discoveries|insights?|patterns?\s*learned)[\s:]*\n+((?:[-*]\s*.+\n?)+)/i,

  /** Pattern for extracting files changed */
  filesChanged:
    /(?:files?\s*(?:changed|modified|updated)|changed\s*files)[\s:]*\n+((?:[-*]\s*.+\n?)+)/i,

  /** Pattern for extracting gotchas/issues */
  gotchas:
    /(?:gotchas?|issues?|problems?|workarounds?)[\s:]*\n+((?:[-*]\s*.+\n?)+)/i,

  /** Pattern for extracting summary */
  summary:
    /(?:summary|overview|synthesis)[\s:]*\n*([^\n]+(?:\n(?![\n#])[^\n]+)*)/i,

  /** Pattern for completion status */
  complete: /(?:complete|finished|done)[\s:]*\n*(true|false|yes|no)/i,

  /** Pattern for root cause */
  rootCause:
    /(?:root\s*cause|cause|reason)[\s:]*\n*([^\n]+(?:\n(?![\n#])[^\n]+)*)/i,

  /** Pattern for fix plan */
  fixPlan:
    /(?:fix\s*plan|solution|next\s*steps?)[\s:]*\n*((?:[-*\d]\s*.+\n?)+)/i,
};

/** JSON block delimiters (order matters - try most specific first) */
const JSON_DELIMITERS: Array<{ start: string; end: string }> = [
  { start: "<RALPH_ITERATION_LOG_JSON>", end: "</RALPH_ITERATION_LOG_JSON>" },
  { start: "```json", end: "```" },
  { start: "```", end: "```" },
  { start: "{", end: "}" }, // Last resort - try to find any JSON object
];

// ============================================================================
// Extraction Result Types
// ============================================================================

export interface ExtractedIterationData {
  structured: Partial<IterationLog>;
  raw: string;
  extractionMethod: "json" | "regex" | "raw";
  confidence: number; // 0-1, how confident we are in the extraction
}

export interface ExtractedFailureAnalysis {
  analysis: FailureAnalysis;
  extractionMethod: "json" | "regex" | "fallback";
}

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extract iteration data from agent output using flexible strategy:
 * 1. Try JSON block extraction
 * 2. Fall back to regex section extraction
 * 3. Preserve raw text as last resort
 */
export function extractFromOutput(
  output: string,
  sessionId: string,
  iteration: number,
  taskId: string,
): ExtractedIterationData {
  // Try 1: JSON block extraction
  const jsonResult = tryExtractJson(output);
  if (jsonResult) {
    return {
      structured: { ...jsonResult, sessionId, iteration, taskId },
      raw: sanitizeRawOutput(output),
      extractionMethod: "json",
      confidence: 0.95,
    };
  }

  // Try 2: Regex-based extraction
  const regexResult = tryExtractRegex(output);
  if (regexResult) {
    return {
      structured: { ...regexResult, sessionId, iteration, taskId },
      raw: sanitizeRawOutput(output),
      extractionMethod: "regex",
      confidence: 0.7,
    };
  }

  // Try 3: Raw preservation
  return {
    structured: {
      sessionId,
      iteration,
      taskId,
      status: "in_progress",
    },
    raw: sanitizeRawOutput(output),
    extractionMethod: "raw",
    confidence: 0.3,
  };
}

// ============================================================================
// JSON Extraction
// ============================================================================

function tryExtractJson(output: string): Partial<IterationLog> | null {
  for (const delimiter of JSON_DELIMITERS) {
    const extracted = extractJsonWithDelimiter(
      output,
      delimiter.start,
      delimiter.end,
    );
    if (extracted) {
      return normalizeIterationLog(extracted);
    }
  }
  return null;
}

function extractJsonWithDelimiter(
  output: string,
  startDelimiter: string,
  endDelimiter: string,
): z.infer<typeof ExtractedIterationLogSchema> | null {
  const startIndex = output.indexOf(startDelimiter);
  if (startIndex === -1) return null;

  const contentStart = startIndex + startDelimiter.length;
  const endIndex = output.indexOf(endDelimiter, contentStart);
  if (endIndex === -1) return null;

  const jsonContent = output.slice(contentStart, endIndex).trim();

  try {
    const parsed: unknown = JSON.parse(jsonContent);
    const validated = ExtractedIterationLogSchema.safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

// ============================================================================
// Regex Extraction (ralph-tui style)
// ============================================================================

function tryExtractRegex(output: string): Partial<IterationLog> | null {
  const result: Partial<IterationLog> = {};
  let hasData = false;

  // Extract what was done
  const whatWasDoneMatch = output.match(SUMMARY_PATTERNS.whatWasDone);
  if (whatWasDoneMatch?.[1]) {
    result.context = result.context || {};
    result.context.whatWasDone = parseListItems(whatWasDoneMatch[1]);
    hasData = true;
  }

  // Extract learnings
  const learningsMatch = output.match(SUMMARY_PATTERNS.learnings);
  if (learningsMatch?.[1]) {
    result.context = result.context || {};
    result.context.learnings = parseListItems(learningsMatch[1]);
    hasData = true;
  }

  // Extract files changed
  const filesChangedMatch = output.match(SUMMARY_PATTERNS.filesChanged);
  if (filesChangedMatch?.[1]) {
    result.context = result.context || {};
    result.context.filesChanged = parseListItems(filesChangedMatch[1]);
    hasData = true;
  }

  // Extract gotchas
  const gotchasMatch = output.match(SUMMARY_PATTERNS.gotchas);
  if (gotchasMatch?.[1]) {
    result.context = result.context || {};
    result.context.gotchas = parseListItems(gotchasMatch[1]);
    hasData = true;
  }

  // Extract summary
  const summaryMatch = output.match(SUMMARY_PATTERNS.summary);
  if (summaryMatch?.[1]) {
    result.summary = summaryMatch[1].trim();
    hasData = true;
  }

  // Extract completion status
  const completeMatch = output.match(SUMMARY_PATTERNS.complete);
  if (completeMatch?.[1]) {
    const complete = /true|yes/i.test(completeMatch[1]);
    result.agentClaimedComplete = complete;
    result.status = complete ? "success" : "in_progress";
    hasData = true;
  }

  // If no data extracted, return null
  if (!hasData) return null;

  // Ensure defaults
  result.status = result.status || "in_progress";
  result.agentClaimedComplete = result.agentClaimedComplete ?? false;

  return result;
}

// ============================================================================
// Failure Analysis Extraction
// ============================================================================

/**
 * Extract failure analysis from agent output
 * Used when a task fails and we need to analyze the failure
 */
export function extractFailureAnalysis(
  output: string,
  errorMessage: string,
): ExtractedFailureAnalysis {
  // Try JSON first
  const jsonResult = tryExtractJson(output);
  if (jsonResult?.failureAnalysis) {
    // Validate failure analysis with Zod schema
    const parsed = FailureAnalysisSchema.safeParse(jsonResult.failureAnalysis);
    if (parsed.success) {
      const fa = parsed.data;
      return {
        analysis: {
          rootCause: fa.rootCause || errorMessage,
          fixPlan: fa.fixPlan || "Retry with careful attention to the error",
          errorMessage: fa.errorMessage || errorMessage,
          errorType: fa.errorType || categorizeError(errorMessage),
        },
        extractionMethod: "json",
      };
    }
  }

  // Try regex extraction
  const rootCauseMatch = output.match(SUMMARY_PATTERNS.rootCause);
  const fixPlanMatch = output.match(SUMMARY_PATTERNS.fixPlan);

  if (rootCauseMatch?.[1] || fixPlanMatch?.[1]) {
    return {
      analysis: {
        rootCause: rootCauseMatch?.[1]?.trim() || errorMessage,
        fixPlan:
          fixPlanMatch?.[1]?.trim() ||
          "Retry with careful attention to the error",
        errorMessage,
        errorType: categorizeError(errorMessage),
      },
      extractionMethod: "regex",
    };
  }

  // Fallback
  return {
    analysis: {
      rootCause: errorMessage,
      fixPlan: "Retry with careful attention to the error",
      errorMessage,
      errorType: "unknown",
    },
    extractionMethod: "fallback",
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function parseListItems(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-*\d.]\s*/, "").trim())
    .filter((line) => line.length > 0);
}

function categorizeError(
  errorMessage: string,
): "validation" | "runtime" | "timeout" | "unknown" {
  const lower = errorMessage.toLowerCase();
  if (lower.includes("timeout") || lower.includes("timed out"))
    return "timeout";
  if (
    lower.includes("syntax") ||
    lower.includes("type") ||
    lower.includes("lint")
  )
    return "validation";
  if (
    lower.includes("error") ||
    lower.includes("exception") ||
    lower.includes("failed")
  )
    return "runtime";
  return "unknown";
}

function sanitizeRawOutput(output: string): string {
  // Strip ANSI escape codes using string-based pattern construction
  const esc = String.fromCharCode(27);
  const csi = String.fromCharCode(155);
  const ansiPattern = new RegExp(
    `[${esc}${csi}][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]`,
    "g",
  );
  const noAnsi = output.replace(ansiPattern, "");

  // Limit length to prevent storage bloat
  const maxLength = 50000;
  if (noAnsi.length > maxLength) {
    return `${noAnsi.slice(0, maxLength)}\n\n... [truncated]`;
  }

  return noAnsi.trim();
}

/**
 * Normalize extracted data to IterationLog shape
 */
function normalizeIterationLog(
  validated: z.infer<typeof ExtractedIterationLogSchema>,
): Partial<IterationLog> {
  const result: Partial<IterationLog> = {};

  // Map threadId
  if (validated.threadId !== undefined) {
    result.threadId = validated.threadId;
  }

  // Map task reference (task, taskId, or id)
  if (validated.task !== undefined) {
    result.taskId = validated.task;
  } else if (validated.taskId !== undefined) {
    result.taskId = validated.taskId;
  } else if (validated.id !== undefined) {
    result.taskId = validated.id;
  }

  // Map status
  if (validated.status !== undefined) {
    result.status = validated.status;
  }

  // Map completion
  const complete =
    validated.complete ?? validated.completed ?? validated.success;
  if (complete !== undefined) {
    result.agentClaimedComplete = complete;
    if (result.status === undefined) {
      result.status = complete ? "success" : "failed";
    }
  }

  // Map implemented/whatWasDone
  if (validated.implemented !== undefined) {
    result.implemented = validated.implemented;
    result.context = result.context || {};
    result.context.whatWasDone = validated.implemented;
  }
  if (validated.whatWasDone !== undefined) {
    result.context = result.context || {};
    result.context.whatWasDone = validated.whatWasDone;
  }

  // Map patterns/learnings
  if (validated.codebasePatterns !== undefined) {
    result.codebasePatterns = validated.codebasePatterns;
  }
  if (validated.learnings !== undefined) {
    result.context = result.context || {};
    result.context.learnings = validated.learnings;
  }

  // Map gotchas
  if (validated.gotchas !== undefined) {
    result.context = result.context || {};
    result.context.gotchas = validated.gotchas;
  }

  // Map summary
  if (validated.summary !== undefined) {
    result.summary = validated.summary;
  }

  // Map failure analysis
  if (validated.failureAnalysis !== undefined) {
    result.failureAnalysis = validated.failureAnalysis;
    result.status = "failed";
  }

  // Ensure defaults
  if (result.agentClaimedComplete === undefined) {
    result.agentClaimedComplete = result.status === "success";
  }

  return result;
}


