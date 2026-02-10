"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { RalphEvent } from "@/lib/ralph/events";

/**
 * Hook to subscribe to real-time RalphWorker events via SSE.
 * Automatically updates TanStack Query cache for runs and logs.
 */
export function useRalphEvents(runId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const url = new URL("/api/runs/events", window.location.origin);
    if (runId) url.searchParams.set("runId", runId);

    const eventSource = new EventSource(url.toString());

    eventSource.onmessage = (event) => {
      if (event.data === ": heartbeat") return;

      try {
        const data: RalphEvent = JSON.parse(event.data);
        console.log("[useRalphEvents] Received event:", data);

        // Update TanStack Query cache based on event type
        if (data.type === "run:status") {
          queryClient.invalidateQueries({ queryKey: ["run", data.runId] });
        } else if (data.type === "log") {
          // Optimistically append log if we have a list of logs
          queryClient.setQueryData(
            ["logs", data.runId],
            (old: RalphEvent[] | undefined) => {
              if (!old) return [data];
              return [...old, data];
            },
          );
        } else if (data.type.startsWith("task:")) {
          queryClient.invalidateQueries({ queryKey: ["tasks", data.runId] });
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = (err) => {
      console.error("[useRalphEvents] SSE Error:", err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [runId, queryClient]);
}
