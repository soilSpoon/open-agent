import { use } from "react";
import { ProjectSettings } from "@/features/projects/components/project-settings";

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div className="container mx-auto py-8">
      <ProjectSettings projectId={id} showHeader={false} />
    </div>
  );
}
