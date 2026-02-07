"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject } from "@/app/actions";
import { queryKeys } from "@/lib/query/keys";

interface CreateProjectInput {
  name: string;
  path: string;
  checkCommand?: string;
  preCheckCommand?: string;
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation<string, Error, CreateProjectInput>({
    mutationFn: async (input): Promise<string> => {
      const result = await createProject(
        input.name,
        input.path,
        input.checkCommand,
        input.preCheckCommand,
      );
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.all,
      });
    },
  });
}
