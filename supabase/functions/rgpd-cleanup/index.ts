import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CleanupResult {
  success: boolean;
  log_id?: string;
  cutoff_date?: string;
  trainings_anonymized?: number;
  participants_anonymized?: number;
  questionnaires_deleted?: number;
  evaluations_anonymized?: number;
  signatures_deleted?: number;
  emails_purged?: number;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const {
      action = "preview", // "preview" or "execute"
      cutoffYears = 3,
      executedBy = "system",
    } = body;

    if (action === "preview") {
      // Return list of trainings eligible for cleanup
      const { data: eligibleTrainings, error } = await supabase.rpc(
        "get_rgpd_eligible_trainings",
        { cutoff_years: cutoffYears }
      );

      if (error) {
        throw new Error(`Failed to get eligible trainings: ${error.message}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: "preview",
          cutoff_years: cutoffYears,
          cutoff_date: new Date(
            Date.now() - cutoffYears * 365 * 24 * 60 * 60 * 1000
          ).toISOString().split("T")[0],
          eligible_trainings: eligibleTrainings || [],
          total_trainings: (eligibleTrainings || []).length,
          total_participants: (eligibleTrainings || []).reduce(
            (sum: number, t: { participants_count: number }) =>
              sum + (t.participants_count || 0),
            0
          ),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "execute") {
      // Run the actual cleanup
      const { data: result, error } = await supabase.rpc("run_rgpd_cleanup", {
        p_cutoff_years: cutoffYears,
        p_execution_mode: "manual",
        p_executed_by: executedBy,
      });

      if (error) {
        throw new Error(`RGPD cleanup failed: ${error.message}`);
      }

      console.log("RGPD cleanup completed:", result);

      return new Response(
        JSON.stringify({
          success: true,
          action: "execute",
          ...result,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get cleanup history
    if (action === "history") {
      const { data: logs, error } = await supabase
        .from("rgpd_cleanup_logs")
        .select("*")
        .order("cleanup_date", { ascending: false })
        .limit(50);

      if (error) {
        throw new Error(`Failed to get cleanup history: ${error.message}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: "history",
          logs: logs || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Invalid action. Use 'preview', 'execute', or 'history'",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in rgpd-cleanup:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
