"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCreateChange } from "@/features/pipeline/api/hooks/use-create-change";

export function NewChangeButton() {
  const router = useRouter();
  const createChangeMutation = useCreateChange();

  const handleCreate = async () => {
    const title = window.prompt("Enter change title (e.g. Add Dark Mode)");
    if (!title) return;

    try {
      const change = await createChangeMutation.mutateAsync(title);
      router.push(`/changes/${change.id}`);
    } catch (error) {
      console.error(error);
      alert("Failed to create change");
    }
  };

  return (
    <Button onClick={handleCreate} disabled={createChangeMutation.isPending}>
      <Plus className="mr-2 h-4 w-4" /> New Change
    </Button>
  );
}
