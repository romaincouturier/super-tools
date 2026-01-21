import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { siren } = await req.json();

    if (!siren || !/^\d{9}$/.test(siren)) {
      return new Response(
        JSON.stringify({ error: "SIREN invalide. Il doit contenir exactement 9 chiffres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("INSEE_API_KEY");
    if (!apiKey) {
      throw new Error("INSEE_API_KEY is not configured");
    }

    console.log(`Searching SIREN: ${siren}`);

    // Fetch company info with establishments
    const response = await fetch(
      `https://api.insee.fr/api-sirene/3.11/siren/${siren}?champs=siren,denominationUniteLegale,nomUniteLegale,prenomUsuelUniteLegale`,
      {
        headers: {
          "X-INSEE-Api-Key-Integration": apiKey,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ error: "Aucune entreprise trouvée avec ce SIREN" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("INSEE API error:", response.status, errorText);
      throw new Error(`INSEE API error: ${response.status}`);
    }

    const data: SirenResponse = await response.json();
    const uniteLegale = data.uniteLegale;

    // Get company name
    let nomClient = uniteLegale.denominationUniteLegale || "";
    if (!nomClient && uniteLegale.nomUniteLegale) {
      nomClient = `${uniteLegale.prenomUsuelUniteLegale || ""} ${uniteLegale.nomUniteLegale}`.trim();
    }

    // Now fetch the headquarters (siege) to get the address
    const siegeResponse = await fetch(
      `https://api.insee.fr/api-sirene/3.11/siret?q=siren:${siren} AND etablissementSiege:true&champs=siret,adresseEtablissement`,
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

    if (siegeResponse.ok) {
      const siegeData = await siegeResponse.json();
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
