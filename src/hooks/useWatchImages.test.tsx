import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { useWatchImages } from "./useWatchImages";

const mocks = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock("@/services/watchImages", () => ({ uploadWatchImage: mocks.upload, watchImageError: () => null }));

describe("images multiples d’un élément de veille", () => {
  it("envoie deux images au même élément et conserve uniquement la seconde après un échec pour réessayer", async () => {
    const client = new QueryClient();
    const { result } = renderHook(() => useWatchImages(), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
    act(() => result.current.select([new File(["a"], "a.png"), new File(["b"], "b.png")]));
    mocks.upload.mockResolvedValueOnce({ id: "first" }).mockRejectedValueOnce(new Error("Interruption"));
    await act(async () => { await expect(result.current.upload("watch-id")).rejects.toThrow("Interruption"); });
    expect(mocks.upload.mock.calls.map(([id, image]) => [id, image.file.name])).toEqual([["watch-id", "a.png"], ["watch-id", "b.png"]]);
    expect(result.current.images.map((image) => image.file.name)).toEqual(["b.png"]);
    expect(result.current.progress).toEqual(expect.objectContaining({ done: 1, total: 2, failed: 1 }));
    mocks.upload.mockResolvedValueOnce({ id: "second" });
    await act(async () => { await result.current.upload("watch-id"); });
    expect(result.current.images).toEqual([]);
    expect(mocks.upload).toHaveBeenCalledTimes(3);
  });
});