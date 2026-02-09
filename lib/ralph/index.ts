/**
 * Ralph - OpenSpec Integration Module
 *
 * A robust, file-based session and iteration persistence system for AI agent loops.
 *
 * Key Features:
 * - Immutable iteration logs (append-only JSON)
 * - Atomic file operations (crash-safe)
 * - Failure context propagation across retries
 * - Concurrency control via lock files
 * - Derived progress.md generation
 *
 * Architecture:
 * - types.ts    : Core type definitions and schemas
 * - session.ts  : Session state management and locking
 * - iteration.ts: Iteration log persistence and progress generation
 * - prompt.ts   : Handlebars-based prompt templates
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
} from "./types.js";

// ============================================================================
// Session Management
// ============================================================================

export {
  createSessionManager,
  SessionManager,
  type SessionManagerOptions,
} from "./session.js";

// ============================================================================
// Iteration Persistence
// ============================================================================

export {
  createIterationPersistence,
  IterationPersistence,
  type IterationPersistenceOptions,
} from "./iteration.js";

// ============================================================================
// Prompt Templates
// ============================================================================

export {
  createPromptEngine,
  type PromptEngineOptions,
  PromptTemplateEngine,
  type TemplateVariables,
} from "./prompt.js";

// ============================================================================
// Engine (v2)
// ============================================================================

export {
  type ApplyInstructions,
  createRalphEngine,
  type RalphCallbacks,
  RalphEngine,
  type RalphEngineOptions,
} from "./engine.js";

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
