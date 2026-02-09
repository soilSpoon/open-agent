/**
 * Output Extraction Tests
 */

import { describe, expect, it } from "bun:test";
import {
  extractFailureAnalysis,
  extractFromOutput,
  SUMMARY_PATTERNS,
} from "./extraction";

describe("extractFromOutput", () => {
  const sessionId = "sess-test";
  const iteration = 1;
  const taskId = "task-1";

  it("should extract JSON from RALPH_ITERATION_LOG_JSON tags", () => {
    const output = `
Some agent output here
<RALPH_ITERATION_LOG_JSON>
{
  "task": "task-1",
  "complete": true,
  "implemented": ["Feature A"],
  "summary": "Done"
}
</RALPH_ITERATION_LOG_JSON>
More output
    `;

    const result = extractFromOutput(output, sessionId, iteration, taskId);

    expect(result.extractionMethod).toBe("json");
    expect(result.structured.taskId).toBe("task-1");
    expect(result.structured.agentClaimedComplete).toBe(true);
    expect(result.structured.status).toBe("success");
  });

  it("should extract JSON from markdown code blocks", () => {
    const output = `
Here's my result:
\`\`\`json
{
  "taskId": "task-1",
  "complete": false,
  "summary": "Failed"
}
\`\`\`
    `;

    const result = extractFromOutput(output, sessionId, iteration, taskId);

    expect(result.extractionMethod).toBe("json");
    expect(result.structured.agentClaimedComplete).toBe(false);
  });

  it("should fall back to regex extraction for whatWasDone", () => {
    const output = `
What was done:
- Implemented feature A
- Added tests
- Updated docs

Summary: Completed successfully
    `;

    const result = extractFromOutput(output, sessionId, iteration, taskId);

    expect(result.extractionMethod).toBe("regex");
    expect(result.structured.context?.whatWasDone).toEqual([
      "Implemented feature A",
      "Added tests",
      "Updated docs",
    ]);
  });

  it("should extract learnings from output", () => {
    const output = `
Learnings:
- Use zod for validation
- Prefer async/await

Complete: true
    `;

    const result = extractFromOutput(output, sessionId, iteration, taskId);

    expect(result.structured.context?.learnings).toContain(
      "Use zod for validation",
    );
  });

  it("should preserve raw output when parsing fails", () => {
    const output = "This is just plain text without any structured data";

    const result = extractFromOutput(output, sessionId, iteration, taskId);

    expect(result.extractionMethod).toBe("raw");
    expect(result.structured.status).toBe("in_progress");
    expect(result.raw).toBe(output);
  });

  it("should sanitize ANSI codes from raw output", () => {
    const output = "\u001b[31mRed text\u001b[0m normal text";

    const result = extractFromOutput(output, sessionId, iteration, taskId);

    expect(result.raw).not.toContain("\u001b");
    expect(result.raw).toContain("Red text");
  });

  it("should truncate very long raw output", () => {
    const output = "x".repeat(60000);

    const result = extractFromOutput(output, sessionId, iteration, taskId);

    expect(result.raw.length).toBeLessThan(60000);
    expect(result.raw).toContain("[truncated]");
  });
});

describe("extractFailureAnalysis", () => {
  it("should extract failure analysis from JSON", () => {
    const output = `
<RALPH_ITERATION_LOG_JSON>
{
  "failureAnalysis": {
    "rootCause": "Missing import",
    "fixPlan": "Add import statement",
    "errorMessage": "Module not found",
    "errorType": "validation"
  }
}
</RALPH_ITERATION_LOG_JSON>
    `;

    const result = extractFailureAnalysis(output, "Original error");

    expect(result.extractionMethod).toBe("json");
    expect(result.analysis.rootCause).toBe("Missing import");
    expect(result.analysis.fixPlan).toBe("Add import statement");
    expect(result.analysis.errorType).toBe("validation");
  });

  it("should extract from regex patterns", () => {
    const output = `
Root cause: Type mismatch in props

Fix plan:
- Add proper interface
- Update type annotations
    `;

    const result = extractFailureAnalysis(output, "Type error");

    expect(result.extractionMethod).toBe("regex");
    expect(result.analysis.rootCause).toBe("Type mismatch in props");
    expect(result.analysis.errorMessage).toBe("Type error");
  });

  it("should fallback to error message when no patterns match", () => {
    const result = extractFailureAnalysis("plain text", "Unknown error");

    expect(result.extractionMethod).toBe("fallback");
    expect(result.analysis.rootCause).toBe("Unknown error");
  });
});

describe("SUMMARY_PATTERNS", () => {
  it("should match whatWasDone patterns", () => {
    const text = "What was done:\n- Item 1\n- Item 2";
    const match = text.match(SUMMARY_PATTERNS.whatWasDone);

    expect(match?.[1]).toContain("Item 1");
    expect(match?.[1]).toContain("Item 2");
  });

  it("should match learnings patterns", () => {
    const text = "Learnings:\n- Learning 1\n- Learning 2";
    const match = text.match(SUMMARY_PATTERNS.learnings);

    expect(match?.[1]).toContain("Learning 1");
  });

  it("should match completion status", () => {
    expect("Complete: true".match(SUMMARY_PATTERNS.complete)?.[1]).toBe("true");
    expect("Done: yes".match(SUMMARY_PATTERNS.complete)?.[1]).toBe("yes");
    expect("Finished: false".match(SUMMARY_PATTERNS.complete)?.[1]).toBe(
      "false",
    );
  });

  it("should match root cause patterns", () => {
    const text = "Root cause: Missing dependency";
    const match = text.match(SUMMARY_PATTERNS.rootCause);

    expect(match?.[1]).toBe("Missing dependency");
  });
});
