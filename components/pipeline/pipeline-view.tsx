"use client";
import { Code, FileText, ListTodo, Lock, Palette } from "lucide-react";
import type { ArtifactType, OpenSpecCLIStatus } from "@/lib/openspec/types";
import { cn } from "@/lib/utils";

interface PipelineViewProps {
  artifacts: Record<ArtifactType, { exists: boolean }>;
  status: OpenSpecCLIStatus | null;
  currentStage: ArtifactType;
  onStageSelect: (stage: ArtifactType) => void;
}

export function PipelineView({
  artifacts,
  status,
  currentStage,
  onStageSelect,
}: PipelineViewProps) {
  const stages: {
    id: ArtifactType;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }[] = [
    { id: "proposal", icon: FileText, label: "Proposal" },
    { id: "specs", icon: Code, label: "Specs" },
    { id: "design", icon: Palette, label: "Design" },
    { id: "tasks", icon: ListTodo, label: "Tasks" },
  ];

  return (
    <div className="relative flex items-center justify-between w-full max-w-4xl mx-auto mb-8 px-2 md:px-4">
      {/* Connection Line Background */}
      <div className="absolute top-5 md:top-6 left-0 w-full px-8 md:px-12">
        <div className="h-0.5 bg-gray-200 w-full" />
      </div>

      {stages.map((stage) => {
        const exists = artifacts[stage.id].exists;
        const isActive = stage.id === currentStage;
        const Icon = stage.icon;

        // Determine if stage is accessible
        const stageStatus = status?.artifacts.find(
          (a) =>
            a.id === stage.id ||
            (stage.id === "specs" && a.id.startsWith("specs")),
        );

        const isAccessible =
          stage.id === "proposal" ||
          stageStatus?.status === "ready" ||
          stageStatus?.status === "done";

        const isBlocked = stageStatus?.status === "blocked";

        return (
          <button
            key={stage.id}
            type="button"
            onClick={() => isAccessible && onStageSelect(stage.id)}
            disabled={!isAccessible}
            className={cn(
              "relative flex flex-col items-center gap-2 md:gap-3 group z-10 transition-all",
              isActive ? "scale-105" : "opacity-80 hover:opacity-100",
              !isAccessible && "opacity-40 cursor-not-allowed grayscale",
            )}
          >
            <div
              className={cn(
                "w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center border-[3px] md:border-4 transition-colors bg-white",
                isActive ? "border-blue-500 shadow-lg" : "border-gray-100",
                exists ? "text-green-600" : "text-gray-400",
                !isAccessible && "bg-gray-50 border-gray-200",
              )}
            >
              {!isAccessible && !exists ? (
                <Lock className="w-3 h-3 md:w-4 md:h-4 text-gray-400" />
              ) : (
                <Icon className="w-4 h-4 md:w-5 md:h-5" />
              )}
            </div>

            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "text-[10px] md:text-sm font-semibold capitalize",
                  isActive ? "text-blue-600" : "text-gray-600",
                )}
              >
                {stage.label}
              </span>
              <div className="mt-1 hidden sm:flex gap-1">
                {exists && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                    Created
                  </span>
                )}
                {stageStatus?.status === "done" && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                    Done
                  </span>
                )}
                {isBlocked && (
                  <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                    Blocked
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
