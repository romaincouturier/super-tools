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

export type { LessonBlock, LessonBlockContent, LessonBlockType };
