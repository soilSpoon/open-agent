"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
}

interface TaskSection {
  id: string;
  title: string;
  tasks: TaskItem[];
}

interface TaskVisualEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function TaskVisualEditor({ value, onChange }: TaskVisualEditorProps) {
  const [sections, setSections] = useState<TaskSection[]>([]);

  // Parse Markdown to Structured Data
  useEffect(() => {
    const lines = value.split("\n");
    const newSections: TaskSection[] = [];
    let currentSection: TaskSection | null = null;

    for (const line of lines) {
      const headingMatch = line.match(/^##\s+(.*)/);
      if (headingMatch) {
        currentSection = {
          id: Math.random().toString(36).substr(2, 9),
          title: headingMatch[1],
          tasks: [],
        };
        newSections.push(currentSection);
        continue;
      }

      const taskMatch = line.match(/^-\s+\[(x|\s)\]\s+(.*)/i);
      if (taskMatch && currentSection) {
        currentSection.tasks.push({
          id: Math.random().toString(36).substr(2, 9),
          completed: taskMatch[1].toLowerCase() === "x",
          text: taskMatch[2],
        });
      }
    }

    if (newSections.length === 0 && value.trim() !== "") {
      // Fallback or handle non-conforming markdown
    }

    setSections(newSections);
  }, [value]);

  // Serialize Structured Data back to Markdown
  const serialize = (updatedSections: TaskSection[]) => {
    const markdown = updatedSections
      .map((s) => {
        const tasksMd = s.tasks
          .map((t) => `- [${t.completed ? "x" : " "}] ${t.text}`)
          .join("\n");
        return `## ${s.title}\n\n${tasksMd}`;
      })
      .join("\n\n");
    onChange(markdown);
  };

  const addSection = () => {
    const newSections = [
      ...sections,
      { id: Date.now().toString(), title: "New Section", tasks: [] },
    ];
    setSections(newSections);
    serialize(newSections);
  };

  const removeSection = (id: string) => {
    const newSections = sections.filter((s) => s.id !== id);
    setSections(newSections);
    serialize(newSections);
  };

  const updateSectionTitle = (id: string, title: string) => {
    const newSections = sections.map((s) =>
      s.id === id ? { ...s, title } : s,
    );
    setSections(newSections);
    serialize(newSections);
  };

  const addTask = (sectionId: string) => {
    const newSections = sections.map((s) => {
      if (s.id === sectionId) {
        return {
          ...s,
          tasks: [
            ...s.tasks,
            { id: Date.now().toString(), text: "", completed: false },
          ],
        };
      }
      return s;
    });
    setSections(newSections);
    serialize(newSections);
  };

  const updateTask = (
    sectionId: string,
    taskId: string,
    updates: Partial<TaskItem>,
  ) => {
    const newSections = sections.map((s) => {
      if (s.id === sectionId) {
        return {
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, ...updates } : t,
          ),
        };
      }
      return s;
    });
    setSections(newSections);
    serialize(newSections);
  };

  const removeTask = (sectionId: string, taskId: string) => {
    const newSections = sections.map((s) => {
      if (s.id === sectionId) {
        return {
          ...s,
          tasks: s.tasks.filter((t) => t.id !== taskId),
        };
      }
      return s;
    });
    setSections(newSections);
    serialize(newSections);
  };

  return (
    <div className="flex flex-col gap-6 p-4 bg-gray-50/50 min-h-full">
      {sections.map((section) => (
        <div
          key={section.id}
          className="bg-white border rounded-xl shadow-sm overflow-hidden"
        >
          <div className="bg-gray-50/80 px-4 py-3 border-b flex items-center justify-between group">
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={section.title}
                onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                className="font-bold text-lg bg-transparent border-none focus-visible:ring-0 p-0 h-auto"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeSection(section.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4 space-y-3">
            {section.tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 group">
                <Input
                  value={task.text}
                  onChange={(e) =>
                    updateTask(section.id, task.id, { text: e.target.value })
                  }
                  className={cn(
                    "flex-1 border-none focus-visible:ring-0 p-0 h-auto",
                    task.completed && "line-through text-muted-foreground",
                  )}
                  placeholder="Task description..."
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeTask(section.id, task.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-primary mt-2 border-dashed border h-9"
              onClick={() => addTask(section.id)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>
        </div>
      ))}

      <Button
        variant="outline"
        className="border-dashed py-8 border-2 flex flex-col gap-2 h-auto hover:bg-white hover:border-primary hover:text-primary transition-all"
        onClick={addSection}
      >
        <Plus className="h-6 w-6" />
        <span className="font-semibold text-base">Add New Section</span>
      </Button>
    </div>
  );
}
