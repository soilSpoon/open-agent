import { describe, expect, it } from "bun:test";
import { queryKeys } from "@/lib/query/keys";

describe("Pipeline Query Keys", () => {
  it("should generate correct change query keys", () => {
    expect(queryKeys.changes.byId("change-123")).toEqual([
      "changes",
      "change-123",
    ]);
    expect(queryKeys.changes.status("change-123")).toEqual([
      "changes",
      "change-123",
      "status",
    ]);
    expect(queryKeys.changes.validation("change-123")).toEqual([
      "changes",
      "change-123",
      "validation",
    ]);
    expect(queryKeys.changes.specs("change-123")).toEqual([
      "changes",
      "change-123",
      "specs",
    ]);
  });
});
