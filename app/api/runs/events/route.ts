import { NextRequest } from "next/server";
import { workerEvents } from "@/lib/ralph/worker-events";
import { RalphEvent } from "@/lib/ralph/events";

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
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch (err) {
          console.error("[SSE] Error enqueuing event:", err);
        }
      };

      workerEvents.on("event", handler);

      // Keep-alive heartbeat every 15 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch (err) {
          clearInterval(heartbeat);
        }
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
      "Connection": "keep-alive",
    },
  });
}
