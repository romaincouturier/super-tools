/**
 * Garde des fonctions de contrat de location (`verify_jwt = false`, règle
 * [063]) : l'appelant doit pouvoir lire la ligne de commande avec son propre
 * jeton. C'est la RLS de `order_items` (admin ou module dropshipping) qui
 * tranche, pas une règle recopiée ici.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export async function canAccessOrderItem(req: Request, orderItemId: string): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return false;
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return false;
  const { data } = await userClient.from("order_items").select("id").eq("id", orderItemId).maybeSingle();
  return !!data;
}
