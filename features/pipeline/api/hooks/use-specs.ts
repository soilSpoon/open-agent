"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSpecsList } from "@/app/actions";
import { queryKeys } from "@/lib/query/keys";

interface UseSpecsOptions {
  changeId: string;
  enabled?: boolean;
}

export function useSpecs({ changeId, enabled = true }: UseSpecsOptions) {
  return useQuery({
    queryKey: queryKeys.changes.specs(changeId),
    queryFn: () => fetchSpecsList(changeId),
    enabled,
  });
}
