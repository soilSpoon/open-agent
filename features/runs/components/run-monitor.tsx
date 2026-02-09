"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { IterationList } from "@/components/run/iteration-list";
import { LogViewer } from "@/components/run/log-viewer";
import { RunHeader } from "@/components/run/run-header";
import { useRun } from "@/features/runs/api/hooks/use-run";

interface RunMonitorProps {
  runId: string;
}

export function RunMonitor({ runId }: RunMonitorProps) {
  const { data: run, isLoading } = useRun({ runId });
  const [selectedIterationId, setSelectedIterationId] = useState<string>();

  // Auto-select latest iteration when loaded
  useEffect(() => {
    if (run?.logs && run.logs.length > 0 && !selectedIterationId) {
      setSelectedIterationId(run.logs[run.logs.length - 1].id);
    }
  }, [run?.logs, selectedIterationId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
        <p className="text-sm text-muted-foreground animate-pulse">
          Connecting to Ralph Engine...
        </p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <h2 className="text-xl font-semibold">Run Not Found</h2>
        <p className="text-muted-foreground">
          Could not load run data for ID: {runId}
        </p>
      </div>
    );
  }

  // Calculate stats
  const stats = {
    total: run.tasks.length,
    completed: run.tasks.filter((t) => t.status === "completed").length,
    failed: run.tasks.filter((t) => t.status === "failed").length,
  };

  const currentTask =
    run.tasks.find(
      (t) => t.status === "running" || t.status === "in_progress",
    ) || run.tasks[run.tasks.length - 1];

  // Use typed logs directly
  const structuredLogs = run.logs;
  const selectedLog =
    structuredLogs.find((l) => l.id === selectedIterationId) ||
    structuredLogs[structuredLogs.length - 1];

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] gap-4">
      <RunHeader
        runId={runId}
        status={run.status}
        currentTask={currentTask}
        stats={stats}
      />

      <div className="flex flex-1 gap-4 overflow-hidden rounded-lg border bg-background shadow-sm">
        <div className="w-80 flex-shrink-0 border-r bg-muted/10">
          <IterationList
            iterations={structuredLogs}
            selectedId={selectedIterationId}
            onSelect={setSelectedIterationId}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="h-full p-4">
            {selectedLog ? (
              <LogViewer log={selectedLog} />
            ) : run.status === "running" && currentTask ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <div className="text-center">
                  <p className="text-lg font-medium">
                    Executing Task {currentTask.id}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md">
                    {currentTask.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-3">
                    Iteration logs will appear here when the task completes...
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select an iteration to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
