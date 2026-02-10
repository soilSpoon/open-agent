"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Settings2, Terminal, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteProject, updateContext, updateProject } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectConfig } from "@/features/projects/types";
import { queryKeys } from "@/lib/query/keys";
import { RuleListEditor } from "./rule-list-editor";

function parseRules(value?: string | null): string[] {
  if (!value) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr) && arr.every((x) => typeof x === "string"))
        return arr;
    } catch {}
  }
  return trimmed
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ProjectDetail({ project }: { project: ProjectConfig }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [context, setContext] = useState(project.context || "");
  const [rulesApply, setRulesApply] = useState<string[]>(
    parseRules(project.rulesApply),
  );
  const [rulesVerification, setRulesVerification] = useState<string[]>(
    parseRules(project.rulesVerification),
  );

  const handleUpdate = async (data: Partial<ProjectConfig>) => {
    try {
      await updateProject(project.id, data);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      toast.success("Project updated successfully");
    } catch {
      toast.error("Failed to update project");
    }
  };

  const handleContextBlur = async () => {
    if (context !== project.context) {
      const previousContext = project.context;
      try {
        await updateContext(project.path, context);
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
        toast.success("Context updated successfully");
      } catch {
        setContext(previousContext || "");
        toast.error("Failed to update context");
      }
    }
  };

  const handleRulesChange = (
    type: "apply" | "verification",
    newRules: string[],
  ) => {
    if (type === "apply") {
      setRulesApply(newRules);
    } else {
      setRulesVerification(newRules);
    }
    // Optimistic update, but we should also invalidate to sync with file system eventually
    // Since RuleListEditor calls server actions directly, the file is already updated.
    // We just invalidate to keep other parts of the app in sync.
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
  };

  const handleDelete = async () => {
    // Implement custom confirmation dialog later if needed
    if (confirm("Are you sure you want to delete this project?")) {
      try {
        await deleteProject(project.id);
        toast.success("Project deleted successfully");
        router.push("/projects");
      } catch {
        toast.error("Failed to delete project");
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between border-b pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link
              href="/projects"
              className="hover:text-primary transition-colors"
            >
              Projects
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>Settings</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">{project.name}</h2>
          <p className="text-sm font-mono text-muted-foreground bg-muted w-fit px-2 py-0.5 rounded">
            {project.path}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" /> Delete Project
          </Button>
        </div>
      </div>

      <div className="grid gap-8">
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Terminal className="h-5 w-5 text-blue-500" />
            <h3>Build & Check Configuration</h3>
          </div>
          <div className="grid gap-6 p-6 border rounded-xl bg-card shadow-sm">
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Quality Check Command
              </Label>
              <Input
                className="font-mono"
                defaultValue={project.checkCommand}
                onBlur={(e) => handleUpdate({ checkCommand: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">
                The command Ralph runs to verify code quality (e.g., tests,
                linting).
              </p>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Pre-Check Command
              </Label>
              <Input
                className="font-mono"
                defaultValue={project.preCheckCommand}
                onBlur={(e) =>
                  handleUpdate({ preCheckCommand: e.target.value })
                }
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Settings2 className="h-5 w-5 text-purple-500" />
            <h3>AI Knowledge & Rules</h3>
          </div>
          <div className="grid gap-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Project Context</CardTitle>
                <CardDescription>
                  Tech stack, conventions, and high-level project information.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={6}
                  className="font-mono text-sm leading-relaxed"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  onBlur={handleContextBlur}
                  placeholder="Describe the tech stack, architecture, and core conventions..."
                />
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-green-600">
                    Apply Rules
                  </CardTitle>
                  <CardDescription>
                    Rules followed during implementation.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RuleListEditor
                    rules={rulesApply}
                    ruleType="apply"
                    projectPath={project.path}
                    onRulesChange={(rules) => handleRulesChange("apply", rules)}
                  />
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-amber-600">
                    Verification Rules
                  </CardTitle>
                  <CardDescription>
                    Checks performed after implementation.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RuleListEditor
                    rules={rulesVerification}
                    ruleType="verification-report"
                    projectPath={project.path}
                    onRulesChange={(rules) =>
                      handleRulesChange("verification", rules)
                    }
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
