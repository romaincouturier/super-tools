import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const BUCKET = "app-screenshots";

const PAGES: { slug: string; path: string }[] = [
  { slug: "dashboard", path: "/dashboard" },
  { slug: "formations", path: "/formations" },
  { slug: "crm", path: "/crm" },
  { slug: "missions", path: "/missions" },
  { slug: "statistiques", path: "/statistiques" },
  { slug: "medias", path: "/medias" },
  { slug: "lms", path: "/lms" },
  { slug: "catalogue", path: "/catalogue" },
  { slug: "events", path: "/events" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

function today(): string {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}

async function captureScreenshot(
  accessKey: string,
  url: string,
  width: number,
  height: number,
): Promise<ArrayBuffer> {
  const params = new URLSearchParams({
    access_key: accessKey,
    url,
    viewport_width: String(width),
    viewport_height: String(height),
    full_page: "true",
    format: "png",
    delay: "3",
    block_ads: "true",
    block_cookie_banners: "true",
    cache: "false",
  });

  const apiUrl = `https://api.screenshotone.com/take?${params.toString()}`;
  const resp = await fetch(apiUrl);

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ScreenshotOne error ${resp.status}: ${text}`);
  }

  return resp.arrayBuffer();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SCREENSHOTONE_ACCESS_KEY = Deno.env.get("SCREENSHOTONE_ACCESS_KEY");
    if (!SCREENSHOTONE_ACCESS_KEY) {
      throw new Error("SCREENSHOTONE_ACCESS_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get app URL from settings
    const { data: appSetting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "app_url")
      .single();

    const appUrl = appSetting?.setting_value || "https://super-tools.lovable.app";
    const dateStr = today();

    console.log(`[capture-screenshots] Starting for ${dateStr}, app: ${appUrl}`);

    const results: { slug: string; viewport: string; success: boolean; error?: string }[] = [];

    for (const viewport of VIEWPORTS) {
      for (const page of PAGES) {
        const fullUrl = `${appUrl}${page.path}`;
        const storagePath = `${dateStr}/${viewport.name}/${page.slug}.png`;

        try {
          console.log(`  Capturing ${viewport.name}/${page.slug}...`);
          const imageData = await captureScreenshot(
            SCREENSHOTONE_ACCESS_KEY,
            fullUrl,
            viewport.width,
            viewport.height,
          );

          const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, imageData, {
              contentType: "image/png",
              upsert: true,
            });

          if (uploadError) {
            console.error(`  Upload failed: ${uploadError.message}`);
            results.push({ slug: page.slug, viewport: viewport.name, success: false, error: uploadError.message });
          } else {
            console.log(`  Uploaded: ${storagePath}`);
            results.push({ slug: page.slug, viewport: viewport.name, success: true });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`  Failed ${page.slug}: ${msg}`);
          results.push({ slug: page.slug, viewport: viewport.name, success: false, error: msg });
        }
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const totalCount = results.length;

    console.log(`[capture-screenshots] Done: ${successCount}/${totalCount} captured`);

    return new Response(
      JSON.stringify({ date: dateStr, success: successCount, total: totalCount, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[capture-screenshots] Fatal:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
