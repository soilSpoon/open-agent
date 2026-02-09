"use client";

import { useQuery } from "@tanstack/react-query";
import { getRun } from "@/app/actions";
import { type Run, RunSchema } from "@/features/runs/types";
import { queryKeys } from "@/lib/query/keys";

interface UseRunOptions {
  runId: string;
  enabled?: boolean;
}

export function useRun({ runId, enabled = true }: UseRunOptions) {
  return useQuery<Run | null>({
    queryKey: queryKeys.runs.byId(runId),
    queryFn: async () => {
      const data = await getRun(runId);
      if (!data) return null;

      return RunSchema.parse({
        ...data,
        status: data.status,
      });
    },
    enabled,
    refetchInterval: (query) => {
      // Polling is completely removed as real-time updates are handled via useRalphEvents (SSE).
      return false;
    },
    staleTime: 0,
  });
}
