import { Folder, Home, Settings } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Sidebar({ className }: { className?: string }) {
  return (
    <aside className={cn("hidden border-r bg-muted/40 md:block", className)}>
      <div className="flex h-full max-h-svh flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 md:h-[60px] md:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span>OpenAgent</span>
          </Link>
        </div>
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium md:px-4">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/projects"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
            >
              <Folder className="h-4 w-4" />
              Projects
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </nav>
        </div>
      </div>
    </aside>
  );
}
