"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import type { FixResult } from "@/app/actions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import type { ArtifactType } from "@/lib/openspec/types";

interface ValidationStatusProps {
  validation: {
    valid: boolean;
    errors: string[];
  } | null;
  isLoading?: boolean;
  fixing: boolean;
  onFix: () => Promise<FixResult | undefined>;
  onNavigate?: (type: ArtifactType, filePath?: string) => void;
  stage?: ArtifactType;
}

export function ValidationStatus({
  validation,
  isLoading,
  fixing,
  onFix,
  onNavigate,
  stage,
}: ValidationStatusProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [lastFixResult, setLastFixResult] = useState<FixResult | null>(null);

  if (isLoading) {
    return (
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!validation && !lastFixResult) return null;

  // Validation is now valid, but we might have just finished a fix
  if (validation?.valid && !lastFixResult) {
    return (
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-green-200 bg-green-50/50 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600 shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-green-800">All Valid</h3>
            <p className="text-sm text-green-700">
              Change is valid and ready for next steps.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleFixClick = async () => {
    const result = await onFix();
    if (result?.success) {
      setLastFixResult(result);
      // Automatically clear the fix report after some time if valid
      if (validation?.valid) {
        setTimeout(() => setLastFixResult(null), 10000);
      }
    }
  };

  // Filter out "No deltas found" error as it's common during initial drafting
  const filteredErrors =
    validation?.errors?.filter((err) => !err.includes("No deltas found")) || [];

  const isEffectiveValid = validation?.valid || filteredErrors.length === 0;
  const effectiveErrorCount = filteredErrors.length;

  const isFixReportVisible =
    lastFixResult && lastFixResult.modifiedFiles.length > 0;

  if (isEffectiveValid && !lastFixResult) {
    return (
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-green-200 bg-green-50/50 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600 shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-green-800">
              {stage === "proposal" &&
              validation?.errors?.some((e) => e.includes("No deltas found"))
                ? "Proposal in Progress"
                : "All Valid"}
            </h3>
            <p className="text-sm text-green-700">
              {stage === "proposal" &&
              validation?.errors?.some((e) => e.includes("No deltas found"))
                ? "Syntactic validation passed. Ready to define specs next."
                : "Change is valid and ready for next steps."}
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-destructive/20 bg-destructive/5 shadow-sm">
      <div className="max-w-4xl mx-auto px-4">
        {/* Fix Summary Report (Visible after a fix) */}
        {isFixReportVisible && (
          <div className="py-3 px-4 mb-2 mt-2 bg-blue-50 border border-blue-200 rounded-lg animate-in fade-in slide-in-from-top-2">
            <h4 className="text-sm font-bold text-blue-800 flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4" />
              AI fixed {lastFixResult.modifiedFiles.length} file(s)
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 text-xs text-blue-600 hover:text-blue-800"
                onClick={() => setLastFixResult(null)}
              >
                Dismiss
              </Button>
            </h4>
            <ul className="space-y-1">
              {lastFixResult.modifiedFiles.map((file) => (
                <li
                  key={`${file.type}-${file.filePath || ""}`}
                  className="text-xs text-blue-700 flex items-center gap-2"
                >
                  <ChevronRight className="h-3 w-3" />
                  <button
                    type="button"
                    className="font-mono bg-blue-100 px-1 rounded hover:bg-blue-200 transition-colors cursor-pointer text-left"
                    onClick={() => onNavigate?.(file.type, file.filePath)}
                  >
                    {file.filePath || file.type}
                  </button>
                  <span className="opacity-80">— {file.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {validation && !isEffectiveValid && (
          <Accordion
            type="single"
            collapsible
            defaultValue={["errors"]}
            onValueChange={(val) => setIsOpen(val.length > 0)}
            className="border-none"
          >
            <AccordionItem value="errors" className="border-none">
              <div className="flex items-center gap-3 py-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-destructive/10 text-destructive shrink-0">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-destructive flex items-center gap-2">
                        Change Validation Failed
                        <span className="inline-flex items-center justify-center bg-destructive text-destructive-foreground text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px]">
                          {effectiveErrorCount}
                        </span>
                      </h3>
                      {!isOpen && (
                        <p className="text-sm text-destructive/80 truncate">
                          {filteredErrors[0]}
                          {effectiveErrorCount > 1 &&
                            ` (+${effectiveErrorCount - 1} more)`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-destructive/20 bg-white hover:bg-destructive/5 text-destructive hover:text-destructive shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFixClick();
                        }}
                        disabled={fixing}
                      >
                        {fixing ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Wand2 className="mr-2 h-3.5 w-3.5" />
                        )}
                        Auto Fix
                      </Button>
                      <AccordionTrigger className="hover:no-underline py-0 pr-0 pl-2">
                        <span className="sr-only">Toggle details</span>
                      </AccordionTrigger>
                    </div>
                  </div>
                </div>
              </div>

              <AccordionContent>
                <div className="pl-11 pb-4 pr-4">
                  <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    <ul className="space-y-2 text-sm text-destructive/90">
                      {filteredErrors.map((err, i) => (
                        <li
                          key={`${i}-${err.substring(0, 10)}`}
                          className="flex gap-2 items-start bg-white/50 p-2 rounded border border-destructive/10"
                        >
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                          <span className="leading-relaxed">{err}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>
    </div>
  );
}
