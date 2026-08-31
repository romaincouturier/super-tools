import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

import { corsHeaders, createErrorResponse, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { getSupabaseClient, verifyAuth } from "../_shared/supabase-client.ts";

// Même modèle PDFMonkey que les conventions de formation classiques.
const CONVENTION_TEMPLATE_ID = "A9C4C140-4854-40AF-9EFA-BDD88EEA39A4";

const DOSSIER_FEE_WITH_SUBROGATION = 350;
const DOSSIER_FEE_WITHOUT_SUBROGATION = 150;

interface RequestBody {
  activityLogId: string;
  subrogation?: boolean;
}

interface DevisFormData {
  nomClient?: string;
  adresseClient?: string;
  codePostalClient?: string;
  villeClient?: string;
  pays?: string;
  emailCommanditaire?: string;
  adresseCommanditaire?: string;
  formationDemandee?: string;
  formationLibre?: string;
  dateFormation?: string;
  dateFormationLibre?: string;
  lieu?: string;
  lieuAutre?: string;
  participants?: string;
  nbParticipants?: number;
  prix?: number;
  dureeHeures?: number;
  offrirFraisAdmin?: boolean;
  formatFormation?: string;
  typeSubrogation?: string;
}

function sanitizeForFilename(str: string): string {
  return str
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_\- ]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .trim();
}

function getDossierFee(offrirFraisAdmin: boolean, subrogation: boolean): number {
  const base = subrogation ? DOSSIER_FEE_WITH_SUBROGATION : DOSSIER_FEE_WITHOUT_SUBROGATION;
  return Math.max(0, base - (offrirFraisAdmin ? 150 : 0));
}

serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return createErrorResponse("Non autorisé", 401);
    }

    const { activityLogId, subrogation = false }: RequestBody = await req.json();
    if (!activityLogId) throw new Error("activityLogId requis");

    const pdfMonkeyApiKey = Deno.env.get("PDFMONKEY_API_KEY");
    if (!pdfMonkeyApiKey) throw new Error("PDFMONKEY_API_KEY is not set");

    const supabase = getSupabaseClient();

    const { data: log, error: logError } = await supabase
      .from("activity_logs")
      .select("id, recipient_email, details")
      .eq("id", activityLogId)
      .single();
    if (logError || !log) throw new Error("Devis introuvable dans l'historique");

    const details = (log.details || {}) as Record<string, unknown>;
    const form = (details.form_data || {}) as DevisFormData;
    if (!form || Object.keys(form).length === 0) {
      throw new Error("Ce devis n'a pas de données de formulaire : impossible de générer la convention");
    }

    // ── Paramètres généraux (TVA, horaires, moyen pédagogique) ──
    const { data: allSettings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["tva_rate", "convention_default_horaires", "convention_moyen_pedagogique"]);
    const settings: Record<string, string> = {};
    for (const s of allSettings || []) settings[s.setting_key] = s.setting_value || "";
    const tvaRate = settings["tva_rate"] ? parseFloat(settings["tva_rate"]) : 20;
    const defaultHoraires = settings["convention_default_horaires"] || "9h00-17h00";
    const moyenPedagogique = settings["convention_moyen_pedagogique"] || "SuperTilt";

    // ── Données client / formation reprises du devis ──
    const clientName = form.nomClient || (details.client_name as string) || "Client";
    const addressParts = [
      form.adresseClient,
      [form.codePostalClient, form.villeClient].filter(Boolean).join(" "),
    ].filter((p) => p && String(p).trim().length > 0);
    const clientAddress = addressParts.join(", ");

    const trainingName =
      form.formationDemandee || (details.formation_name as string) || form.formationLibre || "Formation";

    // Dates et lieu : on reprend exactement le texte du devis.
    const dates = form.dateFormationLibre?.trim() || form.dateFormation?.trim() || "À définir";
    const lieu = form.lieuAutre?.trim() || form.lieu?.trim() || "À définir";

    const participantsList = (form.participants || "")
      .split(/[,;\n]/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const nbParticipants = Math.max(
      1,
      Number(form.nbParticipants ?? (details.nb_participants as number) ?? (participantsList.length || 1)),
    );
    const stagiaires = [...participantsList];
    for (let i = stagiaires.length; i < nbParticipants; i++) {
      stagiaires.push("Prénom, nom, e-mail");
    }

    const unitPrice = Number(form.prix || 0);
    const priceHt = unitPrice * nbParticipants + getDossierFee(!!form.offrirFraisAdmin, subrogation);
    const prixTtc = priceHt * (1 + tvaRate / 100);

    const dureeHeures = Number(form.dureeHeures || 0);
    const nombreJours = dureeHeures > 0 ? (dureeHeures / 7).toString() : "";

    const isInter = form.formatFormation === "inter" || form.formatFormation === "inter-entreprises";

    // Programme de la formation au catalogue (si retrouvé par nom)
    let programmeUrl = "";
    try {
      const baseName = trainingName.split("—")[0].trim();
      const { data: config } = await supabase
        .from("formation_configs")
        .select("programme_url")
        .ilike("formation_name", baseName)
        .limit(1)
        .maybeSingle();
      programmeUrl = config?.programme_url || "";
    } catch {
      // pas bloquant
    }

    const payload = {
      CLIENT: clientName,
      ADRESSE: clientAddress,
      TITRE_FORMATION: trainingName,
      FORMAT: isInter ? "Inter-entreprises" : "Intra-entreprise",
      PARTICIPANTS: nbParticipants.toString(),
      URL_PROGRAMME_FORMATION: programmeUrl,
      DATES: dates,
      JOURS: dureeHeures > 0 ? dureeHeures.toString() : "",
      NOMBRE_JOURS: nombreJours,
      HORAIRES: defaultHoraires,
      LIEU: lieu,
      STAGIAIRES: stagiaires,
      PRIX: priceHt.toString(),
      TVA: tvaRate.toString(),
      PRIX_TTC: prixTtc.toFixed(2),
      FRAIS: "0",
      AFFICHE_FRAIS: "Non",
      SUBROGATION: subrogation ? "Oui" : "Non",
      MOYEN_PEDAGOGIQUE: moyenPedagogique,
      _date: new Date().toISOString().split("T")[0],
    };

    console.log("PDFMonkey payload (convention devis):", JSON.stringify(payload));

    const createResponse = await fetch("https://api.pdfmonkey.io/api/v1/documents", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${pdfMonkeyApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document: {
          document_template_id: CONVENTION_TEMPLATE_ID,
          payload,
          status: "pending",
        },
      }),
    });
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Erreur creation PDF: ${errorText}`);
    }
    const createData = await createResponse.json();
    const documentId = createData.document.id;

    // Poll for completion
    for (let attempts = 0; attempts < 30; attempts++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const statusResponse = await fetch(`https://api.pdfmonkey.io/api/v1/documents/${documentId}`, {
        headers: { "Authorization": `Bearer ${pdfMonkeyApiKey}` },
      });
      if (!statusResponse.ok) throw new Error("Erreur verification statut PDF");
      const statusData = await statusResponse.json();
      const status = statusData.document.status;

      if (status === "success") {
        const pdfUrl = statusData.document.download_url;
        const fileName = `Convention_${sanitizeForFilename(clientName)}_${sanitizeForFilename(trainingName)}${subrogation ? "_avec_subrogation" : "_sans_subrogation"}.pdf`;

        try {
          await supabase.from("activity_logs").insert({
            action_type: "convention_devis_generated",
            recipient_email: form.emailCommanditaire || log.recipient_email || null,
            details: {
              crm_card_id: details.crm_card_id || null,
              source_activity_log_id: activityLogId,
              client_name: clientName,
              formation_name: trainingName,
              subrogation,
              nb_participants: nbParticipants,
              total_amount: priceHt,
              pdf_url: pdfUrl,
              document_id: documentId,
            },
          });
        } catch (logErr) {
          console.warn("Failed to log activity:", logErr);
        }

        return new Response(
          JSON.stringify({ success: true, pdfUrl, documentId, fileName, totalPriceHt: priceHt }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (status === "failure") {
        throw new Error(`Generation PDF echouee: ${statusData.document.failure_cause}`);
      }
    }

    throw new Error("Delai de generation PDF depasse");
  } catch (error: unknown) {
    console.error("Error:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Unknown error",
      500,
      { cause: error, fn: "generate-devis-convention" },
    );
  }
});
