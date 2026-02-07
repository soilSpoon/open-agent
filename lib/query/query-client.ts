import { QueryClient } from "@tanstack/react-query";

const defaultOptions = {
  queries: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  },
};

/** Create a new QueryClient instance (for SSR) */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions,
  });
}

let browserQueryClient: QueryClient | null = null;

/** Get or create QueryClient singleton (for browser) */
export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: always create new instance
    return makeQueryClient();
  }

  // Browser: reuse singleton
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
