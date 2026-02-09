"use client";

import { useQuery } from "@tanstack/react-query";
import { getPipelineSchema } from "@/app/actions";

export function usePipelineSchema() {
  return useQuery({
    queryKey: ["pipeline", "schema"],
    queryFn: () => getPipelineSchema(),
    staleTime: Infinity, // Schema doesn't change during session
  });
}
