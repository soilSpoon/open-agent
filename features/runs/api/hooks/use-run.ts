"use client";

import { useQuery } from "@tanstack/react-query";
import { getRun } from "@/app/actions";
import { type Run, RunSchema } from "@/features/runs/types";
import { queryKeys } from "@/lib/query/keys";

interface UseRunOptions {
  runId: string;
  enabled?: boolean;
}

const POLLING_INTERVAL = 2000; // 2 seconds for real-time updates

export function useRun({ runId, enabled = true }: UseRunOptions) {
  return useQuery<Run | null>({
    queryKey: queryKeys.runs.byId(runId),
    queryFn: async () => {
      const data = await getRun(runId);
      if (!data) return null;

      // Validate the response with Zod schema to ensure type safety
      // This throws if the data doesn't match the expected schema
      return RunSchema.parse({
        ...data,
        // Ensure status is valid for the enum if needed, though parse handles it
        status: data.status,
      });
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
