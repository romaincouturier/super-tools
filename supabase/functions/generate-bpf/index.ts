import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BPFData {
  year: number;
  organization: {
    name: string;
    siren: string;
    nda: string; // Numero de declaration d'activite
    address: string;
  };
  statistics: {
    totalTrainings: number;
    totalParticipants: number;
    totalHours: number;
    totalRevenue: number;
    byFormat: {
      intra: { trainings: number; participants: number; hours: number };
      inter: { trainings: number; participants: number; hours: number };
      online: { trainings: number; participants: number; hours: number };
    };
    byMonth: Array<{
      month: number;
      trainings: number;
      participants: number;
      hours: number;
    }>;
  };
  trainings: Array<{
    id: string;
    name: string;
    client: string;
    startDate: string;
    endDate: string | null;
    format: string;
    participantsCount: number;
    hoursPerDay: number;
    totalHours: number;
    hasEvaluations: boolean;
    hasAttendance: boolean;
    hasCertificates: boolean;
  }>;
  missingElements: Array<{
    trainingId: string;
    trainingName: string;
    missing: string[];
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { year } = await req.json();
    const targetYear = year || new Date().getFullYear();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all trainings for the year
    const startOfYear = `${targetYear}-01-01`;
    const endOfYear = `${targetYear}-12-31`;

    const { data: trainings, error: trainingsError } = await supabase
      .from("trainings")
      .select(`
        id,
        training_name,
        client_name,
        start_date,
        end_date,
        format_formation,
        location
      `)
      .gte("start_date", startOfYear)
      .lte("start_date", endOfYear)
      .order("start_date", { ascending: true });

    if (trainingsError) {
      throw new Error(`Failed to fetch trainings: ${trainingsError.message}`);
    }

    // For each training, get participants, schedules, evaluations, etc.
    const trainingsWithDetails = await Promise.all(
      (trainings || []).map(async (training) => {
        // Get participants count
        const { count: participantsCount } = await supabase
          .from("training_participants")
          .select("*", { count: "exact", head: true })
          .eq("training_id", training.id);

        // Get schedules to calculate hours
        const { data: schedules } = await supabase
          .from("training_schedules")
          .select("start_time, end_time")
          .eq("training_id", training.id);

        // Calculate total hours
        let totalHours = 0;
        let hoursPerDay = 7; // Default
        if (schedules && schedules.length > 0) {
          schedules.forEach((schedule) => {
            const [startHour, startMin] = schedule.start_time.split(":").map(Number);
            const [endHour, endMin] = schedule.end_time.split(":").map(Number);
            const hours = (endHour * 60 + endMin - startHour * 60 - startMin) / 60;
            totalHours += hours;
          });
          hoursPerDay = totalHours / schedules.length;
        } else {
          // Estimate based on dates
          const start = new Date(training.start_date);
          const end = training.end_date ? new Date(training.end_date) : start;
          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          totalHours = days * 7;
        }

        // Check for evaluations
        const { count: evaluationsCount } = await supabase
          .from("training_evaluations")
          .select("*", { count: "exact", head: true })
          .eq("training_id", training.id)
          .eq("etat", "soumis");

        // Check for attendance signatures
        const { count: signaturesCount } = await supabase
          .from("attendance_signatures")
          .select("*", { count: "exact", head: true })
          .eq("training_id", training.id)
          .not("signed_at", "is", null);

        // Determine format
        let format = "intra";
        if (training.format_formation === "inter-entreprises") {
          format = "inter";
        } else if (
          training.format_formation === "classe_virtuelle" ||
          training.location?.toLowerCase().includes("ligne") ||
          training.location?.toLowerCase().includes("visio")
        ) {
          format = "online";
        }

        // Identify missing elements
        const missing: string[] = [];
        if (!evaluationsCount || evaluationsCount === 0) {
          missing.push("evaluations");
        } else if (evaluationsCount < (participantsCount || 0)) {
          missing.push("evaluations_incomplete");
        }
        if (!signaturesCount || signaturesCount === 0) {
          missing.push("attendance");
        }

        return {
          id: training.id,
          name: training.training_name,
          client: training.client_name,
          startDate: training.start_date,
          endDate: training.end_date,
          format,
          participantsCount: participantsCount || 0,
          hoursPerDay: Math.round(hoursPerDay * 10) / 10,
          totalHours: Math.round(totalHours * 10) / 10,
          hasEvaluations: (evaluationsCount || 0) > 0,
          hasAttendance: (signaturesCount || 0) > 0,
          hasCertificates: false, // Would need to check PDFMonkey/Drive
          missing,
        };
      })
    );

    // Calculate statistics
    const statistics = {
      totalTrainings: trainingsWithDetails.length,
      totalParticipants: trainingsWithDetails.reduce((sum, t) => sum + t.participantsCount, 0),
      totalHours: trainingsWithDetails.reduce((sum, t) => sum + t.totalHours * t.participantsCount, 0),
      totalRevenue: 0, // Would need invoice data
      byFormat: {
        intra: {
          trainings: trainingsWithDetails.filter((t) => t.format === "intra").length,
          participants: trainingsWithDetails
            .filter((t) => t.format === "intra")
            .reduce((sum, t) => sum + t.participantsCount, 0),
          hours: trainingsWithDetails
            .filter((t) => t.format === "intra")
            .reduce((sum, t) => sum + t.totalHours * t.participantsCount, 0),
        },
        inter: {
          trainings: trainingsWithDetails.filter((t) => t.format === "inter").length,
          participants: trainingsWithDetails
            .filter((t) => t.format === "inter")
            .reduce((sum, t) => sum + t.participantsCount, 0),
          hours: trainingsWithDetails
            .filter((t) => t.format === "inter")
            .reduce((sum, t) => sum + t.totalHours * t.participantsCount, 0),
        },
        online: {
          trainings: trainingsWithDetails.filter((t) => t.format === "online").length,
          participants: trainingsWithDetails
            .filter((t) => t.format === "online")
            .reduce((sum, t) => sum + t.participantsCount, 0),
          hours: trainingsWithDetails
            .filter((t) => t.format === "online")
            .reduce((sum, t) => sum + t.totalHours * t.participantsCount, 0),
        },
      },
      byMonth: Array.from({ length: 12 }, (_, i) => {
        const monthTrainings = trainingsWithDetails.filter((t) => {
          const month = new Date(t.startDate).getMonth();
          return month === i;
        });
        return {
          month: i + 1,
          trainings: monthTrainings.length,
          participants: monthTrainings.reduce((sum, t) => sum + t.participantsCount, 0),
          hours: monthTrainings.reduce((sum, t) => sum + t.totalHours * t.participantsCount, 0),
        };
      }),
    };

    // Build missing elements list
    const missingElements = trainingsWithDetails
      .filter((t) => t.missing.length > 0)
      .map((t) => ({
        trainingId: t.id,
        trainingName: t.name,
        missing: t.missing,
      }));

    const bpfData: BPFData = {
      year: targetYear,
      organization: {
        name: "SuperTilt",
        siren: "XXX XXX XXX", // Would come from config
        nda: "XX XX XXXXX XX", // Numero de declaration d'activite
        address: "Paris, France",
      },
      statistics,
      trainings: trainingsWithDetails,
      missingElements,
    };

    return new Response(JSON.stringify({ success: true, data: bpfData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error generating BPF:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
