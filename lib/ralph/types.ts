/**
 * Ralph - OpenSpec Integration Types
 *
 * Type definitions for the Ralph autonomous agent loop with:
 * - Structured session persistence
 * - Immutable iteration logs
 * - Failure analysis propagation
 * - Crash recovery support
 * - Dual-gate verification
 * - JSONL format for AI-native parsing
 */

// ============================================================================
// Schema Versioning
// ============================================================================

export const CURRENT_SCHEMA_VERSION = 2;

import { z } from "zod";

// ============================================================================
// Core Enums and Schemas
// ============================================================================

export const SessionStatusSchema = z.enum([
  "running",
  "paused",
  "failed",
  "completed",
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const IterationStatusSchema = z.enum([
  "success",
  "failed",
  "in_progress",
]);
export type IterationStatus = z.infer<typeof IterationStatusSchema>;

export const ErrorTypeSchema = z.enum([
  "validation",
  "runtime",
  "timeout",
  "unknown",
]);
export type ErrorType = z.infer<typeof ErrorTypeSchema>;

export const ErrorStrategySchema = z.enum([
  "retry",
  "analyze-retry",
  "skip",
  "escalate",
]);
export type ErrorStrategy = z.infer<typeof ErrorStrategySchema>;

// ============================================================================
// Verification Evidence
// ============================================================================

export const VerificationEvidenceSchema = z.object({
  checkOutput: z.string(),
  checkOutputSummary: z.string().optional(),
  testOutput: z.string().optional(),
  specValidation: z
    .object({
      passed: z.boolean(),
      errors: z.array(z.string()).optional(),
    })
    .optional(),
  allChecksPassed: z.boolean(),
  collectedAt: z.string(),
});
export type VerificationEvidence = z.infer<typeof VerificationEvidenceSchema>;

// ============================================================================
// Session State
// ============================================================================

export const SessionStateSchema = z.object({
  schemaVersion: z.number(),
  sessionId: z.string(),
  changeId: z.string(),
  status: SessionStatusSchema,
  currentTask: z
    .object({
      id: z.string(),
      description: z.string(),
      attemptCount: z.number(),
    })
    .nullable(),
  iteration: z.number(),
  maxIterations: z.number(),
  lastSuccessfulCommit: z.string().optional(),
  lockedBy: z
    .object({
      pid: z.number(),
      timestamp: z.string(),
    })
    .optional(),
  errorHandling: z.object({
    strategy: ErrorStrategySchema,
    maxRetries: z.number(),
    currentRetryCount: z.number(),
  }),
  context: z.object({
    codebasePatterns: z.array(z.string()),
    recentFailures: z.array(
      z.object({
        iteration: z.number(),
        taskId: z.string(),
        rootCause: z.string(),
        fixPlan: z.string(),
      }),
    ),
    sandbox: z
      .object({
        sessionId: z.string().optional(),
        workspaceId: z.string().optional(),
        createdAt: z.string().optional(),
      })
      .optional(),
  }),
  lastCleanupAt: z.string().optional(),
});
export type SessionState = z.infer<typeof SessionStateSchema>;

// ============================================================================
// Iteration Log
// ============================================================================

export const FailureAnalysisSchema = z.object({
  rootCause: z.string(),
  fixPlan: z.string(),
  errorMessage: z.string(),
  errorType: ErrorTypeSchema,
});
export type FailureAnalysis = z.infer<typeof FailureAnalysisSchema>;

export const IterationLogSchema = z.object({
  schemaVersion: z.number(),
  sessionId: z.string(),
  iteration: z.number(),
  taskId: z.string(),
  taskAttempt: z.number(),
  timestamp: z.string(),
  threadId: z.string().optional(),
  status: IterationStatusSchema,
  promptTokens: z.number().optional(),
  agentClaimedComplete: z.boolean(),
  verificationEvidence: VerificationEvidenceSchema.optional(),
  context: z
    .object({
      whatWasDone: z.array(z.string()).optional(),
      learnings: z.array(z.string()).optional(),
      filesChanged: z.array(z.string()).optional(),
      gotchas: z.array(z.string()).optional(),
    })
    .optional(),
  implemented: z.array(z.string()).optional(),
  codebasePatterns: z.array(z.string()).optional(),
  summary: z.string().optional(),
  failureAnalysis: FailureAnalysisSchema.optional(),
  commitBefore: z.string().optional(),
  commitAfter: z.string().optional(),
  durationMs: z.number(),
  rawOutput: z.string().optional(),
});
export type IterationLog = z.infer<typeof IterationLogSchema>;

// ============================================================================
// Lock File
// ============================================================================

export const LockFileSchema = z.object({
  pid: z.number(),
  timestamp: z.string(),
  sessionId: z.string(),
});
export type LockFile = z.infer<typeof LockFileSchema>;

// ============================================================================
// Agent Plugin Interface
// ============================================================================

export interface AgentPlugin {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  execute(options: {
    prompt: string;
    cwd: string;
    timeoutMs?: number;
  }): Promise<AgentResult>;
  parseOutput(output: string): {
    structured: Partial<IterationLog>;
    raw: string;
  };
}

export interface AgentResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export type LockStatus =
  | { status: "free" }
  | { status: "locked"; lock: LockFile; stale: boolean }
  | { status: "stale"; lock: LockFile };

export interface ResumeOptions {
  resume: boolean;
  force: boolean;
}
