"use client";

import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface MobileSidebarProps {
  trigger: React.ReactElement;
  className?: string;
}

export function MobileSidebar({ trigger, className }: MobileSidebarProps) {
  return (
    <Drawer>
      <DrawerTrigger render={trigger} />
      <DrawerContent
        className={cn(
          "bg-background h-full w-[280px] border-r shadow-xl",
          className,
        )}
      >
        <Sidebar className="flex h-full w-full border-none bg-background" />
      </DrawerContent>
    </Drawer>
  );
}
