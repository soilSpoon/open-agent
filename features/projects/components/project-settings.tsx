"use client";

import {
  Folder,
  Pencil,
  Plus,
  Save,
  Settings2,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { deleteProject, updateProject } from "@/app/actions";
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
import { useProjects } from "@/features/projects/api/hooks/use-projects";
import { useProjectStore } from "@/features/projects/stores/project-store";
import type { ProjectConfig } from "@/features/projects/types";

export function ProjectSettings() {
  const router = useRouter();
  const { data: projects = [], isLoading } = useProjects();
  const createProjectMutation = useCreateProject();
  const setSelectedProject = useProjectStore((s) => s.setSelectedProject);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({
    name: "",
    path: "",
    checkCommand: "bun run check",
    preCheckCommand: "",
  });
  const [editForm, setEditForm] = useState<Partial<ProjectConfig>>({});

  const nameId = useId();
  const pathId = useId();
  const cmdId = useId();
  const preCmdId = useId();
  const editNameId = useId();
  const editPathId = useId();
  const editCmdId = useId();

  const handleAddProject = async () => {
    if (!newProject.name || !newProject.path) return;

    createProjectMutation.mutate(
      {
        name: newProject.name,
        path: newProject.path,
        checkCommand: newProject.checkCommand,
        preCheckCommand: newProject.preCheckCommand || undefined,
      },
      {
        onSuccess: (id) => {
          setSelectedProject(id);
          setNewProject({
            name: "",
            path: "",
            checkCommand: "bun run check",
            preCheckCommand: "",
          });
          setIsAdding(false);
        },
      },
    );
  };

  const handleSelectProject = (id: string) => {
    if (editingId) return;
    setSelectedProject(id);
    router.push("/");
  };

  const handleStartEdit = (project: ProjectConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(project.id);
    setEditForm(project);
  };

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editForm.name || !editForm.path || !editingId) return;

    await updateProject(editingId, {
      name: editForm.name,
      path: editForm.path,
      checkCommand: editForm.checkCommand,
      preCheckCommand: editForm.preCheckCommand,
    });

    setEditingId(null);
  };

  const removeProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteProject(id);
  };

  if (isLoading) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Projects</h2>
          <p className="text-sm text-muted-foreground">
            Manage repositories and their specific autonomous configurations.
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
            <CardTitle className="text-sm font-medium">
              New Project Configuration
            </CardTitle>
            <CardDescription>
              Setup the environment for Ralph agent loop.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={nameId}>Project Name</Label>
              <Input
                id={nameId}
                placeholder="Open Agent"
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
            <div className="grid gap-2">
              <Label htmlFor={cmdId}>Quality Check Command</Label>
              <div className="relative">
                <Terminal className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id={cmdId}
                  className="pl-9 md:pl-9"
                  placeholder="bun run check"
                  value={newProject.checkCommand}
                  onChange={(e) =>
                    setNewProject({
                      ...newProject,
                      checkCommand: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={preCmdId}>Pre-Check Command (Optional)</Label>
              <div className="relative">
                <Settings2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id={preCmdId}
                  className="pl-9 md:pl-9"
                  placeholder="e.g. bun run lint"
                  value={newProject.preCheckCommand}
                  onChange={(e) =>
                    setNewProject({
                      ...newProject,
                      preCheckCommand: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleAddProject}
              className="w-full"
              disabled={createProjectMutation.isPending}
            >
              {createProjectMutation.isPending
                ? "Creating..."
                : "Initialize Project Context"}
            </Button>
          </CardFooter>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {projects.map((project) => (
          <Card
            key={project.id}
            className={`group relative overflow-hidden transition-all border-muted ${
              editingId === project.id
                ? "ring-2 ring-primary border-primary/50"
                : "hover:shadow-md cursor-pointer hover:border-primary/50"
            }`}
            onClick={() => handleSelectProject(project.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  {editingId === project.id ? (
                    <div className="space-y-3 pr-4">
                      <div className="grid gap-1.5">
                        <Label
                          htmlFor={editNameId}
                          className="text-[10px] uppercase text-muted-foreground font-bold"
                        >
                          Name
                        </Label>
                        <Input
                          id={editNameId}
                          size={1}
                          className="h-8 text-sm"
                          value={editForm.name}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            setEditForm({ ...editForm, name: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label
                          htmlFor={editPathId}
                          className="text-[10px] uppercase text-muted-foreground font-bold"
                        >
                          Path
                        </Label>
                        <Input
                          id={editPathId}
                          size={1}
                          className="h-8 text-sm font-mono"
                          value={editForm.path}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            setEditForm({ ...editForm, path: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Folder className="h-4 w-4 text-blue-500" />
                        {project.name}
                      </CardTitle>
                      <CardDescription className="font-mono text-[10px] truncate max-w-[200px]">
                        {project.path}
                      </CardDescription>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {editingId === project.id ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600 hover:bg-green-50"
                        onClick={handleSaveEdit}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors relative z-10"
                        onClick={(e) => handleStartEdit(project, e)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors relative z-10"
                        onClick={(e) => removeProject(project.id, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              {editingId === project.id ? (
                <div className="grid gap-1.5 pt-1">
                  <Label
                    htmlFor={editCmdId}
                    className="text-[10px] uppercase text-muted-foreground font-bold"
                  >
                    Check Command
                  </Label>
                  <Input
                    id={editCmdId}
                    className="h-8 text-xs font-mono"
                    value={editForm.checkCommand}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      setEditForm({ ...editForm, checkCommand: e.target.value })
                    }
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Terminal className="h-3.5 w-3.5" />
                    <code className="bg-muted px-1.5 py-0.5 rounded">
                      {project.checkCommand}
                    </code>
                  </div>
                  {project.preCheckCommand && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground opacity-70">
                      <Settings2 className="h-3.5 w-3.5" />
                      <code className="bg-muted px-1.5 py-0.5 rounded">
                        {project.preCheckCommand}
                      </code>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            <div className="absolute bottom-0 left-0 h-1 w-full bg-blue-500/20 group-hover:bg-blue-500 transition-all duration-500" />
          </Card>
        ))}
        {projects.length === 0 && !isAdding && (
          <div className="col-span-full py-12 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
            <Settings2 className="h-8 w-8 mb-3 opacity-20" />
            <p className="text-sm">No projects configured yet.</p>
            <Button variant="link" size="sm" onClick={() => setIsAdding(true)}>
              Add your first project
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
