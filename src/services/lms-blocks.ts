/**
 * Service layer for lms_lesson_blocks (ST-2026-0040 + ST-2026-0060).
 *
 * Handles the nested block tree (parent_block_id self-FK + kind
 * discriminator). The Supabase generated types do not yet include
 * lms_lesson_blocks; the `from(...)` calls are cast at the boundary so
 * the rest of the codebase consumes the strongly-typed LessonBlock
 * interface.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  LessonBlock,
  LessonBlockContent,
  LessonBlockType,
  CreateLessonBlockInput,
  UpdateLessonBlockInput,
} from "@/types/lms-blocks";
import { blockKindOf } from "@/types/lms-blocks";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const blocks = () => (supabase as any).from("lms_lesson_blocks");

export async function fetchLessonBlocks(lessonId: string): Promise<LessonBlock[]> {
  const { data, error } = await blocks()
    .select("*")
    .eq("lesson_id", lessonId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data || []) as LessonBlock[];
}

export async function createLessonBlock(input: CreateLessonBlockInput): Promise<LessonBlock> {
  const { data, error } = await blocks().insert(input).select().single();
  if (error) throw error;
  return data as LessonBlock;
}

export async function updateLessonBlock(id: string, updates: UpdateLessonBlockInput): Promise<LessonBlock> {
  const { data, error } = await blocks().update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as LessonBlock;
}

export async function deleteLessonBlock(id: string): Promise<void> {
  const { error } = await blocks().delete().eq("id", id);
  if (error) throw error;
}

/**
 * Persist the new order of blocks sharing the same parent. Each block id
 * is assigned the index of its position in the array. The lesson_id is
 * still required so we never accidentally renumber blocks of another
 * lesson if a stale id sneaks in.
 */
export async function reorderLessonBlocks(lessonId: string, orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      blocks().update({ position: index }).eq("id", id).eq("lesson_id", lessonId),
    ),
  );
}

/**
 * Highest position among blocks sharing the given parent (or among
 * top-level blocks of the lesson when parentBlockId is null/undefined).
 * Returns -1 when there are no siblings yet, so callers can use
 * `result + 1` as the next position.
 */
export async function getMaxBlockPosition(
  lessonId: string,
  parentBlockId?: string | null,
): Promise<number> {
  let query = blocks()
    .select("position")
    .eq("lesson_id", lessonId)
    .order("position", { ascending: false })
    .limit(1);
  query = parentBlockId ? query.eq("parent_block_id", parentBlockId) : query.is("parent_block_id", null);
  const { data, error } = await query;
  if (error) throw error;
  const row = (data || [])[0] as { position?: number } | undefined;
  return row?.position ?? -1;
}

// ── Tree helpers ──────────────────────────────────────────────────────

export interface BlockTreeNode {
  block: LessonBlock;
  children: BlockTreeNode[];
}

/**
 * Build the parent/children tree from a flat list of blocks (e.g. the
 * output of `fetchLessonBlocks`). Roots are blocks whose `parent_block_id`
 * is null. Children are sorted by `position` within each parent. Orphan
 * blocks (parent id pointing to nothing) are surfaced at the root so the
 * UI can still render and the user can fix them by hand.
 */
