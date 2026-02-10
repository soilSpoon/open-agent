import { EventEmitter } from "node:events";
import type { RalphEvent } from "./events";

interface TypedEventMap {
  event: (event: RalphEvent) => void;
}

class WorkerEventEmitter {
  private emitter = new EventEmitter();

  on<K extends keyof TypedEventMap>(
    event: K,
    listener: TypedEventMap[K],
  ): this {
    this.emitter.on(event, listener);
    return this;
  }

  off<K extends keyof TypedEventMap>(
    event: K,
    listener: TypedEventMap[K],
  ): this {
    this.emitter.off(event, listener);
    return this;
  }

  emit<K extends keyof TypedEventMap>(
    event: K,
    ...args: Parameters<TypedEventMap[K]>
  ): boolean {
    return this.emitter.emit(event, ...args);
  }
}

export const workerEvents = new WorkerEventEmitter();
