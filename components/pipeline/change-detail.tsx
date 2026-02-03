"use client";
import { Loader2, Play, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { loadArtifact, updateArtifact } from "@/app/actions.ts";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import type { ArtifactType, OpenSpecChange } from "@/lib/openspec/types.ts";
import { PipelineView } from "./pipeline-view.tsx";

export function ChangeDetail({ change }: { change: OpenSpecChange }) {
  const [stage, setStage] = useState<ArtifactType>("proposal");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    loadArtifact(change.id, stage).then((data) => {
      setContent(data?.content || "");
      setLoading(false);
    });
  }, [change.id, stage]);

  const handleSave = async () => {
    setSaving(true);
    await updateArtifact(change.id, stage, content);
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <PipelineView
        artifacts={change.artifacts}
        currentStage={stage}
        onStageSelect={setStage}
      />

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
              <Button variant="outline" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
              {stage === "tasks" && (
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Play className="mr-2 h-4 w-4" /> Run Ralph
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
              onChange={(e) => setContent(e.target.value)}
              placeholder={`# ${stage.charAt(0).toUpperCase() + stage.slice(1)}\n\nWrite your ${stage} content here...`}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
