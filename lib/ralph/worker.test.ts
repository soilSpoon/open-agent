import { describe, expect, it, mock, spyOn, beforeAll, afterAll } from "bun:test";
import { ralphWorker } from "../worker";
import { workerEvents } from "./worker-events";
import { RalphEvent } from "./events";
import db from "../db";

// DB를 모킹하여 실제 파일 시스템 접근 방지
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
      runId: "test-run-id"
    });

    workerEvents.off("event", handler);
  });

  it("should emit log events via the internal log method", async () => {
    const events: RalphEvent[] = [];
    const handler = (e: RalphEvent) => events.push(e);
    workerEvents.on("event", handler);

    // 내부 메서드 테스트를 위해 리플렉션 대신 인터페이스 확장이나 캐스팅 활용 (TDD 목적)
    await (ralphWorker as unknown as { log: (id: string, l: string, m: string) => Promise<void> })
      .log("test-run", "info", "test message");
    
    expect(events).toContainEqual({
      type: "log",
      runId: "test-run",
      level: "info",
      message: "test message"
    });

    workerEvents.off("event", handler);
  });
});
