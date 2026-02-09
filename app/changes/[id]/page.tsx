import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { getOpenSpecChangeStatus } from "@/app/actions";
import { ProjectDashboard } from "@/components/dashboard/project-dashboard";
import { ChangeDetail } from "@/components/pipeline/change-detail";
import { getChange } from "@/lib/openspec/service";
import { queryKeys } from "@/lib/query/keys";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const queryClient = new QueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.changes.status(id),
      queryFn: () => getOpenSpecChangeStatus(id),
    }),
    queryClient.prefetchQuery({
      queryKey: ["pipeline", "schema"],
      queryFn: () =>
        require("@/lib/openspec/schema-loader").loadOpenSpecSchema(),
    }),
  ]);

  const change = await getChange(id);

  return (
    <ProjectDashboard>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                {change.title}
              </h1>
              <p className="text-sm text-muted-foreground">
                Managed by OpenSpec
              </p>
            </div>
          </div>
          <ChangeDetail change={change} changeId={id} />
        </div>
      </HydrationBoundary>
    </ProjectDashboard>
  );
}
