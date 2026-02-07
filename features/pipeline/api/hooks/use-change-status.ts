"use client";

import { useQueries } from "@tanstack/react-query";
import {
  getActiveRunForChange,
  getOpenSpecChangeStatus,
  validateOpenSpecChange,
} from "@/app/actions";
import { queryKeys } from "@/lib/query/keys";

interface UseChangeStatusResult {
  validation: Awaited<ReturnType<typeof validateOpenSpecChange>> | null;
  status: Awaited<ReturnType<typeof getOpenSpecChangeStatus>> | null;
  activeRun: { id: string } | null;
  isLoading: boolean;
}

const REFETCH_INTERVAL = 30000; // 30 seconds

export function useChangeStatus(changeId: string): UseChangeStatusResult {
  const results = useQueries({
    queries: [
      {
        queryKey: queryKeys.changes.validation(changeId),
        queryFn: () => validateOpenSpecChange(changeId),
        staleTime: 10000, // 10 seconds
      },
      {
        queryKey: queryKeys.changes.status(changeId),
        queryFn: () => getOpenSpecChangeStatus(changeId),
        staleTime: 10000,
        refetchInterval: REFETCH_INTERVAL,
      },
      {
        queryKey: queryKeys.runs.byChange(changeId),
        queryFn: () => getActiveRunForChange(changeId),
        staleTime: 5000,
        refetchInterval: REFETCH_INTERVAL,
      },
    ],
  });

  const [validationResult, statusResult, activeRunResult] = results;

  return {
    validation: validationResult.data ?? null,
    status: statusResult.data ?? null,
    activeRun: activeRunResult.data ?? null,
    isLoading:
      validationResult.isLoading ||
      statusResult.isLoading ||
      activeRunResult.isLoading,
  };
}
