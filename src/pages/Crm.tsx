import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BarChart3, Sparkles, Kanban, BrainCircuit, Settings2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import ModuleLayout from "@/components/ModuleLayout";
import CrmKanbanBoard from "@/components/crm/CrmKanbanBoard";
import { NewOpportunityDialog } from "@/components/crm/NewOpportunityDialog";
import CoachCommercialSettings from "@/components/crm/CoachCommercialSettings";
import { useAuth } from "@/hooks/useAuth";
import { useCommercialCoachData } from "@/hooks/useCommercialCoachData";

const Crm = () => {
  const { user } = useAuth();
  const { cardId } = useParams<{ cardId?: string }>();
  const [showNewOpportunity, setShowNewOpportunity] = useState(false);
  const [showCoachSettings, setShowCoachSettings] = useState(false);
  const { launchCoach, isLoading: isCoachLoading } = useCommercialCoachData();

  return (
    <ModuleLayout>
      <main className="max-w-[1600px] mx-auto p-4 sm:p-6 h-[calc(100vh-80px)] flex flex-col">
        {/* Header with back navigation */}
        <PageHeader
          icon={Kanban}
          title="Pipeline CRM"
          subtitle="Gérez vos opportunités commerciales"
          actions={
            <div className="flex flex-wrap gap-2">
              <div className="flex">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => launchCoach()}
                  disabled={isCoachLoading}
                  className="rounded-r-none"
                >
                  <BrainCircuit className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">{isCoachLoading ? "Chargement..." : "Coach Commercial"}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCoachSettings(true)}
                  className="rounded-l-none border-l-0 px-2"
                  title="Paramétrer le coach"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>
              <Button size="sm" onClick={() => setShowNewOpportunity(true)}>
                <Sparkles className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Nouvelle opportunité</span>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/crm/reports">
                  <BarChart3 className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Reporting</span>
                </Link>
              </Button>
            </div>
          }
        />

        {/* Kanban Board */}
        <div className="flex-1 min-h-0">
          <CrmKanbanBoard initialCardId={cardId} />
        </div>

        {/* New Opportunity Dialog */}
        <NewOpportunityDialog
          open={showNewOpportunity}
          onOpenChange={setShowNewOpportunity}
          userEmail={user?.email || "unknown"}
        />

        {/* Coach Commercial Settings Drawer */}
        <CoachCommercialSettings
          open={showCoachSettings}
          onOpenChange={setShowCoachSettings}
        />
      </main>
    </ModuleLayout>
  );
};

export default Crm;
