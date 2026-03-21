import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";
import { encode as hexEncode } from "https://deno.land/std@0.190.0/encoding/hex.ts";

import { extendCorsHeaders } from "../_shared/cors.ts";

const corsHeaders = extendCorsHeaders({
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

interface TrainingInput {
  // Required fields
  training_name: string;
  client_name: string;
  start_date: string; // ISO date or YYYY-MM-DD
  end_date: string;
  location: string;

  // Optional fields
  format_formation?: "intra-entreprise" | "inter-entreprises" | "e-learning";
  program_id?: string;

  // Sponsor info
  sponsor_email?: string;
  sponsor_first_name?: string;
  sponsor_last_name?: string;
  sponsor_company?: string;
  sponsor_formal_address?: boolean;

  // Participants (array)
  participants?: {
    email: string;
    first_name?: string;
    last_name?: string;
    company?: string;
    job_title?: string;
  }[];

  // Schedules
  schedules?: {
    day_date: string;
    start_time: string; // HH:MM
    end_time: string;
  }[];

  // Extra fields
  notes?: string;
  supports_url?: string;
}

interface ApiKeyData {
  id: string;
  permissions: string[] | null;
  is_active: boolean;
  expires_at: string | null;
}

// Validate API key and return key info
async function validateApiKey(
  supabase: SupabaseClient,
  apiKey: string
): Promise<{ valid: boolean; keyId?: string; permissions?: string[] }> {
  if (!apiKey) {
    return { valid: false };
  }

  // Hash the API key for comparison using Web Crypto
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const keyHash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const { data: keyData, error } = await supabase
    .from("api_keys")
    .select("id, permissions, is_active, expires_at")
    .eq("key_hash", keyHash)
    .single();

  if (error || !keyData) {
    return { valid: false };
  }

  const typedKeyData = keyData as ApiKeyData;

  // Check if key is active
  if (!typedKeyData.is_active) {
    return { valid: false };
  }

  // Check expiration
  if (typedKeyData.expires_at && new Date(typedKeyData.expires_at) < new Date()) {
    return { valid: false };
  }

  // Update last used
  try {
    await supabase.rpc("update_api_key_last_used", { key_id: typedKeyData.id });
  } catch (e) {
    console.warn("Failed to update last_used:", e);
  }

  return {
    valid: true,
    keyId: typedKeyData.id,
    permissions: typedKeyData.permissions || [],
  };
}

// Log API request
async function logRequest(
  supabase: SupabaseClient,
  keyId: string | null,
  endpoint: string,
  method: string,
  statusCode: number,
  requestBody: unknown,
  responseBody: unknown,
  req: Request
) {
  try {
    await supabase.from("api_request_logs").insert({
      api_key_id: keyId,
      endpoint,
      method,
      status_code: statusCode,
      request_body: requestBody as Record<string, unknown>,
      response_body: responseBody as Record<string, unknown>,
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
      user_agent: req.headers.get("user-agent"),
    });
  } catch (e) {
    console.error("Failed to log request:", e);
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { getAppUrls } = await import("../_shared/app-urls.ts");
  const urls = await getAppUrls();
  const appUrl = urls.app_url;

  let requestBody: TrainingInput | null = null;
  let keyId: string | null = null;

  try {
    // Get API key from header
    const apiKey = req.headers.get("x-api-key");

    if (!apiKey) {
      const response = { error: "API key required. Use x-api-key header." };
      await logRequest(supabase, null, "/zapier-create-training", "POST", 401, null, response, req);
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate API key
    const keyValidation = await validateApiKey(supabase, apiKey);

    if (!keyValidation.valid) {
      const response = { error: "Invalid or expired API key" };
      await logRequest(supabase, null, "/zapier-create-training", "POST", 401, null, response, req);
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    keyId = keyValidation.keyId!;

    // Check permission
    if (!keyValidation.permissions?.includes("trainings:create")) {
      const response = { error: "API key does not have permission to create trainings" };
      await logRequest(supabase, keyId, "/zapier-create-training", "POST", 403, null, response, req);
      return new Response(JSON.stringify(response), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    requestBody = await req.json();

    // Validate required fields
    const requiredFields = ["training_name", "client_name", "start_date", "end_date", "location"];
    const missingFields = requiredFields.filter(
      (field) => !requestBody![field as keyof TrainingInput]
    );

    if (missingFields.length > 0) {
      const response = { error: `Missing required fields: ${missingFields.join(", ")}` };
      await logRequest(supabase, keyId, "/zapier-create-training", "POST", 400, requestBody, response, req);
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create training
    const trainingData = {
      training_name: requestBody!.training_name,
      client_name: requestBody!.client_name,
      start_date: requestBody!.start_date,
      end_date: requestBody!.end_date,
      location: requestBody!.location,
      format_formation: requestBody!.format_formation || "intra-entreprise",
      sponsor_email: requestBody!.sponsor_email || null,
      sponsor_first_name: requestBody!.sponsor_first_name || null,
      sponsor_last_name: requestBody!.sponsor_last_name || null,
      sponsor_formal_address: requestBody!.sponsor_formal_address ?? true,
      supports_url: requestBody!.supports_url || null,
      evaluation_link: crypto.randomUUID(),
      created_by: "api",
      trainer_name: "À définir",
    };

    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .insert(trainingData)
      .select()
      .single();

    if (trainingError) {
      console.error("Error creating training:", trainingError);
      const response = { error: "Failed to create training", details: trainingError.message };
      await logRequest(supabase, keyId, "/zapier-create-training", "POST", 500, requestBody, response, req);
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create schedules if provided
    if (requestBody!.schedules && requestBody!.schedules.length > 0) {
      const schedulesData = requestBody!.schedules.map((schedule) => ({
        training_id: training.id,
        day_date: schedule.day_date,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
      }));

      const { error: schedulesError } = await supabase
        .from("training_schedules")
        .insert(schedulesData);

      if (schedulesError) {
        console.error("Error creating schedules:", schedulesError);
        // Don't fail the whole request, just log it
      }
    }

    // Create participants if provided
    const createdParticipants = [];
    if (requestBody!.participants && requestBody!.participants.length > 0) {
      for (const participant of requestBody!.participants) {
        const participantData = {
          training_id: training.id,
          email: participant.email,
          first_name: participant.first_name || null,
          last_name: participant.last_name || null,
          company: participant.company || requestBody!.client_name,
          needs_survey_status: "non_envoye",
        };

        const { data: createdParticipant, error: participantError } = await supabase
          .from("training_participants")
          .insert(participantData)
          .select()
          .single();

        if (participantError) {
          console.error("Error creating participant:", participantError);
        } else {
          createdParticipants.push(createdParticipant);
        }
      }
    }

    const response = {
      success: true,
      training: {
        id: training.id,
        training_name: training.training_name,
        client_name: training.client_name,
        start_date: training.start_date,
        end_date: training.end_date,
        location: training.location,
        format_formation: training.format_formation,
        url: `${appUrl}/formations/${training.id}`,
      },
      participants_created: createdParticipants.length,
      schedules_created: requestBody!.schedules?.length || 0,
    };

    await logRequest(supabase, keyId, "/zapier-create-training", "POST", 201, requestBody, response, req);

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in zapier-create-training:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const response = { error: errorMessage };
    await logRequest(supabase, keyId, "/zapier-create-training", "POST", 500, requestBody, response, req);
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
