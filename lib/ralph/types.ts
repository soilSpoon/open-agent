/**
 * Ralph - OpenSpec Integration Types
 *
 * Type definitions for the Ralph autonomous agent loop with:
 * - Structured session persistence
 * - Immutable iteration logs
 * - Failure analysis propagation
 * - Crash recovery support
 */

// ============================================================================
// Schema Versioning
// ============================================================================

export const CURRENT_SCHEMA_VERSION = 1;

// ============================================================================
// Core Enums
// ============================================================================

export type SessionStatus = "running" | "paused" | "failed" | "completed";

export type IterationStatus = "success" | "failed";

export type ErrorType = "validation" | "runtime" | "timeout" | "unknown";

export type ErrorStrategy = "retry" | "analyze-retry" | "skip" | "escalate";

// ============================================================================
// Session State (session.json)
// ============================================================================

export interface SessionState {
  /** Schema version for migration support */
  schemaVersion: number;

  /** Unique session identifier */
  sessionId: string;

  /** OpenSpec change ID */
  changeId: string;

  /** Current session status */
  status: SessionStatus;

  /** Current task being worked on */
  currentTask: {
    id: string;
    description: string;
    attemptCount: number;
  } | null;

  /** Current iteration number (1-based) */
  iteration: number;

  /** Maximum iterations allowed */
  maxIterations: number;

  /** Git commit SHA before last successful iteration */
  lastSuccessfulCommit?: string;

  /** Concurrency lock information */
  lockedBy?: {
    pid: number;
    timestamp: string;
  };

  /** Error handling configuration */
  errorHandling: {
    strategy: ErrorStrategy;
    maxRetries: number;
    currentRetryCount: number;
  };

  /** Accumulated context across iterations */
  context: {
    /** Reusable patterns discovered during development */
    codebasePatterns: string[];

    /** Rolling window of recent failures (max 3) for context propagation */
    recentFailures: Array<{
      iteration: number;
      taskId: string;
      rootCause: string;
      fixPlan: string;
    }>;
  };
}

// ============================================================================
// Iteration Log (iterations/{N}.json)
// ============================================================================

export interface IterationLog {
  /** Schema version for migration support */
  schemaVersion: number;

  /** Global iteration number (monotonically increasing) */
  iteration: number;

  /** Task ID being worked on */
  taskId: string;

  /** Attempt number for this specific task (1-based) */
  taskAttempt: number;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** Amp thread ID if available */
  threadId?: string;

  /** Success or failure */
  status: IterationStatus;

  /** Optional: prompt token count for monitoring */
  promptTokens?: number;

  // --- Success Fields ---

  /** List of implemented changes */
  implemented?: string[];

  /** Patterns discovered in this iteration */
  codebasePatterns?: string[];

  /** Human-readable summary */
  summary?: string;

  // --- Failure Fields ---

  /** Detailed failure analysis (KEY for context propagation) */
  failureAnalysis?: {
    /** Technical root cause */
    rootCause: string;

    /** Specific fix strategy for next attempt */
    fixPlan: string;

    /** Original error message */
    errorMessage: string;

    /** Categorized error type */
    errorType: ErrorType;
  };

  // --- Git Tracking ---

  /** Git SHA before iteration started */
  commitBefore?: string;

  /** Git SHA after iteration completed (if committed) */
  commitAfter?: string;

  // --- Timing ---

  /** Duration in milliseconds */
  durationMs: number;
}

// ============================================================================
// Failure Analysis (extracted from agent response)
// ============================================================================

export interface FailureAnalysis {
  rootCause: string;
  fixPlan: string;
  errorMessage: string;
  errorType: ErrorType;
}

// ============================================================================
// Lock File (.ralph/.lock)
// ============================================================================

export interface LockFile {
  /** Process ID holding the lock */
  pid: number;

  /** ISO 8601 timestamp when lock was acquired */
  timestamp: string;

  /** Session ID for correlation */
  sessionId: string;
}

// ============================================================================
// Agent Plugin Interface
// ============================================================================

export interface AgentPlugin {
  readonly name: string;

  /** Check if agent is installed and available */
  isAvailable(): Promise<boolean>;

  /** Execute task with given prompt */
  execute(options: {
    prompt: string;
    cwd: string;
    timeoutMs?: number;
  }): Promise<AgentResult>;

  /** Parse agent output to extract structured log */
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
  /** Resume from existing session */
  resume: boolean;

  /** Force start fresh even if session exists */
  force: boolean;
}
