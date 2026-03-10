import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { capitalizeName } from "@/lib/stringUtils";

interface SirenSearchResult {
  nomClient?: string;
  adresseClient?: string;
  codePostalClient?: string;
  villeClient?: string;
  pays?: string;
  paysAutre?: string;
}

export function useSirenSearch() {
  const [siren, setSiren] = useState("");
  const [searchingSiren, setSearchingSiren] = useState(false);
  const [searchingSirenByName, setSearchingSirenByName] = useState(false);
  const { toast } = useToast();

  const handleSearchSiren = async (): Promise<SirenSearchResult | null> => {
    if (!siren || !/^\d{9}$/.test(siren)) {
      toast({
        title: "SIREN invalide",
        description: "Le SIREN doit contenir exactement 9 chiffres",
        variant: "destructive",
      });
      return null;
    }

    setSearchingSiren(true);

    try {
      const response = await supabase.functions.invoke("search-siren", {
        body: { siren },
      });

      if (response.error) {
        const errorData = response.data;
        if (errorData?.error) {
          toast({
            title: "Service temporairement indisponible",
            description: `${errorData.error} Vous pouvez saisir les informations manuellement.`,
            variant: "default",
          });
        } else {
          toast({
            title: "Erreur de recherche",
            description: "Impossible de contacter le service INSEE. Veuillez saisir les informations manuellement.",
            variant: "default",
          });
        }
        setSearchingSiren(false);
        return null;
      }

      const data = response.data;

      if (data?.error) {
        toast({
          title: "Recherche SIREN",
          description: data.error,
          variant: "default",
        });
        setSearchingSiren(false);
        return null;
      }

      const result: SirenSearchResult = {};
      if (data?.nomClient) result.nomClient = capitalizeName(data.nomClient) ?? "";
      if (data?.adresse) result.adresseClient = capitalizeName(data.adresse) ?? "";
      if (data?.codePostal) result.codePostalClient = data.codePostal;
      if (data?.ville) result.villeClient = capitalizeName(data.ville) ?? "";
      if (data?.pays && data.pays !== "France") {
        result.pays = "autre";
        result.paysAutre = capitalizeName(data.pays) ?? "";
      } else {
        result.pays = "france";
      }

      toast({
        title: "Entreprise trouvée",
        description: `${data?.nomClient || "Entreprise"} - ${data?.ville || ""}`,
      });

      return result;
    } catch (error: unknown) {
      console.error("SIREN search error:", error);
      toast({
        title: "Recherche SIREN indisponible",
        description: "Le service de recherche est temporairement indisponible. Vous pouvez saisir les informations manuellement.",
        variant: "default",
      });
      return null;
    } finally {
      setSearchingSiren(false);
    }
  };

  const handleSearchSirenByName = async (nomClient: string): Promise<string | null> => {
    if (!nomClient || nomClient.trim().length < 2) {
      toast({
        title: "Nom trop court",
        description: "Saisissez au moins 2 caractères dans le nom du client",
        variant: "destructive",
      });
      return null;
    }

    setSearchingSirenByName(true);

    try {
      const response = await supabase.functions.invoke("search-siren-by-name", {
        body: { companyName: nomClient.trim() },
      });

      if (response.error) {
        const errorData = response.data;
        if (errorData?.error) {
          toast({
            title: "Service temporairement indisponible",
            description: `${errorData.error} Vous pouvez saisir le SIREN manuellement.`,
            variant: "default",
          });
        } else {
          toast({
            title: "Erreur de recherche",
            description: "Impossible de contacter le service. Veuillez saisir le SIREN manuellement.",
            variant: "default",
          });
        }
        setSearchingSirenByName(false);
        return null;
      }

      const data = response.data;

      if (data?.error && (!data.results || data.results.length === 0)) {
        toast({
          title: "Aucun résultat",
          description: data.error,
          variant: "default",
        });
        setSearchingSirenByName(false);
        return null;
      }

      const results = data?.results || [];

      if (results.length === 0) {
        toast({
          title: "Aucun résultat",
          description: "Aucune entreprise trouvée avec ce nom.",
          variant: "default",
        });
        setSearchingSirenByName(false);
        return null;
      }

      let foundSiren: string;
      if (results.length === 1) {
        foundSiren = results[0].siren;
        toast({
          title: "SIREN trouvé",
          description: `${results[0].nom} — SIREN : ${results[0].siren}${results[0].ville ? ` (${results[0].ville})` : ""}`,
        });
      } else {
        foundSiren = results[0].siren;
        const descriptions = results
          .slice(0, 3)
          .map((r: { siren: string; nom: string; ville: string | null }) =>
            `${r.siren} — ${capitalizeName(r.nom) ?? r.nom}${r.ville ? ` (${capitalizeName(r.ville) ?? r.ville})` : ""}`
          )
          .join("\n");
        toast({
          title: `${results.length} résultat${results.length > 1 ? "s" : ""} trouvé${results.length > 1 ? "s" : ""}`,
          description: `Premier résultat appliqué : ${results[0].siren}. Autres : ${descriptions}`,
        });
      }

      setSiren(foundSiren);
      return foundSiren;
    } catch (error: unknown) {
      console.error("SIREN by name search error:", error);
      toast({
        title: "Recherche indisponible",
        description: "Le service de recherche est temporairement indisponible. Vous pouvez saisir le SIREN manuellement.",
        variant: "default",
      });
      return null;
    } finally {
      setSearchingSirenByName(false);
    }
  };

  return {
    siren,
    setSiren,
    searchingSiren,
    searchingSirenByName,
    handleSearchSiren,
    handleSearchSirenByName,
  };
}
