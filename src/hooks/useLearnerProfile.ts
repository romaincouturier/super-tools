import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LearnerProfile {
  email: string;
  first_name: string | null;
  last_name: string | null;
  fonction: string | null;
  photo_url: string | null;
  updated_at: string;
}

export function useLearnerProfile(email: string | null) {
  return useQuery<LearnerProfile | null>({
    queryKey: ["learner_profile", email?.toLowerCase()],
    queryFn: async () => {
      if (!email) return null;
      const { data, error } = await supabase
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
    }) => {
      const { error } = await supabase
        .from("learner_profiles")
        .upsert(
          { ...profile, email: profile.email.toLowerCase(), updated_at: new Date().toISOString() },
          { onConflict: "email" },
        );
      if (error) throw error;
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
