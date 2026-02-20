import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Process Logistics & Convention Reminders
 *
 * Called daily at 7:00 AM by a cron job.
 * 1. Finds trainings where train_booked or hotel_booked is false (logistics)
 * 2. Finds trainings/participants without generated convention (except already-paid)
 * 3. Finds intra trainings waiting for signed convention / participants without signed convention
 * Sends a single digest email to admin.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VERSION = "process-logistics-reminders@2.0.0";

serve(async (req) => {
  console.log(`[${VERSION}] Starting...`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const appUrl = Deno.env.get("APP_URL") || "https://super-tools.lovable.app";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split("T")[0];
    console.log(`[${VERSION}] Checking for trainings starting after ${today}`);

    // Fetch all future trainings
    const { data: allTrainings, error: fetchError } = await supabase
      .from("trainings")
      .select("id, training_name, start_date, location, train_booked, hotel_booked, format_formation, convention_file_url, signed_convention_urls, sponsor_email")
      .gt("start_date", today);

    if (fetchError) {
      console.error(`[${VERSION}] Error fetching trainings:`, fetchError);
      throw fetchError;
    }

    const trainings = allTrainings || [];

    // Fetch all participants for future trainings
    const trainingIds = trainings.map((t) => t.id);
    const { data: allParticipants } = trainingIds.length > 0
      ? await supabase
          .from("training_participants")
          .select("id, training_id, first_name, last_name, email, company, convention_file_url, signed_convention_url, sponsor_email, payment_mode")
          .in("training_id", trainingIds)
      : { data: [] };

    const participants = allParticipants || [];

    // Fetch convention signatures for future trainings
    const { data: allSignatures } = trainingIds.length > 0
      ? await supabase
          .from("convention_signatures")
          .select("training_id, recipient_email, status")
          .in("training_id", trainingIds)
      : { data: [] };

    const signatures = allSignatures || [];

    // Group participants and signatures by training
    const participantsByTraining = new Map<string, typeof participants>();
    for (const p of participants) {
      const list = participantsByTraining.get(p.training_id) || [];
      list.push(p);
      participantsByTraining.set(p.training_id, list);
    }

    const signaturesByKey = new Map<string, string>();
    for (const sig of signatures) {
      signaturesByKey.set(`${sig.training_id}:${sig.recipient_email}`, sig.status);
    }

    // Get admin email
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", "admin")
      .limit(1);

    const adminEmail = adminProfiles?.[0]?.email || "romain@supertilt.fr";

    // Build alerts
    const alertSections: string[] = [];

    // ── 1. LOGISTICS ALERTS ──
    const logisticsAlerts: string[] = [];
    const todayDate = new Date(today);
    for (const t of trainings) {
      if (t.format_formation === "e_learning") continue;
      const missing: string[] = [];
      // Train: only alert within 2 months (SNCF bookings open ~60 days before)
      const startDate = new Date(t.start_date);
      const daysUntilTraining = Math.ceil((startDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
      if (!t.train_booked && daysUntilTraining <= 60) missing.push("Train");
      if (!t.hotel_booked) missing.push("Hôtel");
      if (missing.length === 0) continue;

      const trainingDate = new Date(t.start_date).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });

      logisticsAlerts.push(
        `<li><a href="${appUrl}/formations/${t.id}" style="color: #1a1a2e; text-decoration: underline;">${t.training_name}</a> (${trainingDate}, ${t.location}) — <strong>${missing.join(" et ")}</strong> non réservé${missing.length > 1 ? "s" : ""}</li>`
      );
    }

    if (logisticsAlerts.length > 0) {
      alertSections.push(`
        <div style="margin-bottom: 24px;">
          <h3 style="color: #F59E0B; margin: 0 0 8px 0; font-size: 16px;">🚆 Réservations en attente</h3>
          <ul style="margin: 0; padding-left: 20px;">${logisticsAlerts.join("")}</ul>
        </div>
      `);
    }

    // ── 2. CONVENTION NOT GENERATED ──
    const conventionNotGenerated: string[] = [];

    for (const t of trainings) {
      const isIntra = t.format_formation === "intra";
      const isInterOrElearning = t.format_formation === "inter-entreprises" || t.format_formation === "e_learning";

      if (isIntra) {
        // For intra: check if training-level convention is generated
        if (!t.convention_file_url) {
          const trainingDate = new Date(t.start_date).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
          });
          conventionNotGenerated.push(
            `<li><a href="${appUrl}/formations/${t.id}" style="color: #1a1a2e; text-decoration: underline;">${t.training_name}</a> (${trainingDate}) — Convention de formation non générée</li>`
          );
        }
      } else if (isInterOrElearning) {
        // For inter/e-learning: check per-participant conventions (except already paid online)
        const tParticipants = participantsByTraining.get(t.id) || [];
        const missingParticipants = tParticipants.filter(
          (p) => !p.convention_file_url && p.payment_mode !== "online"
        );

        if (missingParticipants.length > 0) {
          const names = missingParticipants.map(
            (p) => `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email
          );
          const trainingDate = new Date(t.start_date).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
          });
          conventionNotGenerated.push(
            `<li><a href="${appUrl}/formations/${t.id}" style="color: #1a1a2e; text-decoration: underline;">${t.training_name}</a> (${trainingDate}) — Convention non générée pour : ${names.join(", ")}</li>`
          );
        }
      }
    }

    if (conventionNotGenerated.length > 0) {
      alertSections.push(`
        <div style="margin-bottom: 24px;">
          <h3 style="color: #EF4444; margin: 0 0 8px 0; font-size: 16px;">📄 Conventions non générées</h3>
          <ul style="margin: 0; padding-left: 20px;">${conventionNotGenerated.join("")}</ul>
        </div>
      `);
    }

    // ── 3. CONVENTION NOT SIGNED ──
    const conventionNotSigned: string[] = [];

    for (const t of trainings) {
      const isIntra = t.format_formation === "intra";
      const isInterOrElearning = t.format_formation === "inter-entreprises" || t.format_formation === "e_learning";

      if (isIntra) {
        // For intra: convention generated but not signed
        if (t.convention_file_url) {
          const signedUrls = t.signed_convention_urls || [];
          if (signedUrls.length === 0) {
            // Check if there's a pending electronic signature
            const sigKey = `${t.id}:${t.sponsor_email}`;
            const sigStatus = signaturesByKey.get(sigKey);
            const label = sigStatus === "signed"
              ? null // Already signed electronically
              : sigStatus === "pending"
                ? "En attente de signature électronique"
                : "Convention non signée (aucun retour)";

            if (label) {
              const trainingDate = new Date(t.start_date).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
              });
              conventionNotSigned.push(
                `<li><a href="${appUrl}/formations/${t.id}" style="color: #1a1a2e; text-decoration: underline;">${t.training_name}</a> (${trainingDate}) — ${label}</li>`
              );
            }
          }
        }
      } else if (isInterOrElearning) {
        // For inter/e-learning: per-participant convention signed status
        const tParticipants = participantsByTraining.get(t.id) || [];
        const unsignedParticipants: string[] = [];

        for (const p of tParticipants) {
          if (p.payment_mode === "online") continue; // Skip already-paid
          if (!p.convention_file_url) continue; // Convention not generated yet (handled above)
          if (p.signed_convention_url) continue; // Manually uploaded signed version

          // Check electronic signature
          const sigKey = `${t.id}:${p.sponsor_email}`;
          const sigStatus = signaturesByKey.get(sigKey);
          if (sigStatus === "signed") continue; // Signed electronically

          unsignedParticipants.push(
            `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email
          );
        }

        if (unsignedParticipants.length > 0) {
          const trainingDate = new Date(t.start_date).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
          });
          conventionNotSigned.push(
            `<li><a href="${appUrl}/formations/${t.id}" style="color: #1a1a2e; text-decoration: underline;">${t.training_name}</a> (${trainingDate}) — Convention non signée pour : ${unsignedParticipants.join(", ")}</li>`
          );
        }
      }
    }

    if (conventionNotSigned.length > 0) {
      alertSections.push(`
        <div style="margin-bottom: 24px;">
          <h3 style="color: #F97316; margin: 0 0 8px 0; font-size: 16px;">✍️ Conventions en attente de signature</h3>
          <ul style="margin: 0; padding-left: 20px;">${conventionNotSigned.join("")}</ul>
        </div>
      `);
    }

    // ── 4. FAILED EMAILS ──
    const failedEmailAlerts: string[] = [];

    // Check scheduled_emails with failed status
    const { data: failedScheduled } = await supabase
      .from("scheduled_emails")
      .select("id, email_type, training_id, created_at, error_message, trainings(training_name)")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(20);

    if (failedScheduled && failedScheduled.length > 0) {
      for (const fe of failedScheduled) {
        const trainingName = (fe as any).trainings?.training_name || "—";
        const date = new Date(fe.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        failedEmailAlerts.push(
          `<li><strong>${fe.email_type}</strong> — ${trainingName} (${date})<br/><span style="color: #999; font-size: 12px;">${fe.error_message || "Erreur inconnue"}</span></li>`
        );
      }
    }

    // Check failed_emails table
    const { data: failedAdhoc } = await supabase
      .from("failed_emails")
      .select("id, recipient_email, subject, error_message, email_type, created_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(20);

    if (failedAdhoc && failedAdhoc.length > 0) {
      for (const fe of failedAdhoc) {
        const date = new Date(fe.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        failedEmailAlerts.push(
          `<li><strong>${fe.subject}</strong> → ${fe.recipient_email} (${date})<br/><span style="color: #999; font-size: 12px;">${fe.error_message || "Erreur inconnue"}</span></li>`
        );
      }
    }

    if (failedEmailAlerts.length > 0) {
      alertSections.push(`
        <div style="margin-bottom: 24px;">
          <h3 style="color: #DC2626; margin: 0 0 8px 0; font-size: 16px;">❌ Emails en erreur (${failedEmailAlerts.length})</h3>
          <ul style="margin: 0; padding-left: 20px;">${failedEmailAlerts.join("")}</ul>
          <p style="margin-top: 8px;"><a href="${appUrl}/emails-erreur" style="color: #1a1a2e; text-decoration: underline; font-size: 14px;">Voir le détail →</a></p>
        </div>
      `);
    }

    // ── SEND DIGEST EMAIL ──
    if (alertSections.length === 0) {
      console.log(`[${VERSION}] No alerts to send`);
      return new Response(
        JSON.stringify({ success: true, message: "No alerts", _version: VERSION }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const totalAlerts = logisticsAlerts.length + conventionNotGenerated.length + conventionNotSigned.length + failedEmailAlerts.length;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Bonjour,</p>
        <p>Voici le récapitulatif des alertes pour vos formations à venir :</p>
        ${alertSections.join("")}
        <p>
          <a href="${appUrl}/formations" style="display: inline-block; background-color: #1a1a2e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">
            Voir toutes les formations
          </a>
        </p>
        <p style="color: #666; font-size: 14px; margin-top: 20px;">
          <strong>SuperTools</strong> — Alertes automatiques
        </p>
      </div>
    `;

    try {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "Romain Couturier <romain@supertilt.fr>",
          to: [adminEmail],
          subject: `🔔 ${totalAlerts} alerte${totalAlerts > 1 ? "s" : ""} formation${totalAlerts > 1 ? "s" : ""}`,
          html: htmlContent,
        }),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error(`[${VERSION}] Email failed:`, errorText);
      } else {
        console.log(`[${VERSION}] Digest email sent with ${totalAlerts} alerts`);
      }
    } catch (error) {
      console.error(`[${VERSION}] Error sending digest email:`, error);
    }

    console.log(`[${VERSION}] Completed: ${totalAlerts} alert(s) in digest`);

    return new Response(
      JSON.stringify({
        success: true,
        logistics: logisticsAlerts.length,
        conventionNotGenerated: conventionNotGenerated.length,
        conventionNotSigned: conventionNotSigned.length,
        failedEmails: failedEmailAlerts.length,
        total: totalAlerts,
        _version: VERSION,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error(`[${VERSION}] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, _version: VERSION }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
