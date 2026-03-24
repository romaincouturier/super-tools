import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

interface InseeUniteLegale {
  siren: string;
  denominationUniteLegale?: string;
  nomUniteLegale?: string;
  prenomUsuelUniteLegale?: string;
}

interface InseeAdresse {
  complementAdresseEtablissement?: string;
  numeroVoieEtablissement?: string;
  indiceRepetitionEtablissement?: string;
  typeVoieEtablissement?: string;
  libelleVoieEtablissement?: string;
  codePostalEtablissement?: string;
  libelleCommuneEtablissement?: string;
  codePaysEtrangerEtablissement?: string;
  libellePaysEtrangerEtablissement?: string;
}

interface InseeEtablissement {
  siret: string;
  etablissementSiege: boolean;
  adresseEtablissement: InseeAdresse;
}

interface SirenResponse {
  uniteLegale: InseeUniteLegale;
  etablissements?: InseeEtablissement[];
}

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightIfNeeded(req);

  if (corsResponse) return corsResponse;

  try {
    const { siren } = await req.json();

    if (!siren || !/^\d{9}$/.test(siren)) {
      return new Response(
        JSON.stringify({ error: "SIREN invalide. Il doit contenir exactement 9 chiffres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read INSEE API key from app_settings
    const supabase = getSupabaseClient();
    const { data: keySetting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "insee_api_key")
      .single();

    const apiKey = keySetting?.setting_value || Deno.env.get("INSEE_API_KEY");
    if (!apiKey) {
      throw new Error("La clé API INSEE n'est pas configurée. Allez dans Paramètres > Intégrations > Recherche SIREN.");
    }

    console.log(`Searching SIREN: ${siren}`);

    // Fetch company info - the API returns data in a nested structure
    const response = await fetch(
      `https://api.insee.fr/api-sirene/3.11/siren/${siren}`,
      {
        headers: {
          "X-INSEE-Api-Key-Integration": apiKey,
          "Accept": "application/json",
        },
      }
    );

    // Check content-type before parsing
    const contentType = response.headers.get("content-type");
    console.log(`INSEE API response - Status: ${response.status}, Content-Type: ${contentType}`);

    if (!contentType?.includes("application/json")) {
      const textResponse = await response.text();
      console.error("INSEE API returned non-JSON response:", textResponse.substring(0, 500));
      
      // Check for maintenance page - return 200 with error to avoid Lovable error toast
      if (textResponse.includes("Maintenance - INSEE") || textResponse.includes("maintenance")) {
        return new Response(
          JSON.stringify({ 
            error: "L'API INSEE est actuellement en maintenance. Veuillez réessayer plus tard.",
            maintenance: true 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (textResponse.includes("<!DOCTYPE") || textResponse.includes("<html")) {
        throw new Error(
          `L'API INSEE a retourné une page HTML au lieu de JSON. ` +
          `Cela indique généralement un problème d'authentification avec la clé API. ` +
          `Status: ${response.status}`
        );
      }
      throw new Error(`Format de réponse inattendu: ${contentType}`);
    }

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ error: "Aucune entreprise trouvée avec ce SIREN" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorData = await response.json();
      console.error("INSEE API error:", response.status, JSON.stringify(errorData));
      throw new Error(`Erreur API INSEE: ${response.status}`);
    }

    const data = await response.json();
    console.log("INSEE SIREN response:", JSON.stringify(data, null, 2));

    // The uniteLegale contains periodesUniteLegale array with the current data
    const uniteLegale = data.uniteLegale;
    const periodes = uniteLegale?.periodesUniteLegale;
    const currentPeriode = periodes?.[0]; // Most recent period

    // Get company name from the current period
    let nomClient = currentPeriode?.denominationUniteLegale || "";
    if (!nomClient && currentPeriode?.nomUniteLegale) {
      nomClient = `${currentPeriode?.prenomUsuelUniteLegale || ""} ${currentPeriode.nomUniteLegale}`.trim();
    }

    console.log(`Company name from SIREN: ${nomClient}`);

    // Now fetch the headquarters (siege) to get the address
    const siegeResponse = await fetch(
      `https://api.insee.fr/api-sirene/3.11/siret?q=siren:${siren} AND etablissementSiege:true`,
      {
        headers: {
          "X-INSEE-Api-Key-Integration": apiKey,
          "Accept": "application/json",
        },
      }
    );

    let adresse = "";
    let codePostal = "";
    let ville = "";
    let pays = "France";

    const siegeContentType = siegeResponse.headers.get("content-type");
    console.log(`INSEE SIRET response - Status: ${siegeResponse.status}, Content-Type: ${siegeContentType}`);

    if (siegeResponse.ok && siegeContentType?.includes("application/json")) {
      const siegeData = await siegeResponse.json();
      console.log("INSEE SIRET response:", JSON.stringify(siegeData, null, 2));
      
      const etablissement = siegeData.etablissements?.[0];
      
      if (etablissement?.adresseEtablissement) {
        const addr = etablissement.adresseEtablissement;
        
        // Build address string
        const addressParts = [
          addr.numeroVoieEtablissement,
          addr.indiceRepetitionEtablissement,
          addr.typeVoieEtablissement,
          addr.libelleVoieEtablissement,
        ].filter(Boolean);
        
        if (addr.complementAdresseEtablissement) {
          addressParts.unshift(addr.complementAdresseEtablissement);
        }
        
        adresse = addressParts.join(" ");
        codePostal = addr.codePostalEtablissement || "";
        ville = addr.libelleCommuneEtablissement || "";
        
        if (addr.libellePaysEtrangerEtablissement) {
          pays = addr.libellePaysEtrangerEtablissement;
        }
      }
    } else if (!siegeResponse.ok) {
      const errorText = await siegeResponse.text();
      console.error("SIRET API error:", siegeResponse.status, errorText.substring(0, 200));
    } else {
      console.warn("SIRET API returned non-JSON content-type:", siegeContentType);
    }

    console.log(`Found: ${nomClient}, ${adresse}, ${codePostal} ${ville}`);

    return new Response(
      JSON.stringify({
        siren,
        nomClient,
        adresse,
        codePostal,
        ville,
        pays,
      }),
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
