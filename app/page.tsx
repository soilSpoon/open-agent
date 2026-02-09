import {
  Activity,
  ArrowRight,
  CheckCircle,
  FileText,
  Play,
} from "lucide-react";
import Link from "next/link";
import { getActiveRuns, getDashboardStats, getRuns } from "@/app/actions";
import { ChangeActions } from "@/components/dashboard/change-actions";
import { NewChangeButton } from "@/components/dashboard/new-change-button";
import { ProjectDashboard } from "@/components/dashboard/project-dashboard";
import { RunActions } from "@/components/dashboard/run-actions";
import { RunLink } from "@/components/dashboard/run-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getChanges } from "@/lib/openspec/service";
import { cn } from "@/lib/utils";

const DASHBOARD_CHANGES_LIMIT = 5;
const DASHBOARD_RUNS_LIMIT = 5;

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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">
            Dashboard
          </h1>
          <NewChangeButton />
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Changes
              </CardTitle>
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
              <CardTitle className="text-sm font-medium">
                Success Rate
              </CardTitle>
              <Activity className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.successRate}%</div>
              <p className="text-xs text-gray-500">Overall performance</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
          <Card className="col-span-full lg:col-span-4">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Changes</CardTitle>
              {changes.length > DASHBOARD_CHANGES_LIMIT && (
                <Link
                  href="/changes"
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  View All
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {changes.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No changes yet. Create one to get started.
                  </div>
                ) : (
                  changes.slice(0, DASHBOARD_CHANGES_LIMIT).map((change) => {
                    const runForChange = activeRuns.find(
                      (r) => r.change_id === change.id,
                    );

                    return (
                      <Link
                        key={change.id}
                        href={`/changes/${change.id}`}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors relative gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium leading-tight truncate">
                              {change.title}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>
                                Updated{" "}
                                {new Date(
                                  change.updatedAt,
                                ).toLocaleDateString()}
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
                        <div className="flex items-center justify-between sm:justify-end gap-3">
                          <div className="text-right text-xs text-muted-foreground">
                            {
                              Object.values(change.artifacts).filter(
                                (a) => a.exists,
                              ).length
                            }{" "}
                            Artifacts
                          </div>
                          <div
                            className={cn(
                              "px-2 py-0.5 rounded-full text-xs",
                              change.status === "active"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700",
                            )}
                          >
                            {change.status}
                          </div>
                          <div className="lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                            <ChangeActions
                              id={change.id}
                              title={change.title}
                            />
                          </div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-full lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Ralph Runs</CardTitle>
              {allRuns.length > DASHBOARD_RUNS_LIMIT && (
                <Link
                  href="/runs"
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  View All
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {allRuns.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4">
                    No runs yet.
                  </div>
                ) : (
                  allRuns.slice(0, DASHBOARD_RUNS_LIMIT).map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
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
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent",
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
