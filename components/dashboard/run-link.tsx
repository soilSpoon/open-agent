"use client";

import { Play } from "lucide-react";
import Link from "next/link";

interface RunLinkProps {
  runId: string;
}

export function RunLink({ runId }: RunLinkProps) {
  return (
    <Link
      href={`/runs/${runId}`}
      onClick={(e) => e.stopPropagation()}
      className="text-blue-600 font-medium flex items-center gap-1 hover:underline cursor-pointer z-10"
    >
      <Play className="h-3 w-3" />
      Run #{runId}
    </Link>
  );
}
