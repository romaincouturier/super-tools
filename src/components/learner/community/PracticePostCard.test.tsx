import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import PracticePostCard from "./PracticePostCard";
import type { PracticePost } from "@/hooks/usePracticeFeed";

const mocks = vi.hoisted(() => ({ staff: true, create: vi.fn(), transcript: undefined as undefined | ((text: string) => void), busy: undefined as undefined | ((busy: boolean) => void) }));
vi.mock("@/hooks/useSession", () => ({ useSession: () => ({ isStaff: mocks.staff }) }));
vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ isDemoMode: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/ui/emoji-insert", () => ({ default: () => null }));
vi.mock("./GroupMatchingBlock", () => ({ default: () => null }));
vi.mock("@/components/lms/StaffCommentDictation", () => ({ default: (props: { onTranscript: (text: string) => void; onBusyChange: (busy: boolean) => void }) => {
  mocks.transcript = props.onTranscript;
  mocks.busy = props.onBusyChange;
  return null;
} }));
vi.mock("@/hooks/usePracticeFeed", () => ({
  usePracticeComments: () => ({ data: [] }),
  useCreatePracticeComment: () => ({ mutateAsync: mocks.create, isPending: false }),
  useDeletePracticeComment: () => ({}), useUpdatePracticeComment: () => ({}),
  useUpdatePracticePost: () => ({}), useRotatePracticePostImage: () => ({}),
}));

const post = {
  id: "post-test", content: "Publication", author_email: "learner@example.com",
  created_at: "2026-11-19T10:00:00Z", hashtags: [], comment_count: 0, reaction_count: 0,
} as PracticePost;
function openComment(isAdmin = true) {
  render(<PracticePostCard post={post} currentEmail="staff@example.com" isAdmin={isAdmin} onReact={vi.fn()} onDelete={vi.fn()} onVote={vi.fn()} onSelectTag={vi.fn()} />);
  fireEvent.click(screen.getByText("Commenter"));
}
beforeEach(() => { mocks.staff = true; mocks.transcript = undefined; mocks.busy = undefined; mocks.create.mockReset().mockResolvedValue({}); });

it("ne fournit aucune dictée à une session apprenant, même si la carte demande les outils admin", () => {
  mocks.staff = false;
  openComment();
  expect(mocks.transcript).toBeUndefined();
});

it("ne fournit pas de dictée dans une carte apprenant", () => {
  openComment(false);
  expect(mocks.transcript).toBeUndefined();
});

it("ajoute les segments à la saisie la plus récente sans envoyer le commentaire", () => {
  openComment();
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Bonjour" } });
  act(() => { mocks.transcript?.("Premier segment"); });
  fireEvent.change(input, { target: { value: "Bonjour\nPremier segment\nSaisie pendant la dictée" } });
  act(() => { mocks.transcript?.("Deuxième segment"); });
  expect(input).toHaveValue("Bonjour\nPremier segment\nSaisie pendant la dictée\nDeuxième segment");
  expect(mocks.create).not.toHaveBeenCalled();
});

it("bloque Entrée pendant la dictée puis envoie uniquement sur demande après transcription", async () => {
  openComment();
  const input = screen.getByRole("textbox");
  act(() => { mocks.busy?.(true); mocks.transcript?.("Réponse dictée"); });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(mocks.create).not.toHaveBeenCalled();
  act(() => { mocks.busy?.(false); });
  await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
  expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ postId: "post-test", content: "Réponse dictée" });
  expect(input).toHaveValue("");
});