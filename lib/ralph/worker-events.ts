import { EventEmitter } from "events";
import { TypedEventEmitter } from "./typed-emitter";
import { RalphEvent } from "./events";

// TypedEventEmitter는 EventEmitter를 상속받아 RalphEvent를 타입 안정성 있게 처리합니다.
export const workerEvents = new EventEmitter() as TypedEventEmitter<{
  "event": (event: RalphEvent) => void;
}>;

export interface TypedEventEmitter<T extends Record<string, any>> {
  on<K extends keyof T>(event: K, listener: T[K]): this;
  off<K extends keyof T>(event: K, listener: T[K]): this;
  emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): boolean;
}
