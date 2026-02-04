import { Code, FileText, ListTodo, Palette, Plus } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getChanges } from "@/lib/openspec/service";

export default async function ChangesPage() {
  const changes = await getChanges();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Changes</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> New Change
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {changes.map((change) => (
          <Link key={change.id} href={`/changes/${change.id}`}>
            <Card className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium truncate pr-4">
                  {change.title}
                </CardTitle>
                <Badge
                  variant={change.status === "active" ? "default" : "secondary"}
                >
                  {change.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-4">
                  Updated {new Date(change.updatedAt).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2">
                  <ArtifactIcon
                    type="proposal"
                    active={change.artifacts.proposal.exists}
                    label="Proposal"
                  />
                  <ArtifactIcon
                    type="specs"
                    active={change.artifacts.specs.exists}
                    label="Specs"
                  />
                  <ArtifactIcon
                    type="design"
                    active={change.artifacts.design.exists}
                    label="Design"
                  />
                  <ArtifactIcon
                    type="tasks"
                    active={change.artifacts.tasks.exists}
                    label="Tasks"
                  />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {changes.length === 0 && (
          <div className="col-span-full text-center py-12 border-2 border-dashed rounded-lg text-gray-500">
            <p className="mb-4">No changes found.</p>
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" /> Create your first change
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

import { type ArtifactType, ArtifactTypeSchema } from "@/lib/openspec/types";

function ArtifactIcon({
  type,
  active,
  label,
}: {
  type: string;
  active: boolean;
  label: string;
}) {
  const icons: Record<ArtifactType, typeof FileText> = {
    proposal: FileText,
    specs: Code,
    design: Palette,
    tasks: ListTodo,
  };

  const parsedType = ArtifactTypeSchema.safeParse(type);
  const Icon = parsedType.success ? icons[parsedType.data] : FileText;

  return (
    <div
      className={`p-2 rounded-md flex items-center justify-center ${active ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-300"}`}
      title={label}
    >
      <Icon className="h-4 w-4" />
    </div>
  );
}
