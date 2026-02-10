import { ProjectSettings } from "@/features/projects/components/project-settings";

export default function ProjectsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground">
          Manage your AI-powered agentic repositories and their specific
          configurations.
        </p>
      </div>
      <ProjectSettings showHeader={false} />
    </div>
  );
}
