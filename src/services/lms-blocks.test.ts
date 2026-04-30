import { describe, it, expect } from "vitest";
import { buildBlockTree } from "./lms-blocks";
import type { LessonBlock } from "@/types/lms-blocks";

const mkBlock = (overrides: Partial<LessonBlock> & { id: string }): LessonBlock => ({
  id: overrides.id,
  lesson_id: overrides.lesson_id ?? "lesson-1",
  type: overrides.type ?? "text",
  kind: overrides.kind ?? "content",
  parent_block_id: overrides.parent_block_id ?? null,
  position: overrides.position ?? 0,
  hidden: overrides.hidden ?? false,
  content: overrides.content ?? { html: "" },
  created_at: overrides.created_at ?? "2026-01-01T00:00:00Z",
  updated_at: overrides.updated_at ?? "2026-01-01T00:00:00Z",
});

describe("buildBlockTree", () => {
  it("returns an empty array for no blocks", () => {
    expect(buildBlockTree([])).toEqual([]);
  });

  it("returns the flat list as roots when no parent_block_id is set", () => {
    const blocks = [
      mkBlock({ id: "b1", position: 0 }),
      mkBlock({ id: "b2", position: 1 }),
    ];
    const tree = buildBlockTree(blocks);
    expect(tree).toHaveLength(2);
    expect(tree[0].block.id).toBe("b1");
    expect(tree[1].block.id).toBe("b2");
    expect(tree[0].children).toEqual([]);
    expect(tree[1].children).toEqual([]);
  });

  it("nests children under their parent", () => {
    const blocks = [
      mkBlock({ id: "section", type: "section", kind: "layout", position: 0 }),
      mkBlock({ id: "text-1", parent_block_id: "section", position: 0 }),
      mkBlock({ id: "text-2", parent_block_id: "section", position: 1 }),
    ];
    const tree = buildBlockTree(blocks);
    expect(tree).toHaveLength(1);
    expect(tree[0].block.id).toBe("section");
    expect(tree[0].children.map((c) => c.block.id)).toEqual(["text-1", "text-2"]);
  });

  it("sorts children by position even when input order is shuffled", () => {
    const blocks = [
      mkBlock({ id: "section", type: "section", kind: "layout", position: 0 }),
      mkBlock({ id: "c", parent_block_id: "section", position: 2 }),
      mkBlock({ id: "a", parent_block_id: "section", position: 0 }),
      mkBlock({ id: "b", parent_block_id: "section", position: 1 }),
    ];
    const tree = buildBlockTree(blocks);
    expect(tree[0].children.map((c) => c.block.id)).toEqual(["a", "b", "c"]);
  });

  it("supports nesting at multiple levels", () => {
    const blocks = [
      mkBlock({ id: "section", type: "section", kind: "layout", position: 0 }),
      mkBlock({ id: "row", type: "row", kind: "layout", parent_block_id: "section", position: 0 }),
      mkBlock({ id: "leaf-1", parent_block_id: "row", position: 0 }),
      mkBlock({ id: "leaf-2", parent_block_id: "row", position: 1 }),
    ];
    const tree = buildBlockTree(blocks);
    expect(tree).toHaveLength(1);
    expect(tree[0].block.id).toBe("section");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].block.id).toBe("row");
    expect(tree[0].children[0].children.map((c) => c.block.id)).toEqual(["leaf-1", "leaf-2"]);
  });

  it("surfaces orphans (parent id pointing to nothing) at the root", () => {
    const blocks = [
      mkBlock({ id: "orphan", parent_block_id: "missing-parent", position: 0 }),
      mkBlock({ id: "valid", position: 1 }),
    ];
    const tree = buildBlockTree(blocks);
    const ids = tree.map((n) => n.block.id).sort();
    expect(ids).toEqual(["orphan", "valid"]);
  });

  it("sorts roots by position", () => {
    const blocks = [
      mkBlock({ id: "z", position: 2 }),
      mkBlock({ id: "a", position: 0 }),
      mkBlock({ id: "m", position: 1 }),
    ];
    const tree = buildBlockTree(blocks);
    expect(tree.map((n) => n.block.id)).toEqual(["a", "m", "z"]);
  });
});
