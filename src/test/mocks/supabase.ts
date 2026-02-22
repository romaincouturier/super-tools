import { vi } from "vitest";

// Chainable query builder mock
function createQueryBuilder(resolvedData: unknown = null, resolvedError: unknown = null) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const chainMethods = [
    "select", "insert", "update", "delete", "upsert",
    "eq", "neq", "in", "is", "order", "limit", "single", "maybeSingle",
    "filter", "match", "not", "or", "contains", "overlaps",
    "textSearch", "range", "gt", "gte", "lt", "lte",
  ];

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  // Terminal methods that return data
  builder.then = vi.fn().mockImplementation((resolve) =>
    resolve({ data: resolvedData, error: resolvedError })
  );

  // Make it thenable (for await)
  const proxy = new Proxy(builder, {
    get(target, prop) {
      if (prop === "then") {
        return (resolve: (value: unknown) => void) =>
          resolve({ data: resolvedData, error: resolvedError });
      }
      return target[prop as string];
    },
  });

  return proxy;
}

export function createMockSupabaseClient() {
  const mockAuth = {
    getSession: vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };

  const mockStorage = {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://example.com/file.pdf" } }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    }),
  };

  const mockFunctions = {
    invoke: vi.fn().mockResolvedValue({ data: {}, error: null }),
  };

  const mockClient = {
    auth: mockAuth,
    storage: mockStorage,
    functions: mockFunctions,
    from: vi.fn().mockReturnValue(createQueryBuilder()),
  };

  return mockClient;
}

// Helper to configure mock responses for specific tables
export function mockSupabaseFrom(
  client: ReturnType<typeof createMockSupabaseClient>,
  table: string,
  data: unknown = [],
  error: unknown = null
) {
  const builder = createQueryBuilder(data, error);
  client.from.mockImplementation((t: string) => {
    if (t === table) return builder;
    return createQueryBuilder();
  });
  return builder;
}
