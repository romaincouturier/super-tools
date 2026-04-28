/**
 * Service layer for lms_lesson_blocks (Stage 1 of ST-2026-0040).
 *
 * The Supabase generated types do not yet include lms_lesson_blocks; the
 * `from(...)` calls are cast at the boundary so the rest of the codebase
 * can consume the strongly-typed LessonBlock interface.
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
 * Persist the new order of an entire lesson's block list. Each block id is
 * assigned the index of its position in the array.
 */
export async function reorderLessonBlocks(lessonId: string, orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      blocks().update({ position: index }).eq("id", id).eq("lesson_id", lessonId),
    ),
  );
}

export async function getMaxBlockPosition(lessonId: string): Promise<number> {
  const { data, error } = await blocks()
    .select("position")
    .eq("lesson_id", lessonId)
    .order("position", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = (data || [])[0] as { position?: number } | undefined;
  return row?.position ?? -1;
}

export type { LessonBlock, LessonBlockContent, LessonBlockType };
