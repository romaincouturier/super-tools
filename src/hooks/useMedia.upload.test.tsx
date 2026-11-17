import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { useUploadMissionMedia } from "./useMedia";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), insert: vi.fn(), single: vi.fn(), send: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  functions: { invoke: mocks.invoke },
  auth: { getSession: async () => ({ data: { session: { user: { id: "staff" } } } }) },
  from: () => ({ insert: mocks.insert }),
} }));
vi.mock("@/services/uploadProgress", () => ({
  uploadSignedFile: mocks.send, uploadWithProgress: vi.fn(),
}));

describe("vidéos dans les galeries mission", () => {
  it("envoie un MP4 de plus de 5 Mo au stockage sans transmettre son contenu à la fonction mission", async () => {
    mocks.invoke.mockResolvedValue({ data: { path: "mission/id/video.mp4", token: "token", publicUrl: "/video.mp4", bucket: "media" }, error: null });
    mocks.send.mockResolvedValue({});
    mocks.insert.mockReturnValue({ select: () => ({ single: mocks.single }) });
    mocks.single.mockResolvedValue({ data: { id: "saved" }, error: null });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useUploadMissionMedia(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "video.mp4", { type: "video/mp4" });
    const progress = vi.fn();
    await act(async () => {
      const saved = await result.current.mutateAsync({ file, missionId: "mission-id", onProgress: progress });
      expect(saved.id).toBe("saved");
    });
    expect(mocks.invoke.mock.calls.map(c => c[0])).toEqual(["create-media-upload-url"]);
    expect(mocks.send).toHaveBeenCalledWith("media", "mission/id/video.mp4", "token", file, "video/mp4", true, progress);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ source_type: "mission", source_id: "mission-id", file_type: "video", created_by: "staff", file_url: "/video.mp4" }));
  });
});