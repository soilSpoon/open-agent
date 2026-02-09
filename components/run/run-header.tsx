"use client";

import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { retryRun } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SessionStatus } from "@/lib/ralph/types";

interface RunHeaderProps {
  runId: string;
  status: SessionStatus;
  currentTask?: {
    id: string;
    title: string;
    status: string;
  };
  stats?: {
    total: number;
    completed: number;
    failed: number;
  };
}

export function RunHeader({
  runId,
  status,
  currentTask,
  stats,
}: RunHeaderProps) {
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const newRunId = await retryRun(runId);
      router.push(`/runs/${newRunId}`);
    } catch (error) {
      console.error("Failed to retry run:", error);
      setIsRetrying(false);
    }
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case "running":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "completed":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "failed":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "paused":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const getStatusIcon = (s: string) => {
    switch (s) {
      case "running":
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case "completed":
        return <CheckCircle2 className="w-4 h-4" />;
      case "failed":
        return <XCircle className="w-4 h-4" />;
      case "paused":
        return <PauseCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <Card className="p-4 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Run #{runId.slice(0, 8)}</h2>
            <Badge
              variant="outline"
              className={`flex items-center gap-1.5 ${getStatusColor(status)}`}
            >
              {getStatusIcon(status)}
              <span className="capitalize">{status}</span>
            </Badge>
          </div>

          {currentTask && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <PlayCircle className="w-4 h-4" />
                <span className="font-medium text-foreground">
                  {currentTask.id}:
                </span>
                <span className="truncate max-w-[750px]">
                  {currentTask.title}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          {stats && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Progress:</span>
                <span className="font-medium">
                  {stats.completed}/{stats.total}
                </span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Failures:</span>
                <span
                  className={`font-medium ${stats.failed > 0 ? "text-red-500" : ""}`}
                >
                  {stats.failed}
                </span>
              </div>
            </div>
          )}

          {status !== "running" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isRetrying}
            >
              <RotateCcw
                className={`w-4 h-4 mr-2 ${isRetrying ? "animate-spin" : ""}`}
              />
              Retry Run
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
