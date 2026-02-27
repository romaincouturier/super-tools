import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SirenResult {
  siren: string;
  nom: string;
  ville: string | null;
  codePostal: string | null;
}

/**
 * Search the INSEE SIRENE API by company name (denomination).
 * Returns a list of matching companies with SIREN numbers.
 */
async function searchInsee(companyName: string, apiKey: string): Promise<SirenResult[]> {
  // Use full-text search on the SIRET endpoint (which has address info)
  // Search for active legal units matching the denomination
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
    // No results found
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

    let nom = current?.denominationUniteLegale || "";
    if (!nom && current?.nomUniteLegale) {
      nom = `${current?.prenomUsuelUniteLegale || ""} ${current.nomUniteLegale}`.trim();
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
async function searchWeb(companyName: string): Promise<SirenResult[]> {
  const googleApiKey = Deno.env.get("GOOGLE_SEARCH_API_KEY");
  const searchEngineId = Deno.env.get("GOOGLE_SEARCH_ENGINE_ID");

  if (!googleApiKey || !searchEngineId) {
    console.warn("Google Search API not configured, skipping web fallback");
    return [];
  }

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
    // Match 9-digit numbers that look like SIREN
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    const apiKey = Deno.env.get("INSEE_API_KEY");
    let results: SirenResult[] = [];

    // 1) Try INSEE API first
    if (apiKey) {
      try {
        results = await searchInsee(trimmedName, apiKey);
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
      console.warn("INSEE_API_KEY not configured");
    }

    // 2) If INSEE returned nothing, try web search fallback
    if (results.length === 0) {
      console.log("No INSEE results, falling back to web search");
      results = await searchWeb(trimmedName);
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
