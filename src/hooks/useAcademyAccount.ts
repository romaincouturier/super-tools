import { useMutation } from "@tanstack/react-query";
import { invokeEdge } from "@/lib/invokeEdge";

export type CreateAcademyAccountInput = {
  courseId: string;
  email: string;
  password: string;
  fullName: string;
};

type CreateAcademyAccountResponse = {
  success: boolean;
  email: string;
  courseId: string;
};

export function useAcademyAccount() {
  return useMutation({
    mutationFn: async (input: CreateAcademyAccountInput) => {
      try {
        return await invokeEdge<CreateAcademyAccountResponse>("create-academy-account", input);
      } catch (error) {
        const response = (error as { context?: Response }).context;
        if (response) {
          try {
            const details = await response.clone().json() as { error?: string };
            if (details.error === "already_exists") {
              throw new Error("Cet email est déjà associé à un compte. Connectez-vous depuis l’espace apprenant.");
            }
          } catch (parseError) {
            if (parseError instanceof Error && parseError.message.includes("déjà associé")) throw parseError;
          }
        }
        throw error;
      }
    },
  });
}
