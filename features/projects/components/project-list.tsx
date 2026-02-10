"use client";

import { ExternalLink, Folder, Plus, Settings2, Terminal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { analyzeProject } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateProject } from "@/features/projects/api/hooks/use-create-project";
import type { ProjectConfig } from "@/features/projects/types";

export function ProjectList({ projects }: { projects: ProjectConfig[] }) {
  const router = useRouter();
  const createProjectMutation = useCreateProject();
  const [isAdding, setIsAdding] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", path: "" });

  const nameId = useId();
  const pathId = useId();

  const handleAddProject = async () => {
    if (!newProject.name || !newProject.path) return;
    setIsAnalyzing(true);
    try {
      const proposal = await analyzeProject(newProject.path);
      createProjectMutation.mutate(
        {
          name: newProject.name,
          path: newProject.path,
          checkCommand: proposal.checkCommand.value,
          context: proposal.context,
          rulesApply: JSON.stringify(proposal.rulesApply),
          rulesVerification: JSON.stringify(proposal.rulesVerification),
        },
        {
          onSuccess: (id) => {
            setNewProject({ name: "", path: "" });
            setIsAdding(false);
            router.push(`/projects/${id}`);
          },
        },
      );
    } catch (e) {
      createProjectMutation.mutate(newProject, {
        onSuccess: (id) => {
          setNewProject({ name: "", path: "" });
          setIsAdding(false);
          router.push(`/projects/${id}`);
        },
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            Project Repositories
          </h2>
          <p className="text-sm text-muted-foreground">
            {projects.length} projects configured.
          </p>
        </div>
        <Button
          onClick={() => setIsAdding(!isAdding)}
          variant={isAdding ? "ghost" : "default"}
        >
          {isAdding ? (
            "Cancel"
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" /> Add Project
            </>
          )}
        </Button>
      </div>

      {isAdding && (
        <Card className="border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-300">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Quick Setup</CardTitle>
            <CardDescription>
              Enter the basics, and AI will analyze the repository for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={nameId}>Project Name</Label>
              <Input
                id={nameId}
                placeholder="My Awesome App"
                value={newProject.name}
                onChange={(e) =>
                  setNewProject({ ...newProject, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={pathId}>Root Path (Absolute)</Label>
              <Input
                id={pathId}
                placeholder="/home/user/dev/project"
                value={newProject.path}
                onChange={(e) =>
                  setNewProject({ ...newProject, path: e.target.value })
                }
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleAddProject}
              className="w-full"
              disabled={createProjectMutation.isPending || isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Settings2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                  Analyzing...
                </>
              ) : (
                "Initialize with AI Analysis"
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {projects.map((project) => (
          <Card
            key={project.id}
            className="group relative overflow-hidden transition-all border-muted hover:shadow-md cursor-pointer hover:border-primary/50"
            onClick={() => router.push(`/projects/${project.id}`)}
          >
            <CardHeader className="pb-3 text-card-foreground">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Folder className="h-4 w-4 text-blue-500" />
                    {project.name}
                  </CardTitle>
                  <CardDescription className="font-mono text-[10px] truncate max-w-[200px]">
                    {project.path}
                  </CardDescription>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Terminal className="h-3.5 w-3.5" />
                  <code className="bg-muted px-1.5 py-0.5 rounded">
                    {project.checkCommand}
                  </code>
                </div>
                {project.context && (
                  <p className="text-[10px] text-muted-foreground line-clamp-2 opacity-70">
                    {project.context}
                  </p>
                )}
              </div>
            </CardContent>
            <div className="absolute bottom-0 left-0 h-1 w-full bg-blue-500/20 group-hover:bg-blue-500 transition-all duration-500" />
          </Card>
        ))}
      </div>
    </div>
  );
}
