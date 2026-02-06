"use client";

import { type ReactNode, useCallback, useMemo, useState } from "react";
import { SidebarContext } from "@/lib/sidebar-context";

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({ isOpen, setIsOpen, toggle }),
    [isOpen, toggle],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}
