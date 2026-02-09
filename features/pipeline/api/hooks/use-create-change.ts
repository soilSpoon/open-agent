"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createOpenSpecChange } from "@/app/actions";
import { queryKeys } from "@/lib/query/keys";

export function useCreateChange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (title: string) => {
      return await createOpenSpecChange(title);
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
