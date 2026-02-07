import { describe, expect, it } from "bun:test";
import { makeQueryClient } from "./query-client";

describe("makeQueryClient", () => {
  it("should create query client with default options", () => {
    const client = makeQueryClient();

    expect(client).toBeDefined();
    expect(client.getDefaultOptions().queries?.staleTime).toBe(5 * 60 * 1000);
    expect(client.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(
      false,
    );
  });

  it("should create new instance each time (for SSR)", () => {
    const client1 = makeQueryClient();
    const client2 = makeQueryClient();

    // Each call creates new instance for SSR
    expect(client1).not.toBe(client2);
  });
});
