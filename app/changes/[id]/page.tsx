import { ProjectDashboard } from "@/components/dashboard/project-dashboard";
import { ChangeDetail } from "@/components/pipeline/change-detail";
import { getChange } from "@/lib/openspec/service";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const change = await getChange(id);

  return (
    <ProjectDashboard>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {change.title}
            </h1>
            <p className="text-muted-foreground">Managed by OpenSpec</p>
          </div>
        </div>
        <ChangeDetail change={change} changeId={id} />
      </div>
    </ProjectDashboard>
  );
}
