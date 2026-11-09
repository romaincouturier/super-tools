import { supabase } from "@/integrations/supabase/client";
import { todayAsISO } from "@/lib/dateFormatters";

/**
 * Validation formateur d'un recueil de besoins.
 *
 * La machine à états prévoit `complete → valide_formateur` et la colonne
 * `date_validation_formateur` existe depuis la création de la table, mais
 * aucune écriture n'existait : l'étape était décrite, jamais franchie. Un
 * dossier dont les prérequis ne sont pas validés restait donc sans trace de
 * la décision du formateur, alors que c'est précisément ce que l'indicateur 8
 * attend d'un positionnement à l'entrée.
 */
export async function validateNeedsSurvey(questionnaireId: string): Promise<void> {
  const { error } = await supabase
    .from("questionnaire_besoins")
    .update({
      etat: "valide_formateur",
      date_validation_formateur: todayAsISO(),
      // Le dossier est tranché : il ne réclame plus d'arbitrage.
      necessite_validation_formateur: false,
    })
    .eq("id", questionnaireId)
    .eq("etat", "complete");

  if (error) throw error;
}
