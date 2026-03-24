import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { generateHash, getClientIp } from "../_shared/crypto.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import {
  type JourneyEvent,
  type DeviceInfo,
  buildJourneyEvents,
  LEGAL_BLOCK,
  storeProofFile,
} from "../_shared/signature-helpers.ts";
import { logEmailActivity } from "../_shared/email-helpers.ts";

interface RequestBody {
  token: string;
  signatureData: string;
  userAgent: string;
  consent: boolean;
  deviceInfo?: DeviceInfo;
  journeyEvents?: JourneyEvent[];
}


serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightIfNeeded(req);

  if (corsResponse) return corsResponse;

  try {
    const body: RequestBody = await req.json();
    const { token, signatureData, userAgent, consent, deviceInfo, journeyEvents } = body;

    if (!token || !signatureData) {
      return new Response(
        JSON.stringify({ error: "Token et signature requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!consent) {
      return new Response(
        JSON.stringify({ error: "Le consentement est requis pour la signature électronique" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = getSupabaseClient();

    // Verify token exists and isn't already signed
    const { data: signature, error: fetchError } = await supabase
      .from("attendance_signatures")
      .select("id, signed_at, participant_id, training_id, schedule_date, period")
      .eq("token", token)
      .single();

    if (fetchError || !signature) {
      return new Response(
        JSON.stringify({ error: "Token invalide ou expiré" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (signature.signed_at) {
      return new Response(
        JSON.stringify({ error: "Cette feuille d'émargement a déjà été signée" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ipAddress = getClientIp(req);
    const signatureHash = await generateHash(signatureData);
    const signedAt = new Date().toISOString();

    // Build the complete journey timeline
    const serverJourneyEvents = buildJourneyEvents(
      journeyEvents,
      signedAt,
      { ip_address: ipAddress },
    );

    const consentText =
      "J'atteste de ma présence à cette demi-journée de formation et j'accepte que cette signature électronique ait valeur légale conformément au règlement européen eIDAS (UE n° 910/2014) et aux articles 1366 et 1367 du Code civil français.";

    // Build audit metadata
    const auditMetadata = {
      consent_given: true,
      consent_timestamp: signedAt,
      consent_text: consentText,
      device_info: deviceInfo || {},
      signature_hash: signatureHash,
      legal_reference: "eIDAS (UE n° 910/2014), Code Civil art. 1366-1367",
      signature_level: "SES (Simple Electronic Signature)",
      document_type: "feuille_emargement",
      journey_event_count: serverJourneyEvents.length,
    };

    // Update signature record with all audit data
    const { error: updateError } = await supabase
      .from("attendance_signatures")
      .update({
        signature_data: signatureData,
        signed_at: signedAt,
        ip_address: ipAddress,
        user_agent: userAgent,
        audit_metadata: auditMetadata,
        journey_events: serverJourneyEvents,
      })
      .eq("id", signature.id);

    if (updateError) {
      console.error("Error updating signature:", updateError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'enregistrement de la signature" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get participant & training info for proof file
    const { data: participant } = await supabase
      .from("training_participants")
      .select("email, first_name, last_name")
      .eq("id", signature.participant_id)
      .single();

    const { data: training } = await supabase
      .from("trainings")
      .select("training_name, location")
      .eq("id", signature.training_id)
      .single();

    const participantName = `${participant?.first_name || ""} ${participant?.last_name || ""}`.trim();

    // Generate comprehensive proof file and store in PRIVATE bucket
    const proofFileContent = {
      version: "2.0",
      type: "attendance_signature_proof",
      generated_at: new Date().toISOString(),
      signature: {
        id: signature.id,
        token: token,
        signed_at: signedAt,
        participant_name: participantName,
        participant_email: participant?.email || "unknown",
        ip_address: ipAddress,
        user_agent: userAgent,
        signature_image_hash: signatureHash,
      },
      document: {
        type: "feuille_emargement",
        training_name: training?.training_name || "Unknown",
        training_location: training?.location || "",
        training_id: signature.training_id,
        schedule_date: signature.schedule_date,
        period: signature.period,
      },
      consent: {
        given: true,
        timestamp: signedAt,
        text: consentText,
      },
      device: deviceInfo || {},
      journey_timeline: serverJourneyEvents,
      identification: {
        method: "email_link",
        email_sent_to: participant?.email || "unknown",
        note: "Signature Électronique Simple (SES) : le lien unique est envoyé à l'adresse email du participant.",
      },
      legal: LEGAL_BLOCK,
      non_repudiation_elements: {
        email_dispatch_logged: true,
        link_opening_logged: true,
        full_journey_tracked: serverJourneyEvents.length > 0,
        consent_explicitly_given: true,
        consent_and_submit_separate_actions: true,
        signature_image_captured: true,
        ip_address_captured: ipAddress !== "unknown",
      },
    };

    const { proofFileUrl, proofHash } = await storeProofFile(
      supabase,
      "attendance_signatures",
      signature.id,
      "attendance",
      token,
      proofFileContent,
    );

    // Log the signature event
    await logEmailActivity(supabase, "attendance_signature_submitted", participant?.email || "unknown", {
      participant_name: participantName,
      training_name: training?.training_name || "Unknown",
      schedule_date: signature.schedule_date,
      period: signature.period,
      ip_address: ipAddress,
      signature_hash: signatureHash,
      proof_file_url: proofFileUrl,
      proof_hash: proofHash,
      journey_events_count: serverJourneyEvents.length,
    });

    // =============================================
    // Notify trainer: who signed, who's still pending
    // =============================================
    try {
      // Fetch trainer info for this training
      const { data: trainingFull } = await supabase
        .from("trainings")
        .select("trainer_id, trainer_name, trainers(id, email, first_name)")
        .eq("id", signature.training_id)
        .single();

      const trainerData = (trainingFull as any)?.trainers;
      const trainerEmail = trainerData?.email;

      if (trainerEmail) {
        // Fetch all signatures for this training+date+period to check status
        const { data: allSigs } = await supabase
          .from("attendance_signatures")
          .select("participant_id, signed_at, training_participants(first_name, last_name, email)")
          .eq("training_id", signature.training_id)
          .eq("schedule_date", signature.schedule_date)
          .eq("period", signature.period);

        const signed: string[] = [];
        const pending: string[] = [];

        for (const sig of allSigs || []) {
          const p = (sig as any).training_participants;
          const name = `${p?.first_name || ""} ${p?.last_name || ""}`.trim() || p?.email || "Inconnu";
          if (sig.signed_at) {
            signed.push(name);
          } else {
            pending.push(name);
          }
        }

        const periodLabel = signature.period === "AM" ? "Matin" : "Après-midi";
        const dateObj = new Date(signature.schedule_date + "T12:00:00");
        const formattedDate = dateObj.toLocaleDateString("fr-FR", {
          timeZone: "Europe/Paris",
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        const trainerFirstName = trainerData?.first_name || (trainingFull as any)?.trainer_name || "Formateur";

        const signedList = signed.map(n => `<li>✅ ${n}</li>`).join("");
        const pendingList = pending.length > 0
          ? pending.map(n => `<li>⏳ ${n}</li>`).join("")
          : "<li>Tous les participants ont signé !</li>";

        const trainerHtml = `
          <p>Bonjour ${trainerFirstName},</p>
          <p><strong>${participantName}</strong> vient de signer sa feuille d'émargement pour la formation <strong>"${training?.training_name || "Formation"}"</strong>.</p>
          <ul style="list-style: none; padding: 0; margin: 10px 0;">
            <li>📅 <strong>Date :</strong> ${formattedDate} – ${periodLabel}</li>
          </ul>
          <p><strong>✅ Ont signé (${signed.length}) :</strong></p>
          <ul style="margin: 5px 0;">${signedList}</ul>
          ${pending.length > 0 ? `<p><strong>⏳ En attente (${pending.length}) :</strong></p><ul style="margin: 5px 0;">${pendingList}</ul>` : `<p style="color: #16a34a; font-weight: bold;">🎉 Tous les participants ont signé !</p>`}
        `;

        // Import sendEmail inline to avoid adding to top-level imports
        const { sendEmail: sendTrainerEmail } = await import("../_shared/resend.ts");
        const { getSigniticSignature } = await import("../_shared/signitic.ts");
        const { getSenderFrom: getFrom, getBccList: getBcc } = await import("../_shared/email-settings.ts");

        const [senderFrom, bccList, sigHtml] = await Promise.all([
          getFrom(),
          getBcc(),
          getSigniticSignature(),
        ]);

        const subjectEmoji = pending.length === 0 ? "🎉" : "✍️";
        const subjectStatus = pending.length === 0
          ? "Tous les émargements reçus"
          : `${signed.length}/${signed.length + pending.length} émargements reçus`;

        await sendTrainerEmail({
          from: senderFrom,
          to: [trainerEmail],
          bcc: bccList,
          subject: `${subjectEmoji} ${subjectStatus} – ${training?.training_name || "Formation"} – ${formattedDate} ${periodLabel}`,
          html: trainerHtml + sigHtml,
          _emailType: "attendance_signature_trainer_notify",
          _trainingId: signature.training_id,
        });

        console.log(`Trainer notified: ${trainerEmail} (${signed.length} signed, ${pending.length} pending)`);
      }
    } catch (trainerNotifyErr) {
      console.warn("Failed to notify trainer of signature:", trainerNotifyErr);
    }

    console.log(`Attendance signature submitted for token ${token} from IP ${ipAddress}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Signature enregistrée avec succès",
        signedAt,
        signatureHash,
        proofHash,
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
