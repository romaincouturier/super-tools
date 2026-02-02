import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface CreateTrainingPayload {
  training_name: string;
  start_date: string;
  end_date?: string;
  location: string;
  client_name: string;
  trainer_name?: string;
  format_formation?: "intra" | "inter-entreprises" | "classe_virtuelle";
  sponsor_email?: string;
  sponsor_first_name?: string;
  sponsor_last_name?: string;
  objectives?: string[];
  prerequisites?: string[];
  participants?: Array<{
    email: string;
    first_name?: string;
    last_name?: string;
    company?: string;
  }>;
}

interface AddParticipantsPayload {
  training_id: string;
  participants: Array<{
    email: string;
    first_name?: string;
    last_name?: string;
    company?: string;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validate API key
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key required", code: "MISSING_API_KEY" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up API key in database
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from("api_keys")
      .select("id, organization_id, name, permissions, is_active, last_used_at")
      .eq("key_hash", await hashApiKey(apiKey))
      .single();

    if (apiKeyError || !apiKeyData) {
      console.error("Invalid API key");
      return new Response(
        JSON.stringify({ error: "Invalid API key", code: "INVALID_API_KEY" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!apiKeyData.is_active) {
      return new Response(
        JSON.stringify({ error: "API key is disabled", code: "DISABLED_API_KEY" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const organizationId = apiKeyData.organization_id;

    // Update last used timestamp
    await supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", apiKeyData.id);

    // Parse request
    const url = new URL(req.url);
    const action = url.pathname.split("/").pop() || "create-training";
    const body = await req.json();

    console.log(`Zapier webhook: action=${action}, org=${organizationId}`);

    switch (action) {
      case "create-training":
        return await createTraining(supabase, organizationId, body as CreateTrainingPayload);

      case "add-participants":
        return await addParticipants(supabase, organizationId, body as AddParticipantsPayload);

      case "list-trainings":
        return await listTrainings(supabase, organizationId);

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}`, code: "UNKNOWN_ACTION" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("Zapier webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage, code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Hash API key for secure storage comparison
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Create a new training
async function createTraining(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  payload: CreateTrainingPayload
) {
  // Validate required fields
  if (!payload.training_name || !payload.start_date || !payload.location || !payload.client_name) {
    return new Response(
      JSON.stringify({
        error: "Missing required fields: training_name, start_date, location, client_name",
        code: "VALIDATION_ERROR"
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get default trainer if not provided
  let trainerName = payload.trainer_name;
  if (!trainerName) {
    const { data: defaultTrainer } = await supabase
      .from("trainers")
      .select("name")
      .eq("organization_id", organizationId)
      .eq("is_default", true)
      .single();
    trainerName = defaultTrainer?.name || "Formateur";
  }

  // Generate unique evaluation link
  const evaluationToken = crypto.randomUUID();
  const evaluationLink = `${Deno.env.get("PUBLIC_APP_URL") || "https://supertools.app"}/evaluation/${evaluationToken}`;

  // Create training
  const { data: training, error: trainingError } = await supabase
    .from("trainings")
    .insert({
      organization_id: organizationId,
      training_name: payload.training_name,
      start_date: payload.start_date,
      end_date: payload.end_date || null,
      location: payload.location,
      client_name: payload.client_name,
      trainer_name: trainerName,
      format_formation: payload.format_formation || "intra",
      sponsor_email: payload.sponsor_email || null,
      sponsor_first_name: payload.sponsor_first_name || null,
      sponsor_last_name: payload.sponsor_last_name || null,
      objectives: payload.objectives || [],
      prerequisites: payload.prerequisites || [],
      evaluation_link: evaluationLink,
    })
    .select()
    .single();

  if (trainingError) {
    console.error("Error creating training:", trainingError);
    return new Response(
      JSON.stringify({ error: "Failed to create training", code: "DATABASE_ERROR", details: trainingError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Add participants if provided
  if (payload.participants && payload.participants.length > 0) {
    const participantsToInsert = payload.participants.map(p => ({
      training_id: training.id,
      email: p.email.toLowerCase().trim(),
      first_name: p.first_name || null,
      last_name: p.last_name || null,
      company: p.company || payload.client_name,
      needs_survey_status: "non_envoye",
    }));

    const { error: participantsError } = await supabase
      .from("training_participants")
      .insert(participantsToInsert);

    if (participantsError) {
      console.warn("Error adding participants:", participantsError);
      // Don't fail the whole request, training was created
    }
  }

  // Log activity
  await supabase.from("activity_logs").insert({
    action_type: "training_created",
    details: {
      training_id: training.id,
      training_name: training.training_name,
      source: "zapier",
      organization_id: organizationId,
    },
  });

  console.log(`Training created via Zapier: ${training.id}`);

  return new Response(
    JSON.stringify({
      success: true,
      training: {
        id: training.id,
        training_name: training.training_name,
        start_date: training.start_date,
        end_date: training.end_date,
        location: training.location,
        client_name: training.client_name,
        evaluation_link: training.evaluation_link,
      },
      participants_added: payload.participants?.length || 0,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Add participants to an existing training
async function addParticipants(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  payload: AddParticipantsPayload
) {
  if (!payload.training_id || !payload.participants || payload.participants.length === 0) {
    return new Response(
      JSON.stringify({
        error: "Missing required fields: training_id, participants",
        code: "VALIDATION_ERROR"
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify training belongs to organization
  const { data: training, error: trainingError } = await supabase
    .from("trainings")
    .select("id, training_name, client_name")
    .eq("id", payload.training_id)
    .eq("organization_id", organizationId)
    .single();

  if (trainingError || !training) {
    return new Response(
      JSON.stringify({ error: "Training not found", code: "NOT_FOUND" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get existing participant emails to avoid duplicates
  const { data: existingParticipants } = await supabase
    .from("training_participants")
    .select("email")
    .eq("training_id", payload.training_id);

  const existingEmails = new Set(existingParticipants?.map(p => p.email.toLowerCase()) || []);

  // Filter out duplicates
  const newParticipants = payload.participants.filter(
    p => !existingEmails.has(p.email.toLowerCase().trim())
  );

  if (newParticipants.length === 0) {
    return new Response(
      JSON.stringify({
        success: true,
        added: 0,
        skipped: payload.participants.length,
        message: "All participants already exist",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const participantsToInsert = newParticipants.map(p => ({
    training_id: payload.training_id,
    email: p.email.toLowerCase().trim(),
    first_name: p.first_name || null,
    last_name: p.last_name || null,
    company: p.company || training.client_name,
    needs_survey_status: "non_envoye",
  }));

  const { error: insertError } = await supabase
    .from("training_participants")
    .insert(participantsToInsert);

  if (insertError) {
    console.error("Error adding participants:", insertError);
    return new Response(
      JSON.stringify({ error: "Failed to add participants", code: "DATABASE_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`Added ${newParticipants.length} participants to training ${payload.training_id} via Zapier`);

  return new Response(
    JSON.stringify({
      success: true,
      added: newParticipants.length,
      skipped: payload.participants.length - newParticipants.length,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// List trainings for the organization
async function listTrainings(
  supabase: ReturnType<typeof createClient>,
  organizationId: string
) {
  const { data: trainings, error } = await supabase
    .from("trainings")
    .select("id, training_name, start_date, end_date, location, client_name, created_at")
    .eq("organization_id", organizationId)
    .order("start_date", { ascending: false })
    .limit(100);

  if (error) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch trainings", code: "DATABASE_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ trainings: trainings || [] }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
