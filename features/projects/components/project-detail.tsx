"use client";

import { ChevronRight, Settings2, Terminal, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteProject, updateProject } from "@/app/actions";
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

export function ProjectDetail({ project }: { project: ProjectConfig }) {
  const router = useRouter();

  const handleUpdate = async (data: Partial<ProjectConfig>) => {
    await updateProject(project.id, data);
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this project?")) {
      await deleteProject(project.id);
      router.push("/projects");
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
                  defaultValue={project.context}
                  onBlur={(e) => handleUpdate({ context: e.target.value })}
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
                  <Textarea
                    rows={12}
                    className="font-mono text-xs leading-relaxed"
                    defaultValue={project.rulesApply}
                    onBlur={(e) => handleUpdate({ rulesApply: e.target.value })}
                    placeholder="Rules for code generation..."
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
                  <Textarea
                    rows={12}
                    className="font-mono text-xs leading-relaxed"
                    defaultValue={project.rulesVerification}
                    onBlur={(e) =>
                      handleUpdate({ rulesVerification: e.target.value })
                    }
                    placeholder="Rules for checking the report..."
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
