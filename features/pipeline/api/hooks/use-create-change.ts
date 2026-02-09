"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createOpenSpecChange } from "@/app/actions";
import { queryKeys } from "@/lib/query/keys";

export interface CreateChangeInput {
  title: string;
  description?: string;
}

export function useCreateChange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateChangeInput) => {
      return await createOpenSpecChange(input.title, input.description);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.changes.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.stats,
      });
    },
  });
}
