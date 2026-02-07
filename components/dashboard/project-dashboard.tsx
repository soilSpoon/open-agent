"use client";

import {
  ArrowRight,
  Folder,
  LayoutDashboard,
  Settings2,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getProjects } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { ProjectConfig } from "@/lib/openspec/types";

export function ProjectDashboard({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);

  const loadProjects = useCallback(async () => {
    const dbProjects = await getProjects();
    const mappedProjects = dbProjects.map((p) => ({
      id: p.id,
      name: p.name,
      path: p.path,
      checkCommand: p.checkCommand ?? undefined,
      preCheckCommand: p.preCheckCommand ?? undefined,
    }));
    setProjects(mappedProjects);

    if (mappedProjects.length > 0) {
      const activeId =
        localStorage.getItem("open-agent-active-project") ||
        mappedProjects[0].id;
      setSelectedId(activeId);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleProjectChange = (value: string | null) => {
    if (!value) return;
    setSelectedId(value);
    localStorage.setItem("open-agent-active-project", value);
    // In a real app, we might need to refresh data based on the new project path
    // For now, we'll reload the page to ensure all server actions use the new context
    window.location.reload();
  };

  const activeProject = projects.find((p) => p.id === selectedId);

  if (!isLoaded) return null;

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60svh] space-y-8 animate-in fade-in duration-700">
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full opacity-20 blur-xl animate-pulse" />
          <LayoutDashboard className="h-20 w-20 text-primary relative" />
        </div>
        <div className="text-center space-y-3 max-w-md">
          <h2 className="text-3xl font-bold tracking-tight">
            Welcome to Open Agent
          </h2>
          <p className="text-muted-foreground">
            To start using autonomous Ralph loops, you first need to configure a
            local project repository.
          </p>
        </div>
        <Link href="/settings">
          <Button
            size="lg"
            className="px-8 py-6 text-lg gap-2 group shadow-lg hover:shadow-primary/20 transition-all"
          >
            Setup First Project
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/30 p-4 rounded-2xl border border-muted-foreground/10">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Folder className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Workspace
            </span>
            <Select value={selectedId} onValueChange={handleProjectChange}>
              <SelectTrigger className="w-[240px] border-none bg-transparent p-0 h-auto focus:ring-0 text-base font-bold">
                <span className="truncate">
                  {activeProject?.name || "Select Project"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {activeProject && (
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2 bg-background/50 px-3 py-1.5 rounded-full border border-muted">
              <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
              <code className="text-xs font-mono">
                {activeProject.checkCommand}
              </code>
            </div>
            <div className="hidden lg:flex items-center gap-2 text-muted-foreground px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="truncate max-w-[200px]">
                {activeProject.path}
              </span>
            </div>
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings2 className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        {children}
      </div>
    </div>
  );
}
