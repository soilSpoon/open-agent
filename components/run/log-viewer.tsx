"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { IterationLog } from "@/lib/ralph/types";

interface LogViewerProps {
  log: IterationLog;
}

export function LogViewer({ log }: LogViewerProps) {
  // Strip ANSI codes for display if needed, but CSS handles standard ones usually.
  // For safety, we can rely on a library or simple regex if needed, but here we assume raw text.

  return (
    <div className="flex flex-col h-full gap-4">
      <Tabs defaultValue="overview" className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="console">Console Output</TabsTrigger>
            <TabsTrigger value="verification">Verification</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex-1 mt-0">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-6">
              {/* Failure Analysis */}
              {log.failureAnalysis && (
                <Card className="p-4 border-red-200 bg-red-50/10 dark:bg-red-900/10">
                  <div className="flex items-center gap-2 mb-3 text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-5 h-5" />
                    <h3 className="font-semibold">Failure Analysis</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                        Root Cause
                      </div>
                      <p className="text-sm">{log.failureAnalysis.rootCause}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                        Fix Plan
                      </div>
                      <p className="text-sm">{log.failureAnalysis.fixPlan}</p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Summary */}
              {log.summary && (
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Summary
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {log.summary}
                  </p>
                </div>
              )}

              {/* Changes */}
              {log.context?.whatWasDone &&
                log.context.whatWasDone.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                      Implemented Changes
                    </h3>
                    <ul className="space-y-1">
                      {log.context.whatWasDone.map((item) => (
                        <li
                          key={item}
                          className="text-sm flex items-start gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Files Changed */}
              {log.context?.filesChanged &&
                log.context.filesChanged.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                      Files Modified
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {log.context.filesChanged.map((file) => (
                        <Badge
                          key={file}
                          variant="secondary"
                          className="font-mono text-xs"
                        >
                          {file}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent
          value="console"
          className="flex-1 mt-0 min-h-0 border rounded-lg bg-black/90 text-gray-200 p-4 font-mono text-xs"
        >
          <ScrollArea className="h-full">
            <pre className="whitespace-pre-wrap break-all">
              {log.rawOutput || "No console output recorded."}
            </pre>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="verification" className="flex-1 mt-0">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Card className="p-4 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-5 h-5 text-blue-500" />
                    <h3 className="font-semibold">Dual-Gate Status</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">
                        Spec Validation
                      </div>
                      <div className="flex items-center gap-2 font-medium">
                        {log.verificationEvidence?.specValidation?.passed ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span className="text-green-600">Passed</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-red-500" />
                            <span className="text-red-600">Failed</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">
                        Quality Checks
                      </div>
                      <div className="flex items-center gap-2 font-medium">
                        {log.verificationEvidence?.allChecksPassed ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span className="text-green-600">Passed</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-red-500" />
                            <span className="text-red-600">Failed</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {log.verificationEvidence?.checkOutput && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Check Output</h3>
                  <div className="rounded-lg bg-muted p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto">
                    {log.verificationEvidence.checkOutput}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
