import { supabase } from "@/integrations/supabase/client";

export type PasswordLinkResult =
  | { status: "valid"; tokenHash: string }
  | { status: "expired" | "used" | "invalid" | "error" };

/** Échange un lien SuperTools (`?link=`) contre un jeton de connexion natif, au clic seulement. */
export async function redeemPasswordLink(link: string): Promise<PasswordLinkResult> {
  const { data, error } = await supabase.functions.invoke("redeem-password-link", { body: { link, action: "redeem" } });
  if (error || !data) return { status: "error" };
  if (data.status === "valid" && typeof data.token_hash === "string") return { status: "valid", tokenHash: data.token_hash };
  return { status: ["expired", "used", "invalid"].includes(data.status) ? data.status : "error" };
}

/** Envoie un nouveau lien (24 h) à l'adresse du lien expiré, sans la révéler au navigateur. */
export async function resendPasswordLink(link: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("redeem-password-link", { body: { link, action: "resend" } });
  return !error && data?.status === "sent";
}
