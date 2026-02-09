/**
 * Ralph Prompt Template Engine
 *
 * Template-based prompt generation with:
 * - Failure context injection
 * - Rolling window of recent failures
 * - Codebase patterns accumulation
 * - Progress summary
 * 
 * NOTE: Uses simple template strings (Handlebars optional for future enhancement)
 */

import type { SessionState, IterationLog, FailureAnalysis } from './types.js';

export interface PromptEngineOptions {
  projectName: string;
  projectPath: string;
  checkCommand?: string;
}

export interface TemplateVariables {
  // Task context
  taskId: string;
  taskDescription: string;
  attemptCount: number;
  iteration: number;
  maxIterations: number;

  // Project context
  projectName: string;
  projectPath: string;
  checkCommand: string;

  // Spec context
  specContext: string;

  // Failure context (KEY for context propagation)
  recentFailures: Array<{
    iteration: number;
    taskId: string;
    rootCause: string;
    fixPlan: string;
    errorMessage?: string;
    errorType?: string;
  }>;
  hasRecentFailures: boolean;

  // Accumulated learning
  codebasePatterns: string[];
  hasCodebasePatterns: boolean;

  // Progress
  recentProgress: string;
  hasRecentProgress: boolean;
}

export class PromptTemplateEngine {
  private options: PromptEngineOptions;

  constructor(options: PromptEngineOptions) {
    this.options = {
      checkCommand: 'bun run check',
      ...options,
    };
  }

  /**
   * Build template variables from session state and logs
   */
  buildVariables(
    session: SessionState,
    specContext: string,
    recentLogs: IterationLog[]
  ): TemplateVariables {
    const task = session.currentTask;
    if (!task) {
      throw new Error('No current task in session');
    }

    // Extract recent failures from session context (rolling window)
    const recentFailures = session.context.recentFailures.slice(-3);

    // Format recent progress
    const recentProgress = this.formatRecentProgress(recentLogs);

    return {
      taskId: task.id,
      taskDescription: task.description,
      attemptCount: task.attemptCount,
      iteration: session.iteration,
      maxIterations: session.maxIterations,
      projectName: this.options.projectName,
      projectPath: this.options.projectPath,
      checkCommand: this.options.checkCommand!,
      specContext,
      recentFailures,
      hasRecentFailures: recentFailures.length > 0,
      codebasePatterns: session.context.codebasePatterns,
      hasCodebasePatterns: session.context.codebasePatterns.length > 0,
      recentProgress,
      hasRecentProgress: recentProgress.length > 0,
    };
  }

  /**
   * Generate the main execution prompt
   */
  generateMainPrompt(v: TemplateVariables): string {
    const parts: string[] = [];

    // Header
    parts.push('# Ralph Autonomous Agent Mode');
    parts.push('');
    parts.push('You are an autonomous implementation agent working on the OpenSpec change.');
    parts.push('');

    // Current Task
    parts.push('## CURRENT TASK');
    parts.push(`- **ID**: ${v.taskId}`);
    parts.push(`- **Description**: ${v.taskDescription}`);
    parts.push(`- **Iteration**: ${v.iteration} / ${v.maxIterations}`);
    parts.push(`- **Attempt**: ${v.attemptCount}`);
    parts.push('');

    // Project Context
    parts.push('## PROJECT CONTEXT');
    parts.push(`- **Project**: ${v.projectName} (${v.projectPath})`);
    parts.push(`- **Quality Check**: \`${v.checkCommand}\``);
    parts.push('');

    // Failure Context (KEY SECTION)
    if (v.hasRecentFailures) {
      parts.push('## ⚠️ PREVIOUS FAILURE ANALYSIS (CRITICAL - READ THIS FIRST)');
      parts.push('');
      v.recentFailures.forEach((failure, idx) => {
        parts.push(`### Previous Attempt ${idx + 1}`);
        parts.push(`- **Root Cause**: ${failure.rootCause}`);
        parts.push(`- **Fix Plan**: ${failure.fixPlan}`);
        parts.push(`- **Error**: ${failure.errorMessage}`);
        parts.push('');
      });
      parts.push('**You MUST address the root cause above to succeed.**');
      parts.push('');
    }

    // Codebase Patterns
    if (v.hasCodebasePatterns) {
      parts.push('## ACCUMULATED CODEBASE PATTERNS');
      parts.push('');
      parts.push('These patterns discovered in previous iterations should guide your implementation:');
      parts.push('');
      v.codebasePatterns.forEach(pattern => {
        parts.push(`- ${pattern}`);
      });
      parts.push('');
    }

    // Spec Context
    parts.push('## AUTHORITATIVE SPEC');
    parts.push(v.specContext);
    parts.push('');

    // Recent Progress
    if (v.hasRecentProgress) {
      parts.push('## RECENT PROGRESS');
      parts.push(v.recentProgress);
      parts.push('');
    }

    // Execution Workflow
    parts.push('## EXECUTION WORKFLOW');
    parts.push('');
    parts.push('1. **Explore & Plan**: Read the current codebase. Identify existing patterns.');
    parts.push('2. **Implement**: Make the requested changes following existing conventions.');
    parts.push('3. **Quality Assurance**:');
    parts.push(`   - Run \`${v.checkCommand}\` for lint/type checking`);
    parts.push('   - Run `openspec validate` to verify spec compliance');
    parts.push('4. **Knowledge Management**:');
    parts.push('   - Update tasks.md to mark the task complete');
    parts.push('   - Update AGENTS.md with discovered patterns');
    parts.push('');

    // Response Format
    parts.push('## RESPONSE FORMAT');
    parts.push('');
    parts.push('When done, provide your response in this exact JSON format:');
    parts.push('');
    parts.push('<RALPH_ITERATION_LOG_JSON>');
    parts.push('{');
    parts.push('  "threadId": "T-xxxx...",');
    parts.push(`  "task": "${v.taskId}",`);
    parts.push('  "implemented": ["Specific action 1", "Specific action 2"],');
    parts.push('  "codebasePatterns": ["Pattern discovered in this iteration"],');
    parts.push('  "gotchas": ["Any issues encountered and how they were resolved"],');
    parts.push('  "summary": "Clear synthesis of what was done and key insights",');
    parts.push('  "complete": true');
    parts.push('}');
    parts.push('</RALPH_ITERATION_LOG_JSON>');
    parts.push('');
    parts.push('If validation fails, set "complete": false and include failure details.');

    return parts.join('\n');
  }

