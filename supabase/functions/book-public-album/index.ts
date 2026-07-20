import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  createErrorResponse,
  createJsonResponse,
  handleCorsPreflightIfNeeded,
} from "../_shared/cors.ts";

function extractStoragePath(fileUrl: string): string | null {
  if (!fileUrl.startsWith("http")) return fileUrl;

  try {
    const url = new URL(fileUrl);
    const markers = [
      "/object/public/book-productions/",
      "/object/sign/book-productions/",
      "/object/book-productions/",
    ];
    for (const marker of markers) {
      const index = url.pathname.indexOf(marker);
      if (index !== -1) {
        return decodeURIComponent(url.pathname.slice(index + marker.length).split("?")[0]);
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function signProductionUrls(supabase: ReturnType<typeof createClient>, productions: any[]) {
  const results = await Promise.all(
    productions.map(async (production) => {
      const path = extractStoragePath(production.file_url);
      if (!path) return production;

      const isImage = production.file_type !== "video";
      const thumbnailPath = production.thumbnail_url ? extractStoragePath(production.thumbnail_url) : null;

      // For images, generate a downscaled thumbnail (600px, q70) for the grid.
      // If a real thumbnail file exists, sign it directly instead of transforming
      // the original: very large source images can exceed transform limits.
      // Keep file_url pointing to a full-res signed URL for the lightbox.
      const [full, signedStoredThumb] = await Promise.all([
        supabase.storage.from("book-productions").createSignedUrl(path, 60 * 60),
        isImage && thumbnailPath
          ? supabase.storage.from("book-productions").createSignedUrl(thumbnailPath, 60 * 60)
          : Promise.resolve({ data: null, error: null } as any),
      ]);

      const transformedThumb =
        isImage && !signedStoredThumb?.data?.signedUrl
          ? await supabase.storage.from("book-productions").createSignedUrl(path, 60 * 60, {
              transform: { width: 600, quality: 70, resize: "contain" },
            })
          : null;

      return {
        ...production,
        file_url: full.data?.signedUrl ?? production.file_url,
        thumbnail_url: signedStoredThumb?.data?.signedUrl ?? transformedThumb?.data?.signedUrl ?? null,
      };
    })
  );
  return results;
}


serve(async (req: Request): Promise<Response> => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const body = await req.json().catch(() => null);
    if (!body?.token) return createErrorResponse("token is required", 400);

    const token: string = body.token;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve share link
    const { data: link, error: linkError } = await supabase
      .from("book_share_links")
      .select("id, album_id, prospect_name, user_id")
      .eq("token", token)
      .is("revoked_at", null)
      .single();

    if (linkError || !link) {
      return createErrorResponse("Share link not found or revoked", 404);
    }

    // Fetch album
    const { data: album, error: albumError } = await supabase
      .from("book_albums")
      .select("id, title, description, cover_url, sort_order, created_at, updated_at")
      .eq("id", link.album_id)
      .single();

    if (albumError || !album) {
      console.error("[book-public-album] album error:", albumError);
      return createErrorResponse("Album not found", 404);
    }

    // Fetch productions (exclude user_id)
    const { data: productions, error: prodError } = await supabase
      .from("book_productions")
      .select(
        "id, album_id, title, file_url, thumbnail_url, file_type, exif_date, exif_width, exif_height, original_filename, tags, notes, sort_order, created_at, updated_at"
      )
      .eq("album_id", link.album_id)
      .order("sort_order", { ascending: true });

    if (prodError) {
      console.error("[book-public-album] productions error:", prodError);
      return createErrorResponse("Failed to fetch productions", 500);
    }

    // Fetch profile for album owner
    const { data: profile } = await supabase
      .from("book_profiles")
      .select("id, user_id, photo_url, bio, created_at, updated_at")
      .eq("user_id", link.user_id)
      .maybeSingle();

    // Record analytics event
    const { error: analyticsError } = await supabase
      .from("book_analytics_events")
      .insert({
        link_id: link.id,
        event_type: "album_view",
      });

    if (analyticsError) {
      console.warn("[book-public-album] analytics insert error:", analyticsError);
    }

    const signedProductions = await signProductionUrls(supabase, productions ?? []);

    return createJsonResponse({
      album,
      productions: signedProductions,
      profile: profile ?? null,
      link: {
        id: link.id,
        prospect_name: link.prospect_name,
      },
    });
  } catch (err) {
    console.error("[book-public-album] Unexpected error:", err);
    return createErrorResponse("Internal error", 500);
  }
});
