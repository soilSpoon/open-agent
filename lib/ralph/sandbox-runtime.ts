import type { UniversalEvent } from "sandbox-agent";
import { SandboxAgent } from "sandbox-agent";

export interface SandboxRuntime {
  start(): Promise<void>;
  dispose(): Promise<void>;
  runAgentExecute(
    prompt: string,
    onEvent?: (e: UniversalEvent) => void,
  ): Promise<{ transcript: string }>;
  sessionId: string;
}

export class SandboxSdkRuntime implements SandboxRuntime {
  private client: SandboxAgent | undefined;
  public sessionId: string;

  constructor(
    private readonly opts: {
      projectPath: string;
      persistedSessionId?: string;
      onLog?: (
        level: "info" | "warn" | "error",
        message: string,
      ) => Promise<void>;
    },
  ) {
    this.sessionId =
      opts.persistedSessionId ||
      `ralph-${Math.random().toString(36).substring(2, 9)}`;
  }

  async start() {
    // Local development: SandboxAgent.start() spawns the server
    this.client = await SandboxAgent.start();

    // Create or attach to session
    await this.client.createSession(this.sessionId, {
      agent: "amp",
      agentMode: "build",
      permissionMode: "default",
    });

    // Mount the project path into the sandbox workspace if possible
    // Note: In local mode, sandbox-agent operates on the same filesystem usually,
    // but we can explicitly set the workspace directory if needed.
    await this.opts.onLog?.(
      "info",
      `Sandbox session started: ${this.sessionId}`,
    );
  }

  async runAgentExecute(prompt: string, onEvent?: (e: UniversalEvent) => void) {
    if (!this.client) throw new Error("Runtime not started");

    const transcriptParts: string[] = [];

    // Post the message (this starts the agent)
    await this.client.postMessage(this.sessionId, { message: prompt });

    // Stream events
    for await (const event of this.client.streamEvents(this.sessionId)) {
      if (onEvent) onEvent(event);

      // Handle content deltas (like stdout/message parts)
      if (event.type === "item.delta" && "delta" in event.data) {
        const text = event.data.delta || "";
        if (text) {
          transcriptParts.push(text);
          if (this.opts.onLog) {
            await this.opts.onLog("info", `[sandbox] ${text}`);
          }
        }
      }

      // Handle turn completion
      if (event.type === "turn.ended") {
        break;
      }

      // Handle session end or errors
      if (event.type === "error" || event.type === "session.ended") {
        break;
      }
    }

    return { transcript: transcriptParts.join("") };
  }

  async dispose() {
    // Session is usually left alive for reuse, but we can close it if needed
    // await this.client?.closeSession(this.sessionId);
  }
}
