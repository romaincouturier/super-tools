import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderFrom } from "../_shared/email-settings.ts";

/**
 * Process Logistics & Convention Reminders — Per-user edition
 *
 * Called daily at 7:00 AM by a cron job.
 * Sends individual digest emails to each user based on their assigned trainings.
 * Admins receive ALL alerts; non-admin users receive only alerts
 * for trainings where assigned_to = their user_id.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VERSION = "process-logistics-reminders@3.0.0";

// ─── Types ───
interface AlertRecipient {
  userId: string;
  email: string;
  firstName: string;
  isAdmin: boolean;
}

interface TrainingAlert {
  trainingId: string;
  assignedTo: string | null;
  html: string;
}

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
    const todayDate = new Date(today);
    console.log(`[${VERSION}] Checking for trainings starting after ${today}`);

    // ── Fetch all recipients: users with 'formations' module access OR admins ──
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("user_id, email, first_name, is_admin");

    const { data: moduleAccess } = await supabase
      .from("user_module_access")
      .select("user_id")
      .eq("module", "formations");

    const formationsUserIds = new Set((moduleAccess || []).map((m: any) => m.user_id));

    const recipients: AlertRecipient[] = (allProfiles || [])
      .filter((p: any) => p.is_admin || formationsUserIds.has(p.user_id))
      .map((p: any) => ({
        userId: p.user_id,
        email: p.email,
        firstName: p.first_name || p.email.split("@")[0],
        isAdmin: p.is_admin === true,
      }));

    if (recipients.length === 0) {
      console.log(`[${VERSION}] No recipients found`);
      return new Response(
        JSON.stringify({ success: true, message: "No recipients", _version: VERSION }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[${VERSION}] Found ${recipients.length} recipient(s)`);

    // ── Fetch all future trainings (with assigned_to) ──
    const { data: allTrainings, error: fetchError } = await supabase
      .from("trainings")
      .select("id, training_name, start_date, location, train_booked, hotel_booked, format_formation, convention_file_url, signed_convention_urls, sponsor_email, assigned_to")
      .gt("start_date", today);

    if (fetchError) {
      console.error(`[${VERSION}] Error fetching trainings:`, fetchError);
      throw fetchError;
    }

    const trainings = allTrainings || [];
    const trainingIds = trainings.map((t) => t.id);

    // ── Fetch participants and signatures in bulk ──
    const { data: allParticipants } = trainingIds.length > 0
      ? await supabase
          .from("training_participants")
          .select("id, training_id, first_name, last_name, email, company, convention_file_url, signed_convention_url, sponsor_email, payment_mode")
          .in("training_id", trainingIds)
      : { data: [] };
    const participants = allParticipants || [];

    const { data: allSignatures } = trainingIds.length > 0
      ? await supabase
          .from("convention_signatures")
          .select("training_id, recipient_email, status")
          .in("training_id", trainingIds)
      : { data: [] };
    const signatures = allSignatures || [];

    // Group by training
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

    // ── Build per-training alerts ──
    // Each alert carries its trainingId and assigned_to so we can route it

    // Helper to check if a user should see a training alert
    const userCanSeeTraining = (recipient: AlertRecipient, assignedTo: string | null): boolean => {
      if (recipient.isAdmin) return true;
      return assignedTo === recipient.userId;
    };

    // 1. LOGISTICS ALERTS (per training)
    const logisticsAlertsByTraining: TrainingAlert[] = [];
    for (const t of trainings) {
      if (t.format_formation === "e_learning") continue;
      const missing: string[] = [];
      const startDate = new Date(t.start_date);
      const daysUntilTraining = Math.ceil((startDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
      if (!t.train_booked && daysUntilTraining <= 60) missing.push("Train");
      if (!t.hotel_booked) missing.push("Hôtel");
      if (missing.length === 0) continue;

      const trainingDate = new Date(t.start_date).toLocaleDateString("fr-FR", {
        weekday: "long", day: "numeric", month: "long",
      });

      logisticsAlertsByTraining.push({
        trainingId: t.id,
        assignedTo: t.assigned_to,
        html: `<li><a href="${appUrl}/formations/${t.id}" style="color: #1a1a2e; text-decoration: underline;">${t.training_name}</a> (${trainingDate}, ${t.location}) — <strong>${missing.join(" et ")}</strong> non réservé${missing.length > 1 ? "s" : ""}</li>`,
      });
    }

    // 2. CONVENTION NOT GENERATED (per training)
    const conventionNotGenAlertsByTraining: TrainingAlert[] = [];
    for (const t of trainings) {
      const isIntra = t.format_formation === "intra";
      const isInterOrElearning = t.format_formation === "inter-entreprises" || t.format_formation === "e_learning";

      if (isIntra && !t.convention_file_url) {
        const trainingDate = new Date(t.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
        conventionNotGenAlertsByTraining.push({
          trainingId: t.id,
          assignedTo: t.assigned_to,
          html: `<li><a href="${appUrl}/formations/${t.id}" style="color: #1a1a2e; text-decoration: underline;">${t.training_name}</a> (${trainingDate}) — Convention de formation non générée</li>`,
        });
      } else if (isInterOrElearning) {
        const tParticipants = participantsByTraining.get(t.id) || [];
        const missingParticipants = tParticipants.filter(
          (p) => !p.convention_file_url && p.payment_mode !== "online"
        );
        if (missingParticipants.length > 0) {
          const names = missingParticipants.map(
            (p) => `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email
          );
          const trainingDate = new Date(t.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
          conventionNotGenAlertsByTraining.push({
            trainingId: t.id,
            assignedTo: t.assigned_to,
            html: `<li><a href="${appUrl}/formations/${t.id}" style="color: #1a1a2e; text-decoration: underline;">${t.training_name}</a> (${trainingDate}) — Convention non générée pour : ${names.join(", ")}</li>`,
          });
        }
      }
    }

    // 3. CONVENTION NOT SIGNED (per training)
    const conventionNotSignedAlertsByTraining: TrainingAlert[] = [];
    for (const t of trainings) {
      const isIntra = t.format_formation === "intra";
      const isInterOrElearning = t.format_formation === "inter-entreprises" || t.format_formation === "e_learning";

      if (isIntra && t.convention_file_url) {
        const signedUrls = t.signed_convention_urls || [];
        if (signedUrls.length === 0) {
          const sigKey = `${t.id}:${t.sponsor_email}`;
          const sigStatus = signaturesByKey.get(sigKey);
          const label = sigStatus === "signed"
            ? null
            : sigStatus === "pending"
              ? "En attente de signature électronique"
              : "Convention non signée (aucun retour)";

          if (label) {
            const trainingDate = new Date(t.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
            conventionNotSignedAlertsByTraining.push({
              trainingId: t.id,
              assignedTo: t.assigned_to,
              html: `<li><a href="${appUrl}/formations/${t.id}" style="color: #1a1a2e; text-decoration: underline;">${t.training_name}</a> (${trainingDate}) — ${label}</li>`,
            });
          }
        }
      } else if (isInterOrElearning) {
        const tParticipants = participantsByTraining.get(t.id) || [];
        const unsignedNames: string[] = [];
        for (const p of tParticipants) {
          if (p.payment_mode === "online") continue;
          if (!p.convention_file_url) continue;
          if (p.signed_convention_url) continue;
          const sigKey = `${t.id}:${p.sponsor_email}`;
          const sigStatus = signaturesByKey.get(sigKey);
          if (sigStatus === "signed") continue;
          unsignedNames.push(`${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email);
        }
        if (unsignedNames.length > 0) {
          const trainingDate = new Date(t.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
          conventionNotSignedAlertsByTraining.push({
            trainingId: t.id,
            assignedTo: t.assigned_to,
            html: `<li><a href="${appUrl}/formations/${t.id}" style="color: #1a1a2e; text-decoration: underline;">${t.training_name}</a> (${trainingDate}) — Convention non signée pour : ${unsignedNames.join(", ")}</li>`,
          });
        }
      }
    }

    // 6. TRAININGS FINISHED WITHOUT INVOICE (per training)
    const invoiceAlertsByTraining: TrainingAlert[] = [];
    const { data: pastTrainings } = await supabase
      .from("trainings")
      .select("id, training_name, start_date, end_date, invoice_file_url, assigned_to")
      .lt("start_date", today)
      .is("invoice_file_url", null);

    if (pastTrainings) {
      for (const t of pastTrainings) {
        const endDate = t.end_date || t.start_date;
        if (new Date(endDate) >= new Date(today)) continue;

        const daysAgo = Math.ceil((Date.now() - new Date(endDate).getTime()) / (1000 * 60 * 60 * 24));
        const formattedDate = new Date(endDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

        invoiceAlertsByTraining.push({
          trainingId: t.id,
          assignedTo: t.assigned_to,
          html: `<li><a href="${appUrl}/formations/${t.id}" style="color: #1a1a2e; text-decoration: underline;">${t.training_name}</a> — terminée le ${formattedDate} (il y a ${daysAgo}j)</li>`,
        });
      }
    }

    // ── 4. FAILED EMAILS (admin-only, not per-training) ──
    const failedEmailAlerts: string[] = [];

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

    // ── 5. PENDING CONTENT REVIEWS (per-reviewer) ──
    const { data: pendingReviews } = await supabase
      .from("content_reviews")
      .select("id, card_id, reviewer_email, status, created_at, content_cards(title)")
      .in("status", ["pending", "in_review"])
      .order("created_at", { ascending: true });

    // Group reviews by reviewer email
    const reviewsByReviewerEmail = new Map<string, typeof pendingReviews>();
    if (pendingReviews) {
      for (const review of pendingReviews) {
        const email = review.reviewer_email || "";
        const list = reviewsByReviewerEmail.get(email) || [];
        list.push(review);
        reviewsByReviewerEmail.set(email, list);
      }
    }

    // ── SEND PER-USER DIGEST EMAILS ──
    const senderFrom = await getSenderFrom();
    let emailsSent = 0;
    let totalAlertsSent = 0;

    for (const recipient of recipients) {
      const sections: string[] = [];

      // Filter training alerts for this user
      const userLogistics = logisticsAlertsByTraining.filter(
        (a) => userCanSeeTraining(recipient, a.assignedTo)
      );
      if (userLogistics.length > 0) {
        sections.push(`
          <div style="margin-bottom: 24px;">
            <h3 style="color: #F59E0B; margin: 0 0 8px 0; font-size: 16px;">🚆 Réservations en attente</h3>
            <ul style="margin: 0; padding-left: 20px;">${userLogistics.map((a) => a.html).join("")}</ul>
          </div>
        `);
      }

      const userConvNotGen = conventionNotGenAlertsByTraining.filter(
        (a) => userCanSeeTraining(recipient, a.assignedTo)
      );
      if (userConvNotGen.length > 0) {
        sections.push(`
          <div style="margin-bottom: 24px;">
            <h3 style="color: #EF4444; margin: 0 0 8px 0; font-size: 16px;">📄 Conventions non générées</h3>
            <ul style="margin: 0; padding-left: 20px;">${userConvNotGen.map((a) => a.html).join("")}</ul>
          </div>
        `);
      }

      const userConvNotSigned = conventionNotSignedAlertsByTraining.filter(
        (a) => userCanSeeTraining(recipient, a.assignedTo)
      );
      if (userConvNotSigned.length > 0) {
        sections.push(`
          <div style="margin-bottom: 24px;">
            <h3 style="color: #F97316; margin: 0 0 8px 0; font-size: 16px;">✍️ Conventions en attente de signature</h3>
            <ul style="margin: 0; padding-left: 20px;">${userConvNotSigned.map((a) => a.html).join("")}</ul>
          </div>
        `);
      }

      // Failed emails — admin only
      if (recipient.isAdmin && failedEmailAlerts.length > 0) {
        sections.push(`
          <div style="margin-bottom: 24px;">
            <h3 style="color: #DC2626; margin: 0 0 8px 0; font-size: 16px;">❌ Emails en erreur (${failedEmailAlerts.length})</h3>
            <ul style="margin: 0; padding-left: 20px;">${failedEmailAlerts.join("")}</ul>
            <p style="margin-top: 8px;"><a href="${appUrl}/emails-erreur" style="color: #1a1a2e; text-decoration: underline; font-size: 14px;">Voir le détail →</a></p>
          </div>
        `);
      }

      // Pending reviews — show the user's own reviews, or all for admin
      const userReviews = reviewsByReviewerEmail.get(recipient.email);
      if (recipient.isAdmin && pendingReviews && pendingReviews.length > 0) {
        // Admin sees all pending reviews grouped by reviewer
        const reviewItems: string[] = [];
        for (const [reviewer, reviews] of reviewsByReviewerEmail) {
          const items = reviews.map((r: any) => {
            const cardTitle = r.content_cards?.title || "Sans titre";
            const daysAgo = Math.ceil((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24));
            const statusLabel = r.status === "pending" ? "En attente" : "En cours";
            return `<a href="${appUrl}/contenu?card=${r.card_id}" style="color: #1a1a2e; text-decoration: underline;">${cardTitle}</a> — ${statusLabel} (${daysAgo}j)`;
          });
          reviewItems.push(
            `<li><strong>${reviewer}</strong> : ${items.join(" · ")}</li>`
          );
        }
        sections.push(`
          <div style="margin-bottom: 24px;">
            <h3 style="color: #8B5CF6; margin: 0 0 8px 0; font-size: 16px;">📋 Relectures en attente</h3>
            <ul style="margin: 0; padding-left: 20px;">${reviewItems.join("")}</ul>
            <p style="margin-top: 8px;"><a href="${appUrl}/contenu" style="color: #1a1a2e; text-decoration: underline; font-size: 14px;">Voir le tableau de contenu →</a></p>
          </div>
        `);
      } else if (userReviews && userReviews.length > 0) {
        // Non-admin sees only their own reviews
        const items = userReviews.map((r: any) => {
          const cardTitle = r.content_cards?.title || "Sans titre";
          const daysAgo = Math.ceil((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24));
          const statusLabel = r.status === "pending" ? "En attente" : "En cours";
          return `<li><a href="${appUrl}/contenu?card=${r.card_id}" style="color: #1a1a2e; text-decoration: underline;">${cardTitle}</a> — ${statusLabel} (${daysAgo}j)</li>`;
        });
        sections.push(`
          <div style="margin-bottom: 24px;">
            <h3 style="color: #8B5CF6; margin: 0 0 8px 0; font-size: 16px;">📋 Tes relectures en attente</h3>
            <ul style="margin: 0; padding-left: 20px;">${items.join("")}</ul>
            <p style="margin-top: 8px;"><a href="${appUrl}/contenu" style="color: #1a1a2e; text-decoration: underline; font-size: 14px;">Voir le tableau de contenu →</a></p>
          </div>
        `);
      }

      // Invoice alerts (per training)
      const userInvoiceAlerts = invoiceAlertsByTraining.filter(
        (a) => userCanSeeTraining(recipient, a.assignedTo)
      );
      if (userInvoiceAlerts.length > 0) {
        sections.push(`
          <div style="margin-bottom: 24px;">
            <h3 style="color: #EF4444; margin: 0 0 8px 0; font-size: 16px;">🧾 Formations terminées sans facture (${userInvoiceAlerts.length})</h3>
            <ul style="margin: 0; padding-left: 20px;">${userInvoiceAlerts.map((a) => a.html).join("")}</ul>
          </div>
        `);
      }

      // Skip if no alerts for this user
      if (sections.length === 0) continue;

      const alertCount =
        userLogistics.length +
        userConvNotGen.length +
        userConvNotSigned.length +
        (recipient.isAdmin ? failedEmailAlerts.length : 0) +
        (recipient.isAdmin
          ? (pendingReviews?.length || 0)
          : (userReviews?.length || 0)) +
        userInvoiceAlerts.length;

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <p>Bonjour ${recipient.firstName},</p>
          <p>Voici le récapitulatif de tes alertes :</p>
          ${sections.join("")}
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
            from: senderFrom,
            to: [recipient.email],
            subject: `🔔 ${alertCount} alerte${alertCount > 1 ? "s" : ""} formation${alertCount > 1 ? "s" : ""}`,
            html: htmlContent,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error(`[${VERSION}] Email failed for ${recipient.email}:`, errorText);
        } else {
          emailsSent++;
          totalAlertsSent += alertCount;
          console.log(`[${VERSION}] Digest sent to ${recipient.email} with ${alertCount} alerts`);
        }

        // Rate limit: 600ms between sends
        await new Promise((r) => setTimeout(r, 600));
      } catch (error) {
        console.error(`[${VERSION}] Error sending to ${recipient.email}:`, error);
      }
    }

    console.log(`[${VERSION}] Completed: ${emailsSent} email(s) sent, ${totalAlertsSent} total alerts`);

    return new Response(
      JSON.stringify({
        success: true,
        recipientCount: recipients.length,
        emailsSent,
        totalAlerts: totalAlertsSent,
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
