import type { NextRequest } from "next/server";
import type { RalphEvent } from "@/lib/ralph/events";
import { workerEvents } from "@/lib/ralph/worker-events";

/**
 * SSE endpoint to stream RalphWorker events to the client.
 */
export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get("runId");

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const handler = (event: RalphEvent) => {
        // If runId is provided, filter events for that specific run
        if (runId && event.runId !== runId) return;

        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch (err) {
          console.error("[SSE] Error enqueuing event:", err);
        }
      };

      workerEvents.on("event", handler);

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 15000);

      req.signal.onabort = () => {
        console.log(`[SSE] Client disconnected (runId: ${runId})`);
        workerEvents.off("event", handler);
        clearInterval(heartbeat);
        controller.close();
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
