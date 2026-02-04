"use client";
import { Code, FileText, ListTodo, Palette } from "lucide-react";
import type { ArtifactType } from "@/lib/openspec/types";
import { cn } from "@/lib/utils";

interface PipelineViewProps {
  artifacts: Record<ArtifactType, { exists: boolean }>;
  currentStage: ArtifactType;
  onStageSelect: (stage: ArtifactType) => void;
}

export function PipelineView({
  artifacts,
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
    <div className="relative flex items-center justify-between w-full max-w-4xl mx-auto mb-8 px-4">
      {/* Connection Line Background */}
      <div className="absolute top-6 left-0 w-full px-12">
        <div className="h-0.5 bg-gray-200 w-full" />
      </div>

      {stages.map((stage) => {
        const exists = artifacts[stage.id].exists;
        const isActive = stage.id === currentStage;
        const Icon = stage.icon;

        return (
          <button
            key={stage.id}
            type="button"
            onClick={() => onStageSelect(stage.id)}
            className={cn(
              "relative flex flex-col items-center gap-3 group z-10",
              isActive ? "scale-105" : "opacity-80 hover:opacity-100",
            )}
          >
            <div
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center border-4 transition-colors bg-white",
                isActive ? "border-blue-500 shadow-lg" : "border-gray-100",
                exists ? "text-green-600" : "text-gray-400",
              )}
            >
              <Icon className="w-5 h-5" />
            </div>

            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "text-sm font-semibold capitalize",
                  isActive ? "text-blue-600" : "text-gray-600",
                )}
              >
                {stage.label}
              </span>
              {exists && (
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full mt-1">
                  Ready
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
