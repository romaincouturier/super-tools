import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const resolveStorageUrl = vi.fn();
vi.mock("@/lib/storageUrl", async (orig) => ({
  ...(await orig<typeof import("@/lib/storageUrl")>()),
  resolveStorageUrl: (url: string) => resolveStorageUrl(url),
}));

import { useResolvedStorageUrl } from "./useResolvedStorageUrl";

const base = "https://x.supabase.co/storage/v1/object/public";

describe("useResolvedStorageUrl", () => {
  beforeEach(() => resolveStorageUrl.mockReset());

  it("rend une URL de bucket public telle quelle, sans signature", () => {
    const url = `${base}/media/a.jpg`;
    const { result } = renderHook(() => useResolvedStorageUrl(url));
    expect(result.current).toBe(url);
    expect(resolveStorageUrl).not.toHaveBeenCalled();
  });

  it("ne rend pas l'URL publique d'un bucket privé avant sa signature", async () => {
    const url = `${base}/book-productions/u/a.jpg`;
    resolveStorageUrl.mockResolvedValue("signed-a");
    const { result } = renderHook(() => useResolvedStorageUrl(url));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe("signed-a"));
  });

  it("réutilise la signature au montage suivant", async () => {
    const url = `${base}/book-productions/u/b.jpg`;
    resolveStorageUrl.mockResolvedValue("signed-b");
    const first = renderHook(() => useResolvedStorageUrl(url));
    await waitFor(() => expect(first.result.current).toBe("signed-b"));
    const second = renderHook(() => useResolvedStorageUrl(url));
    expect(second.result.current).toBe("signed-b");
    expect(resolveStorageUrl).toHaveBeenCalledTimes(1);
  });
});
