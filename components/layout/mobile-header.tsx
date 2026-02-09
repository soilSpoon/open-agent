"use client";

import { Menu } from "lucide-react";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function MobileHeader() {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 md:hidden">
      <MobileSidebar
        trigger={
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        }
      />
      <div className="flex-1">
        <h1 className="text-lg font-semibold">OpenAgent</h1>
      </div>
      <ThemeToggle />
    </header>
  );
}
