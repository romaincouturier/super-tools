import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { normalizeLearnerEmail, isUsableLearnerEmail } from "./learner-email.ts";

/**
 * Provisionne le compte apprenant d'une adresse, sans mot de passe (W12).
 *
 * Appelée au moment de l'inscription ou de l'encaissement : le compte existe
 * avant même que l'apprenant clique sur son lien. Le mot de passe reste
 * facultatif, et un compte déjà présent n'est jamais modifié (S1).
 */
export async function ensureLearnerAccount(
  admin: SupabaseClient,
  email: string,
): Promise<{ created: boolean; userId: string | null }> {
  // RG-01 et RG-18 : une seule règle de normalisation, une seule règle de
  // validité, partagées par toutes les fonctions qui provisionnent un compte.
  const normalized = normalizeLearnerEmail(email);
  if (!isUsableLearnerEmail(normalized)) return { created: false, userId: null };

  const { data: created, error } = await admin.auth.admin.createUser({
    email: normalized,
    email_confirm: true,
    user_metadata: { role: "learner" },
  });

  if (error) {
    const message = (error.message || "").toLowerCase();
    const exists = message.includes("already") || message.includes("registered") || message.includes("exists");
    if (exists) return { created: false, userId: null };
    throw error;
  }

  const userId = created.user?.id ?? null;
  if (userId) {
    // Sans mot de passe : la résolution d'identité aiguillera vers le lien.
    await admin
      .from("user_security_metadata")
      .upsert({ user_id: userId, password_set: false }, { onConflict: "user_id" });
  }

  return { created: true, userId };
}
