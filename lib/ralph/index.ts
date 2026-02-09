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
  // Enums
  CURRENT_SCHEMA_VERSION,
  type SessionStatus,
  type IterationStatus,
  type ErrorType,
  type ErrorStrategy,
  
  // Core interfaces
  type SessionState,
  type IterationLog,
  type FailureAnalysis,
  type LockFile,
  
  // Utility types
  type LockStatus,
  type ResumeOptions,
  type AgentPlugin,
  type AgentResult,
} from './types.js';



// ============================================================================
// Session Management
// ============================================================================

export {
  SessionManager,
  createSessionManager,
  type SessionManagerOptions,
} from './session.js';

// ============================================================================
// Iteration Persistence
// ============================================================================

export {
  IterationPersistence,
  createIterationPersistence,
  type IterationPersistenceOptions,
} from './iteration.js';

// ============================================================================
// Prompt Templates
// ============================================================================

export {
  PromptTemplateEngine,
  createPromptEngine,
  type PromptEngineOptions,
  type TemplateVariables,
} from './prompt.js';

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
export function isRetryableError(errorType: import('./types.js').ErrorType): boolean {
  return errorType !== 'timeout'; // Timeouts might succeed on retry
}

/**
 * Default error strategy configuration
 */
export const DEFAULT_ERROR_HANDLING = {
  strategy: 'analyze-retry' as const,
  maxRetries: 3,
};
