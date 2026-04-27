import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchMyDeposit,
  fetchVisibleDeposits,
  createDeposit,
  updateDeposit,
  deleteDeposit,
  uploadDepositFile,
  fetchDepositComments,
  createDepositComment,
  updateDepositComment,
  deleteDepositComment,
  fetchDepositFeedback,
} from "@/services/lms-work-deposit";
import type {
  CreateWorkDepositInput,
  UpdateWorkDepositInput,
  WorkDeposit,
  DepositComment,
  DepositFeedback,
} from "@/types/lms-work-deposit";

const KEYS = {
  myDeposit: (lessonId: string, learnerEmail: string) => ["my-deposit", lessonId, learnerEmail] as const,
  visibleDeposits: (lessonId: string, learnerEmail: string) => ["visible-deposits", lessonId, learnerEmail] as const,
  comments: (depositId: string) => ["deposit-comments", depositId] as const,
  feedback: (depositId: string) => ["deposit-feedback", depositId] as const,
};

export function useMyDeposit(lessonId: string | undefined, learnerEmail: string | undefined) {
  return useQuery({
    queryKey: KEYS.myDeposit(lessonId || "", learnerEmail || ""),
    enabled: !!lessonId && !!learnerEmail,
    queryFn: () => fetchMyDeposit(lessonId!, learnerEmail!),
  });
}

export function useVisibleDeposits(lessonId: string | undefined, learnerEmail: string | undefined) {
  return useQuery({
    queryKey: KEYS.visibleDeposits(lessonId || "", learnerEmail || ""),
    enabled: !!lessonId && !!learnerEmail,
    queryFn: () => fetchVisibleDeposits(lessonId!, learnerEmail!),
  });
}

export function useCreateDeposit(lessonId: string, learnerEmail: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkDepositInput) => createDeposit(input),
    onSuccess: (data: WorkDeposit) => {
      qc.setQueryData(KEYS.myDeposit(lessonId, learnerEmail), data);
      qc.invalidateQueries({ queryKey: KEYS.visibleDeposits(lessonId, learnerEmail) });
    },
  });
}

export function useUpdateDeposit(lessonId: string, learnerEmail: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateWorkDepositInput }) =>
      updateDeposit(id, updates, learnerEmail),
    onSuccess: (data: WorkDeposit) => {
      qc.setQueryData(KEYS.myDeposit(lessonId, learnerEmail), data);
      qc.invalidateQueries({ queryKey: KEYS.visibleDeposits(lessonId, learnerEmail) });
    },
  });
}

export function useDeleteDeposit(lessonId: string, learnerEmail: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDeposit(id, learnerEmail),
    onSuccess: () => {
      qc.removeQueries({ queryKey: KEYS.myDeposit(lessonId, learnerEmail) });
      qc.invalidateQueries({ queryKey: KEYS.visibleDeposits(lessonId, learnerEmail) });
    },
  });
}

export function useDepositComments(depositId: string | undefined, learnerEmail: string | undefined) {
  return useQuery<DepositComment[]>({
    queryKey: KEYS.comments(depositId || ""),
    enabled: !!depositId && !!learnerEmail,
    queryFn: () => fetchDepositComments(depositId!, learnerEmail!),
  });
}

export function useCreateDepositComment(depositId: string, learnerEmail: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => createDepositComment(depositId, learnerEmail, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.comments(depositId) }),
  });
}

export function useUpdateDepositComment(depositId: string, learnerEmail: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      updateDepositComment(id, learnerEmail, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.comments(depositId) }),
  });
}

export function useDeleteDepositComment(depositId: string, learnerEmail: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDepositComment(id, learnerEmail),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.comments(depositId) }),
  });
}

export function useDepositFeedback(depositId: string | undefined, learnerEmail: string | undefined) {
  return useQuery<DepositFeedback[]>({
    queryKey: KEYS.feedback(depositId || ""),
    enabled: !!depositId && !!learnerEmail,
    queryFn: () => fetchDepositFeedback(depositId!, learnerEmail!),
  });
}

export { uploadDepositFile };
