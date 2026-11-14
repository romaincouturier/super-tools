import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { SocialCalendarNote, SocialContentGroup } from "@/services/socialContents";

const h = vi.hoisted(() => ({
  setGroupDate: vi.fn(), createTheme: vi.fn(), updateTheme: vi.fn(), deleteTheme: vi.fn(),
  setPostPublished: vi.fn(), updatePublishedPost: vi.fn(), deletePost: vi.fn(), deleteGroup: vi.fn(),
  createNote: vi.fn(), updateNote: vi.fn(), deleteNote: vi.fn(), listNotesInRange: vi.fn(),
}));
vi.mock("@/services/socialContents", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/socialContents")>()),
  setGroupDate: h.setGroupDate,
  createTheme: h.createTheme,
  updateTheme: h.updateTheme,
  deleteTheme: h.deleteTheme,
  setPostPublished: h.setPostPublished,
  updatePublishedPost: h.updatePublishedPost,
  deletePost: h.deletePost,
  deleteGroup: h.deleteGroup,
  createNote: h.createNote,
  updateNote: h.updateNote,
  deleteNote: h.deleteNote,
  listNotesInRange: h.listNotesInRange,
  listUndatedGroups: vi.fn(() => new Promise(() => {})),
  listGroupsInRange: vi.fn(() => new Promise(() => {})),
}));

import {
  useCreateSocialNote,
  useCreateSocialTheme,
  useDeleteSocialNote,
  useSocialCalendarNotes,
  useUpdateSocialNote,
  useDeleteSocialGroup,
  useDeleteSocialPost,
  useDeleteSocialTheme,
  useSetSocialGroupDate,
  useSetSocialPostPublished,
  useUpdatePublishedSocialPost,
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
      expect(cached?.[0].posts[0]).toMatchObject({ scheduled_at: "2026-11-12T08:00:00.000Z", publication_status: "unscheduled" });
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

describe("mutations du marquage publié et de la suppression", () => {
  function setupMutation<T>(hook: () => T) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    return { invalidate, ...renderHook(hook, { wrapper }) };
  }
  const keys = (invalidate: ReturnType<typeof vi.spyOn>) =>
    invalidate.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);

  it("le marquage invalide les contenus, même en cas d'échec", async () => {
    h.setPostPublished.mockRejectedValue(new Error("refus"));
    const { invalidate, result } = setupMutation(() => useSetSocialPostPublished());
    await act(async () => { await result.current.mutateAsync({ postId: "p", published: true }).catch(() => {}); });
    expect(h.setPostPublished).toHaveBeenCalledWith("p", true);
    expect(keys(invalidate)).toEqual([["social-contents"]]);
  });

  it("l'édition et les suppressions invalident les contenus même en cas d'échec", async () => {
    h.updatePublishedPost.mockRejectedValue(new Error("refus"));
    h.deletePost.mockRejectedValue(new Error("refus"));
    h.deleteGroup.mockRejectedValue(new Error("refus"));
    const edit = setupMutation(() => useUpdatePublishedSocialPost());
    await act(async () => { await edit.result.current.mutateAsync({ postId: "p", text: "t", mediaId: null }).catch(() => {}); });
    expect(keys(edit.invalidate)).toEqual([["social-contents"]]);
    const post = setupMutation(() => useDeleteSocialPost());
    await act(async () => { await post.result.current.mutateAsync("p").catch(() => {}); });
    expect(h.deletePost).toHaveBeenCalledWith("p", expect.anything());
    expect(keys(post.invalidate)).toEqual([["social-contents"]]);
    const group = setupMutation(() => useDeleteSocialGroup());
    await act(async () => { await group.result.current.mutateAsync("g").catch(() => {}); });
    expect(keys(group.invalidate)).toEqual([["social-contents"]]);
  });

  it("l'édition d'une publiée invalide les contenus", async () => {
    h.updatePublishedPost.mockResolvedValue(undefined);
    const { invalidate, result } = setupMutation(() => useUpdatePublishedSocialPost());
    await act(async () => { await result.current.mutateAsync({ postId: "p", text: "t", mediaId: null }); });
    expect(h.updatePublishedPost).toHaveBeenCalledWith("p", "t", null);
    expect(keys(invalidate)).toEqual([["social-contents"]]);
  });

  it("les suppressions invalident les contenus", async () => {
    h.deletePost.mockResolvedValue(undefined);
    h.deleteGroup.mockResolvedValue(undefined);
    const post = setupMutation(() => useDeleteSocialPost());
    await act(async () => { await post.result.current.mutateAsync("p"); });
    expect(h.deletePost).toHaveBeenCalledWith("p", expect.anything());
    expect(keys(post.invalidate)).toEqual([["social-contents"]]);
    const group = setupMutation(() => useDeleteSocialGroup());
    await act(async () => { await group.result.current.mutateAsync("g"); });
    expect(h.deleteGroup).toHaveBeenCalledWith("g", expect.anything());
    expect(keys(group.invalidate)).toEqual([["social-contents"]]);
  });
});

