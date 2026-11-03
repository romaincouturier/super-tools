import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const passwordIdentitySchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est obligatoire.").max(100, "Le prénom est trop long."),
  lastName: z.string().trim().min(1, "Le nom est obligatoire.").max(100, "Le nom est trop long."),
});

async function verifiedEmail() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.email) throw new Error("Votre session a expiré. Demandez un nouveau lien.");
  return data.user.email.toLowerCase();
}

export async function loadPasswordIdentity() {
  const email = await verifiedEmail();
  const { data, error } = await supabase.from("learner_profiles")
    .select("first_name, last_name").eq("email", email).maybeSingle();
  if (error) throw error;
  return { firstName: data?.first_name ?? "", lastName: data?.last_name ?? "" };
}

export async function savePasswordIdentity(identity: z.infer<typeof passwordIdentitySchema>) {
  const names = passwordIdentitySchema.parse(identity);
  const email = await verifiedEmail();
  const { data, error } = await supabase.from("learner_profiles").upsert({
    email, first_name: names.firstName, last_name: names.lastName, updated_at: new Date().toISOString(),
  }, { onConflict: "email" }).select("email").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Votre prénom et votre nom n’ont pas été enregistrés. Réessayez.");
}