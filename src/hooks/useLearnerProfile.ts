import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LearnerProfile {
  email: string;
  first_name: string | null;
  last_name: string | null;
  fonction: string | null;
  photo_url: string | null;
  email_notif_work_reply: boolean;
  email_notif_work_comment: boolean;
  email_notif_live: boolean;
  email_notif_important: boolean;
  updated_at: string;
}

export function useLearnerProfile(email: string | null) {
  return useQuery<LearnerProfile | null>({
    queryKey: ["learner_profile", email?.toLowerCase()],
    queryFn: async () => {
      if (!email) return null;
      const client = supabase;
      const { data, error } = await client
        .from("learner_profiles")
        .select("*")
        .eq("email", email.toLowerCase())
        .maybeSingle();
      if (error) throw error;
      return data as LearnerProfile | null;
    },
    enabled: !!email,
  });
}

export function useUpsertLearnerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: {
      email: string;
      first_name?: string | null;
      last_name?: string | null;
      fonction?: string | null;
      photo_url?: string | null;
      email_notif_work_reply?: boolean;
      email_notif_work_comment?: boolean;
      email_notif_live?: boolean;
      email_notif_important?: boolean;
    }) => {
      const email = profile.email.toLowerCase();
      const client = supabase;
      // `select()` forces PostgREST to return the written row: a policy that
      // silently filters the row out (RLS mismatch) then surfaces as an error
      // instead of a fake success — this exact silent no-op hid the learner
      // profile bug from Sentry.
      const { data, error } = await client
        .from("learner_profiles")
        .upsert(
          { ...profile, email, updated_at: new Date().toISOString() },
          { onConflict: "email" },
        )
        .select("email")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new Error(
          `Profil apprenant non enregistré (aucune ligne retournée pour ${email}) — règle d'accès en cause`,
        );
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["learner_profile", vars.email.toLowerCase()] });
    },
  });
}

export async function uploadLearnerPhoto(file: File, email: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("email", email.toLowerCase());
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-learner-photo`;
  const resp = await fetch(url, { method: "POST", body: form });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "Erreur inconnue");
    throw new Error(text);
  }
  const json = await resp.json();
  return json.url as string;
}
