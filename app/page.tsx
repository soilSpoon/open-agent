import { Activity, CheckCircle, FileText, Play } from "lucide-react";
import Link from "next/link";
import { getActiveRuns, getDashboardStats, getRuns } from "@/app/actions";
import { ChangeActions } from "@/components/dashboard/change-actions";
import { NewChangeButton } from "@/components/dashboard/new-change-button";
import { RunActions } from "@/components/dashboard/run-actions";
import { RunLink } from "@/components/dashboard/run-link";
import { ProjectDashboard } from "@/components/dashboard/project-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getChanges } from "@/lib/openspec/service";
import { cn } from "@/lib/utils";

export default async function Dashboard() {
  const [changes, activeRuns, allRuns, stats] = await Promise.all([
    getChanges(),
    getActiveRuns(),
    getRuns(),
    getDashboardStats(),
  ]);

  return (
    <ProjectDashboard>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <NewChangeButton />
        </div>

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
              <div className="text-2xl font-bold">{stats.activeRuns}</div>
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
              <div className="text-2xl font-bold">{stats.completedTasks}</div>
              <p className="text-xs text-gray-500">All time</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <Activity className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.successRate}%</div>
              <p className="text-xs text-gray-500">Overall performance</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
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
                              <span>
                                Updated{" "}
                                {new Date(change.updatedAt).toLocaleDateString()}
                              </span>
                              {runForChange && (
                                <>
                                  <span>•</span>
                                  <RunLink runId={runForChange.id} />
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

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Ralph Runs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {allRuns.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">
                    No runs yet.
                  </div>
                ) : (
                  allRuns.map((run) => (
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
                          {run.status.charAt(0).toUpperCase() +
                            run.status.slice(1)}
                        </span>
                        {run.status === "running" && (
                          <RunActions runId={run.id} />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProjectDashboard>
  );
}
