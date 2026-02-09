"use client";

import {
  AlertCircle,
  FileCode,
  LayoutPanelLeft,
  Loader2,
  Play,
  Save,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MarkdownEditor } from "@/components/common/markdown-editor";
import { TaskVisualEditor } from "@/components/pipeline/task-visual-editor";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useArtifact,
  useUpdateArtifact,
} from "@/features/pipeline/api/hooks/use-artifact";
import { useChangeStatus } from "@/features/pipeline/api/hooks/use-change-status";
import { useFixArtifact } from "@/features/pipeline/api/hooks/use-fix-artifact";
import { useGenerateArtifact } from "@/features/pipeline/api/hooks/use-generate-artifact";
import { useSpecs } from "@/features/pipeline/api/hooks/use-specs";
import {
  usePipelineStore,
  useSelectedSpecFile,
  useStage,
  useViewMode,
} from "@/features/pipeline/stores/pipeline-store";
import { useProjects } from "@/features/projects/api/hooks/use-projects";
import { useSelectedProjectId } from "@/features/projects/stores/project-store";
import { useStartRalphRun } from "@/features/runs/api/hooks/use-start-ralph-run";
import type { OpenSpecChange } from "@/lib/openspec/types";
import { useSettings } from "@/lib/settings-context";
import { cn } from "@/lib/utils";
import { PipelineView } from "./pipeline-view";
import { PlannerStatus } from "./planner-status";
import { SpecsEditor } from "./specs-editor";
import { ValidationStatus } from "./validation-status";

