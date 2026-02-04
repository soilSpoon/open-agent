import { Activity, CheckCircle, FileText, Play } from "lucide-react";
import Link from "next/link";
import { getActiveRuns } from "@/app/actions";
import { ChangeActions } from "@/components/dashboard/change-actions";
import { NewChangeButton } from "@/components/dashboard/new-change-button";
import { RunActions } from "@/components/dashboard/run-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getChanges } from "@/lib/openspec/service";

export default async function Dashboard() {
  const [changes, activeRuns] = await Promise.all([
    getChanges(),
    getActiveRuns(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <NewChangeButton />
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Changes</CardTitle>
            <FileText className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{changes.length}</div>
            <p className="text-xs text-gray-500">Managed by OpenSpec</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Ralph Loops
            </CardTitle>
            <Play className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeRuns.length}</div>
            <p className="text-xs text-gray-500">Running now</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completed Tasks
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156</div>
            <p className="text-xs text-green-600">+12% from last week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Activity className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94.2%</div>
            <p className="text-xs text-red-500">-2% from last week</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Changes (Left 4 cols) */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {changes.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No changes yet. Create one to get started.
                </div>
              ) : (
                changes.map((change) => {
                  // Find active run for this change if exists
                  const runForChange = activeRuns.find(
                    (r) => r.change_id === change.id,
                  );

                  return (
                    <Link
                      key={change.id}
                      href={`/changes/${change.id}`}
                      className="group flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors relative"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-lg">{change.title}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>ID: {change.id}</span>
                            <span>•</span>
                            <span>
                              Updated{" "}
                              {new Date(change.updatedAt).toLocaleDateString()}
                            </span>
                            {runForChange && (
                              <>
                                <span>•</span>
                                <span className="text-blue-600 font-medium flex items-center gap-1">
                                  <Play className="h-3 w-3" />
                                  Run #{runForChange.id}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm text-gray-500">
                          {
                            Object.values(change.artifacts).filter(
                              (a) => a.exists,
                            ).length
                          }{" "}
                          Artifacts
                        </div>
                        <div
                          className={`px-2 py-1 rounded-full text-xs ${
                            change.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {change.status}
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChangeActions id={change.id} title={change.title} />
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active Ralph Runs (Right 3 cols) */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Active Ralph Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeRuns.length === 0 ? (
                <div className="text-center text-gray-500 py-4">
                  No active runs.
                </div>
              ) : (
                activeRuns.map((run) => (
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
                            className="text-xs text-gray-500 hover:text-gray-900 hover:underline"
                          >
                            ({run.change_id})
                          </Link>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Task {run.progress}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-blue-100 text-blue-800">
                        Running
                      </span>
                      <RunActions runId={run.id} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
