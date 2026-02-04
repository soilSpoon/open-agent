"use client";

import { Loader2, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { stopRalphRun } from "@/app/actions";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface RunActionsProps {
  runId: string;
}

export function RunActions({ runId }: RunActionsProps) {
  const router = useRouter();
  const [isStopping, setIsStopping] = useState(false);

  async function handleStop(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to stop this run?")) return;

    setIsStopping(true);
    try {
      await stopRalphRun(runId);
      router.refresh();
    } catch (error) {
      console.error("Failed to stop run:", error);
      alert("Failed to stop run");
    } finally {
      setIsStopping(false);
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50",
          )}
          onClick={handleStop}
          disabled={isStopping}
        >
          {isStopping ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Square className="h-4 w-4 fill-current" />
          )}
          <span className="sr-only">Stop Run</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Stop Run</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
