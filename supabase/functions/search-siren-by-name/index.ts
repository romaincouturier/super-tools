import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

interface SirenResult {
  siren: string;
  nom: string;
  ville: string | null;
  codePostal: string | null;
}

/** Read API keys from app_settings table */
async function getApiKeys(): Promise<{
  inseeApiKey: string | null;
  googleSearchApiKey: string | null;
  googleSearchEngineId: string | null;
}> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("app_settings")
    .select("setting_key, setting_value")
    .in("setting_key", ["insee_api_key", "google_search_api_key", "google_search_engine_id"]);

  const map: Record<string, string> = {};
  (data || []).forEach((row: { setting_key: string; setting_value: string | null }) => {
    if (row.setting_value) map[row.setting_key] = row.setting_value;
  });

  return {
    inseeApiKey: map["insee_api_key"] || null,
    googleSearchApiKey: map["google_search_api_key"] || null,
    googleSearchEngineId: map["google_search_engine_id"] || null,
  };
}

/**
 * Search the INSEE SIRENE API by company name (denomination).
 * Returns a list of matching companies with SIREN numbers.
 */
async function searchInsee(companyName: string, apiKey: string): Promise<SirenResult[]> {
  const query = `denominationUniteLegale:"${companyName}" AND etablissementSiege:true AND etatAdministratifUniteLegale:A`;
  const url = `https://api.insee.fr/api-sirene/3.11/siret?q=${encodeURIComponent(query)}&nombre=5`;

  console.log(`INSEE search URL: ${url}`);

  const response = await fetch(url, {
    headers: {
      "X-INSEE-Api-Key-Integration": apiKey,
      "Accept": "application/json",
    },
  });

  const contentType = response.headers.get("content-type");
  console.log(`INSEE search response - Status: ${response.status}, Content-Type: ${contentType}`);

  if (!contentType?.includes("application/json")) {
    const text = await response.text();
    console.error("INSEE returned non-JSON:", text.substring(0, 300));

    if (text.includes("Maintenance") || text.includes("maintenance")) {
      throw new Error("MAINTENANCE");
    }
    return [];
  }

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    const errorData = await response.json();
    console.error("INSEE API error:", response.status, JSON.stringify(errorData));
    return [];
  }

  const data = await response.json();
  const etablissements = data.etablissements || [];

  console.log(`INSEE returned ${etablissements.length} results`);

  const results: SirenResult[] = [];
  const seenSirens = new Set<string>();

  for (const etab of etablissements) {
    const siren = etab.siren;
    if (seenSirens.has(siren)) continue;
    seenSirens.add(siren);

    const uniteLegale = etab.uniteLegale;
    const periodes = uniteLegale?.periodesUniteLegale;
    const current = periodes?.[0];

    let nom = current?.denominationUniteLegale || uniteLegale?.denominationUniteLegale || "";
    if (!nom) {
      const nomUL = current?.nomUniteLegale || uniteLegale?.nomUniteLegale;
      const prenomUL = current?.prenomUsuelUniteLegale || uniteLegale?.prenomUsuelUniteLegale;
      if (nomUL) {
        nom = `${prenomUL || ""} ${nomUL}`.trim();
      }
    }

    const addr = etab.adresseEtablissement;
    const ville = addr?.libelleCommuneEtablissement || null;
    const codePostal = addr?.codePostalEtablissement || null;

    results.push({ siren, nom, ville, codePostal });
  }

  return results;
}

/**
 * Fallback: search Google for the company SIREN and try to extract a 9-digit number.
 */
async function searchWeb(
  companyName: string,
  googleApiKey: string,
  searchEngineId: string,
): Promise<SirenResult[]> {
  const query = `SIREN "${companyName}"`;
  const url = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=5`;

  console.log(`Google search for: ${query}`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error("Google Search API error:", response.status);
      return [];
    }

    const data = await response.json();
    const items = data.items || [];

    const results: SirenResult[] = [];
    const seenSirens = new Set<string>();
    const sirenRegex = /\b(\d{9})\b/g;

    for (const item of items) {
      const text = `${item.title || ""} ${item.snippet || ""}`;
      const matches = text.matchAll(sirenRegex);

      for (const match of matches) {
        const siren = match[1];
        if (seenSirens.has(siren)) continue;
        seenSirens.add(siren);
        results.push({
          siren,
          nom: companyName,
          ville: null,
          codePostal: null,
        });
      }

      if (results.length >= 3) break;
    }

    return results;
  } catch (err) {
    console.error("Google search error:", err);
    return [];
  }
}

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightIfNeeded(req);

  if (corsResponse) return corsResponse;

  try {
    const { companyName } = await req.json();

    if (!companyName || typeof companyName !== "string" || companyName.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: "Le nom de l'entreprise doit contenir au moins 2 caractères." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trimmedName = companyName.trim();
    console.log(`Searching SIREN for company: "${trimmedName}"`);

    // Read API keys from app_settings
    const { inseeApiKey, googleSearchApiKey, googleSearchEngineId } = await getApiKeys();

    let results: SirenResult[] = [];

    // 1) Try INSEE API first
    if (inseeApiKey) {
      try {
        results = await searchInsee(trimmedName, inseeApiKey);
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "MAINTENANCE") {
          return new Response(
            JSON.stringify({
              error: "L'API INSEE est actuellement en maintenance. Veuillez réessayer plus tard.",
              maintenance: true,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        console.error("INSEE search failed:", err);
      }
    } else {
      console.warn("insee_api_key not configured in app_settings");
    }

    // 2) If INSEE returned nothing, try web search fallback
    if (results.length === 0) {
      if (googleSearchApiKey && googleSearchEngineId) {
        console.log("No INSEE results, falling back to web search");
        results = await searchWeb(trimmedName, googleSearchApiKey, googleSearchEngineId);
      } else {
        console.warn("Google Search API not configured in app_settings, skipping web fallback");
      }
    }

    if (results.length === 0) {
      return new Response(
        JSON.stringify({ error: "Aucune entreprise trouvée avec ce nom.", results: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Returning ${results.length} results`);

    return new Response(
      JSON.stringify({ results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
