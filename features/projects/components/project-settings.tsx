"use client";

import {
  ExternalLink,
  Folder,
  Pencil,
  Plus,
  Save,
  Settings2,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { analyzeProject, deleteProject, updateProject } from "@/app/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { useCreateProject } from "@/features/projects/api/hooks/use-create-project";
import { useProjects } from "@/features/projects/api/hooks/use-projects";
import { useProjectStore } from "@/features/projects/stores/project-store";
import type { ProjectConfig } from "@/features/projects/types";
import { ProjectDetail } from "./project-detail";
import { ProjectList } from "./project-list";

export function ProjectSettings({
  projectId,
  showHeader = true,
}: {
  projectId?: string;
  showHeader?: boolean;
}) {
  const router = useRouter();
  const { data: projects = [], isLoading } = useProjects();

  if (isLoading) return null;

  if (projectId) {
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      return (
        <div className="p-8 text-center border-2 border-dashed rounded-xl">
          <p className="text-muted-foreground">
            Project not found (ID: {projectId})
          </p>
          <Button variant="link" onClick={() => router.push("/projects")}>
            Back to Projects
          </Button>
        </div>
      );
    }
    return <ProjectDetail project={project} />;
  }

  return (
    <div className="space-y-6">
      <ProjectList projects={projects} />
    </div>
  );
}
