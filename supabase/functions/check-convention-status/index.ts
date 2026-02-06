import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { sendEmail } from "../_shared/resend.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALERT_EMAIL = "romain@supertilt.fr";

interface TrainingIssue {
  trainingName: string;
  clientName: string;
  startDate: string;
  format: string;
  sponsorEmail: string | null;
  issues: string[];
}

function formatDateFr(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch upcoming trainings (start_date >= today)
    const today = new Date().toISOString().split("T")[0];

    const { data: trainings, error: trainingsError } = await supabase
      .from("trainings")
      .select("id, training_name, start_date, format_formation, convention_file_url, client_name, sponsor_email")
      .gte("start_date", today)
      .order("start_date", { ascending: true });

    if (trainingsError) {
      console.error("Error fetching trainings:", trainingsError);
      throw new Error("Impossible de récupérer les formations");
    }

    if (!trainings || trainings.length === 0) {
      console.log("No upcoming trainings found");
      return new Response(
        JSON.stringify({ success: true, message: "Aucune formation à venir", issues: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch convention email logs for all upcoming trainings
    const trainingIds = trainings.map((t) => t.id);

    const { data: conventionLogs } = await supabase
      .from("activity_logs")
      .select("details")
      .eq("action_type", "convention_email_sent");

    // Build a set of training IDs that have had convention emails sent
    const sentTrainingIds = new Set<string>();
    if (conventionLogs) {
      for (const log of conventionLogs) {
        const details = log.details as { training_id?: string } | null;
        if (details?.training_id && trainingIds.includes(details.training_id)) {
          sentTrainingIds.add(details.training_id);
        }
      }
    }

    // For inter-entreprises, also check per-participant convention emails
    // Fetch participants for inter trainings
    const interTrainingIds = trainings
      .filter((t) => t.format_formation === "inter-entreprises" || t.format_formation === "e_learning")
      .map((t) => t.id);

    let participantsByTraining: Record<string, number> = {};
    let conventionsSentByTraining: Record<string, number> = {};

    if (interTrainingIds.length > 0) {
      const { data: participants } = await supabase
        .from("training_participants")
        .select("id, training_id")
        .in("training_id", interTrainingIds);

      if (participants) {
        for (const p of participants) {
          participantsByTraining[p.training_id] = (participantsByTraining[p.training_id] || 0) + 1;
        }
      }

      // Count convention emails sent per inter training
      if (conventionLogs) {
        for (const log of conventionLogs) {
          const details = log.details as { training_id?: string; convention_type?: string } | null;
          if (details?.training_id && interTrainingIds.includes(details.training_id)) {
            conventionsSentByTraining[details.training_id] =
              (conventionsSentByTraining[details.training_id] || 0) + 1;
          }
        }
      }
    }

    // Identify issues
    const issuesList: TrainingIssue[] = [];

    for (const training of trainings) {
      const issues: string[] = [];
      const isIntra = training.format_formation === "intra";
      const isInter = training.format_formation === "inter-entreprises" || training.format_formation === "e_learning";
      const days = daysUntil(training.start_date);

      // Check convention generated
      if (!training.convention_file_url) {
        issues.push(`Convention NON GÉNÉRÉE (formation dans ${days} jour${days > 1 ? "s" : ""})`);
      }

      // Check convention sent
      if (isIntra) {
        // For intra: check if at least one convention email was sent
        if (!sentTrainingIds.has(training.id)) {
          if (training.convention_file_url) {
            issues.push("Convention générée mais NON ENVOYÉE au client");
          }
        }
      } else if (isInter) {
        // For inter: check per participant
        const nbParticipants = participantsByTraining[training.id] || 0;
        const nbSent = conventionsSentByTraining[training.id] || 0;

        if (nbParticipants > 0 && nbSent < nbParticipants) {
          issues.push(
            `Convention envoyée à ${nbSent}/${nbParticipants} participant${nbParticipants > 1 ? "s" : ""}`
          );
        }
      }

      if (issues.length > 0) {
        issuesList.push({
          trainingName: training.training_name,
          clientName: training.client_name || "Client inconnu",
          startDate: training.start_date,
          format: training.format_formation || "inconnu",
          sponsorEmail: training.sponsor_email,
          issues,
        });
      }
    }

    console.log(`Found ${issuesList.length} training(s) with convention issues`);

    if (issuesList.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Toutes les conventions sont en ordre", issues: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build urgent alert email
    const rows = issuesList
      .map((item) => {
        const daysLeft = daysUntil(item.startDate);
        const urgencyColor = daysLeft <= 7 ? "#dc2626" : daysLeft <= 14 ? "#ea580c" : "#ca8a04";
        const issueItems = item.issues.map((i) => `<li>${i}</li>`).join("");

        return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <strong>${item.trainingName}</strong><br/>
            <span style="color: #6b7280; font-size: 13px;">${item.clientName} — ${item.format}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <span style="color: ${urgencyColor}; font-weight: bold;">
              ${formatDateFr(item.startDate)} (J-${daysLeft})
            </span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <ul style="margin: 0; padding-left: 16px; color: #dc2626;">${issueItems}</ul>
          </td>
        </tr>`;
      })
      .join("");

    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 700px;">
      <div style="background-color: #dc2626; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">⚠️ ALERTE — Conventions de formation manquantes</h2>
      </div>
      <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p>${issuesList.length} formation${issuesList.length > 1 ? "s" : ""} à venir ${issuesList.length > 1 ? "nécessitent" : "nécessite"} une action sur la convention :</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
          <thead>
            <tr style="background-color: #f9fafb;">
              <th style="padding: 10px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Formation</th>
              <th style="padding: 10px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Date</th>
              <th style="padding: 10px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Problème</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <p style="margin-top: 20px; color: #6b7280; font-size: 13px;">
          Ce contrôle est effectué automatiquement chaque jour à 6h00.
        </p>
      </div>
    </div>`;

    const result = await sendEmail({
      to: ALERT_EMAIL,
      subject: `🚨 URGENT — ${issuesList.length} convention${issuesList.length > 1 ? "s" : ""} manquante${issuesList.length > 1 ? "s" : ""} pour des formations à venir`,
      html: htmlContent,
    });

    if (!result.success) {
      throw new Error(`Erreur d'envoi de l'alerte: ${result.error}`);
    }

    // Log the check
    try {
      await supabase.from("activity_logs").insert({
        action_type: "convention_status_check",
        recipient_email: ALERT_EMAIL,
        details: {
          issues_count: issuesList.length,
          trainings_checked: trainings.length,
          issues: issuesList.map((i) => ({
            training_name: i.trainingName,
            start_date: i.startDate,
            issues: i.issues,
          })),
        },
      });
    } catch (logError) {
      console.warn("Failed to log activity:", logError);
    }

    console.log(`Alert email sent to ${ALERT_EMAIL} for ${issuesList.length} issue(s)`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Alerte envoyée pour ${issuesList.length} formation(s)`,
        issues: issuesList.length,
        details: issuesList,
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
