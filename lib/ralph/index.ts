/**
 * Ralph - OpenSpec Integration Module
 *
 * A robust, file-based session and iteration persistence system for AI agent loops.
 *
 * Key Features:
 * - Immutable iteration logs (append-only JSONL)
 * - Atomic file operations (crash-safe)
 * - Failure context propagation across retries
 * - Concurrency control via lock files
 * - Dual-gate verification with evidence
 * - Flexible output parsing (JSON → regex → raw)
 *
 * Architecture:
 * - types.ts     : Core type definitions and schemas
 * - session.ts   : Session state management and locking
 * - iteration.ts : Iteration log persistence (JSONL format)
 * - extraction.ts: Flexible output parsing
 * - prompt.ts    : Prompt template generation
 * - engine.ts    : Main execution engine
 */

// ============================================================================
// Types
// ============================================================================

export {
  type AgentPlugin,
  type AgentResult,
  // Enums
  CURRENT_SCHEMA_VERSION,
  type ErrorStrategy,
  type ErrorType,
  type FailureAnalysis,
  type IterationLog,
  type IterationStatus,
  type LockFile,
  // Utility types
  type LockStatus,
  type ResumeOptions,
  // Core interfaces
  type SessionState,
  type SessionStatus,
} from "./types";

// ============================================================================
// Session Management
// ============================================================================

export {
  createSessionManager,
  SessionManager,
  type SessionManagerOptions,
} from "./session";

// ============================================================================
// Iteration Persistence
// ============================================================================

export {
  createIterationPersistence,
  IterationPersistence,
  type IterationPersistenceOptions,
} from "./iteration";

// ============================================================================
// Prompt Templates
// ============================================================================

export {
  createPromptEngine,
  type PromptEngineOptions,
  PromptTemplateEngine,
  type TemplateVariables,
} from "./prompt";

// ============================================================================
// Output Extraction
// ============================================================================

export {
  type ExtractedFailureAnalysis,
  type ExtractedIterationData,
  extractFailureAnalysis,
  extractFromOutput,
  SUMMARY_PATTERNS,
} from "./extraction";

// ============================================================================
// Engine
// ============================================================================

export {
  type ApplyInstructions,
  createRalphEngine,
  type RalphCallbacks,
  RalphEngine,
  type RalphEngineOptions,
} from "./engine";

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format a thread URL from thread ID
 */
export function formatThreadUrl(threadId: string): string {
  return `https://ampcode.com/threads/${threadId}`;
}

/**
 * Check if a failure is retryable
 */
export function isRetryableError(
  errorType: import("./types.js").ErrorType,
): boolean {
  return errorType !== "timeout"; // Timeouts might succeed on retry
}

/**
 * Default error strategy configuration
 */
export const DEFAULT_ERROR_HANDLING = {
  strategy: "analyze-retry" as const,
  maxRetries: 3,
};
