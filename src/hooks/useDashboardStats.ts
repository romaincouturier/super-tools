import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subMonths, format, eachWeekOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { processWeeklyData, type WeeklyData } from "@/lib/dashboardHelpers";

interface DashboardStats {
  microDevisWeekly: WeeklyData[];
  formationsWeekly: WeeklyData[];
  evaluationsWeekly: WeeklyData[];
  averageEvaluation: number | null;
  topImprovements: { id: string; title: string; category: string; status: string }[];
  isLoading: boolean;
}

export const useDashboardStats = (): DashboardStats => {
  // IMPORTANT: keep the date range stable across renders.
  // Otherwise queryKey changes continuously (because new Date() changes), causing infinite loading.
  const { startDate, endDate, startDateKey } = useMemo(() => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = subMonths(end, 12);
    return {
      startDate: start,
      endDate: end,
      startDateKey: format(start, "yyyy-MM-dd"),
    };
  }, []);

  // Generate all weeks in the last 12 months
  const allWeeks = useMemo(
    () =>
      eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 }).map((weekStart) =>
        format(weekStart, "dd/MM", { locale: fr }),
      ),
    [startDateKey],
  );

  // Micro-devis sent per week
  const { data: microDevisData, isLoading: microDevisLoading } = useQuery({
    queryKey: ["dashboard-micro-devis", startDateKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("created_at")
        .eq("action_type", "micro_devis_generated")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching micro-devis:", error);
        return [];
      }
      return data || [];
    },
  });

  // Formations per week (based on start_date)
  const { data: formationsData, isLoading: formationsLoading } = useQuery({
    queryKey: ["dashboard-formations", startDateKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainings")
        .select("start_date")
        .or("is_cancelled.is.null,is_cancelled.eq.false")
        .gte("start_date", format(startDate, "yyyy-MM-dd"))
        .order("start_date", { ascending: true });

      if (error) {
        console.error("Error fetching formations:", error);
        return [];
      }
      return data || [];
    },
  });

  // Evaluations per week (based on date_soumission)
  const { data: evaluationsData, isLoading: evaluationsLoading } = useQuery({
    queryKey: ["dashboard-evaluations", startDateKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_evaluations")
        .select("date_soumission, appreciation_generale")
        .not("date_soumission", "is", null)
        .gte("date_soumission", startDate.toISOString())
        .order("date_soumission", { ascending: true });

      if (error) {
        console.error("Error fetching evaluations:", error);
        return [];
      }
      return data || [];
    },
  });

  // Top 3 pending improvements
  const { data: improvementsData, isLoading: improvementsLoading } = useQuery({
    queryKey: ["dashboard-improvements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("improvements")
        .select("id, title, category, status")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) {
        console.error("Error fetching improvements:", error);
        return [];
      }
      return data || [];
    },
  });

  // Process micro-devis data into weekly counts
  const microDevisWeekly = processWeeklyData(
    microDevisData?.map((d) => d.created_at) || [],
    allWeeks
  );

  // Process formations data into weekly counts
  const formationsWeekly = processWeeklyData(
    formationsData?.map((d) => d.start_date) || [],
    allWeeks
  );

  // Process evaluations data into weekly counts
  const evaluationsWeekly = processWeeklyData(
    (evaluationsData?.map((d) => d.date_soumission).filter(Boolean) as string[]) || [],
    allWeeks
  );

  // Calculate average evaluation
  const evaluationsWithScore = evaluationsData?.filter((e) => e.appreciation_generale !== null) || [];
  const averageEvaluation =
    evaluationsWithScore.length > 0
      ? evaluationsWithScore.reduce((sum, e) => sum + (e.appreciation_generale || 0), 0) /
        evaluationsWithScore.length
      : null;

  const isLoading = microDevisLoading || formationsLoading || evaluationsLoading || improvementsLoading;

  return {
    microDevisWeekly,
    formationsWeekly,
    evaluationsWeekly,
    averageEvaluation,
    topImprovements: improvementsData || [],
    isLoading,
  };
};
