"use client";

import { useEffect } from "react";

/**
 * WorkerInit is a client component that pings the background worker API.
 * This ensures the worker is started when the application loads.
 */
export function WorkerInit() {
  useEffect(() => {
    fetch("/api/worker").catch(console.error);
  }, []);

  return null;
}
