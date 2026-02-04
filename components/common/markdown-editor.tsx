"use client";

import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import {
  type InitialConfigType,
  LexicalComposer,
} from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

const theme = {
  paragraph: "mb-2",
  text: {
    bold: "font-bold",
    italic: "italic",
    strikethrough: "line-through",
    underline: "underline",
  },
  list: {
    ul: "list-disc ml-6",
    ol: "list-decimal ml-6",
    listitem: "mb-1",
  },
  heading: {
    h1: "text-2xl font-bold mb-4",
    h2: "text-xl font-bold mb-3",
    h3: "text-lg font-bold mb-2",
  },
  code: "bg-muted p-1 rounded font-mono text-sm",
  quote: "border-l-4 border-primary pl-4 italic bg-muted/30 py-1",
  banner: {
    info: "bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 text-blue-800",
    warning: "bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-4 text-yellow-800",
    error: "bg-red-50 border-l-4 border-red-500 p-4 mb-4 text-red-800",
  },
};

function onError(error: Error) {
  console.error(error);
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readonly?: boolean;
  className?: string;
  type?: "proposal" | "specs" | "design" | "tasks";
}

function InitialValuePlugin({ value }: { value: string }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.update(() => {
      const currentMarkdown = $convertToMarkdownString(TRANSFORMERS);
      if (currentMarkdown !== value) {
        $convertFromMarkdownString(value, TRANSFORMERS);
      }
    });
  }, [value, editor]);
  return null;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write something...",
  readonly = false,
  className,
  type,
}: MarkdownEditorProps) {
  const initialConfig: InitialConfigType = {
    namespace: `MarkdownEditor-${type || "default"}`,
    theme,
    onError,
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      CodeNode,
      CodeHighlightNode,
      TableNode,
      TableCellNode,
      TableRowNode,
      LinkNode,
      AutoLinkNode,
    ],
    editable: !readonly,
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        className={cn(
          "relative flex-1 flex flex-col group",
          type === "tasks" && "tasks-editor",
          type === "design" && "design-editor",
          className,
        )}
      >
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className={cn(
                "outline-none flex-1 p-4 min-h-[400px]",
                type === "tasks" && "font-sans",
                type === "specs" && "font-mono text-sm",
              )}
            />
          }
          placeholder={
            <div className="absolute top-4 left-4 text-muted-foreground pointer-events-none text-sm">
              {placeholder}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <CheckListPlugin />
        <TablePlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <InitialValuePlugin value={value} />
        <OnChangePlugin
          onChange={(editorState) => {
            editorState.read(() => {
              const markdown = $convertToMarkdownString(TRANSFORMERS);
              onChange(markdown);
            });
          }}
        />
      </div>
    </LexicalComposer>
  );
}
