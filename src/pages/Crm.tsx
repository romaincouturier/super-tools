import { Link } from "react-router-dom";
import { BarChart3, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import CrmKanbanBoard from "@/components/crm/CrmKanbanBoard";

const Crm = () => {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Pipeline CRM</h1>
          <p className="text-muted-foreground">
            Gérez vos opportunités commerciales
          </p>
        </div>
        <div className="flex gap-2">
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
    </div>
  );
};

export default Crm;
