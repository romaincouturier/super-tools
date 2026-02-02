import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import CRMLayout from "@/components/crm/CRMLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Plus,
  Search,
  Filter,
  Upload,
  MoreHorizontal,
  Building,
  Mail,
  Phone,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Lead {
  id: string;
  title: string;
  company_name: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  amount: number;
  priority: string;
  temperature: string;
  source: string | null;
  created_at: string;
  last_activity_at: string | null;
  stage: {
    id: string;
    name: string;
    color: string;
  } | null;
  assigned_to_profile: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

interface PipelineStage {
  id: string;
  name: string;
  color: string;
}

const LeadsList = () => {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch stages
        const { data: stagesData } = await supabase
          .from("crm_pipeline_stages")
          .select("id, name, color")
          .order("position", { ascending: true });

        setStages(stagesData || []);

        // Fetch leads
        const { data: leadsData, error } = await supabase
          .from("crm_leads")
          .select(`
            id,
            title,
            company_name,
            contact_first_name,
            contact_last_name,
            contact_email,
            contact_phone,
            amount,
            priority,
            temperature,
            source,
            created_at,
            last_activity_at,
            stage:crm_pipeline_stages(id, name, color),
            assigned_to_profile:user_profiles!crm_leads_assigned_to_fkey(first_name, last_name)
          `)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setLeads(leadsData as unknown as Lead[] || []);
      } catch (error) {
        console.error("Error fetching leads:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDelete = async (leadId: string, leadTitle: string) => {
    if (!confirm(`Supprimer le lead "${leadTitle}" ?`)) return;

    try {
      const { error } = await supabase
        .from("crm_leads")
        .delete()
        .eq("id", leadId);

      if (error) throw error;

      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      toast({
        title: "Lead supprime",
        description: `"${leadTitle}" a ete supprime.`,
      });
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le lead.",
        variant: "destructive",
      });
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      searchQuery === "" ||
      lead.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.contact_email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStage =
      filterStage === "all" || lead.stage?.id === filterStage;

    const matchesPriority =
      filterPriority === "all" || lead.priority === filterPriority;

    return matchesSearch && matchesStage && matchesPriority;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPriorityBadge = (priority: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      urgent: { label: "Urgent", variant: "destructive" },
      high: { label: "Haute", variant: "default" },
      medium: { label: "Moyenne", variant: "secondary" },
      low: { label: "Basse", variant: "outline" },
    };
    const { label, variant } = config[priority] || config.medium;
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getSourceLabel = (source: string | null) => {
    const labels: Record<string, string> = {
      manual: "Manuel",
      zapier: "Zapier",
      email: "Email",
      linkedin: "LinkedIn",
      website: "Site web",
      referral: "Recommandation",
    };
    return labels[source || ""] || source || "—";
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Leads</h2>
            <p className="text-sm text-muted-foreground">
              {filteredLeads.length} lead{filteredLeads.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Button onClick={() => navigate("/crm/leads/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau lead
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, entreprise, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterStage} onValueChange={setFilterStage}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Etape" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les etapes</SelectItem>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Priorite" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="low">Basse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Leads Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Lead</TableHead>
                    <TableHead className="min-w-[150px] hidden md:table-cell">Contact</TableHead>
                    <TableHead className="min-w-[120px]">Etape</TableHead>
                    <TableHead className="min-w-[100px]">Montant</TableHead>
                    <TableHead className="min-w-[100px] hidden lg:table-cell">Priorite</TableHead>
                    <TableHead className="min-w-[100px] hidden lg:table-cell">Source</TableHead>
                    <TableHead className="min-w-[100px] hidden sm:table-cell">Date</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Aucun lead trouve
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeads.map((lead) => (
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/crm/leads/${lead.id}`)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{lead.title}</p>
                            {lead.company_name && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Building className="h-3 w-3" />
                                {lead.company_name}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="space-y-1">
                            {(lead.contact_first_name || lead.contact_last_name) && (
                              <p className="text-sm">
                                {lead.contact_first_name} {lead.contact_last_name}
                              </p>
                            )}
                            {lead.contact_email && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {lead.contact_email}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {lead.stage ? (
                            <Badge
                              variant="outline"
                              style={{ borderColor: lead.stage.color, color: lead.stage.color }}
                            >
                              {lead.stage.name}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Non assigne</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(lead.amount || 0)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {getPriorityBadge(lead.priority)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {getSourceLabel(lead.source)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {format(new Date(lead.created_at), "d MMM", { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/crm/leads/${lead.id}`); }}>
                                Voir le detail
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/crm/leads/${lead.id}/edit`); }}>
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/crm/activities/new?lead=${lead.id}`); }}>
                                Ajouter une activite
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => { e.stopPropagation(); handleDelete(lead.id, lead.title); }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </CRMLayout>
  );
};

export default LeadsList;
