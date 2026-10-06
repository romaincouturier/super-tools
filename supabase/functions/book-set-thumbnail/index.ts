import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createErrorResponse,
  createJsonResponse,
  handleCorsPreflightIfNeeded,
} from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";

// Stocke une vignette légère (générée dans le navigateur) pour une production
// du book qui n'en avait pas. Réservé au propriétaire de la production.
serve(async (req: Request): Promise<Response> => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const user = await verifyAuth(req.headers.get("Authorization"));
    if (!user) return createErrorResponse("Unauthorized", 401);

    const formData = await req.formData().catch(() => null);
    const thumbnail = formData?.get("thumbnail") as File | null;
    const productionId = formData?.get("productionId") as string | null;
    if (!thumbnail || !productionId) return createErrorResponse("thumbnail and productionId are required", 400);
    if (thumbnail.size > 3 * 1024 * 1024) return createErrorResponse("thumbnail too large", 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: prod } = await admin
      .from("book_productions")
      .select("id, album_id, user_id, file_type")
      .eq("id", productionId)
      .maybeSingle();
    if (!prod || prod.user_id !== user.id || prod.file_type !== "image") {
      return createErrorResponse("Not found", 404);
    }

    const path = `${user.id}/${prod.album_id}/thumbnails/${prod.id}.jpg`;
    const { error: upErr } = await admin.storage
      .from("book-productions")
      .upload(path, await thumbnail.arrayBuffer(), { contentType: "image/jpeg", upsert: true });
    if (upErr) return createErrorResponse(upErr.message, 500);

    const { error } = await admin.from("book_productions").update({ thumbnail_url: path }).eq("id", prod.id);
    if (error) return createErrorResponse(error.message, 500);

    return createJsonResponse({ thumbnail_url: path });
  } catch (err) {
    console.error("[book-set-thumbnail]", err);
    return createErrorResponse("Internal error", 500);
  }
});
