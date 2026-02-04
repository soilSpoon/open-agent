import { ArrowRight, Check, Lock } from "lucide-react";
import type { OpenSpecCLIStatus } from "@/lib/openspec/types";

export function PlannerStatus({
  status,
  isLoading,
}: {
  status: OpenSpecCLIStatus | null;
  isLoading?: boolean;
}) {
  if (isLoading || !status) {
    return (
      <div className="bg-muted/50 text-foreground p-4 rounded-lg font-mono text-sm mb-6 border border-border shadow-lg animate-pulse">
        <div className="flex justify-between items-start mb-4 border-b border-border pb-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
        </div>
        <div className="space-y-3">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        </div>
      </div>
    );
  }

  const doneCount = status.artifacts.filter((a) => a.status === "done").length;
  const total = status.artifacts.length;

  return (
    <div className="bg-muted/50 text-foreground p-4 rounded-lg font-mono text-sm mb-6 border border-border shadow-lg">
      <div className="flex justify-between items-start mb-4 border-b border-border pb-2">
        <div>
          <div className="text-muted-foreground text-xs">
            Schema: {status.schemaName}
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold text-green-600 dark:text-green-400">
            {doneCount}/{total} completed
          </div>
          <div className="text-muted-foreground text-xs uppercase tracking-wider mt-1">
            Status
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {status.artifacts.map((artifact) => {
          let icon = (
            <div className="w-4 h-4 rounded-sm border border-muted-foreground/50 mr-2" />
          );
          let textColor = "text-muted-foreground";
          let statusText = "";

          if (artifact.status === "done") {
            icon = (
              <Check className="w-4 h-4 text-green-600 dark:text-green-400 mr-2" />
            );
            textColor = "text-foreground";
            statusText = "";
          } else if (artifact.status === "ready") {
            icon = (
              <ArrowRight className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mr-2 animate-pulse" />
            );
            textColor = "text-yellow-600 dark:text-yellow-400 font-bold";
            statusText = "(ready)";
          } else if (artifact.status === "blocked") {
            icon = <Lock className="w-4 h-4 text-red-500 mr-2" />;
            textColor = "text-muted-foreground/70";
            statusText = `(blocked by: ${
              artifact.missingDeps?.join(", ") || "prev steps"
            })`;
          }

          return (
            <div key={artifact.id} className="flex items-center">
              {icon}
              <span className={textColor}>{artifact.id}</span>
              {statusText && (
                <span className="ml-2 text-xs opacity-70 italic text-muted-foreground">
                  {statusText}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {status.isComplete && (
        <div className="mt-4 pt-3 border-t border-border text-green-600 dark:text-green-400 font-bold flex items-center">
          <Check className="w-5 h-5 mr-2" />
          All artifacts complete! Ready to apply.
        </div>
      )}
    </div>
  );
}
