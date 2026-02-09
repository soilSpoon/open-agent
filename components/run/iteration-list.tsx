"use client";

import { CheckCircle2, ChevronRight, Clock, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { IterationLog } from "@/lib/ralph/types";
import { cn } from "@/lib/utils";

interface IterationListProps {
  iterations: (IterationLog & { id: string })[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function IterationList({
  iterations,
  selectedId,
  onSelect,
}: IterationListProps) {
  return (
    <div className="flex flex-col h-full border rounded-lg bg-card overflow-hidden">
      <div className="p-3 border-b bg-muted/30">
        <h3 className="font-semibold text-sm">Iteration History</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {iterations.map((iter) => (
            <button
              type="button"
              key={iter.id}
              onClick={() => onSelect(iter.id)}
              className={cn(
                "flex items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50 border-b last:border-0",
                selectedId === iter.id && "bg-muted",
              )}
            >
              <div className="mt-0.5">
                {iter.status === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : iter.status === "failed" ? (
                  <XCircle className="w-4 h-4 text-red-500" />
                ) : (
                  <Clock className="w-4 h-4 text-blue-500 animate-pulse" />
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Iteration {iter.iteration}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(iter.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="text-xs font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded w-fit">
                  {iter.taskId}
                </div>

                {iter.summary && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {iter.summary}
                  </p>
                )}

                {/* Dual Gate Indicator */}
                <div className="flex items-center gap-2 mt-2">
                  {/* Agent Gate */}
                  <div
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      iter.status === "success"
                        ? "bg-green-500"
                        : "bg-gray-300",
                    )}
                    title="Agent Claimed Complete"
                  />

                  {/* Quality Gate */}
                  <div
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      iter.verificationEvidence?.allChecksPassed
                        ? "bg-green-500"
                        : "bg-red-400",
                    )}
                    title="Verification Passed"
                  />
                </div>
              </div>

              {selectedId === iter.id && (
                <ChevronRight className="w-4 h-4 text-muted-foreground mt-1" />
              )}
            </button>
          ))}

          {iterations.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No iterations recorded yet.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
