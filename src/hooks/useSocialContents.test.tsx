import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { SocialContentGroup } from "@/services/socialContents";

const h = vi.hoisted(() => ({ setGroupDate: vi.fn(), createTheme: vi.fn(), updateTheme: vi.fn(), deleteTheme: vi.fn() }));
vi.mock("@/services/socialContents", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/socialContents")>()),
  setGroupDate: h.setGroupDate,
  createTheme: h.createTheme,
  updateTheme: h.updateTheme,
  deleteTheme: h.deleteTheme,
  listUndatedGroups: vi.fn(() => new Promise(() => {})),
  listGroupsInRange: vi.fn(() => new Promise(() => {})),
}));

import {
  useCreateSocialTheme,
  useDeleteSocialTheme,
  useSetSocialGroupDate,
  useUpdateSocialTheme,
} from "./useSocialContents";

const draft: SocialContentGroup = {
  id: "g", format: "post", sync: true, theme_id: null, created_by: null, created_at: "", updated_at: "",
  posts: [{ id: "p", group_id: "g", channel_id: "li", text: "t", scheduled_at: null, publication_status: "unscheduled", media_id: null }],
};

const dated: SocialContentGroup = {
  ...draft, id: "d",
  posts: [{ id: "q", group_id: "d", channel_id: "li", text: "t", scheduled_at: "2026-11-03T17:00:00.000Z", publication_status: "scheduled", media_id: null }],
};
const RANGE = ["social-contents", "range", "2026-10-25T23:00:00.000Z", "2026-12-06T23:00:00.000Z"];

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  qc.setQueryData(["social-contents", "undated"], [draft]);
  qc.setQueryData(RANGE, [dated]);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, ...renderHook(() => useSetSocialGroupDate(), { wrapper }) };
}

describe("useSetSocialGroupDate", () => {
  it("date le groupe en cache avant la réponse du serveur", async () => {
    let resolve: () => void = () => {};
    h.setGroupDate.mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    const { qc, result } = setup();
    act(() => { result.current.mutate({ groupId: "g", scheduledAt: "2026-11-12T08:00:00.000Z" }); });
    await waitFor(() => {
      const cached = qc.getQueryData<SocialContentGroup[]>(["social-contents", "undated"]);
      expect(cached?.[0].posts[0]).toMatchObject({ scheduled_at: "2026-11-12T08:00:00.000Z", publication_status: "scheduled" });
    });
    act(() => { result.current.mutate({ groupId: "d", scheduledAt: "2026-11-10T17:00:00.000Z" }); });
    await waitFor(() => {
      expect(qc.getQueryData<SocialContentGroup[]>(RANGE)?.[0].posts[0].scheduled_at).toBe("2026-11-10T17:00:00.000Z");
    });
    expect(h.setGroupDate).toHaveBeenCalledTimes(2);
    resolve();
  });

  it("revient à l'état précédent si l'écriture échoue", async () => {
    h.setGroupDate.mockRejectedValue(new Error("refus"));
    const { qc, result } = setup();
    act(() => { result.current.mutate({ groupId: "g", scheduledAt: "2026-11-12T08:00:00.000Z" }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData<SocialContentGroup[]>(["social-contents", "undated"])?.[0].posts[0]).toMatchObject({
      scheduled_at: null, publication_status: "unscheduled",
    });
  });

  it("revient à l'état précédent d'une plage du calendrier si l'écriture échoue", async () => {
    h.setGroupDate.mockRejectedValue(new Error("refus"));
    const { qc, result } = setup();
    act(() => { result.current.mutate({ groupId: "d", scheduledAt: "2026-11-10T17:00:00.000Z" }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData<SocialContentGroup[]>(RANGE)?.[0].posts[0]).toMatchObject({
      scheduled_at: "2026-11-03T17:00:00.000Z", publication_status: "scheduled",
    });
  });
});

describe("mutations des thèmes", () => {
  function setupTheme<T>(hook: () => T) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    return { invalidate, ...renderHook(hook, { wrapper }) };
  }
  const keys = (invalidate: ReturnType<typeof vi.spyOn>) =>
    invalidate.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);

  it("la suppression invalide les thèmes et les contenus", async () => {
    h.deleteTheme.mockResolvedValue(undefined);
    const { invalidate, result } = setupTheme(() => useDeleteSocialTheme());
    await act(async () => { await result.current.mutateAsync("t1"); });
    expect(h.deleteTheme).toHaveBeenCalledWith("t1", expect.anything());
    expect(keys(invalidate)).toEqual(expect.arrayContaining([["social-themes"], ["social-contents"]]));
  });

  it("la création invalide les thèmes", async () => {
    h.createTheme.mockResolvedValue({ id: "t1", name: "IA", color: "#3b82f6" });
    const { invalidate, result } = setupTheme(() => useCreateSocialTheme());
    await act(async () => { await result.current.mutateAsync({ name: "IA", color: "#3b82f6" }); });
    expect(keys(invalidate)).toEqual([["social-themes"]]);
  });

  it("la modification invalide les thèmes, même en cas d'échec", async () => {
    h.updateTheme.mockRejectedValue(new Error("refus"));
    const { invalidate, result } = setupTheme(() => useUpdateSocialTheme());
    await act(async () => { await result.current.mutateAsync({ id: "t1", name: "IA" }).catch(() => {}); });
    expect(h.updateTheme).toHaveBeenCalledWith("t1", { name: "IA" });
    expect(keys(invalidate)).toEqual([["social-themes"]]);
  });
});
