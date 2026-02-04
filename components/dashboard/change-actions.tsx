"use client";

import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteOpenSpecChange, renameOpenSpecChange } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ChangeActionsProps {
  id: string;
  title: string;
}

export function ChangeActions({ id, title }: ChangeActionsProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  const [showRenameDialog, setShowRenameDialog] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this change?")) return;

    setIsDeleting(true);
    try {
      await deleteOpenSpecChange(id);
      router.refresh();
    } catch (error) {
      console.error("Failed to delete change:", error);
      alert("Failed to delete change");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || newTitle === title) {
      setShowRenameDialog(false);
      return;
    }

    setIsRenaming(true);
    try {
      await renameOpenSpecChange(id, newTitle);
      router.refresh();
      setShowRenameDialog(false);
    } catch (error) {
      console.error("Failed to rename change:", error);
      alert("Failed to rename change");
    } finally {
      setIsRenaming(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "h-8 w-8 p-0",
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setNewTitle(title);
              setShowRenameDialog(true);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename Change</DialogTitle>
            <DialogDescription>
              Enter a new title for this change. This will update the folder
              name.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRename}>
            <div className="grid gap-4 py-4">
              <Input
                id={`name-${id}`}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="col-span-3"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRenameDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isRenaming}>
                {isRenaming && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
