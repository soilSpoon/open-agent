"use client";

import { CheckCircle2, Circle, Loader2, Terminal, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { getRun } from "@/app/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type RunData, RunDataSchema } from "@/lib/openspec/types";
import { cn } from "@/lib/utils";

export function RunMonitor({ runId }: { runId: string }) {
  const [run, setRun] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      const data = await getRun(runId);
      if (mounted && data) {
        const result = RunDataSchema.safeParse(data);
        if (result.success) {
          setRun(result.data);
          setLoading(false);
        } else {
          console.error("Failed to parse run data:", result.error);
        }
      }
    }

    // Initial fetch
    fetchData();

    // Simulate polling
    const interval = setInterval(fetchData, 2000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [runId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!run) return <div>Run not found</div>;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Tasks List */}
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Execution Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {run.tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-2 rounded-lg border bg-card text-card-foreground shadow-sm"
            >
              {task.status === "completed" && (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
              {task.status === "running" && (
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
              )}
              {task.status === "pending" && (
                <Circle className="h-5 w-5 text-gray-300" />
              )}
              {task.status === "failed" && (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span
                className={cn(
                  "text-sm font-medium",
                  task.status === "completed" && "text-gray-500 line-through",
                )}
              >
                {task.title}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Console/Logs */}
      <Card className="md:col-span-2 flex flex-col max-h-[600px]">
        <CardHeader className="border-b bg-gray-950 text-gray-100 rounded-t-xl py-3">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Console Output
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 bg-gray-950 rounded-b-xl overflow-hidden">
          <div className="h-[500px] overflow-y-auto p-4 font-mono text-xs space-y-1">
            {run.logs.map((log) => (
              <div key={log.id} className="flex gap-2 text-gray-300">
                <span className="text-gray-500 shrink-0">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                <span
                  className={cn(
                    log.level === "error" && "text-red-400",
                    log.level === "warn" && "text-yellow-400",
                    "break-all",
                  )}
                >
                  {log.message}
                </span>
              </div>
            ))}
            {run.status === "running" && (
              <div className="flex gap-2 text-gray-500 animate-pulse">
                <span className="invisible">
                  [{new Date().toLocaleTimeString()}]
                </span>
                <span>_</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
