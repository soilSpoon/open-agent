"use client";

import { AlertCircle, Check, FileQuestion } from "lucide-react";
import { useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  checkCapabilityCoverage,
  parseCapabilities,
} from "@/lib/openspec/capabilities-parser";
import { cn } from "@/lib/utils";

interface CapabilitiesChecklistProps {
  proposalContent: string;
  specFiles: { path: string; name: string }[];
}

export function CapabilitiesChecklist({
  proposalContent,
  specFiles,
}: CapabilitiesChecklistProps) {
  const { capabilities, coverage } = useMemo(() => {
    const caps = parseCapabilities(proposalContent);
    const cov = checkCapabilityCoverage(caps, specFiles);
    return { capabilities: caps, coverage: cov };
  }, [proposalContent, specFiles]);

  const totalCaps =
    capabilities.newCapabilities.length +
    capabilities.modifiedCapabilities.length;

  if (totalCaps === 0) {
    return null;
  }

  const allCovered = coverage.missing.length === 0;

  return (
    <div className="mb-4">
      <Alert
        className={cn(
          allCovered
            ? "bg-green-50 border-green-200"
            : "bg-amber-50 border-amber-200",
        )}
      >
        {allCovered ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <AlertCircle className="h-4 w-4 text-amber-600" />
        )}
        <AlertTitle
          className={allCovered ? "text-green-800" : "text-amber-800"}
        >
          Capabilities Coverage: {coverage.covered.length}/{totalCaps}
        </AlertTitle>
        <AlertDescription>
          <div className="mt-2 space-y-2">
            {coverage.missing.length > 0 && (
              <div className="text-amber-700 text-sm">
                <span className="font-medium">Missing specs:</span>{" "}
                {coverage.missing.map((m) => (
                  <code
                    key={m}
                    className="mx-1 px-1.5 py-0.5 bg-amber-100 rounded text-xs"
                  >
                    {m}
                  </code>
                ))}
              </div>
            )}
            {coverage.extra.length > 0 && (
              <div className="text-blue-700 text-sm flex items-center gap-1">
                <FileQuestion className="h-3 w-3" />
                <span>Extra specs not in proposal:</span>{" "}
                {coverage.extra.map((e) => (
                  <code
                    key={e}
                    className="mx-1 px-1.5 py-0.5 bg-blue-100 rounded text-xs"
                  >
                    {e}
                  </code>
                ))}
              </div>
            )}
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
