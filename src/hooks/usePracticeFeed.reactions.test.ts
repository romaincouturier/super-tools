import { describe, it, expect } from "vitest";
import { applyReactionToggle, type PracticePost } from "./usePracticeFeed";

const basePost = (overrides: Partial<PracticePost> = {}): PracticePost => ({
  id: "p1",
  author_email: "auteur@example.com",
  content: "hello",
  file_url: null,
  file_name: null,
  file_mime: null,
  file_size: null,
  course_id: null,
  lesson_id: null,
  is_pinned: false,
  is_staff_treated: false,
  file_rotation: 0,
  created_at: "2026-11-01T10:00:00Z",
  updated_at: "2026-11-01T10:00:00Z",
  reaction_count: 0,
  i_reacted: false,
  reactions_by_type: {},
  reactions_by_type_users: {},
  my_reaction_types: [],
  comment_count: 0,
  hashtags: [],
  poll: null,
  ...overrides,
});

const ME = "apprenant@example.com";

describe("applyReactionToggle", () => {
  it("adds a reaction: count, type breakdown, my types and i_reacted", () => {
    const next = applyReactionToggle(basePost(), "👍", ME, true);
    expect(next.reaction_count).toBe(1);
    expect(next.reactions_by_type["👍"]).toBe(1);
    expect(next.reactions_by_type_users["👍"]).toEqual([ME]);
    expect(next.my_reaction_types).toEqual(["👍"]);
    expect(next.i_reacted).toBe(true);
  });

  it("removes an existing reaction (toggle off)", () => {
    const withReaction = applyReactionToggle(basePost(), "❤️", ME, true);
    const next = applyReactionToggle(withReaction, "❤️", ME, false);
    expect(next.reaction_count).toBe(0);
    expect(next.reactions_by_type["❤️"]).toBeUndefined();
    expect(next.reactions_by_type_users["❤️"]).toBeUndefined();
    expect(next.my_reaction_types).toEqual([]);
    expect(next.i_reacted).toBe(false);
  });

  it("is idempotent when adding the same reaction twice (double tap)", () => {
    const once = applyReactionToggle(basePost(), "👍", ME, true);
    const twice = applyReactionToggle(once, "👍", ME, true);
    expect(twice).toBe(once);
    expect(twice.reaction_count).toBe(1);
  });

  it("is idempotent when removing a reaction the user never set", () => {
    const post = basePost();
    const next = applyReactionToggle(post, "👏", ME, false);
    expect(next).toBe(post);
    expect(next.reaction_count).toBe(0);
  });

  it("keeps other users' reactions untouched when toggling off", () => {
    const post = basePost({
      reaction_count: 2,
      reactions_by_type: { "👍": 2 },
      reactions_by_type_users: { "👍": [ME, "autre@example.com"] },
      my_reaction_types: ["👍"],
      i_reacted: true,
    });
    const next = applyReactionToggle(post, "👍", ME, false);
    expect(next.reaction_count).toBe(1);
    expect(next.reactions_by_type_users["👍"]).toEqual(["autre@example.com"]);
    expect(next.i_reacted).toBe(false);
  });
});
