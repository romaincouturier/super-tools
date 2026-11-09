import { supabase } from "@/integrations/supabase/client";

export async function loadOAuthConsent(id: string) {
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);
  if (error) throw error;
  return data;
}

export async function decideOAuthConsent(id: string, approve: boolean) {
  const { data, error } = approve
    ? await supabase.auth.oauth.approveAuthorization(id)
    : await supabase.auth.oauth.denyAuthorization(id);
  if (error) throw error;
  return data.redirect_url;
}