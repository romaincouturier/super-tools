import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, Sparkles, ArrowLeft, Kanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppHeader from "@/components/AppHeader";
import CrmKanbanBoard from "@/components/crm/CrmKanbanBoard";
import { NewOpportunityDialog } from "@/components/crm/NewOpportunityDialog";
import { useAuth } from "@/hooks/useAuth";

const Crm = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showNewOpportunity, setShowNewOpportunity] = useState(false);

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
              <div className="p-2 rounded-lg bg-primary/10">
                <Kanban className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Pipeline CRM</h1>
                <p className="text-muted-foreground text-sm">
                  Gérez vos opportunités commerciales
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowNewOpportunity(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Nouvelle opportunité
            </Button>
            <Button variant="outline" asChild>
              <Link to="/crm/reports">
                <BarChart3 className="h-4 w-4 mr-2" />
                Reporting
              </Link>
            </Button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 min-h-0">
          <CrmKanbanBoard />
        </div>

        {/* New Opportunity Dialog */}
        <NewOpportunityDialog
          open={showNewOpportunity}
          onOpenChange={setShowNewOpportunity}
          userEmail={user?.email || "unknown"}
        />
      </main>
    </div>
  );
};

export default Crm;
