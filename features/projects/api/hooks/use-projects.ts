"use client";

import { useQuery } from "@tanstack/react-query";
import { getProjects } from "@/app/actions";
import type { ProjectConfig } from "@/features/projects/types";
import { queryKeys } from "@/lib/query/keys";

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export function useProjects() {
  return useQuery<ProjectConfig[]>({
    queryKey: queryKeys.projects.all,
    queryFn: async () => {
      const projects = await getProjects();
      return projects.map((p) => ({
        id: p.id,
        name: p.name,
        path: p.path,
        checkCommand: p.checkCommand ?? undefined,
        preCheckCommand: p.preCheckCommand ?? undefined,
        context: p.context ?? undefined,
        rulesApply: p.rulesApply ?? undefined,
        rulesVerification: p.rulesVerification ?? undefined,
      }));
    },
    staleTime: STALE_TIME,
  });
}
