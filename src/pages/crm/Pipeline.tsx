import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import CRMLayout from "@/components/crm/CRMLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Plus,
  MoreHorizontal,
  Euro,
  User,
  Building,
  GripVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  position: number;
  is_won: boolean;
  is_lost: boolean;
  probability: number;
}

interface Lead {
  id: string;
  title: string;
  company_name: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  amount: number;
  stage_id: string | null;
  priority: string;
  temperature: string;
  expected_close_date: string | null;
}

const Pipeline = () => {
  const [loading, setLoading] = useState(true);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      // Fetch stages
      const { data: stagesData, error: stagesError } = await supabase
        .from("crm_pipeline_stages")
        .select("*")
        .order("position", { ascending: true });

      if (stagesError) throw stagesError;

      // If no stages, create defaults
      if (!stagesData || stagesData.length === 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single();

          if (profile?.organization_id) {
            await supabase.rpc("setup_default_pipeline_stages", {
              p_org_id: profile.organization_id,
            });
            // Re-fetch stages
            const { data: newStages } = await supabase
              .from("crm_pipeline_stages")
              .select("*")
              .order("position", { ascending: true });
            setStages(newStages || []);
          }
        }
      } else {
        setStages(stagesData);
      }

      // Fetch leads
      const { data: leadsData, error: leadsError } = await supabase
        .from("crm_leads")
        .select("id, title, company_name, contact_first_name, contact_last_name, amount, stage_id, priority, temperature, expected_close_date")
        .order("updated_at", { ascending: false });

      if (leadsError) throw leadsError;
      setLeads(leadsData || []);
    } catch (error) {
      console.error("Error fetching pipeline data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(null);

    if (!draggedLead || draggedLead.stage_id === stageId) {
      setDraggedLead(null);
      return;
    }

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) =>
        l.id === draggedLead.id ? { ...l, stage_id: stageId } : l
      )
    );

    try {
      const { error } = await supabase
        .from("crm_leads")
        .update({ stage_id: stageId, updated_at: new Date().toISOString() })
        .eq("id", draggedLead.id);

      if (error) throw error;

      const stage = stages.find((s) => s.id === stageId);
      toast({
        title: "Lead deplace",
        description: `"${draggedLead.title}" est maintenant en "${stage?.name}"`,
      });
    } catch (error) {
      console.error("Error moving lead:", error);
      // Revert on error
      setLeads((prev) =>
        prev.map((l) =>
          l.id === draggedLead.id ? { ...l, stage_id: draggedLead.stage_id } : l
        )
      );
      toast({
        title: "Erreur",
        description: "Impossible de deplacer le lead",
        variant: "destructive",
      });
    }

    setDraggedLead(null);
  };

  const getLeadsForStage = (stageId: string | null) => {
    return leads.filter((l) => l.stage_id === stageId);
  };

  const getStageTotal = (stageId: string) => {
    return getLeadsForStage(stageId).reduce((sum, l) => sum + (l.amount || 0), 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      default:
        return "bg-gray-400";
    }
  };

  const getTemperatureColor = (temp: string) => {
    switch (temp) {
      case "hot":
        return "text-red-500";
      case "warm":
        return "text-orange-500";
      default:
        return "text-blue-500";
    }
  };

  if (loading) {
    return (
      <CRMLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Pipeline de vente</h2>
            <p className="text-sm text-muted-foreground">
              Glissez-deposez les leads entre les etapes
            </p>
          </div>
          <Button onClick={() => navigate("/crm/leads/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau lead
          </Button>
        </div>

        {/* Unassigned leads */}
        {getLeadsForStage(null).length > 0 && (
          <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200">
            <CardHeader className="py-2">
              <CardTitle className="text-sm flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                Leads sans etape ({getLeadsForStage(null).length})
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="flex gap-2 flex-wrap">
                {getLeadsForStage(null).map((lead) => (
                  <Badge
                    key={lead.id}
                    variant="outline"
                    className="cursor-pointer hover:bg-yellow-100"
                    onClick={() => navigate(`/crm/leads/${lead.id}`)}
                  >
                    {lead.title}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Kanban Board */}
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4 min-w-max">
            {stages.map((stage) => {
              const stageLeads = getLeadsForStage(stage.id);
              const stageTotal = getStageTotal(stage.id);
              const isDropTarget = dragOverStage === stage.id;

              return (
                <div
                  key={stage.id}
                  className={`w-72 sm:w-80 shrink-0 rounded-lg border-2 transition-colors ${
                    isDropTarget
                      ? "border-primary bg-primary/5"
                      : "border-transparent bg-muted/30"
                  }`}
                  onDragOver={(e) => handleDragOver(e, stage.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stage.id)}
                >
                  {/* Stage Header */}
                  <div
                    className="p-3 border-b"
                    style={{ borderBottomColor: stage.color }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <h3 className="font-semibold">{stage.name}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {stageLeads.length}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {stage.probability}%
                      </span>
                    </div>
                    <p className="text-sm font-medium mt-1" style={{ color: stage.color }}>
                      {formatCurrency(stageTotal)}
                    </p>
                  </div>

                  {/* Stage Content */}
                  <div className="p-2 space-y-2 min-h-[200px]">
                    {stageLeads.map((lead) => (
                      <Card
                        key={lead.id}
                        className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                          draggedLead?.id === lead.id ? "opacity-50" : ""
                        }`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div
                                  className={`w-2 h-2 rounded-full shrink-0 ${getPriorityColor(lead.priority)}`}
                                />
                                <p
                                  className="font-medium truncate cursor-pointer hover:text-primary"
                                  onClick={() => navigate(`/crm/leads/${lead.id}`)}
                                >
                                  {lead.title}
                                </p>
                              </div>

                              {lead.company_name && (
                                <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                                  <Building className="h-3 w-3" />
                                  <span className="truncate">{lead.company_name}</span>
                                </div>
                              )}

                              {(lead.contact_first_name || lead.contact_last_name) && (
                                <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  <span className="truncate">
                                    {lead.contact_first_name} {lead.contact_last_name}
                                  </span>
                                </div>
                              )}
                            </div>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/crm/leads/${lead.id}`)}>
                                  Voir le detail
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/crm/leads/${lead.id}/edit`)}>
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/crm/activities/new?lead=${lead.id}`)}>
                                  Ajouter une activite
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-2 border-t">
                            <div className="flex items-center gap-1">
                              <Euro className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {formatCurrency(lead.amount || 0)}
                              </span>
                            </div>
                            <span className={`text-xs font-medium ${getTemperatureColor(lead.temperature)}`}>
                              {lead.temperature === "hot" ? "Chaud" : lead.temperature === "warm" ? "Tiede" : "Froid"}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {stageLeads.length === 0 && (
                      <div className="flex items-center justify-center h-24 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                        Deposez un lead ici
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </CRMLayout>
  );
};

export default Pipeline;