export function buildBlockTree(blocks: LessonBlock[]): BlockTreeNode[] {
  const byId = new Map<string, BlockTreeNode>();
  for (const b of blocks) byId.set(b.id, { block: b, children: [] });

  const roots: BlockTreeNode[] = [];
  for (const b of blocks) {
    const node = byId.get(b.id)!;
    if (b.parent_block_id && byId.has(b.parent_block_id)) {
      byId.get(b.parent_block_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortByPosition = (a: BlockTreeNode, b: BlockTreeNode) => a.block.position - b.block.position;
  const sortRecursive = (nodes: BlockTreeNode[]) => {
    nodes.sort(sortByPosition);
    for (const n of nodes) sortRecursive(n.children);
  };
  sortRecursive(roots);
  return roots;
}

// ── Move ──────────────────────────────────────────────────────────────

/**
 * Move a block to a new parent and/or position. Renumbers the affected
 * sibling lists so positions stay 0..n-1 dense. Pass `parentBlockId=null`
 * to move to the top level. `position` is the index within the new
 * parent's children after the move.
 *
 * NB: PostgreSQL does not enforce transactions across multiple supabase
 * calls. The renumbering is done sequentially; in the unlikely case of a
 * failure midway the worst that happens is a temporary position hole or
 * duplicate, fixed on the next save.
 */
export async function moveLessonBlock(params: {
  blockId: string;
  lessonId: string;
  newParentId: string | null;
  newPosition: number;
}): Promise<void> {
  const { blockId, lessonId, newParentId, newPosition } = params;
  const all = await fetchLessonBlocks(lessonId);
  const moved = all.find((b) => b.id === blockId);
  if (!moved) throw new Error(`Block ${blockId} not found in lesson ${lessonId}`);

  const oldParentId = moved.parent_block_id ?? null;
  const sameParent = oldParentId === newParentId;

  const oldSiblings = all
    .filter((b) => (b.parent_block_id ?? null) === oldParentId && b.id !== blockId)
    .sort((a, b) => a.position - b.position);

  const newSiblings = sameParent
    ? oldSiblings
    : all
        .filter((b) => (b.parent_block_id ?? null) === newParentId)
        .sort((a, b) => a.position - b.position);

  const clamped = Math.max(0, Math.min(newPosition, newSiblings.length));
  const reordered = [...newSiblings];
  reordered.splice(clamped, 0, moved);

  // First update the moved block (parent + position) so the trigger sees
  // a consistent state if any constraint kicks in.
  await blocks()
    .update({ parent_block_id: newParentId, position: clamped })
    .eq("id", blockId)
    .eq("lesson_id", lessonId);

  // Renumber new-parent siblings (excluding the moved block, since it
  // already has its target position).
  await Promise.all(
    reordered
      .filter((b) => b.id !== blockId)
      .map((b, idx) => {
        if (b.position === idx) return null;
        return blocks().update({ position: idx }).eq("id", b.id).eq("lesson_id", lessonId);
      })
      .filter(Boolean),
  );

  // Renumber old-parent siblings (only if we changed parents — otherwise
  // they are already correct).
  if (!sameParent) {
    await Promise.all(
      oldSiblings.map((b, idx) => {
        if (b.position === idx) return null;
        return blocks().update({ position: idx }).eq("id", b.id).eq("lesson_id", lessonId);
      }).filter(Boolean),
    );
  }
}

// ── Duplicate ─────────────────────────────────────────────────────────

/**
 * Duplicate a block and its entire subtree. The duplicate is inserted as
 * a sibling immediately after the original (so the user sees it next to
 * the source). Children are recreated bottom-up so each parent_block_id
 * points to a freshly minted id.
 *
 * Returns the id of the top-level duplicate (root of the cloned subtree).
 */
export async function duplicateLessonBlock(params: {
  blockId: string;
  lessonId: string;
}): Promise<string> {
  const { blockId, lessonId } = params;
  const all = await fetchLessonBlocks(lessonId);
  const source = all.find((b) => b.id === blockId);
  if (!source) throw new Error(`Block ${blockId} not found in lesson ${lessonId}`);

  // Make room: shift positions of siblings after the source by +1.
  const siblings = all
    .filter((b) => (b.parent_block_id ?? null) === (source.parent_block_id ?? null))
    .sort((a, b) => a.position - b.position);
  await Promise.all(
    siblings
      .filter((b) => b.position > source.position)
      .map((b) =>
        blocks()
          .update({ position: b.position + 1 })
          .eq("id", b.id)
          .eq("lesson_id", lessonId),
      ),
  );

  // Recursively clone, top-down, so parent ids exist when children insert.
  async function cloneSubtree(node: LessonBlock, newParentId: string | null, newPosition: number): Promise<string> {
    const insert: CreateLessonBlockInput = {
      lesson_id: lessonId,
      type: node.type,
      kind: blockKindOf(node.type),
      parent_block_id: newParentId,
      position: newPosition,
      content: node.content,
    };
    const created = await createLessonBlock(insert);
    const children = all
      .filter((b) => b.parent_block_id === node.id)
      .sort((a, b) => a.position - b.position);
    for (let i = 0; i < children.length; i++) {
      await cloneSubtree(children[i], created.id, i);
    }
    return created.id;
  }

  return cloneSubtree(source, source.parent_block_id ?? null, source.position + 1);
}

export type { LessonBlock, LessonBlockContent, LessonBlockType };
