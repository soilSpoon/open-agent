"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadArtifact, updateArtifact } from "@/app/actions";
import type { ArtifactType } from "@/lib/openspec/types";
import { queryKeys } from "@/lib/query/keys";

interface UseArtifactOptions {
  changeId: string;
  type: ArtifactType;
  filePath?: string;
  enabled?: boolean;
}

const STALE_TIME = 30000; // 30 seconds

export function useArtifact({
  changeId,
  type,
  filePath,
  enabled = true,
}: UseArtifactOptions) {
  return useQuery({
    queryKey: queryKeys.changes.artifact(changeId, type, filePath),
    queryFn: () => loadArtifact(changeId, type, filePath),
    staleTime: STALE_TIME,
    enabled,
  });
}

export function useUpdateArtifact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      changeId,
      type,
      filePath,
      content,
    }: {
      changeId: string;
      type: ArtifactType;
      filePath?: string;
      content: string;
    }) => {
      await updateArtifact(changeId, type, content, filePath);
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific artifact
      queryClient.invalidateQueries({
        queryKey: queryKeys.changes.artifact(
          variables.changeId,
          variables.type,
          variables.filePath,
        ),
      });
      // Also invalidate status since content changed
      queryClient.invalidateQueries({
        queryKey: queryKeys.changes.status(variables.changeId),
      });
    },
  });
}
