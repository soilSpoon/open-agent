"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { addRule, deleteRule, updateRule } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface RuleListEditorProps {
  rules: string[];
  ruleType: "apply" | "verification-report";
  projectPath: string;
  onRulesChange: (rules: string[]) => void;
}

export function RuleListEditor({
  rules,
  ruleType,
  projectPath,
  onRulesChange,
}: RuleListEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const newInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(rules[index]);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditValue("");
  };

  const saveEdit = (index: number) => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === rules[index]) {
      cancelEdit();
      return;
    }

    const previousRules = [...rules];
    const updated = [...rules];
    updated[index] = trimmed;

    // Optimistic update
    onRulesChange(updated);
    setEditingIndex(null);
    setEditValue("");

    startTransition(async () => {
      try {
        await updateRule(projectPath, ruleType, index, trimmed);
      } catch {
        // Rollback on error
        onRulesChange(previousRules);
        toast.error("Failed to update rule");
      }
    });
  };

  const handleDelete = (index: number) => {
    if (editingIndex !== null) cancelEdit();

    const previousRules = [...rules];
    const updated = rules.filter((_, i) => i !== index);

    // Optimistic update
    onRulesChange(updated);

    startTransition(async () => {
      try {
        await deleteRule(projectPath, ruleType, index);
      } catch {
        // Rollback on error
        onRulesChange(previousRules);
        toast.error("Failed to delete rule");
      }
    });
  };

  const startAdding = () => {
    setIsAdding(true);
    setNewValue("");
    setTimeout(() => newInputRef.current?.focus(), 0);
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setNewValue("");
  };

  const saveNew = () => {
    const trimmed = newValue.trim();
    if (!trimmed) {
      cancelAdd();
      return;
    }

    const previousRules = [...rules];

    // Optimistic update
    onRulesChange([...rules, trimmed]);
    setNewValue("");
    setIsAdding(false);

    startTransition(async () => {
      try {
        await addRule(projectPath, ruleType, trimmed);
      } catch {
        // Rollback on error
        onRulesChange(previousRules);
        toast.error("Failed to add rule");
      }
    });
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit(index);
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  const handleNewKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveNew();
    } else if (e.key === "Escape") {
      cancelAdd();
    }
  };

  if (rules.length === 0 && !isAdding) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={startAdding}
          className="w-full border-2 border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4 mx-auto mb-1.5" />
          Add your first rule
        </button>
        {isAdding && (
          <div className="flex items-center gap-2 animate-in fade-in">
            <Input
              ref={newInputRef}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={handleNewKeyDown}
              onBlur={saveNew}
              placeholder="Type a rule..."
              className="text-sm"
              disabled={isPending}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={cancelAdd}
              disabled={isPending}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {rules.map((rule, index) => (
        <div
          key={`${index}-${rule.slice(0, 20)}`}
          className={cn(
            "group flex items-start gap-2 rounded-lg border px-3 py-2 transition-colors",
            editingIndex === index
              ? "border-primary/50 bg-primary/5"
              : "hover:bg-muted/50",
            isPending && "opacity-60 pointer-events-none",
          )}
        >
          <span className="text-xs font-mono text-muted-foreground pt-1.5 select-none min-w-[1.5rem] text-right">
            {index + 1}.
          </span>

          {editingIndex === index ? (
            <div className="flex-1 flex items-center gap-1.5">
              <Input
                ref={editInputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => handleEditKeyDown(e, index)}
                onBlur={() => saveEdit(index)}
                className="text-sm h-8"
                disabled={isPending}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-green-600"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => saveEdit(index)}
                disabled={isPending}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onMouseDown={(e) => e.preventDefault()}
                onClick={cancelEdit}
                disabled={isPending}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <>
              <p
                className="flex-1 text-sm pt-1 cursor-pointer"
                onClick={() => startEdit(index)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") startEdit(index);
                }}
              >
                {rule}
              </p>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => startEdit(index)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(index)}
                  disabled={isPending}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </>
          )}
        </div>
      ))}

      {isAdding ? (
        <div className="flex items-center gap-2 pt-1 animate-in fade-in">
          <span className="text-xs font-mono text-muted-foreground min-w-[1.5rem] text-right">
            {rules.length + 1}.
          </span>
          <Input
            ref={newInputRef}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={handleNewKeyDown}
            onBlur={saveNew}
            placeholder="Type a rule..."
            className="text-sm h-8"
            disabled={isPending}
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onMouseDown={(e) => e.preventDefault()}
            onClick={cancelAdd}
            disabled={isPending}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 text-muted-foreground"
          onClick={startAdding}
          disabled={isPending}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add rule
        </Button>
      )}
    </div>
  );
}
