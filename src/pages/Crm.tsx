import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BarChart3, Sparkles, ArrowLeft, Kanban, BrainCircuit, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppHeader from "@/components/AppHeader";
import CrmKanbanBoard from "@/components/crm/CrmKanbanBoard";
import { NewOpportunityDialog } from "@/components/crm/NewOpportunityDialog";
import CoachCommercialSettings from "@/components/crm/CoachCommercialSettings";
import { useAuth } from "@/hooks/useAuth";
import { useCommercialCoachData } from "@/hooks/useCommercialCoachData";

const Crm = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { cardId } = useParams<{ cardId?: string }>();
  const [showNewOpportunity, setShowNewOpportunity] = useState(false);
  const [showCoachSettings, setShowCoachSettings] = useState(false);
  const { launchCoach, isLoading: isCoachLoading } = useCommercialCoachData();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-[1600px] mx-auto p-4 sm:p-6 h-[calc(100vh-80px)] flex flex-col">
        {/* Header with back navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 hidden sm:block">
                <Kanban className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">Pipeline CRM</h1>
                <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">
                  Gérez vos opportunités commerciales
                </p>
              </div>
            </div>
          </div>
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
        </div>

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
    </div>
  );
};

export default Crm;
