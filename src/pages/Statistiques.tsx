import { Loader2, Star, BarChart3 } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import WeeklyChart from "@/components/dashboard/WeeklyChart";
import StatCard from "@/components/dashboard/StatCard";
import TopImprovements from "@/components/dashboard/TopImprovements";
import { useDashboardStats } from "@/hooks/useDashboardStats";

const Statistiques = () => {
  const {
    microDevisWeekly,
    formationsWeekly,
    evaluationsWeekly,
    averageEvaluation,
    topImprovements,
    isLoading,
  } = useDashboardStats();

  return (
    <ModuleLayout>
      <main className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Title */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Statistiques</h1>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <WeeklyChart
                title="Micro-devis par semaine"
                data={microDevisWeekly}
                color="hsl(var(--primary))"
              />
              <WeeklyChart
                title="Formations par semaine"
                data={formationsWeekly}
                color="hsl(var(--chart-2))"
              />
              <WeeklyChart
                title="Évaluations par semaine"
                data={evaluationsWeekly}
                color="hsl(var(--chart-3))"
              />
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard
                title="Évaluation moyenne"
                value={averageEvaluation ? `${averageEvaluation.toFixed(1)}/5` : "N/A"}
                icon={Star}
                description="Basée sur toutes les évaluations soumises"
              />
              <TopImprovements improvements={topImprovements} />
            </div>
          </div>
        )}
      </main>
    </ModuleLayout>
  );
};

export default Statistiques;
