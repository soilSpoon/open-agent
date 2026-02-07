"use client";

import { useQuery } from "@tanstack/react-query";
import { getRun } from "@/app/actions";
import { queryKeys } from "@/lib/query/keys";

interface UseRunOptions {
  runId: string;
  enabled?: boolean;
}

const POLLING_INTERVAL = 2000; // 2 seconds for real-time updates

export function useRun({ runId, enabled = true }: UseRunOptions) {
  return useQuery({
    queryKey: queryKeys.runs.byId(runId),
    queryFn: async () => {
      const data = await getRun(runId);
      if (!data) return null;
      return {
        id: data.id,
        status: data.status,
        logs: data.logs.map((l) => ({
          ...l,
          id: String(l.id),
          timestamp: l.timestamp,
          level: l.level,
          message: l.message,
        })),
        tasks: data.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
        })),
      };
    },
    enabled,
    refetchInterval: (query) => {
      // Poll every 2 seconds while running
      const data = query.state.data;
      return data?.status === "running" ? POLLING_INTERVAL : false;
    },
    staleTime: 0, // Always fresh for run data
  });
}
