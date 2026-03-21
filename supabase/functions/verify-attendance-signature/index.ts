import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface JourneyEvent {
  event: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

async function hashArrayBuffer(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { signatureId, token } = await req.json();

    if (!signatureId && !token) {
      return new Response(
        JSON.stringify({ error: "signatureId ou token requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let query = supabase.from("attendance_signatures").select("*");
    if (signatureId) {
      query = query.eq("id", signatureId);
    } else {
      query = query.eq("token", token);
    }

    const { data: sig, error: fetchError } = await query.single();

    if (fetchError || !sig) {
      return new Response(
        JSON.stringify({ error: "Signature introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get participant info
    const { data: participant } = await supabase
      .from("training_participants")
      .select("email, first_name, last_name")
      .eq("id", sig.participant_id)
      .single();

    const { data: training } = await supabase
      .from("trainings")
      .select("training_name")
      .eq("id", sig.training_id)
      .single();

    const participantName = `${participant?.first_name || ""} ${participant?.last_name || ""}`.trim();

    const verificationResults: Record<string, unknown> = {
      signature_id: sig.id,
      document_type: "feuille_emargement",
      status: sig.signed_at ? "signed" : "pending",
      signed_at: sig.signed_at,
      participant_name: participantName,
      participant_email: participant?.email,
      training_name: training?.training_name,
      schedule_date: sig.schedule_date,
      period: sig.period,
      checks: {},
    };

    const checks: Record<string, { status: string; detail: string }> = {};

    // 1. Check if signed
    if (sig.signed_at) {
      checks["signature_status"] = { status: "✅ CONFORME", detail: "Feuille d'émargement signée électroniquement" };
    } else {
      checks["signature_status"] = { status: "⚠️ EN ATTENTE", detail: "En attente de signature" };
    }

    // 2. Verify proof file integrity
    if (sig.proof_file_url && sig.proof_hash) {
      try {
        let proofContent: ArrayBuffer | null = null;

        if (sig.proof_file_url.startsWith("signature-proofs/")) {
          const fileName = sig.proof_file_url.replace("signature-proofs/", "");
          const { data, error } = await supabase.storage.from("signature-proofs").download(fileName);
          if (!error && data) {
            proofContent = await data.arrayBuffer();
          }
        } else {
          const proofResponse = await fetch(sig.proof_file_url);
          if (proofResponse.ok) {
            proofContent = await proofResponse.arrayBuffer();
          }
        }

        if (proofContent) {
          const currentProofHash = await hashArrayBuffer(proofContent);
          if (currentProofHash === sig.proof_hash) {
            checks["proof_integrity"] = {
              status: "✅ CONFORME",
              detail: `Dossier de preuve intact. Hash: ${sig.proof_hash.substring(0, 16)}...`,
            };
          } else {
            checks["proof_integrity"] = {
              status: "❌ NON CONFORME",
              detail: `Le dossier de preuve a été altéré !`,
            };
          }
        } else {
          checks["proof_integrity"] = { status: "⚠️ IMPOSSIBLE", detail: "Impossible de télécharger le dossier de preuve" };
        }
      } catch {
        checks["proof_integrity"] = { status: "⚠️ ERREUR", detail: "Erreur lors de la vérification" };
      }
    } else {
      checks["proof_integrity"] = { status: "⚠️ ABSENT", detail: "Pas de dossier de preuve enregistré" };
    }

    // 3. Check audit metadata completeness
    const audit = sig.audit_metadata as Record<string, unknown> | null;
    if (audit) {
      const requiredFields = [
        "consent_given", "consent_timestamp", "consent_text",
        "signature_hash", "legal_reference", "signature_level",
      ];
      const missingFields = requiredFields.filter((f) => !(f in audit));

      if (missingFields.length === 0) {
        checks["audit_completeness"] = { status: "✅ CONFORME", detail: "Toutes les métadonnées d'audit présentes" };
      } else {
        checks["audit_completeness"] = {
          status: "⚠️ PARTIEL",
          detail: `Champs manquants: ${missingFields.join(", ")}`,
        };
      }
    } else {
      checks["audit_completeness"] = { status: "❌ NON CONFORME", detail: "Pas de métadonnées d'audit" };
    }

    // 4. Check IP and user-agent
    if (sig.ip_address && sig.ip_address !== "unknown") {
      checks["ip_address"] = { status: "✅ CONFORME", detail: `IP enregistrée: ${sig.ip_address}` };
    } else {
      checks["ip_address"] = { status: "⚠️ PARTIEL", detail: "Adresse IP non capturée" };
    }

    if (sig.user_agent) {
      checks["user_agent"] = { status: "✅ CONFORME", detail: "User-agent enregistré" };
    } else {
      checks["user_agent"] = { status: "⚠️ PARTIEL", detail: "User-agent non capturé" };
    }

    // 5. Check journey timeline
    const journeyEvents = sig.journey_events as JourneyEvent[] | null;
    if (journeyEvents && Array.isArray(journeyEvents) && journeyEvents.length > 0) {
      const eventTypes = journeyEvents.map((e: JourneyEvent) => e.event);
      const criticalEvents = ["page_loaded", "consent_checkbox_checked", "submit_button_clicked"];
      const hasCritical = criticalEvents.every((ce) => eventTypes.includes(ce));

      checks["journey_timeline"] = {
        status: hasCritical ? "✅ CONFORME" : "⚠️ PARTIEL",
        detail: `${journeyEvents.length} événements tracés. ${hasCritical ? "Parcours complet." : "Certains événements critiques manquent."}`,
      };
    } else {
      checks["journey_timeline"] = { status: "⚠️ ABSENT", detail: "Pas de timeline de parcours" };
    }

    // 6. Check link was opened before signature
    if (sig.email_opened_at) {
      checks["link_opening"] = {
        status: "✅ CONFORME",
        detail: `Lien ouvert le ${sig.email_opened_at}`,
      };
    } else {
      checks["link_opening"] = { status: "⚠️ ABSENT", detail: "Ouverture du lien non enregistrée" };
    }

    verificationResults.checks = checks;

    // Summary
    const allChecks = Object.values(checks);
    const conformCount = allChecks.filter((c) => c.status.includes("CONFORME") && !c.status.includes("NON")).length;
    const nonConformCount = allChecks.filter((c) => c.status.includes("NON CONFORME")).length;

    verificationResults.summary = {
      total_checks: allChecks.length,
      conforme: conformCount,
      non_conforme: nonConformCount,
      partiel_ou_absent: allChecks.length - conformCount - nonConformCount,
      overall: nonConformCount > 0 ? "NON CONFORME" : conformCount === allChecks.length ? "CONFORME" : "ACCEPTABLE AVEC RÉSERVES",
    };

    return new Response(
      JSON.stringify(verificationResults),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
