"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fixArtifact as fixArtifactAction } from "@/app/actions";
import { queryKeys } from "@/lib/query/keys";
import type { Language } from "@/lib/settings-context";

interface FixArtifactParams {
  changeId: string;
  errors: string[];
  language: Language;
}

export function useFixArtifact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ changeId, errors, language }: FixArtifactParams) => {
      return await fixArtifactAction(changeId, errors, language);
    },
    onSuccess: (result, variables) => {
      if (result?.success) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.changes.validation(variables.changeId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.changes.status(variables.changeId),
        });
        for (const file of result.modifiedFiles) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.changes.artifact(
              variables.changeId,
              file.type,
              file.filePath,
            ),
          });
        }
      }
    },
  });
}
