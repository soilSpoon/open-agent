"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generateInstructions, updateArtifact } from "@/app/actions";
import type { ArtifactType } from "@/lib/openspec/types";
import { queryKeys } from "@/lib/query/keys";
import type { Language } from "@/lib/settings-context";

interface GenerateArtifactParams {
  changeId: string;
  type: ArtifactType;
  language: Language;
}

export function useGenerateArtifact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      changeId,
      type,
      language,
    }: GenerateArtifactParams) => {
      const generatedContent = await generateInstructions(
        changeId,
        type,
        language,
      );
      await updateArtifact(changeId, type, generatedContent);
      return generatedContent;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.changes.artifact(
          variables.changeId,
          variables.type,
        ),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.changes.status(variables.changeId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.changes.validation(variables.changeId),
      });
      if (variables.type === "specs") {
        queryClient.invalidateQueries({
          queryKey: queryKeys.changes.specs(variables.changeId),
        });
      }
    },
  });
}
