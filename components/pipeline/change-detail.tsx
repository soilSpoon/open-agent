"use client";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Play,
  Save,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  fixArtifact,
  generateInstructions,
  getOpenSpecChangeStatus,
  loadArtifact,
  startRalphRun,
  updateArtifact,
  validateOpenSpecChange,
} from "@/app/actions";
import { useSettings } from "@/components/settings-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type {
  ArtifactType,
  OpenSpecChange,
  OpenSpecCLIStatus,
} from "@/lib/openspec/types";
import { cn } from "@/lib/utils";
import { PipelineView } from "./pipeline-view";
import { PlannerStatus } from "./planner-status";

export function ChangeDetail({ change }: { change: OpenSpecChange }) {
  const [stage, setStage] = useState<ArtifactType>("proposal");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [running, setRunning] = useState(false);
  const [validation, setValidation] = useState<{
    valid: boolean;
    errors: string[];
  } | null>(null);
  const [fixing, setFixing] = useState(false);
  const [cliStatus, setCliStatus] = useState<OpenSpecCLIStatus | null>(null);

  const router = useRouter();

  const [isModified, setIsModified] = useState(false);
  const contentRef = useRef(content);

  const { language } = useSettings();

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    setLoading(true);
    // Load content
    loadArtifact(change.id, stage).then((data) => {
      const newContent = data?.content || "";
      setContent(newContent);
      contentRef.current = newContent;
      setIsModified(false);
      setLoading(false);
    });
    // Load CLI status
    getOpenSpecChangeStatus(change.id).then(setCliStatus);
  }, [change.id, stage]);

  // Run validation on mount and after saves
  useEffect(() => {
    validateOpenSpecChange(change.id).then(setValidation);
  }, [change.id]);

  // Debounced auto-save and validation
  useEffect(() => {
    if (!isModified || loading || saving || generating || fixing) return;

    const timeoutId = setTimeout(async () => {
      const contentToSave = content;
      // Perform background save and validation
      await updateArtifact(change.id, stage, contentToSave);
      const result = await validateOpenSpecChange(change.id);
      const newStatus = await getOpenSpecChangeStatus(change.id);

      setValidation(result);
      setCliStatus(newStatus);

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
  ]);

  const handleSave = async () => {
    setSaving(true);
    await updateArtifact(change.id, stage, content);
    const result = await validateOpenSpecChange(change.id);
    const newStatus = await getOpenSpecChangeStatus(change.id);
    setValidation(result);
    setCliStatus(newStatus);
    setIsModified(false);
    setSaving(false);
    router.refresh();
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
      const result = await validateOpenSpecChange(change.id);
      const newStatus = await getOpenSpecChangeStatus(change.id);
      setValidation(result);
      setCliStatus(newStatus);
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
      const runId = await startRalphRun(change.id);
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
      const fixedContent = await fixArtifact(
        content,
        validation.errors,
        language,
      );
      setContent(fixedContent);
      // Automatically save after fix to trigger re-validation
      await updateArtifact(change.id, stage, fixedContent);
      const result = await validateOpenSpecChange(change.id);
      const newStatus = await getOpenSpecChangeStatus(change.id);
      setValidation(result);
      setCliStatus(newStatus);
      router.refresh();
    } catch (error) {
      console.error("Failed to fix artifact:", error);
    } finally {
      setFixing(false);
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
      {cliStatus && <PlannerStatus status={cliStatus} />}

      <PipelineView
        artifacts={change.artifacts}
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

      {validation && !validation.valid && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <div className="flex-1">
            <AlertTitle className="flex items-center justify-between">
              Validation Errors
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-900"
                onClick={handleFix}
                disabled={fixing}
              >
                {fixing ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-3 w-3" />
                )}
                Auto Fix with AI
              </Button>
            </AlertTitle>
            <AlertDescription className="mt-2">
              <ul className="list-disc list-inside">
                {validation.errors.map((err, i) => (
                  <li key={`${i}-${err.substring(0, 10)}`}>{err}</li>
                ))}
              </ul>
            </AlertDescription>
          </div>
        </Alert>
      )}

      {validation?.valid && (
        <Alert className="border-green-500 text-green-700 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>All Valid</AlertTitle>
          <AlertDescription>
            This change is ready for the next steps.
          </AlertDescription>
        </Alert>
      )}

      <Card className="flex-1 min-h-[600px] flex flex-col">
        <CardContent className="p-6 flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold capitalize flex items-center gap-2">
              {stage} Editor
              {change.artifacts[stage].exists && (
                <span className="text-xs font-normal text-muted-foreground">
                  (Last modified:{" "}
                  {new Date(
                    change.artifacts[stage].lastModified ?? "",
                  ).toLocaleString()}
                  )
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={handleGenerate}
                disabled={generating || loading || isBlocked}
                className={cn(
                  isReady && !content && "ring-2 ring-blue-400 ring-offset-1",
                  isBlocked && "opacity-50 cursor-not-allowed",
                )}
              >
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {isBlocked
                  ? "Blocked"
                  : isReady && !content
                    ? "Draft with AI"
                    : "Regenerate with AI"}
              </Button>
              <Button variant="outline" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
              {stage === "tasks" && (
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={handleRunRalph}
                  disabled={running}
                >
                  {running ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Run Ralph
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <Textarea
              className="flex-1 font-mono text-sm leading-relaxed p-4 resize-none bg-gray-50 focus:bg-white transition-colors"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setIsModified(true);
              }}
              placeholder={`# ${stage.charAt(0).toUpperCase() + stage.slice(1)}\n\nWrite your ${stage} content here...`}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
