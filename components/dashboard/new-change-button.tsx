"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateChange } from "@/features/pipeline/api/hooks/use-create-change";

export function NewChangeButton() {
  const router = useRouter();
  const createChangeMutation = useCreateChange();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const change = await createChangeMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
      });
      setOpen(false);
      setTitle("");
      setDescription("");
      router.push(`/changes/${change.id}`);
    } catch (error) {
      console.error(error);
      alert("Failed to create change");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Change
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleCreate}>
          <DialogHeader>
            <DialogTitle>Create New Change</DialogTitle>
            <DialogDescription>
              새로운 변경사항을 추가합니다. 제목과 설명을 입력하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">제목</Label>
              <Input
                id="title"
                placeholder="예: Add Dark Mode"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">설명 (선택)</Label>
              <Textarea
                id="description"
                placeholder="변경사항에 대한 자세한 설명, 배경, 목표 등을 적어주세요..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || createChangeMutation.isPending}
            >
              {createChangeMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              생성
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
