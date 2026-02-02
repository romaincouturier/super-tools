/**
 * Test Helpers - Utilities for testing
 */
import { vi } from "vitest";
import type { Mock } from "vitest";

/**
 * Create a chainable mock for Supabase queries
 */
export function createSupabaseMock(resolvedData: unknown = null, error: unknown = null) {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: resolvedData, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data: resolvedData, error }),
    then: vi.fn().mockImplementation((callback) =>
      Promise.resolve({ data: resolvedData, error }).then(callback)
    ),
  };

  return mockChain;
}

/**
 * Create a mock Supabase client with predefined responses
 */
export function createMockSupabaseClient(tableResponses: Record<string, unknown> = {}) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn((table: string) => {
      const data = tableResponses[table] ?? null;
      return createSupabaseMock(data);
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  };
}

/**
 * Setup authenticated session mock
 */
export function mockAuthenticatedSession(
  supabaseClient: ReturnType<typeof createMockSupabaseClient>,
  user: { id: string; email: string }
) {
  const session = {
    user,
    access_token: "mock-token",
    refresh_token: "mock-refresh",
    expires_at: Date.now() + 3600000,
  };

  supabaseClient.auth.getSession.mockResolvedValue({
    data: { session },
    error: null,
  });

  supabaseClient.auth.getUser.mockResolvedValue({
    data: { user },
    error: null,
  });

  supabaseClient.auth.onAuthStateChange.mockImplementation((callback: Function) => {
    callback("SIGNED_IN", session);
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });

  return session;
}

/**
 * Wait for all pending promises to resolve
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Create a mock for React Router navigation
 */
export function createNavigateMock(): Mock {
  return vi.fn();
}

/**
 * Wrapper for rendering with providers
 */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";

interface WrapperProps {
  children: React.ReactNode;
}

export function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return function TestWrapper({ children }: WrapperProps) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        TooltipProvider,
        null,
        React.createElement(BrowserRouter, null, children)
      )
    );
  };
}

/**
 * Assert that a function was called with specific arguments
 */
export function expectCalledWith(mockFn: Mock, ...args: unknown[]) {
  expect(mockFn).toHaveBeenCalledWith(...args);
}

/**
 * Create a delayed promise for testing loading states
 */
export function createDelayedPromise<T>(value: T, delay: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), delay));
}
