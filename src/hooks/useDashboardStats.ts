import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, subMonths, format, eachWeekOfInterval, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface WeeklyData {
  week: string;
  count: number;
}

interface DashboardStats {
  microDevisWeekly: WeeklyData[];
  formationsWeekly: WeeklyData[];
  evaluationsWeekly: WeeklyData[];
  averageEvaluation: number | null;
  topImprovements: { id: string; title: string; category: string; status: string }[];
  isLoading: boolean;
}

export const useDashboardStats = (): DashboardStats => {
  const endDate = new Date();
  const startDate = subMonths(endDate, 12);

  // Generate all weeks in the last 12 months
  const allWeeks = eachWeekOfInterval(
    { start: startDate, end: endDate },
    { weekStartsOn: 1 }
  ).map((weekStart) => format(weekStart, "dd/MM", { locale: fr }));

  // Micro-devis sent per week
  const { data: microDevisData, isLoading: microDevisLoading } = useQuery({
    queryKey: ["dashboard-micro-devis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("created_at")
        .eq("action_type", "micro_devis_generated")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Formations per week (based on start_date)
  const { data: formationsData, isLoading: formationsLoading } = useQuery({
    queryKey: ["dashboard-formations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainings")
        .select("start_date")
        .gte("start_date", startDate.toISOString().split("T")[0])
        .order("start_date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Evaluations per week (based on date_soumission)
  const { data: evaluationsData, isLoading: evaluationsLoading } = useQuery({
    queryKey: ["dashboard-evaluations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_evaluations")
        .select("date_soumission, appreciation_generale")
        .not("date_soumission", "is", null)
        .gte("date_soumission", startDate.toISOString())
        .order("date_soumission", { ascending: true });

      if (error) throw error;
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

      if (error) throw error;
      return data || [];
    },
  });

  // Process micro-devis data into weekly counts
  const microDevisWeekly = processWeeklyData(
    microDevisData?.map((d) => d.created_at) || [],
    allWeeks,
    startDate,
    endDate
  );

  // Process formations data into weekly counts
  const formationsWeekly = processWeeklyData(
    formationsData?.map((d) => d.start_date) || [],
    allWeeks,
    startDate,
    endDate
  );

  // Process evaluations data into weekly counts
  const evaluationsWeekly = processWeeklyData(
    evaluationsData?.map((d) => d.date_soumission).filter(Boolean) as string[] || [],
    allWeeks,
    startDate,
    endDate
  );

  // Calculate average evaluation
  const evaluationsWithScore = evaluationsData?.filter((e) => e.appreciation_generale !== null) || [];
  const averageEvaluation =
    evaluationsWithScore.length > 0
      ? evaluationsWithScore.reduce((sum, e) => sum + (e.appreciation_generale || 0), 0) /
        evaluationsWithScore.length
      : null;

  return {
    microDevisWeekly,
    formationsWeekly,
    evaluationsWeekly,
    averageEvaluation,
    topImprovements: improvementsData || [],
    isLoading: microDevisLoading || formationsLoading || evaluationsLoading || improvementsLoading,
  };
};

function processWeeklyData(
  dates: string[],
  allWeeks: string[],
  startDate: Date,
  endDate: Date
): WeeklyData[] {
  const weekCounts: Record<string, number> = {};

  // Initialize all weeks with 0
  allWeeks.forEach((week) => {
    weekCounts[week] = 0;
  });

  // Count occurrences per week
  dates.forEach((dateStr) => {
    const date = parseISO(dateStr);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekLabel = format(weekStart, "dd/MM", { locale: fr });
    if (weekCounts[weekLabel] !== undefined) {
      weekCounts[weekLabel]++;
    }
  });

  return allWeeks.map((week) => ({
    week,
    count: weekCounts[week] || 0,
  }));
}
