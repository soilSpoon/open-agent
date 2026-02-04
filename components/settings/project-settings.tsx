"use client";

import {
  CheckCircle2,
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
import { useEffect, useState } from "react";
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
import type { ProjectConfig } from "@/lib/openspec/types";

export function ProjectSettings() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newProject, setNewProject] = useState<Partial<ProjectConfig>>({
    name: "",
    path: "",
    checkCommand: "bun run check",
  });
  const [editForm, setEditForm] = useState<Partial<ProjectConfig>>({});

  useEffect(() => {
    const saved = localStorage.getItem("open-agent-projects");
    if (saved) {
      try {
        setProjects(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse projects", e);
      }
    }
  }, []);

  const saveProjects = (updated: ProjectConfig[]) => {
    setProjects(updated);
    localStorage.setItem("open-agent-projects", JSON.stringify(updated));
  };

  const handleSelectProject = (id: string) => {
    if (editingId) return; // Don't redirect while editing
    localStorage.setItem("open-agent-active-project", id);
    router.push("/");
  };

  const handleAddProject = () => {
    if (!newProject.name || !newProject.path) return;

    const project: ProjectConfig = {
      id: Math.random().toString(36).substring(7),
      name: newProject.name,
      path: newProject.path,
      checkCommand: newProject.checkCommand || "bun run check",
    };

    saveProjects([...projects, project]);
    setNewProject({ name: "", path: "", checkCommand: "bun run check" });
    setIsAdding(false);
  };

  const handleStartEdit = (project: ProjectConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(project.id);
    setEditForm(project);
  };

  const handleSaveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editForm.name || !editForm.path) return;

    const updated = projects.map((p) =>
      p.id === editingId ? ({ ...p, ...editForm } as ProjectConfig) : p,
    );
    saveProjects(updated);
    setEditingId(null);
  };

  const removeProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    saveProjects(projects.filter((p) => p.id !== id));
  };

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
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                placeholder="Open Agent"
                value={newProject.name}
                onChange={(e) =>
                  setNewProject({ ...newProject, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="path">Root Path (Absolute)</Label>
              <Input
                id="path"
                placeholder="/home/user/dev/project"
                value={newProject.path}
                onChange={(e) =>
                  setNewProject({ ...newProject, path: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cmd">Quality Check Command</Label>
              <div className="relative">
                <Terminal className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cmd"
                  className="pl-9"
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
          </CardContent>
          <CardFooter>
            <Button onClick={handleAddProject} className="w-full">
              Initialize Project Context
            </Button>
          </CardFooter>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {projects.map((project) => (
          <Card
            key={project.id}
            className={`group relative overflow-hidden transition-all border-muted ${editingId === project.id ? "ring-2 ring-primary border-primary/50" : "hover:shadow-md cursor-pointer hover:border-primary/50"}`}
            onClick={() => handleSelectProject(project.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  {editingId === project.id ? (
                    <div className="space-y-3 pr-4">
                      <div className="grid gap-1.5">
                        <Label
                          htmlFor="edit-name"
                          className="text-[10px] uppercase text-muted-foreground font-bold"
                        >
                          Name
                        </Label>
                        <Input
                          id="edit-name"
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
                          htmlFor="edit-path"
                          className="text-[10px] uppercase text-muted-foreground font-bold"
                        >
                          Path
                        </Label>
                        <Input
                          id="edit-path"
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
                    htmlFor="edit-cmd"
                    className="text-[10px] uppercase text-muted-foreground font-bold"
                  >
                    Check Command
                  </Label>
                  <Input
                    id="edit-cmd"
                    className="h-8 text-xs font-mono"
                    value={editForm.checkCommand}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      setEditForm({ ...editForm, checkCommand: e.target.value })
                    }
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Terminal className="h-3.5 w-3.5" />
                  <code className="bg-muted px-1.5 py-0.5 rounded">
                    {project.checkCommand}
                  </code>
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