describe("mutations des notes du calendrier", () => {
  const NOTES = ["social-calendar-notes", "2026-10-26", "2026-12-06"];
  const n1: SocialCalendarNote = { id: "n1", day: "2026-11-12", text: "Lancement", color: "#f97316", created_at: "" };
  function setupNote<T>(hook: () => T) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    qc.setQueryData(NOTES, [n1]);
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    return { qc, invalidate, ...renderHook(hook, { wrapper }) };
  }
  const keys = (invalidate: ReturnType<typeof vi.spyOn>) =>
    invalidate.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);

  it("déplace la note en cache avant la réponse du serveur", async () => {
    let resolve: () => void = () => {};
    h.updateNote.mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    const { qc, result } = setupNote(() => useUpdateSocialNote());
    act(() => { result.current.mutate({ id: "n1", day: "2026-11-14" }); });
    await waitFor(() => expect(qc.getQueryData<SocialCalendarNote[]>(NOTES)?.[0].day).toBe("2026-11-14"));
    expect(h.updateNote).toHaveBeenCalledWith("n1", { day: "2026-11-14" });
    resolve();
  });

  it("revient au jour précédent si le déplacement échoue, et relit les notes", async () => {
    h.updateNote.mockRejectedValue(new Error("refus"));
    const { qc, invalidate, result } = setupNote(() => useUpdateSocialNote());
    act(() => { result.current.mutate({ id: "n1", day: "2026-11-14" }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData<SocialCalendarNote[]>(NOTES)?.[0].day).toBe("2026-11-12");
    expect(keys(invalidate)).toEqual([["social-calendar-notes"]]);
  });

  it("deux déplacements concurrents : l'échec du premier ne restaure que sa note, relecture après le dernier", async () => {
    const n2: SocialCalendarNote = { ...n1, id: "n2", day: "2026-11-13" };
    let rejectFirst: (e: Error) => void = () => {};
    let resolveSecond: () => void = () => {};
    h.updateNote
      .mockReturnValueOnce(new Promise<void>((_r, reject) => { rejectFirst = reject; }))
      .mockReturnValueOnce(new Promise<void>((r) => { resolveSecond = r; }));
    const { qc, invalidate, result } = setupNote(() => ({ a: useUpdateSocialNote(), b: useUpdateSocialNote() }));
    qc.setQueryData(NOTES, [n1, n2]);
    act(() => { result.current.a.mutate({ id: "n1", day: "2026-11-14" }); });
    await waitFor(() => expect(qc.getQueryData<SocialCalendarNote[]>(NOTES)?.[0].day).toBe("2026-11-14"));
    act(() => { result.current.b.mutate({ id: "n2", day: "2026-11-20" }); });
    await waitFor(() => expect(qc.getQueryData<SocialCalendarNote[]>(NOTES)?.[1].day).toBe("2026-11-20"));
    await act(async () => { rejectFirst(new Error("refus")); });
    await waitFor(() => expect(result.current.a.isError).toBe(true));
    expect(qc.getQueryData<SocialCalendarNote[]>(NOTES)?.map((n) => n.day)).toEqual(["2026-11-12", "2026-11-20"]);
    expect(invalidate).not.toHaveBeenCalled();
    await act(async () => { resolveSecond(); });
    await waitFor(() => expect(result.current.b.isSuccess).toBe(true));
    expect(keys(invalidate)).toEqual([["social-calendar-notes"]]);
  });

  it("l'échec d'un déplacement ne défait pas un déplacement plus récent de la même note", async () => {
    let rejectFirst: (e: Error) => void = () => {};
    h.updateNote
      .mockReturnValueOnce(new Promise<void>((_r, reject) => { rejectFirst = reject; }))
      .mockReturnValueOnce(new Promise<void>(() => {}));
    const { qc, result } = setupNote(() => ({ a: useUpdateSocialNote(), b: useUpdateSocialNote() }));
    act(() => { result.current.a.mutate({ id: "n1", day: "2026-11-14" }); });
    await waitFor(() => expect(qc.getQueryData<SocialCalendarNote[]>(NOTES)?.[0].day).toBe("2026-11-14"));
    act(() => { result.current.b.mutate({ id: "n1", day: "2026-11-16" }); });
    await waitFor(() => expect(qc.getQueryData<SocialCalendarNote[]>(NOTES)?.[0].day).toBe("2026-11-16"));
    await act(async () => { rejectFirst(new Error("refus")); });
    await waitFor(() => expect(result.current.a.isError).toBe(true));
    expect(qc.getQueryData<SocialCalendarNote[]>(NOTES)?.[0].day).toBe("2026-11-16");
  });

  it("la création et la suppression invalident les notes, même en cas d'échec", async () => {
    h.createNote.mockRejectedValue(new Error("refus"));
    h.deleteNote.mockRejectedValue(new Error("refus"));
    const create = setupNote(() => useCreateSocialNote());
    await act(async () => { await create.result.current.mutateAsync({ day: "2026-11-12", text: "x", color: "#f97316" }).catch(() => {}); });
    expect(keys(create.invalidate)).toEqual([["social-calendar-notes"]]);
    const remove = setupNote(() => useDeleteSocialNote());
    await act(async () => { await remove.result.current.mutateAsync("n1").catch(() => {}); });
    expect(h.deleteNote).toHaveBeenCalledWith("n1", expect.anything());
    expect(keys(remove.invalidate)).toEqual([["social-calendar-notes"]]);
  });
});

