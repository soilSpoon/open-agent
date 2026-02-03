// This file exists to isolate the metadata export from the root layout component
// to satisfy Fast Refresh requirements (avoiding useComponentExportOnlyModules)

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OpenAgent",
  description: "AI Agent Orchestrator",
};
