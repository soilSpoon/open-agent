"use client";

import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  ExternalLink,
  Lightbulb,
  Loader2,
  Square,
  Terminal,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getRun, stopRalphRun } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type RunData, RunDataSchema } from "@/lib/openspec/types";
import { cn } from "@/lib/utils";

export function RunMonitor({ runId }: { runId: string }) {
  const [run, setRun] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    // Trigger background worker if not active
    fetch("/api/worker").catch((err) =>
      console.error("Failed to trigger worker", err),
    );

    async function fetchData() {
      const data = await getRun(runId);
      if (mounted && data) {
        const result = RunDataSchema.safeParse(data);
        if (result.success) {
          setRun(result.data);
          setLoading(false);
        }
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [runId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [run?.logs]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
        <p className="text-sm text-muted-foreground animate-pulse">
          Initializing Monitor...
        </p>
      </div>
    );
  }

  if (!run) return <div>Run not found</div>;

  const isRunning = run.status === "running";
  const activeTask = run.tasks.find((t) => t.status === "running");

  // Mocking patterns from logs for demonstration - in reality these come from progress.txt/DB
  const patterns = run.logs
    .filter((l) => l.message.includes("Pattern:"))
    .map((l) => l.message.replace("Pattern:", "").trim());
  const gotchas = run.logs
    .filter((l) => l.message.includes("Gotcha:"))
    .map((l) => l.message.replace("Gotcha:", "").trim());

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-700">
      {/* Status Header */}
      <div className="flex items-center justify-between bg-muted/30 border p-4 rounded-2xl">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "h-12 w-12 rounded-xl flex items-center justify-center shadow-sm",
              isRunning
                ? "bg-blue-500/10 text-blue-500 animate-pulse"
                : "bg-muted text-muted-foreground",
            )}
          >
            {isRunning ? (
              <Zap className="h-6 w-6" />
            ) : (
              <Clock className="h-6 w-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">Ralph is {run.status}</h2>
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                #{run.id}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {activeTask
                ? `Currently processing: ${activeTask.title}`
                : "System idle"}
            </p>
          </div>
        </div>
        {isRunning && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => stopRalphRun(runId)}
            className="gap-2"
          >
            <Square className="h-3.5 w-3.5 fill-current" /> Stop Loop
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Execution Monitor */}
        <div className="lg:col-span-8 space-y-6">
          {/* Terminal */}
          <Card className="border-0 bg-zinc-950 shadow-2xl overflow-hidden rounded-2xl ring-1 ring-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 bg-zinc-900/50 px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5 pr-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/50" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500/50" />
                </div>
                <CardTitle className="text-xs font-mono text-zinc-400 flex items-center gap-2">
                  <Terminal className="h-3.5 w-3.5" />
                  ralph_executor --verbose
                </CardTitle>
              </div>
              <div className="text-[10px] font-mono text-zinc-500 tracking-tighter">
                {new Date().toLocaleTimeString()}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div
                ref={scrollRef}
                className="h-[500px] overflow-y-auto p-4 font-mono text-[13px] leading-relaxed selection:bg-blue-500/30"
              >
                {run.logs.map((log) => (
                  <div key={log.id} className="flex gap-3 mb-1 group">
                    <span className="text-zinc-600 shrink-0 text-[11px] pt-0.5 w-16">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour12: false,
                      })}
                    </span>
                    <span
                      className={cn(
                        "break-all",
                        log.level === "error"
                          ? "text-red-400 font-bold"
                          : log.level === "warn"
                            ? "text-yellow-400"
                            : "text-zinc-300",
                      )}
                    >
                      {log.message}
                    </span>
                  </div>
                ))}
                {isRunning && (
                  <div className="flex gap-3 items-center">
                    <span className="text-zinc-600 shrink-0 text-[11px] w-16">
                      {new Date().toLocaleTimeString([], { hour12: false })}
                    </span>
                    <div className="flex items-center gap-2 text-blue-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="animate-pulse">
                        Listening for updates...
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tasks Progress */}
          <div className="grid gap-3 sm:grid-cols-2">
            {run.tasks.map((task) => (
              <div
                key={task.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border transition-all duration-300",
                  task.status === "running"
                    ? "bg-primary/5 border-primary/30 shadow-sm"
                    : task.status === "completed"
                      ? "bg-muted/20 opacity-60"
                      : "bg-card opacity-40",
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center",
                      task.status === "running"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {task.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : task.status === "running" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : task.status === "failed" ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </div>
                  <span className="text-sm font-medium">{task.title}</span>
                </div>
                {task.status === "running" && (
                  <span className="text-[10px] font-bold text-primary animate-pulse">
                    ACTIVE
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Knowledge Base */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-primary/10 shadow-lg bg-gradient-to-b from-primary/[0.02] to-transparent rounded-2xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-500" />
                Iteration Memory
              </CardTitle>
              <CardDescription className="text-[11px]">
                Insights captured from progress.txt
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Patterns */}
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                  <Lightbulb className="h-3 w-3 text-yellow-500" />
                  Codebase Patterns
                </div>
                <div className="space-y-2">
                  {patterns.length > 0 ? (
                    patterns.map((p, i) => (
                      <div
                        key={i}
                        className="text-xs bg-muted/50 p-2 rounded-lg border border-primary/5 flex gap-2"
                      >
                        <ChevronRight className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                        {p}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic p-2">
                      Waiting for first pattern discovery...
                    </p>
                  )}
                </div>
              </div>

              {/* Gotchas */}
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                  Gotchas & Constraints
                </div>
                <div className="space-y-2">
                  {gotchas.length > 0 ? (
                    gotchas.map((g, i) => (
                      <div
                        key={i}
                        className="text-xs bg-red-500/5 p-2 rounded-lg border border-red-500/10 text-red-700 dark:text-red-400 flex gap-2"
                      >
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        {g}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic p-2">
                      No gotchas reported yet.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-9 p-0"
              asChild
            >
              <a
                href={`https://ampcode.com/threads/${
                  run.logs
                    .find((l) => l.message.includes("threadId"))
                    ?.message.split(":")
                    .pop() || ""
                }`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between w-full px-3 text-xs font-medium"
              >
                <span className="truncate mr-2">View Active Amp Thread</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-60 shrink-0" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-9 px-3 justify-between text-[11px] text-muted-foreground group flex items-center"
            >
              <span className="truncate mr-2">Download Full Progress Log</span>
              <Terminal className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
