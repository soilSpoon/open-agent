"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { stopRalphRun } from "@/app/actions";
import { queryKeys } from "@/lib/query/keys";

export function useStopRalphRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runId: string) => {
      await stopRalphRun(runId);
    },
    onSuccess: (_, runId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.runs.byId(runId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.runs.all,
      });
    },
  });
}
