import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { trainingId, participantId } = await req.json();

    if (!trainingId) {
      return new Response(
        JSON.stringify({ error: "trainingId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch training info
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("training_name, location, start_date, end_date, trainer_name")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      throw new Error("Training not found");
    }

    // Build query for signatures
    let query = supabase
      .from("attendance_signatures")
      .select("id, schedule_date, period, signature_data, signed_at, participant_id")
      .eq("training_id", trainingId)
      .order("schedule_date", { ascending: true })
      .order("period", { ascending: true });

    if (participantId) {
      query = query.eq("participant_id", participantId);
    }

    const { data: signatures, error: sigError } = await query;

    if (sigError) {
      throw new Error("Failed to fetch signatures");
    }

    // Fetch participant details for each signature
    const participantIds = [...new Set(signatures?.map(s => s.participant_id) || [])];
    const { data: participants } = await supabase
      .from("training_participants")
      .select("id, first_name, last_name, email, company")
      .in("id", participantIds);

    const participantMap = new Map(participants?.map(p => [p.id, p]) || []);

    // Enrich signatures with participant data
    const enrichedSignatures = (signatures || []).map(sig => ({
      id: sig.id,
      schedule_date: sig.schedule_date,
      period: sig.period,
      signature_data: sig.signature_data,
      signed_at: sig.signed_at,
      participant: participantMap.get(sig.participant_id) || {
        first_name: null,
        last_name: null,
        email: "",
        company: null,
      },
    }));

    // Fetch trainer signatures
    const { data: trainerSignatures } = await supabase
      .from("trainer_attendance_signatures")
      .select("schedule_date, period, signature_data, signed_at, trainer_name")
      .eq("training_id", trainingId);

    return new Response(
      JSON.stringify({
        success: true,
        training,
        signatures: enrichedSignatures,
        trainerSignatures: trainerSignatures || [],
        signaturesCount: enrichedSignatures.length,
        signedCount: enrichedSignatures.filter(s => s.signed_at).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error generating attendance PDF:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
