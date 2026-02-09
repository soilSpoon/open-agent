import Link from "next/link";
import { getRuns } from "@/app/actions";
import { RunActions } from "@/components/dashboard/run-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function RunsPage() {
  const runs = await getRuns();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Ralph Runs</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {runs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No runs yet.
              </div>
            ) : (
              runs.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/runs/${run.id}`}
                        className="font-medium hover:underline text-blue-600"
                      >
                        #{run.id}
                      </Link>
                      {run.change_id && (
                        <Link
                          href={`/changes/${run.change_id}`}
                          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                        >
                          ({run.change_id})
                        </Link>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Task {run.progress}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent",
                        run.status === "running"
                          ? "bg-blue-100 text-blue-800"
                          : run.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800",
                      )}
                    >
                      {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                    </span>
                    {run.status === "running" && <RunActions runId={run.id} />}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
