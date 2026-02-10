import { describe, expect, it, mock } from "bun:test";
import { ralphWorker } from "../worker";
import type { RalphEvent } from "./events";
import { workerEvents } from "./worker-events";

mock.module("../db", () => ({
  default: {
    insert: () => ({
      values: () => Promise.resolve(),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    query: {
      runs: {
        findMany: () => Promise.resolve([]),
      },
      tasks: {
        findFirst: () => Promise.resolve(null),
      },
    },
  },
}));

describe("RalphWorker Events (TDD)", () => {
  it("should emit run:new event when notifyNewRun is called", () => {
    const events: RalphEvent[] = [];
    const handler = (e: RalphEvent) => events.push(e);
    workerEvents.on("event", handler);

    ralphWorker.notifyNewRun("test-run-id");

    expect(events).toContainEqual({
      type: "run:new",
      runId: "test-run-id",
    });

    workerEvents.off("event", handler);
  });

  it("should emit log events when log is called via public interface", () => {
    const events: RalphEvent[] = [];
    const handler = (e: RalphEvent) => events.push(e);
    workerEvents.on("event", handler);

    workerEvents.emit("event", {
      type: "log",
      runId: "test-run",
      level: "info",
      message: "test message",
    });

    expect(events).toContainEqual({
      type: "log",
      runId: "test-run",
      level: "info",
      message: "test message",
    });

    workerEvents.off("event", handler);
  });

  it("should type-check RalphEvent discriminated union", () => {
    const logEvent: RalphEvent = {
      type: "log",
      runId: "run-1",
      level: "warn",
      message: "warning message",
    };
    expect(logEvent.type).toBe("log");

    const runNewEvent: RalphEvent = {
      type: "run:new",
      runId: "run-2",
    };
    expect(runNewEvent.type).toBe("run:new");

    const taskStartEvent: RalphEvent = {
      type: "task:start",
      runId: "run-3",
      taskId: "task-1",
      title: "Test task",
    };
    expect(taskStartEvent.type).toBe("task:start");

    const taskCompleteEvent: RalphEvent = {
      type: "task:complete",
      runId: "run-4",
      taskId: "task-2",
      success: true,
    };
    expect(taskCompleteEvent.type).toBe("task:complete");
  });
});
