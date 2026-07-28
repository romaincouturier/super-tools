import { describe, it, expect } from "vitest";
import {
  buildThreads,
  partitionThreads,
  canDeleteComment,
  OWN_DELETE_WINDOW_MINUTES,
} from "./missionPageComments";
import type { MissionPageCommentPublic } from "@/lib/supabase-rpc";

const NOW = Date.UTC(2026, 6, 28, 12, 0, 0);
const minutesAgo = (n: number) => new Date(NOW - n * 60_000).toISOString();

function comment(overrides: Partial<MissionPageCommentPublic> & { id: string }): MissionPageCommentPublic {
  return {
    page_id: "page-1",
    parent_comment_id: null,
    block_id: "block-a",
    quoted_text: null,
    author_name: "Marie Dupont",
    author_contact_id: "contact-1",
    is_staff: false,
    body: "Un commentaire",
    is_resolved: false,
    created_at: minutesAgo(1),
    ...overrides,
  };
}

describe("buildThreads", () => {
  it("regroupe les réponses sous leur racine", () => {
    const threads = buildThreads([
      comment({ id: "root-1" }),
      comment({ id: "reply-1", parent_comment_id: "root-1" }),
      comment({ id: "reply-2", parent_comment_id: "root-1" }),
      comment({ id: "root-2" }),
    ]);
    expect(threads).toHaveLength(2);
    expect(threads[0].replies.map((r) => r.id)).toEqual(["reply-1", "reply-2"]);
    expect(threads[1].replies).toEqual([]);
  });

  it("masque les réponses dont la racine a été supprimée", () => {
    // La RPC publique n'expose pas les commentaires supprimés : une réponse
    // orpheline ne doit pas réapparaître comme un fil à part.
    const threads = buildThreads([comment({ id: "reply-1", parent_comment_id: "root-supprimé" })]);
    expect(threads).toEqual([]);
  });
});

describe("partitionThreads", () => {
  const blockIds = new Set(["block-a", "block-b"]);

  it("range les fils ouverts sous leur bloc", () => {
    const threads = buildThreads([
      comment({ id: "c1", block_id: "block-a" }),
      comment({ id: "c2", block_id: "block-b" }),
      comment({ id: "c3", block_id: "block-a" }),
    ]);
    const { byBlock, detached, resolved } = partitionThreads(threads, blockIds);
    expect(byBlock.get("block-a")?.map((t) => t.root.id)).toEqual(["c1", "c3"]);
    expect(byBlock.get("block-b")?.map((t) => t.root.id)).toEqual(["c2"]);
    expect(detached).toEqual([]);
    expect(resolved).toEqual([]);
  });

  it("détache un fil dont le bloc a été réécrit", () => {
    const threads = buildThreads([comment({ id: "c1", block_id: "block-disparu" })]);
    const { byBlock, detached } = partitionThreads(threads, blockIds);
    expect(byBlock.size).toBe(0);
    expect(detached.map((t) => t.root.id)).toEqual(["c1"]);
  });

  it("détache un commentaire de page (sans bloc)", () => {
    const threads = buildThreads([comment({ id: "c1", block_id: null })]);
    expect(partitionThreads(threads, blockIds).detached).toHaveLength(1);
  });

  it("sort les fils clos des blocs et des détachés", () => {
    const threads = buildThreads([
      comment({ id: "c1", is_resolved: true, block_id: "block-a" }),
      comment({ id: "c2", is_resolved: true, block_id: "block-disparu" }),
      comment({ id: "c3" }),
    ]);
    const { byBlock, detached, resolved } = partitionThreads(threads, blockIds);
    expect(resolved.map((t) => t.root.id)).toEqual(["c1", "c2"]);
    expect(byBlock.get("block-a")?.map((t) => t.root.id)).toEqual(["c3"]);
    expect(detached).toEqual([]);
  });
});

describe("canDeleteComment", () => {
  it("autorise le staff sur tout commentaire, même ancien", () => {
    const c = comment({ id: "c1", created_at: minutesAgo(600), author_contact_id: "contact-9" });
    expect(canDeleteComment(c, { isStaff: true, contactId: null, now: NOW })).toBe(true);
  });

  it("autorise un contact sur son commentaire récent", () => {
    const c = comment({ id: "c1", created_at: minutesAgo(5) });
    expect(canDeleteComment(c, { isStaff: false, contactId: "contact-1", now: NOW })).toBe(true);
  });

  it("refuse au-delà de la fenêtre", () => {
    const c = comment({ id: "c1", created_at: minutesAgo(OWN_DELETE_WINDOW_MINUTES + 1) });
    expect(canDeleteComment(c, { isStaff: false, contactId: "contact-1", now: NOW })).toBe(false);
  });

  it("refuse le commentaire d'un autre contact", () => {
    const c = comment({ id: "c1", author_contact_id: "contact-2" });
    expect(canDeleteComment(c, { isStaff: false, contactId: "contact-1", now: NOW })).toBe(false);
  });

  it("refuse un visiteur sans identité", () => {
    const c = comment({ id: "c1" });
    expect(canDeleteComment(c, { isStaff: false, contactId: null, now: NOW })).toBe(false);
  });
});