  /**
   * Generate the failure analysis prompt
   */
  generateAnalysisPrompt(
    session: SessionState,
    errorMessage: string,
    lastFailure?: FailureAnalysis
  ): string {
    const task = session.currentTask;
    if (!task) {
      throw new Error('No current task in session');
    }

    const parts: string[] = [];

    parts.push('# Ralph Failure Analysis Mode');
    parts.push('');
    parts.push('## FAILURE CONTEXT');
    parts.push(`- **Task**: ${task.id}`);
    parts.push(`- **Attempt**: ${task.attemptCount}`);
    parts.push(`- **Iteration**: ${session.iteration}`);
    parts.push('');

    if (lastFailure) {
      parts.push('## PREVIOUS ATTEMPT FAILURE');
      parts.push(`- **Root Cause**: ${lastFailure.rootCause}`);
      parts.push(`- **Fix Plan**: ${lastFailure.fixPlan}`);
      parts.push('');
    }

    parts.push('## CURRENT ERROR');
    parts.push(errorMessage);
    parts.push('');

    parts.push('## YOUR MISSION');
    parts.push('');
    parts.push('Analyze this failure and provide:');
    parts.push('');
    parts.push('1. **Root Cause**: What technically caused this failure? Be specific.');
    parts.push('2. **Fix Plan**: What exactly needs to change in the next attempt?');
    parts.push('3. **Key Insight**: What pattern or lesson should be remembered?');
    parts.push('');

    parts.push('## RESPONSE FORMAT');
    parts.push('');
    parts.push('<RALPH_ITERATION_LOG_JSON>');
    parts.push('{');
    parts.push('  "threadId": "T-xxxx...",');
    parts.push(`  "task": "${task.id}",`);
    parts.push('  "implemented": [],');
    parts.push('  "codebasePatterns": [],');
    parts.push('  "gotchas": ["Root cause and fix strategy"],');
    parts.push('  "summary": "Synthesized analysis of the failure",');
    parts.push('  "complete": false,');
    parts.push('  "failureAnalysis": {');
    parts.push('    "rootCause": "Technical root cause of the failure",');
    parts.push('    "fixPlan": "Specific steps to fix in next attempt",');
    parts.push(`    "errorMessage": "${errorMessage.replace(/"/g, '\\"')}",`);
    parts.push('    "errorType": "validation"');
    parts.push('  }');
    parts.push('}');
    parts.push('</RALPH_ITERATION_LOG_JSON>');

    return parts.join('\n');
  }

  /**
   * Format recent iteration logs for progress context
   */
  private formatRecentProgress(logs: IterationLog[]): string {
    if (logs.length === 0) return '';

    const lines: string[] = [];
    const recent = logs.slice(-3);

    for (const log of recent) {
      const icon = log.status === 'success' ? '✓' : '✗';
      lines.push(`${icon} Iteration ${log.iteration}: ${log.summary || 'No summary'}`);

      if (log.status === 'failed' && log.failureAnalysis) {
        lines.push(`  → Failed: ${log.failureAnalysis.rootCause}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Calculate estimated token count (rough approximation)
   */
  estimateTokens(prompt: string): number {
    // Rough estimate: ~4 chars per token for English text
    return Math.ceil(prompt.length / 4);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createPromptEngine(options: PromptEngineOptions): PromptTemplateEngine {
  return new PromptTemplateEngine(options);
}
