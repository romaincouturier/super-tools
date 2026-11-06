import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { staffOnboarding } from "@/services/authorOnboarding";

export function useAuthorInvitations() {
  return useQuery({ queryKey: ["author-invitations"], queryFn: staffOnboarding.list });
}
export function useAuthorInvitationDetail(id: string | undefined) {
  return useQuery({ queryKey: ["author-invitation", id], queryFn: () => staffOnboarding.detail(id!), enabled: !!id });
}
export function useInvalidateOnboarding() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["author-invitations"] });
    qc.invalidateQueries({ queryKey: ["author-invitation"] });
    qc.invalidateQueries({ queryKey: ["game-authors"] });
    qc.invalidateQueries({ queryKey: ["games"] });
  };
}
export function useOnboardingAction<T, A>(fn: (a: A) => Promise<T>) {
  const invalidate = useInvalidateOnboarding();
  return useMutation({ mutationFn: fn, onSuccess: invalidate });
}
