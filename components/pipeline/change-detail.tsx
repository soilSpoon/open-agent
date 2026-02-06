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
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchSpecsList,
  fixArtifact,
  generateInstructions,
  getActiveRunForChange,
  getOpenSpecChangeStatus,
  loadArtifact,
  startRalphRun,
  updateArtifact,
  validateOpenSpecChange,
} from "@/app/actions";
import { MarkdownEditor } from "@/components/common/markdown-editor";
import { TaskVisualEditor } from "@/components/pipeline/task-visual-editor";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
  ArtifactType,
  OpenSpecChange,
  OpenSpecCLIStatus,
  ProjectConfig,
  SpecEntry,
} from "@/lib/openspec/types";
import type { Validation } from "@/lib/openspec/validation";
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
  const [stage, setStage] = useState<ArtifactType>("proposal");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [running, setRunning] = useState(false);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [cliStatus, setCliStatus] = useState<OpenSpecCLIStatus | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const [specFiles, setSpecFiles] = useState<SpecEntry[]>([]);
  const [selectedSpecFile, setSelectedSpecFile] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"visual" | "markdown">("visual");

  const { language } = useSettings();
  const router = useRouter();

  const [isModified, setIsModified] = useState(false);
  const contentRef = useRef(content);

  const refreshStatus = useCallback(async () => {
    setIsValidating(true);
    try {
      const [result, newStatus, activeRun] = await Promise.all([
        validateOpenSpecChange(change.id),
        getOpenSpecChangeStatus(change.id),
        getActiveRunForChange(change.id),
      ]);
      setValidation(result);
      setCliStatus(newStatus);
      setActiveRunId(activeRun?.id || null);
    } finally {
      setIsValidating(false);
    }
  }, [change.id]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    if (stage === "specs") {
      fetchSpecsList(change.id).then((files) => {
        setSpecFiles(files);
        if (files.length > 0 && !selectedSpecFile) {
          setSelectedSpecFile(files[0].path);
        }
      });
    }
  }, [change.id, stage, selectedSpecFile]); // selectedSpecFile is needed here to auto-select if nothing is selected

  useEffect(() => {
    setLoading(true);
    // Load content
    loadArtifact(change.id, stage, selectedSpecFile || undefined).then(
      (data) => {
        const newContent = data?.content || "";
        setContent(newContent);
        contentRef.current = newContent;
        setIsModified(false);
        setLoading(false);
      },
    );
  }, [change.id, stage, selectedSpecFile]);

  // Run validation and status check on mount and after saves
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Debounced auto-save and validation
  useEffect(() => {
    if (!isModified || loading || saving || generating || fixing) return;

    const timeoutId = setTimeout(async () => {
      const contentToSave = content;
      // Perform background save and validation
      await updateArtifact(
        change.id,
        stage,
        contentToSave,
        selectedSpecFile || undefined,
      );
      await refreshStatus();

      // Only reset modified flag if content hasn't changed since we started saving
      if (contentRef.current === contentToSave) {
        setIsModified(false);
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [
    content,
    isModified,
    loading,
    saving,
    generating,
    fixing,
    change.id,
    stage,
    refreshStatus,
    selectedSpecFile,
  ]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateArtifact(
        change.id,
        stage,
        content,
        selectedSpecFile || undefined,
      );
      await refreshStatus();
      setIsModified(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const generatedContent = await generateInstructions(
        change.id,
        stage,
        language,
      );
      setContent(generatedContent);

      // Auto-save and validate after generation to provide immediate feedback
      setSaving(true);
      await updateArtifact(change.id, stage, generatedContent);

      // If we're in specs, refresh the file list to show the new file immediately
      if (stage === "specs") {
        const files = await fetchSpecsList(change.id);
        setSpecFiles(files);
        if (files.length > 0 && !selectedSpecFile) {
          setSelectedSpecFile(files[0].path);
        }
      }

      await refreshStatus();
      setIsModified(false);
      setSaving(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to generate:", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleRunRalph = async () => {
    setRunning(true);
    try {
      if (activeRunId) {
        router.push(`/runs/${activeRunId}`);
        return;
      }

      // Get current project config from localStorage
      let projectConfig: ProjectConfig | undefined;
      const savedProjects = localStorage.getItem("open-agent-projects");
      const activeProjectId = localStorage.getItem("open-agent-active-project");

      if (savedProjects && activeProjectId) {
        const projects = JSON.parse(savedProjects);
        projectConfig = projects.find(
          (p: ProjectConfig) => p.id === activeProjectId,
        );
      }

      const runId = await startRalphRun(change.id, projectConfig);
      router.push(`/runs/${runId}`);
    } catch (error) {
      console.error("Failed to start Ralph run:", error);
      setRunning(false);
    }
  };

  const handleFix = async () => {
    if (!validation || validation.valid) return;
    setFixing(true);
    try {
      const result = await fixArtifact(changeId, validation.errors, language);
      if (result?.success) {
        // Reload global status
        await refreshStatus();

        // If the current stage was one of the modified files, we need to reload its content
        const isCurrentStageModified = result.modifiedFiles.some(
          (f) =>
            f.type === stage &&
            (!selectedSpecFile || f.filePath === selectedSpecFile),
        );

        if (isCurrentStageModified) {
          const data = await loadArtifact(
            changeId,
            stage,
            selectedSpecFile || undefined,
          );
          setContent(data?.content || "");
          setIsModified(false);
        }

        // Return result so ValidationStatus can show the report
        return result;
      }
    } catch (error) {
      console.error("Failed to fix artifact:", error);
    } finally {
      setFixing(false);
      router.refresh();
    }
  };

  // Determine current artifact status from CLI status
  const currentArtifactInfo = cliStatus?.artifacts.find(
    (a) => a.id === stage || (stage === "specs" && a.id.startsWith("specs")),
  );
  const isBlocked = currentArtifactInfo?.status === "blocked";
  const isReady = currentArtifactInfo?.status === "ready";

  return (
    <div className="flex flex-col gap-6">
      <ValidationStatus
        validation={validation}
        isLoading={isValidating && !validation}
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
        isLoading={isValidating && !cliStatus}
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
                      activeRunId
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-blue-600 hover:bg-blue-700",
                    )}
                    onClick={handleRunRalph}
                    disabled={running}
                  >
                    {running ? (
                      <Loader2 className="mr-1.5 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" />
                    ) : (
                      <Play className="mr-1.5 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                    )}
                    {activeRunId ? "View" : "Run"}
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
