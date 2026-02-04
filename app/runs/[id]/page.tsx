import { RunMonitor } from "@/components/run/run-monitor";

export default async function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Ralph Execution Monitor
        </h1>
        <div className="text-sm text-gray-500">Run ID: {id}</div>
      </div>
      <RunMonitor runId={id} />
    </div>
  );
}