export function ChangeDetail({
  change,
  changeId,
}: {
  change: OpenSpecChange;
  changeId: string;
}) {
  const stage = useStage();
  const viewMode = useViewMode();
  const selectedSpecFile = useSelectedSpecFile();
  const { setStage, setViewMode, setSelectedSpecFile } = usePipelineStore();

  const [content, setContent] = useState("");
  const [isModified, setIsModified] = useState(false);
  const contentRef = useRef(content);

  const { language } = useSettings();
  const router = useRouter();

  const selectedProjectId = useSelectedProjectId();
  const { data: projects = [] } = useProjects();

  const {
    validation,
    status: cliStatus,
    activeRun,
    isLoading: isStatusLoading,
  } = useChangeStatus(changeId);

  const { data: specFiles = [] } = useSpecs({
    changeId,
    enabled: stage === "specs",
  });

  const { data: proposalData } = useArtifact({
    changeId,
    type: "proposal",
    enabled: stage === "specs",
  });

  const { data: artifactData, isLoading: isArtifactLoading } = useArtifact({
    changeId,
    type: stage,
    filePath: selectedSpecFile ?? undefined,
  });

  const updateArtifactMutation = useUpdateArtifact();
  const generateMutation = useGenerateArtifact();
  const fixMutation = useFixArtifact();
  const startRunMutation = useStartRalphRun();

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    if (artifactData?.content !== undefined) {
      const newContent = artifactData.content || "";
      setContent(newContent);
      contentRef.current = newContent;
      setIsModified(false);
    }
  }, [artifactData]);

  useEffect(() => {
    if (stage === "specs" && specFiles.length > 0 && !selectedSpecFile) {
      setSelectedSpecFile(specFiles[0].path);
    }
  }, [stage, specFiles, selectedSpecFile, setSelectedSpecFile]);

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      const {
        useProjectStore,
      } = require("@/features/projects/stores/project-store");
      useProjectStore.getState().setSelectedProject(projects[0].id);
    }
  }, [selectedProjectId, projects]);

  useEffect(() => {
    if (
      !isModified ||
      isArtifactLoading ||
      updateArtifactMutation.isPending ||
      generateMutation.isPending ||
      fixMutation.isPending
    )
      return;

    const timeoutId = setTimeout(async () => {
      const contentToSave = content;
      await updateArtifactMutation.mutateAsync({
        changeId,
        type: stage,
        filePath: selectedSpecFile ?? undefined,
        content: contentToSave,
      });

      if (contentRef.current === contentToSave) {
        setIsModified(false);
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [
    content,
    isModified,
    isArtifactLoading,
    updateArtifactMutation,
    generateMutation.isPending,
    fixMutation.isPending,
    changeId,
    stage,
    selectedSpecFile,
  ]);

  const handleSave = async () => {
    await updateArtifactMutation.mutateAsync({
      changeId,
      type: stage,
      filePath: selectedSpecFile ?? undefined,
      content,
    });
    setIsModified(false);
  };

  const handleGenerate = async () => {
    const generatedContent = await generateMutation.mutateAsync({
      changeId,
      type: stage,
      language,
    });
    setContent(generatedContent);
    setIsModified(false);
  };

  const handleFix = async () => {
    if (!validation || validation.valid) return;
    const result = await fixMutation.mutateAsync({
      changeId,
      errors: validation.errors,
      language,
    });

    if (result?.success) {
      const isCurrentStageModified = result.modifiedFiles.some(
        (f) =>
          f.type === stage &&
          (!selectedSpecFile || f.filePath === selectedSpecFile),
      );

      if (isCurrentStageModified && artifactData) {
        setContent(artifactData.content || "");
        setIsModified(false);
      }

      return result;
    }
  };

  const handleRunRalph = async () => {
    if (activeRun?.id) {
      router.push(`/runs/${activeRun.id}`);
      return;
    }

    if (!selectedProjectId) {
      alert("Please select a project first in the dashboard.");
      return;
    }

    const runId = await startRunMutation.mutateAsync({
      changeId,
      projectId: selectedProjectId,
    });
    router.push(`/runs/${runId}`);
  };

  const currentArtifactInfo = cliStatus?.artifacts.find(
    (a) => a.id === stage || (stage === "specs" && a.id.startsWith("specs")),
  );
  const isBlocked = currentArtifactInfo?.status === "blocked";
  const isReady = currentArtifactInfo?.status === "ready";

  const loading = isArtifactLoading;
  const saving = updateArtifactMutation.isPending;
  const generating = generateMutation.isPending;
  const fixing = fixMutation.isPending;
  const running = startRunMutation.isPending;

  return (
    <div className="flex flex-col gap-6">
      <ValidationStatus
        validation={validation}
        isLoading={isStatusLoading && !validation}
        fixing={fixing}
        onFix={handleFix}
        stage={stage}
        onNavigate={(type, filePath) => {
          setStage(type);
          if (type === "specs" && filePath) {
            setSelectedSpecFile(filePath);
          }
        }}
      />

      <PlannerStatus
        status={cliStatus}
        isLoading={isStatusLoading && !cliStatus}
      />

      <PipelineView
        artifacts={change.artifacts}
        status={cliStatus}
        currentStage={stage}
        onStageSelect={setStage}
      />

      {isBlocked && (
        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Step Blocked</AlertTitle>
          <AlertDescription className="text-red-700">
            This step is blocked by dependencies:{" "}
            <span className="font-semibold">
              {currentArtifactInfo?.missingDeps?.join(", ")}
            </span>
            . Please complete them first.
          </AlertDescription>
        </Alert>
      )}

      {isReady && !content && (
        <Alert className="bg-blue-50 border-blue-200">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Ready to Draft</AlertTitle>
          <AlertDescription className="text-blue-700">
            This step is ready. You can use "Generate with AI" to draft the
            content based on previous steps.
          </AlertDescription>
        </Alert>
      )}

      <Card className="flex-1 min-h-[600px] flex flex-col">
        <CardContent className="p-6 flex-1 flex flex-col">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
            <h2 className="text-base md:text-lg font-semibold capitalize flex items-center gap-2">
              {stage} Editor
              {change.artifacts[stage].exists && (
                <span className="text-[10px] md:text-xs font-normal text-muted-foreground">
                  (Modified:{" "}
                  {new Date(
                    change.artifacts[stage].lastModified ?? "",
                  ).toLocaleDateString()}
                  )
                </span>
              )}
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              {stage === "tasks" && (
                <div className="flex bg-muted p-1 rounded-md border shadow-sm">
                  <Button
                    variant={viewMode === "visual" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 md:h-8 px-2 md:px-3 text-xs md:text-sm"
                    onClick={() => setViewMode("visual")}
                  >
                    <LayoutPanelLeft className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                    Visual
                  </Button>
                  <Button
                    variant={viewMode === "markdown" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 md:h-8 px-2 md:px-3 text-xs md:text-sm"
                    onClick={() => setViewMode("markdown")}
                  >
                    <FileCode className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                    Markdown
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={generating || loading || isBlocked}
                  className={cn(
                    "flex-1 sm:flex-none text-xs md:text-sm h-8 md:h-9",
                    isReady && !content && "ring-2 ring-blue-400 ring-offset-1",
                    isBlocked && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {generating ? (
                    <Loader2 className="mr-1.5 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                  )}
                  {isBlocked
                    ? "Blocked"
                    : isReady && !content
                      ? "Draft"
                      : "Regen"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 sm:flex-none text-xs md:text-sm h-8 md:h-9"
                >
                  {saving ? (
                    <Loader2 className="mr-1.5 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                  )}
                  Save
                </Button>
                {stage === "tasks" && (
                  <Button
                    size="sm"
                    className={cn(
                      "flex-1 sm:flex-none text-xs md:text-sm h-8 md:h-9",
                      activeRun?.id
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-blue-600 hover:bg-blue-700",
                    )}
                    onClick={handleRunRalph}
                    disabled={running || !selectedProjectId}
                  >
                    {running ? (
                      <Loader2 className="mr-1.5 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" />
                    ) : (
                      <Play className="mr-1.5 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                    )}
                    {activeRun?.id ? "View" : "Run"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : stage === "specs" ? (
            <SpecsEditor
              files={specFiles}
              selectedFile={selectedSpecFile}
              onSelectFile={setSelectedSpecFile}
              content={content}
              onChangeContent={(value) => {
                setContent(value);
                setIsModified(true);
              }}
              placeholder={`# Specs\n\nSelect a file to edit...`}
              proposalContent={proposalData?.content}
            />
          ) : stage === "tasks" && viewMode === "visual" ? (
            <div className="flex-1 flex flex-col">
              <TaskVisualEditor
                value={content}
                onChange={(value) => {
                  setContent(value);
                  setIsModified(true);
                }}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col border rounded-md overflow-hidden bg-gray-50 focus-within:bg-white transition-colors">
              <MarkdownEditor
                value={content}
                onChange={(value) => {
                  setContent(value);
                  setIsModified(true);
                }}
                placeholder={`# ${stage.charAt(0).toUpperCase() + stage.slice(1)}\n\nWrite your ${stage} content here...`}
                className="flex-1"
                type={stage}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
