import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppHeader from "@/components/AppHeader";
import MissionsKanbanBoard from "@/components/missions/MissionsKanbanBoard";
import MissionProfitabilityDashboard from "@/components/missions/MissionProfitabilityDashboard";

const Missions = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-[1600px] mx-auto p-6 h-[calc(100vh-80px)] flex flex-col">
        {/* Header with back navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Briefcase className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Missions</h1>
                <p className="text-muted-foreground text-sm">
                  Suivi des missions de conseil
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Profitability Dashboard */}
        <MissionProfitabilityDashboard />

        {/* Kanban Board */}
        <div className="flex-1 min-h-0">
          <MissionsKanbanBoard
            prefillFromCrm={searchParams.get("title") ? {
              title: searchParams.get("title") || "",
              clientName: searchParams.get("clientName") || "",
              clientContact: searchParams.get("clientContact") || "",
              totalAmount: searchParams.get("totalAmount") || "",
              fromCrmCardId: searchParams.get("fromCrmCardId") || "",
            } : undefined}
            onPrefillConsumed={() => setSearchParams({})}
          />
        </div>
      </main>
    </div>
  );
};

export default Missions;
