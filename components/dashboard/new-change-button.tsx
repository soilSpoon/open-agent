"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { createOpenSpecChange } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function NewChangeButton() {
  const router = useRouter();

  const handleCreate = async () => {
    const title = window.prompt("Enter change title (e.g. Add Dark Mode)");
    if (!title) return;

    try {
      const change = await createOpenSpecChange(title);
      router.push(`/changes/${change.id}`);
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Failed to create change");
    }
  };

  return (
    <Button onClick={handleCreate}>
      <Plus className="mr-2 h-4 w-4" /> New Change
    </Button>
  );
}
