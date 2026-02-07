"use client";

import { Play } from "lucide-react";
import { useRouter } from "next/navigation";

interface RunLinkProps {
  runId: string;
}

export function RunLink({ runId }: RunLinkProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/runs/${runId}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-blue-600 font-medium flex items-center gap-1 hover:underline cursor-pointer z-10 bg-transparent border-0 p-0"
    >
      <Play className="h-3 w-3" />
      Run #{runId}
    </button>
  );
}
