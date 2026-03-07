import { useSearchParams, useParams } from "react-router-dom";
import { Briefcase } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import MissionsKanbanBoard from "@/components/missions/MissionsKanbanBoard";
import MissionProfitabilityDashboard from "@/components/missions/MissionProfitabilityDashboard";

const Missions = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { missionId } = useParams<{ missionId?: string }>();

  // Support deep links: /missions/:missionId or /missions?open=:id
  const openMissionId = missionId || searchParams.get("open");

  return (
    <ModuleLayout>
      <main className="max-w-[1600px] mx-auto p-6 h-[calc(100vh-80px)] flex flex-col">
        {/* Header with back navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
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
            openMissionId={openMissionId}
            prefillFromCrm={searchParams.get("title") ? {
              title: searchParams.get("title") || "",
              clientName: searchParams.get("clientName") || "",
              clientContact: searchParams.get("clientContact") || "",
              totalAmount: searchParams.get("totalAmount") || "",
              fromCrmCardId: searchParams.get("fromCrmCardId") || "",
              contactFirstName: searchParams.get("contactFirstName") || "",
              contactLastName: searchParams.get("contactLastName") || "",
              contactEmail: searchParams.get("contactEmail") || "",
              contactPhone: searchParams.get("contactPhone") || "",
            } : undefined}
            onPrefillConsumed={() => setSearchParams({})}
          />
        </div>
      </main>
    </ModuleLayout>
  );
};

export default Missions;
