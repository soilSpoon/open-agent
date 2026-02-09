/**
 * Ralph Iteration Persistence
 * 
 * Manages immutable iteration logs:
 * - Append-only JSON files
 * - Atomic writes
 * - Progress.md generation (derived)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { IterationLog, FailureAnalysis, IterationStatus } from './types.js';
import { CURRENT_SCHEMA_VERSION } from './types.js';

export interface IterationPersistenceOptions {
  iterationsDir: string;
  ralphDir: string;
}

export class IterationPersistence {
  private iterationsDir: string;
  private progressPath: string;

  constructor(options: IterationPersistenceOptions) {
    this.iterationsDir = options.iterationsDir;
    this.progressPath = path.join(options.ralphDir, 'progress.md');
  }

  // ========================================================================
  // Iteration Log CRUD (Immutable)
  // ========================================================================

  /**
   * Save a new iteration log (append-only, never modify)
   */
  async saveIteration(log: IterationLog): Promise<void> {
    const filename = this.getIterationFilename(log.iteration);
    const filepath = path.join(this.iterationsDir, filename);

    // Ensure schema version is set
    const logWithVersion = {
      ...log,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };

    // Atomic write
    const tempPath = `${filepath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(logWithVersion, null, 2), 'utf-8');
    await fs.rename(tempPath, filepath);
  }

  /**
   * Read a specific iteration log
   */
  async readIteration(iteration: number): Promise<IterationLog | null> {
    const filename = this.getIterationFilename(iteration);
    const filepath = path.join(this.iterationsDir, filename);

    try {
      const content = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(content) as IterationLog;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * List all iteration numbers (sorted)
   */
  async listIterations(): Promise<number[]> {
    try {
      const files = await fs.readdir(this.iterationsDir);
      const iterations = files
        .filter(f => f.endsWith('.json'))
        .map(f => parseInt(f.replace('.json', ''), 10))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);
      return iterations;
    } catch {
      return [];
    }
  }

  /**
   * Read the most recent N iterations
   */
  async readRecentIterations(count: number): Promise<IterationLog[]> {
    const allIterations = await this.listIterations();
    const recent = allIterations.slice(-count);
    
    const logs: IterationLog[] = [];
    for (const iter of recent) {
      const log = await this.readIteration(iter);
      if (log) logs.push(log);
    }
    return logs;
  }

  /**
   * Read all iterations for a specific task
   */
  async readTaskIterations(taskId: string): Promise<IterationLog[]> {
    const allIterations = await this.listIterations();
    const logs: IterationLog[] = [];
    
    for (const iter of allIterations) {
      const log = await this.readIteration(iter);
      if (log && log.taskId === taskId) {
        logs.push(log);
      }
    }
    return logs;
  }

  // ========================================================================
  // Failure Analysis Helpers
  // ========================================================================

  /**
   * Extract failure analysis from the most recent failed iteration
   */
  async getLastFailure(): Promise<(IterationLog & { failureAnalysis: NonNullable<IterationLog['failureAnalysis']> }) | null> {
    const allIterations = await this.listIterations();
    
    // Search backwards for failed iteration with analysis
    for (let i = allIterations.length - 1; i >= 0; i--) {
      const log = await this.readIteration(allIterations[i]);
      if (log && log.status === 'failed' && log.failureAnalysis) {
        return log as IterationLog & { failureAnalysis: NonNullable<IterationLog['failureAnalysis']> };
      }
    }
    return null;
  }

  /**
   * Get failure analysis for a specific task's recent attempts
   */
  async getTaskFailureHistory(taskId: string, maxAttempts: number = 3): Promise<FailureAnalysis[]> {
    const taskLogs = await this.readTaskIterations(taskId);
    const failures = taskLogs
      .filter(log => log.status === 'failed' && log.failureAnalysis)
      .slice(-maxAttempts)
      .map(log => log.failureAnalysis!);
    return failures;
  }

  // ========================================================================
  // Progress.md Generation (Derived)
  // ========================================================================

  /**
   * Regenerate progress.md from iteration logs
   */
  async generateProgress(): Promise<string> {
    const iterations = await this.listIterations();
    const logs: IterationLog[] = [];
    
    for (const iter of iterations) {
      const log = await this.readIteration(iter);
      if (log) logs.push(log);
    }

    const content = this.formatProgressMarkdown(logs);
    await fs.writeFile(this.progressPath, content, 'utf-8');
    return content;
  }

  private formatProgressMarkdown(logs: IterationLog[]): string {
    const lines: string[] = [
      '# Ralph Progress Log',
      '',
      'Auto-generated from iteration logs. **DO NOT EDIT DIRECTLY** - will be overwritten.',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Total iterations: ${logs.length}`,
      '',
      '## Summary',
      '',
    ];

    // Calculate stats
    const successes = logs.filter(l => l.status === 'success').length;
    const failures = logs.filter(l => l.status === 'failed').length;
    lines.push(`- ✓ Successes: ${successes}`);
    lines.push(`- ✗ Failures: ${failures}`);
    lines.push('');

    // Accumulated patterns
    const allPatterns = new Set<string>();
    logs.forEach(l => l.codebasePatterns?.forEach(p => allPatterns.add(p)));
    if (allPatterns.size > 0) {
      lines.push('## Codebase Patterns (Study These First)');
      lines.push('');
      allPatterns.forEach(p => lines.push(`- ${p}`));
      lines.push('');
    }

    // Recent iterations (last 5)
    lines.push('## Recent Iterations');
    lines.push('');
    
    const recent = logs.slice(-5).reverse();
    for (const log of recent) {
      const icon = log.status === 'success' ? '✓' : '✗';
      lines.push(`### ${icon} Iteration ${log.iteration} - Task ${log.taskId} (Attempt ${log.taskAttempt})`);
      lines.push('');
      lines.push(`- **Status**: ${log.status}`);
      lines.push(`- **Timestamp**: ${log.timestamp}`);
      lines.push(`- **Duration**: ${(log.durationMs / 1000).toFixed(1)}s`);
      if (log.threadId) {
        lines.push(`- **Thread**: https://ampcode.com/threads/${log.threadId}`);
      }
      lines.push('');

      if (log.status === 'success' && log.summary) {
        lines.push('**Summary**: ' + log.summary);
        lines.push('');
        if (log.implemented && log.implemented.length > 0) {
          lines.push('**Implemented**:');
          log.implemented.forEach(item => lines.push(`- ${item}`));
          lines.push('');
        }
      }

      if (log.status === 'failed' && log.failureAnalysis) {
        lines.push('**Failure Analysis**:');
        lines.push(`- **Root Cause**: ${log.failureAnalysis.rootCause}`);
        lines.push(`- **Fix Plan**: ${log.failureAnalysis.fixPlan}`);
        lines.push(`- **Error Type**: ${log.failureAnalysis.errorType}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private getIterationFilename(iteration: number): string {
    // Zero-padded for sorting: 0001.json, 0002.json, etc.
    return iteration.toString().padStart(4, '0') + '.json';
  }

  /**
   * Get the next iteration number
   */
  async getNextIterationNumber(): Promise<number> {
    const iterations = await this.listIterations();
    if (iterations.length === 0) return 1;
    return Math.max(...iterations) + 1;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createIterationPersistence(
  options: IterationPersistenceOptions
): IterationPersistence {
  return new IterationPersistence(options);
}
