import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchLessonBlocks,
  createLessonBlock,
  updateLessonBlock,
  deleteLessonBlock,
  reorderLessonBlocks,
  getMaxBlockPosition,
} from "@/services/lms-blocks";
import type {
  LessonBlock,
  CreateLessonBlockInput,
  UpdateLessonBlockInput,
  LessonBlockType,
  LessonBlockContent,
} from "@/types/lms-blocks";
import { defaultBlockContent, blockKindOf } from "@/types/lms-blocks";

const KEY = (lessonId: string) => ["lms-lesson-blocks", lessonId] as const;

export function useLessonBlocks(lessonId: string | null | undefined) {
  return useQuery({
    queryKey: KEY(lessonId || ""),
    queryFn: () => (lessonId ? fetchLessonBlocks(lessonId) : Promise.resolve([] as LessonBlock[])),
    enabled: !!lessonId,
  });
}

export function useCreateLessonBlock(lessonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      type: LessonBlockType;
      content?: LessonBlockContent;
      parentBlockId?: string | null;
    }) => {
      const parentBlockId = vars.parentBlockId ?? null;
      const position = (await getMaxBlockPosition(lessonId, parentBlockId)) + 1;
      const payload: CreateLessonBlockInput = {
        lesson_id: lessonId,
        type: vars.type,
        kind: blockKindOf(vars.type),
        parent_block_id: parentBlockId,
        position,
        content: vars.content ?? defaultBlockContent(vars.type),
      };
      return createLessonBlock(payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(lessonId) }),
  });
}

export function useUpdateLessonBlock(lessonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateLessonBlockInput }) =>
      updateLessonBlock(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(lessonId) }),
  });
}

export function useDeleteLessonBlock(lessonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLessonBlock(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(lessonId) }),
  });
}

export function useReorderLessonBlocks(lessonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => reorderLessonBlocks(lessonId, orderedIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(lessonId) }),
  });
}