describe("useSocialCalendarNotes", () => {
  it("lit la plage demandée, relit à chaque nouvelle plage et après une création", async () => {
    h.listNotesInRange.mockResolvedValue([]);
    h.createNote.mockResolvedValue({ id: "n", day: "2026-11-12", text: "x", color: "#f97316", created_at: "" });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result, rerender } = renderHook(
      ({ from, to }: { from: string; to: string }) => ({ notes: useSocialCalendarNotes(from, to), create: useCreateSocialNote() }),
      { wrapper, initialProps: { from: "2026-10-26", to: "2026-12-06" } },
    );
    await waitFor(() => expect(result.current.notes.isSuccess).toBe(true));
    expect(h.listNotesInRange).toHaveBeenLastCalledWith("2026-10-26", "2026-12-06");
    rerender({ from: "2026-11-30", to: "2027-01-03" });
    await waitFor(() => expect(h.listNotesInRange).toHaveBeenLastCalledWith("2026-11-30", "2027-01-03"));
    const calls = h.listNotesInRange.mock.calls.length;
    await act(async () => { await result.current.create.mutateAsync({ day: "2026-12-02", text: "x", color: "#f97316" }); });
    await waitFor(() => expect(h.listNotesInRange.mock.calls.length).toBeGreaterThan(calls));
    expect(h.listNotesInRange).toHaveBeenLastCalledWith("2026-11-30", "2027-01-03");
  });
});
