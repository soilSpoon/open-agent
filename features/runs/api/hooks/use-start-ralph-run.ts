"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getProject, startRalphRun } from "@/app/actions";
import type { ProjectConfig } from "@/lib/openspec/types";
import { queryKeys } from "@/lib/query/keys";

interface StartRunParams {
  changeId: string;
  projectId: string;
}

export function useStartRalphRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ changeId, projectId }: StartRunParams) => {
      const dbProject = await getProject(projectId);
      if (!dbProject) {
        throw new Error("Project not found");
      }

      const projectConfig: ProjectConfig = {
        id: dbProject.id,
        name: dbProject.name,
        path: dbProject.path,
        checkCommand: dbProject.checkCommand ?? undefined,
        preCheckCommand: dbProject.preCheckCommand ?? undefined,
      };

      const runId = await startRalphRun(changeId, projectConfig);
      return runId;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.runs.byChange(variables.changeId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.runs.all,
      });
    },
  });
}
