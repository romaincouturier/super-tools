import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  token: string;
  signatureData: string;
  userAgent: string;
  consent: boolean;
  signerName: string;
  signerFunction?: string;
  deviceInfo?: {
    screenWidth?: number;
    screenHeight?: number;
    timezone?: string;
    language?: string;
  };
}

async function generateHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { token, signatureData, userAgent, consent, signerName, signerFunction, deviceInfo } = body;

    if (!token || !signatureData || !signerName) {
      return new Response(
        JSON.stringify({ error: "Token, signature et nom du signataire requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!consent) {
      return new Response(
        JSON.stringify({ error: "Le consentement est requis pour la signature électronique" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify token
    const { data: conventionSig, error: fetchError } = await supabase
      .from("convention_signatures")
      .select("*")
      .eq("token", token)
      .single();

    if (fetchError || !conventionSig) {
      return new Response(
        JSON.stringify({ error: "Lien de signature invalide ou expiré" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (conventionSig.status === "signed") {
      return new Response(
        JSON.stringify({ error: "Cette convention a déjà été signée" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (
      conventionSig.status === "expired" ||
      (conventionSig.expires_at && new Date(conventionSig.expires_at) < new Date())
    ) {
      return new Response(
        JSON.stringify({ error: "Ce lien de signature a expiré" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (conventionSig.status === "cancelled") {
      return new Response(
        JSON.stringify({ error: "Cette convention a été annulée" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ipAddress = getClientIp(req);
    const signatureHash = await generateHash(signatureData);
    const signedAt = new Date().toISOString();

    const auditMetadata = {
      consent_given: true,
      consent_timestamp: signedAt,
      consent_text:
        "En signant cette convention, j'accepte les conditions de formation proposées et je reconnais que cette signature électronique a valeur légale conformément au règlement européen eIDAS (UE n° 910/2014) et aux articles 1366 et 1367 du Code civil français.",
      signer_name: signerName,
      signer_function: signerFunction || null,
      device_info: deviceInfo || {},
      signature_hash: signatureHash,
      legal_reference: "eIDAS (UE n° 910/2014), Code Civil art. 1366-1367",
      document_type: "convention_de_formation",
      document_details: {
        formation_name: conventionSig.formation_name,
        client_name: conventionSig.client_name,
        training_id: conventionSig.training_id,
      },
    };

    const { error: updateError } = await supabase
      .from("convention_signatures")
      .update({
        signature_data: signatureData,
        signed_at: signedAt,
        ip_address: ipAddress,
        user_agent: userAgent,
        audit_metadata: auditMetadata,
        status: "signed",
      })
      .eq("id", conventionSig.id);

    if (updateError) {
      console.error("Error updating convention signature:", updateError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'enregistrement de la signature" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the signature event
    try {
      await supabase.from("activity_logs").insert({
        action_type: "convention_signature_submitted",
        recipient_email: conventionSig.recipient_email,
        details: {
          training_id: conventionSig.training_id,
          formation_name: conventionSig.formation_name,
          client_name: conventionSig.client_name,
          signer_name: signerName,
          signer_function: signerFunction,
          ip_address: ipAddress,
          signature_hash: signatureHash,
        },
      });
    } catch (logError) {
      console.warn("Failed to log convention signature activity:", logError);
    }

    console.log(`Convention signature submitted for token ${token} from IP ${ipAddress}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Convention signée avec succès",
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
