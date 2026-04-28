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
  createDepositFeedback,
  updateDepositFeedback,
  deleteDepositFeedback,
  fetchAllDepositsAdmin,
  adminUpdateDeposit,
  adminUpdateCommentStatus,
  fetchAllDepositCommentsAdmin,
  fetchAllDepositFeedbackAdmin,
  type AdminDepositRow,
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

/** Admin-only (BO). */
export function useCreateDepositFeedback(depositId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => createDepositFeedback(depositId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.feedback(depositId) });
      qc.invalidateQueries({ queryKey: ["all-deposits"] });
    },
  });
}

export function useUpdateDepositFeedback(depositId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => updateDepositFeedback(id, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.feedback(depositId) }),
  });
}

export function useDeleteDepositFeedback(depositId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDepositFeedback(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.feedback(depositId) }),
  });
}

export { uploadDepositFile };

// ── Admin (BO) — Stage 4 ─────────────────────────────────────────

export function useAllDepositsAdmin() {
  return useQuery<AdminDepositRow[]>({
    queryKey: ["all-deposits"],
    queryFn: fetchAllDepositsAdmin,
  });
}

export function useAdminUpdateDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateWorkDepositInput }) =>
      adminUpdateDeposit(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-deposits"] }),
  });
}

export function useAdminCommentStatus(depositId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "published" | "hidden" | "deleted" }) =>
      adminUpdateCommentStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.comments(depositId) });
      qc.invalidateQueries({ queryKey: ["admin-comments", depositId] });
    },
  });
}

export function useAdminDepositComments(depositId: string | undefined) {
  return useQuery<DepositComment[]>({
    queryKey: ["admin-comments", depositId || ""],
    enabled: !!depositId,
    queryFn: () => fetchAllDepositCommentsAdmin(depositId!),
  });
}

export function useAdminDepositFeedback(depositId: string | undefined) {
  return useQuery<DepositFeedback[]>({
    queryKey: ["admin-feedback", depositId || ""],
    enabled: !!depositId,
    queryFn: () => fetchAllDepositFeedbackAdmin(depositId!),
  });
}
