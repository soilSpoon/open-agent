"use client";

import { File, Folder } from "lucide-react";
import { MarkdownEditor } from "@/components/common/markdown-editor";
import type { SpecEntry } from "@/lib/openspec/types";
import { cn } from "@/lib/utils";
import { CapabilitiesChecklist } from "./capabilities-checklist";

interface SpecsEditorProps {
  files: SpecEntry[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  content: string;
  onChangeContent: (value: string) => void;
  placeholder?: string;
  className?: string;
  proposalContent?: string;
}

export function SpecsEditor({
  files,
  selectedFile,
  onSelectFile,
  content,
  onChangeContent,
  placeholder,
  className,
  proposalContent,
}: SpecsEditorProps) {
  return (
    <div className="flex flex-col flex-1 h-full min-h-[500px]">
      {proposalContent && (
        <CapabilitiesChecklist
          proposalContent={proposalContent}
          specFiles={files}
        />
      )}
      <div
        className={cn(
          "flex flex-1 border rounded-md overflow-hidden",
          className,
        )}
      >
      {/* Sidebar */}
      <div className="w-64 bg-gray-50/50 border-r flex flex-col overflow-y-auto">
        <div className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Files
        </div>
        <div className="flex-1">
          {files.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground italic">
              No specs found
            </div>
          ) : (
            <ul className="space-y-0.5 p-2">
              {files.map((file) => (
                <li key={file.path}>
                  <button
                    type="button"
                    onClick={() => onSelectFile(file.path)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors text-left",
                      selectedFile === file.path
                        ? "bg-white text-blue-600 shadow-sm font-medium border border-gray-200"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                    )}
                  >
                    {file.type === "directory" ? (
                      <Folder className="h-4 w-4 text-blue-400 shrink-0" />
                    ) : (
                      <File className="h-4 w-4 text-gray-400 shrink-0" />
                    )}
                    <span className="truncate">{file.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col bg-white overflow-y-auto">
        {selectedFile ? (
          <MarkdownEditor
            value={content}
            onChange={onChangeContent}
            placeholder={placeholder}
            className="flex-1"
            type="specs"
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
            <Folder className="h-8 w-8 text-gray-300" />
            <p>Select a file to edit</p>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
