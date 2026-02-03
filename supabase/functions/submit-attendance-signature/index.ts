import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  token: string;
  signatureData: string;
  userAgent: string;
  consent: boolean;
  deviceInfo?: {
    screenWidth?: number;
    screenHeight?: number;
    timezone?: string;
    language?: string;
  };
}

// Generate SHA-256 hash of signature data for integrity verification
async function generateHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Get client IP from request headers
function getClientIp(req: Request): string {
  // Check various headers that may contain the real IP
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback
  return "unknown";
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { token, signatureData, userAgent, consent, deviceInfo } = body;

    // Validate required fields
    if (!token || !signatureData) {
      return new Response(
        JSON.stringify({ error: "Token et signature requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify consent was given
    if (!consent) {
      return new Response(
        JSON.stringify({ error: "Le consentement est requis pour la signature electronique" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify token exists and isn't already signed
    const { data: signature, error: fetchError } = await supabase
      .from("attendance_signatures")
      .select("id, signed_at, participant_id, training_id, schedule_date, period")
      .eq("token", token)
      .single();

    if (fetchError || !signature) {
      return new Response(
        JSON.stringify({ error: "Token invalide ou expire" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (signature.signed_at) {
      return new Response(
        JSON.stringify({ error: "Cette feuille d'emargement a deja ete signee" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get client IP
    const ipAddress = getClientIp(req);

    // Generate hash for integrity verification
    const signatureHash = await generateHash(signatureData);

    // Current timestamp
    const signedAt = new Date().toISOString();

    // Build audit metadata
    const auditMetadata = {
      consent_given: true,
      consent_timestamp: signedAt,
      consent_text: "En signant, j'atteste de ma presence a cette demi-journee de formation et accepte que cette signature electronique ait valeur legale conformement au reglement europeen eIDAS (UE n° 910/2014).",
      device_info: deviceInfo || {},
      signature_hash: signatureHash,
      legal_reference: "eIDAS (UE n° 910/2014), Code Civil art. 1366-1367",
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
      })
      .eq("id", signature.id);

    if (updateError) {
      console.error("Error updating signature:", updateError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'enregistrement de la signature" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the signature event
    try {
      // Get participant info for logging
      const { data: participant } = await supabase
        .from("training_participants")
        .select("email, first_name, last_name")
        .eq("id", signature.participant_id)
        .single();

      const { data: training } = await supabase
        .from("trainings")
        .select("training_name")
        .eq("id", signature.training_id)
        .single();

      await supabase.from("activity_logs").insert({
        action_type: "attendance_signature_submitted",
        recipient_email: participant?.email || "unknown",
        details: {
          participant_name: `${participant?.first_name || ""} ${participant?.last_name || ""}`.trim(),
          training_name: training?.training_name || "Unknown",
          schedule_date: signature.schedule_date,
          period: signature.period,
          ip_address: ipAddress,
          signature_hash: signatureHash,
        },
      });
    } catch (logError) {
      console.warn("Failed to log signature activity:", logError);
    }

    console.log(`Signature submitted successfully for token ${token} from IP ${ipAddress}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Signature enregistree avec succes",
        signedAt,
        signatureHash,
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
