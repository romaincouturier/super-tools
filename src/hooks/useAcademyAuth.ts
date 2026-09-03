import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function useAcademyAuth() {
  const { user, loading } = useAuth({ disableRedirect: true, checkPasswordChange: false });
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);
  return { user, loading, signIn };
}
