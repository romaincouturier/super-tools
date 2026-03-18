import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// PDFMonkey template ID for Convention de Formation
const CONVENTION_TEMPLATE_ID = "A9C4C140-4854-40AF-9EFA-BDD88EEA39A4";

interface RequestBody {
  trainingId: string;
  participantId?: string; // For inter/e-learning: generate for specific participant
  subrogation?: boolean; // Whether OPCO pays directly
  mandatairePayeur?: string; // Optional paying agent info
  pricePerParticipant?: number; // Price per participant
}

interface Schedule {
  day_date: string;
  start_time: string;
  end_time: string;
}

interface Participant {
  first_name: string | null;
  last_name: string | null;
  email: string;
}

// Format date in French
function formatDateFrench(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Format date range for display
function formatDateRange(schedules: Schedule[]): string {
  if (schedules.length === 0) return "";

  if (schedules.length === 1) {
    return formatDateFrench(schedules[0].day_date);
  }

  // Check if dates are contiguous
  const dates = schedules.map(s => new Date(s.day_date));
  dates.sort((a, b) => a.getTime() - b.getTime());

  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  // If all dates are in the same month
  if (firstDate.getMonth() === lastDate.getMonth() && firstDate.getFullYear() === lastDate.getFullYear()) {
    const dayFirst = firstDate.getDate();
    const dayLast = lastDate.getDate();
    const month = lastDate.toLocaleDateString("fr-FR", { month: "long" });
    const year = lastDate.getFullYear();

    if (schedules.length === 2 && dayLast - dayFirst === 1) {
      return `${dayFirst} et ${dayLast} ${month} ${year}`;
    }

    return `Du ${dayFirst} au ${dayLast} ${month} ${year}`;
  }

  // Different months
  return `Du ${formatDateFrench(schedules[0].day_date)} au ${formatDateFrench(schedules[schedules.length - 1].day_date)}`;
}

// Calculate total hours from schedules (normalized: <= 4h = 3.5h, > 4h = 7h)
function calculateTotalHours(schedules: Schedule[]): number {
  return schedules.reduce((total, schedule) => {
    const [startH, startM] = schedule.start_time.split(":").map(Number);
    const [endH, endM] = schedule.end_time.split(":").map(Number);
    const hours = (endH * 60 + endM - startH * 60 - startM) / 60;
    // Normalized: <= 4h = 3.5h (half day), > 4h = 7h (full day)
    return total + (hours <= 4 ? 3.5 : 7);
  }, 0);
}

// Calculate total days from schedules (normalized: <= 4h = 0.5 day, > 4h = 1 day)
function calculateTotalDays(schedules: Schedule[]): number {
  return schedules.reduce((total, schedule) => {
    const [startH, startM] = schedule.start_time.split(":").map(Number);
    const [endH, endM] = schedule.end_time.split(":").map(Number);
    const hours = (endH * 60 + endM - startH * 60 - startM) / 60;
    return total + (hours <= 4 ? 0.5 : 1);
  }, 0);
}

// Get time range string
function getTimeRange(schedules: Schedule[], defaultHoraires = "9h00-17h00"): string {
  if (schedules.length === 0) return defaultHoraires;

  // Check if all schedules have same times
  const firstSchedule = schedules[0];
  const allSameTimes = schedules.every(
    s => s.start_time === firstSchedule.start_time && s.end_time === firstSchedule.end_time
  );

  if (allSameTimes) {
    const startTime = firstSchedule.start_time.slice(0, 5).replace(":", "h");
    const endTime = firstSchedule.end_time.slice(0, 5).replace(":", "h");
    return `${startTime}-${endTime}`;
  }

  return "Horaires variables (voir planning)";
}

// Format participant list with placeholders for remaining slots
function formatParticipants(participants: Participant[], maxParticipants: number): string[] {
  const formatted = participants.map(p => {
    const name = `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Participant";
    return `${name} ${p.email}`;
  });

  // Fill remaining slots with placeholder text
  if (maxParticipants > 0) {
    const remaining = maxParticipants - participants.length;
    for (let i = 0; i < remaining; i++) {
      formatted.push("Prénom, nom, e-mail");
    }
  }

  return formatted;
}

// Sanitize string for use in filename
function sanitizeForFilename(str: string): string {
  return str
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-zA-Z0-9_\- ]/g, "") // remove special chars
    .replace(/\s+/g, "_") // spaces to underscores
    .replace(/_+/g, "_") // collapse multiple underscores
    .trim();
}

// Get format label
function getFormatLabel(formatFormation: string | null, location: string): string {
  if (formatFormation === "e_learning") return "E-learning";

  const isOnline = location?.toLowerCase().includes("visio") ||
    location?.toLowerCase().includes("en ligne") ||
    location?.toLowerCase().includes("distanciel");

  if (isOnline) return "Distanciel (classe virtuelle)";

  return "Presentiel";
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    console.log("Received request:", JSON.stringify(body));

    const {
      trainingId,
      participantId,
      subrogation = false,
      mandatairePayeur,
      pricePerParticipant: inputPrice,
    } = body;

    if (!trainingId) {
      return new Response(
        JSON.stringify({ error: "trainingId est requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfMonkeyApiKey = Deno.env.get("PDFMONKEY_API_KEY");
    if (!pdfMonkeyApiKey) {
      throw new Error("PDFMONKEY_API_KEY is not set");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch training details
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      console.error("Error fetching training:", trainingError);
      return new Response(
        JSON.stringify({ error: "Formation introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine if this is intra (global convention) or inter/e-learning (per participant)
    const isIntra = training.format_formation === "intra" || training.format_formation === "classe_virtuelle";
    const isIndividualConvention = training.format_formation === "inter-entreprises" || training.format_formation === "inter" || training.format_formation === "e_learning";

    // Check max_participants is set (only required for intra conventions)
    const maxParticipants: number = training.max_participants || 0;
    if (!isIndividualConvention && maxParticipants < 1) {
      return new Response(
        JSON.stringify({
          error: "Le nombre maximum de participants doit être configuré (minimum 1) avant de générer la convention. Modifiez la formation pour définir ce champ.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For inter/e-learning, participantId is required
    if (isIndividualConvention && !participantId) {
      return new Response(
        JSON.stringify({
          error: "participantId est requis pour les formations inter-entreprises et e-learning",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch schedules
    const { data: schedules } = await supabase
      .from("training_schedules")
      .select("*")
      .eq("training_id", trainingId)
      .order("day_date", { ascending: true });

    // Fetch participants based on format
    let participantList: Participant[] = [];
    let singleParticipant: Participant | null = null;

    if (isIndividualConvention && participantId) {
      // Fetch single participant for inter/e-learning
      const { data: participant } = await supabase
        .from("training_participants")
        .select("first_name, last_name, email, company, sponsor_email, sponsor_first_name, sponsor_last_name, sold_price_ht, elearning_duration")
        .eq("id", participantId)
        .single();

      if (!participant) {
        return new Response(
          JSON.stringify({ error: "Participant introuvable" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      singleParticipant = participant;
      participantList = [participant];
    } else {
      // Fetch all participants for intra
      const { data: participants } = await supabase
        .from("training_participants")
        .select("first_name, last_name, email")
        .eq("training_id", trainingId)
        .order("added_at", { ascending: true });

      participantList = participants || [];
    }

    const scheduleList = schedules || [];

    // Fetch all convention settings from app_settings in one query
    const { data: allSettings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        "tva_rate",
        "convention_default_price_ht",
        "elearning_default_duration",
        "elearning_horaires_text",
        "elearning_lieu_text",
        "convention_default_horaires",
        "convention_moyen_pedagogique",
        "convention_frais_default",
        "convention_affiche_frais",
      ]);

    const settings: Record<string, string> = {};
    for (const s of allSettings || []) {
      settings[s.setting_key] = s.setting_value || "";
    }

    const tvaRate = settings["tva_rate"] ? parseFloat(settings["tva_rate"]) : 20;
    const defaultPriceHt = settings["convention_default_price_ht"] ? parseFloat(settings["convention_default_price_ht"]) : 1250;
    const elearningDefaultDuration = settings["elearning_default_duration"] || "7";
    const elearningHorairesText = settings["elearning_horaires_text"] || "Formation accessible en ligne à votre rythme";
    const elearningLieuText = settings["elearning_lieu_text"] || "En ligne (plateforme e-learning)";
    const defaultHoraires = settings["convention_default_horaires"] || "9h00-17h00";
    const moyenPedagogique = settings["convention_moyen_pedagogique"] || "SuperTilt";
    const fraisDefault = settings["convention_frais_default"] || "0";
    const afficheFrais = settings["convention_affiche_frais"] || "Non";

    // Calculate price - for inter/e-learning use participant's sold_price_ht first, then training's, then input, then default
    const participantPrice = isIndividualConvention && singleParticipant
      ? (singleParticipant as any).sold_price_ht
      : null;
    const priceHt = participantPrice || inputPrice || training.sold_price_ht || defaultPriceHt;

    // Build client name and address
    let clientName = training.client_name;
    let clientAddress = training.client_address || "";

    // For inter-entreprises individual convention, use participant's company if available
    if (isIndividualConvention && singleParticipant) {
      const participantWithCompany = singleParticipant as Participant & {
        company?: string;
        sponsor_first_name?: string;
        sponsor_last_name?: string;
      };
      if (participantWithCompany.company) {
        clientName = participantWithCompany.company;
      }
    }

    if (mandatairePayeur) {
      clientAddress += ` – Mandataire Payeur : ${mandatairePayeur}`;
    }

    // Calculate TTC
    const prixTtc = priceHt * (1 + tvaRate / 100);

    // Build the payload for PDFMonkey
    const payload = {
      CLIENT: clientName,
      ADRESSE: clientAddress,
      TITRE_FORMATION: training.training_name,
      FORMAT: getFormatLabel(training.format_formation, training.location),
      PARTICIPANTS: maxParticipants > 0 ? maxParticipants.toString() : "1",
      URL_PROGRAMME_FORMATION: training.program_file_url || "",
      DATES: training.format_formation === "e_learning"
        ? `Du ${formatDateFrench(training.start_date)} au ${formatDateFrench(training.end_date || training.start_date)}`
        : formatDateRange(scheduleList),
      JOURS: training.format_formation === "e_learning"
        ? ((singleParticipant as any)?.elearning_duration || training.elearning_duration || elearningDefaultDuration).toString()
        : calculateTotalHours(scheduleList).toString(),
      NOMBRE_JOURS: training.format_formation === "e_learning"
        ? ((singleParticipant as any)?.elearning_duration || training.elearning_duration || elearningDefaultDuration).toString()
        : calculateTotalDays(scheduleList).toString(),
      HORAIRES: training.format_formation === "e_learning"
        ? elearningHorairesText
        : getTimeRange(scheduleList, defaultHoraires),
      LIEU: training.format_formation === "e_learning"
        ? elearningLieuText
        : training.location,
      STAGIAIRES: isIndividualConvention
        ? formatParticipants(participantList, participantList.length)
        : formatParticipants(participantList, maxParticipants),
      PRIX: priceHt.toString(),
      TVA: tvaRate.toString(),
      PRIX_TTC: prixTtc.toFixed(2),
      FRAIS: fraisDefault,
      AFFICHE_FRAIS: afficheFrais,
      SUBROGATION: subrogation ? "Oui" : "Non",
      MOYEN_PEDAGOGIQUE: moyenPedagogique,
      _date: new Date().toISOString().split("T")[0],
    };

    console.log("PDFMonkey payload:", JSON.stringify(payload));
    console.log("Convention type:", isIndividualConvention ? "individual (inter/e-learning)" : "global (intra)");

    // Create document
    const createResponse = await fetch("https://api.pdfmonkey.io/api/v1/documents", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${pdfMonkeyApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document: {
          document_template_id: CONVENTION_TEMPLATE_ID,
          payload: payload,
          status: "pending",
        },
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("PDFMonkey create error:", errorText);
      throw new Error(`Erreur creation PDF: ${errorText}`);
    }

    const createData = await createResponse.json();
    const documentId = createData.document.id;
    console.log(`Document created with ID: ${documentId}`);

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const statusResponse = await fetch(
        `https://api.pdfmonkey.io/api/v1/documents/${documentId}`,
        {
          headers: {
            "Authorization": `Bearer ${pdfMonkeyApiKey}`,
          },
        }
      );

      if (!statusResponse.ok) {
        throw new Error("Erreur verification statut PDF");
      }

      const statusData = await statusResponse.json();
      const status = statusData.document.status;

      console.log(`Document status: ${status}`);

      if (status === "success") {
        const pdfUrl = statusData.document.download_url;
        console.log(`PDF ready: ${pdfUrl}`);

        // Save convention URL to training (only for intra/global convention)
        if (!isIndividualConvention) {
          try {
            await supabase
              .from("trainings")
              .update({ convention_file_url: pdfUrl })
              .eq("id", trainingId);
            console.log("Convention URL saved to training");
          } catch (saveError) {
            console.warn("Failed to save convention URL:", saveError);
          }
        }

        // Save convention URL and document ID on participant (for individual conventions)
        if (isIndividualConvention && participantId) {
          try {
            await supabase
              .from("training_participants")
              .update({
                convention_file_url: pdfUrl,
                convention_document_id: documentId,
              })
              .eq("id", participantId);
            console.log("Convention URL and document ID saved to participant");
          } catch (saveError) {
            console.warn("Failed to save convention data on participant:", saveError);
          }
        }

        // Log activity
        try {
          await supabase.from("activity_logs").insert({
            action_type: "convention_formation_generated",
            recipient_email: singleParticipant?.email || training.sponsor_email || null,
            details: {
              training_id: trainingId,
              training_name: training.training_name,
              client_name: clientName,
              pdf_url: pdfUrl,
              document_id: documentId,
              subrogation: subrogation,
              nb_participants: participantList.length,
              convention_type: isIndividualConvention ? "individual" : "global",
              participant_id: participantId || null,
              participant_name: singleParticipant
                ? `${singleParticipant.first_name || ""} ${singleParticipant.last_name || ""}`.trim()
                : null,
            },
          });
        } catch (logError) {
          console.warn("Failed to log activity:", logError);
        }

        // Build filename: Convention_CLIENT_FORMATION.pdf
        const clientPart = sanitizeForFilename(clientName || "Client");
        const formationPart = sanitizeForFilename(training.training_name || "Formation");
        const participantPart = singleParticipant
          ? `_${sanitizeForFilename(`${singleParticipant.first_name || ""} ${singleParticipant.last_name || ""}`.trim() || "Participant")}`
          : "";
        const fileName = `Convention_${clientPart}_${formationPart}${participantPart}.pdf`;

        return new Response(
          JSON.stringify({
            success: true,
            pdfUrl,
            documentId,
            fileName,
            conventionType: isIndividualConvention ? "individual" : "global",
            participantId: participantId || null,
            message: "Convention de formation generee avec succes",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (status === "failure") {
        throw new Error(`Generation PDF echouee: ${statusData.document.failure_cause}`);
      }

      attempts++;
    }

    throw new Error("Delai de generation PDF depasse");
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
