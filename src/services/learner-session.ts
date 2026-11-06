import { supabase } from "@/integrations/supabase/client";

export async function hasActiveSession(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}
