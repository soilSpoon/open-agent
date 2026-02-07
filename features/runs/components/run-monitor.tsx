"use client";

import { Loader2 } from "lucide-react";
import { useRef } from "react";
import { useRun } from "@/features/runs/api/hooks/use-run";

interface RunMonitorProps {
  runId: string;
}

export function RunMonitor({ runId }: RunMonitorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: run, isLoading } = useRun({ runId });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
        <p className="text-sm text-muted-foreground animate-pulse">
          Initializing Monitor...
        </p>
      </div>
    );
  }

  if (!run) {
    return <div>Run not found</div>;
  }

  // TODO: Complete RunMonitor UI migration
  return (
    <div>
      <h2>
        Run #{run.id} - {run.status}
      </h2>
      <div>Tasks: {run.tasks.length}</div>
      <div>Logs: {run.logs.length}</div>
    </div>
  );
}
