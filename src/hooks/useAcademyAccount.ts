import { useMutation } from "@tanstack/react-query";
import { createAcademyAccount } from "@/services/academyAccount";
export type { CreateAcademyAccountInput } from "@/services/academyAccount";

export function useAcademyAccount() {
  return useMutation({
    mutationFn: createAcademyAccount,
  });
}
