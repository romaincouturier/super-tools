import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/invokeEdge";

export type CreateAcademyAccountInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export class AcademyAccountExistsError extends Error {
  constructor() {
    super("Un compte existe déjà avec cette adresse. Connectez-vous ou utilisez « Mot de passe oublié » pour définir votre mot de passe.");
    this.name = "AcademyAccountExistsError";
  }
}

export async function createAcademyAccount(input: CreateAcademyAccountInput) {
  try {
    return await invokeEdge<{ success: boolean; email: string }>("create-academy-account", input);
  } catch (error) {
    const response = (error as { context?: Response } | null)?.context;
    if (response instanceof Response && response.status === 409) {
      throw new AcademyAccountExistsError();
    }
    throw error;
  }
}

export async function hasExistingAcademyEnrollment(): Promise<boolean> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user?.email) return false;
  const { data, error } = await supabase.from("lms_enrollments")
    .select("id").eq("learner_email", user.email.trim().toLowerCase())
    .in("status", ["active", "completed"]).limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}