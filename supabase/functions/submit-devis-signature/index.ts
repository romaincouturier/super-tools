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
  signerName: string;
  signerFunction?: string; // Job title/function
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
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
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

  return "unknown";
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { token, signatureData, userAgent, consent, signerName, signerFunction, deviceInfo } = body;

    // Validate required fields
    if (!token || !signatureData || !signerName) {
      return new Response(
        JSON.stringify({ error: "Token, signature et nom du signataire requis" }),
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
    const { data: devisSignature, error: fetchError } = await supabase
      .from("devis_signatures")
      .select("*")
      .eq("token", token)
      .single();

    if (fetchError || !devisSignature) {
      return new Response(
        JSON.stringify({ error: "Lien de signature invalide ou expire" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (devisSignature.status === "signed") {
      return new Response(
        JSON.stringify({ error: "Ce devis a deja ete signe" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (devisSignature.status === "expired" || (devisSignature.expires_at && new Date(devisSignature.expires_at) < new Date())) {
      return new Response(
        JSON.stringify({ error: "Ce lien de signature a expire" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (devisSignature.status === "cancelled") {
      return new Response(
        JSON.stringify({ error: "Ce devis a ete annule" }),
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
      consent_text: "En signant ce devis, j'accepte les conditions proposees et je reconnais que cette signature electronique a valeur legale conformement au reglement europeen eIDAS (UE n° 910/2014) et aux articles 1366 et 1367 du Code civil francais.",
      signer_name: signerName,
      signer_function: signerFunction || null,
      device_info: deviceInfo || {},
      signature_hash: signatureHash,
      legal_reference: "eIDAS (UE n° 910/2014), Code Civil art. 1366-1367",
      document_type: "devis",
      document_details: {
        formation_name: devisSignature.formation_name,
        client_name: devisSignature.client_name,
        devis_type: devisSignature.devis_type,
      },
    };

    // Update signature record with all audit data
    const { error: updateError } = await supabase
      .from("devis_signatures")
      .update({
        signature_data: signatureData,
        signed_at: signedAt,
        ip_address: ipAddress,
        user_agent: userAgent,
        audit_metadata: auditMetadata,
        status: "signed",
      })
      .eq("id", devisSignature.id);

    if (updateError) {
      console.error("Error updating signature:", updateError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'enregistrement de la signature" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the signature event
    try {
      await supabase.from("activity_logs").insert({
        action_type: "devis_signature_submitted",
        recipient_email: devisSignature.recipient_email,
        details: {
          formation_name: devisSignature.formation_name,
          client_name: devisSignature.client_name,
          signer_name: signerName,
          signer_function: signerFunction,
          devis_type: devisSignature.devis_type,
          ip_address: ipAddress,
          signature_hash: signatureHash,
        },
      });
    } catch (logError) {
      console.warn("Failed to log signature activity:", logError);
    }

    console.log(`Devis signature submitted successfully for token ${token} from IP ${ipAddress}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Devis signe avec succes",
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
