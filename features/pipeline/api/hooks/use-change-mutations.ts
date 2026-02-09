"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteOpenSpecChange, renameOpenSpecChange } from "@/app/actions";
import { queryKeys } from "@/lib/query/keys";

export function useDeleteChange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (changeId: string) => {
      await deleteOpenSpecChange(changeId);
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

export function useRenameChange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      changeId,
      newTitle,
    }: {
      changeId: string;
      newTitle: string;
    }) => {
      await renameOpenSpecChange(changeId, newTitle);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.changes.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.changes.byId(variables.changeId),
      });
    },
  });
}
