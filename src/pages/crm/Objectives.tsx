import { useState, useEffect } from "react";
import CRMLayout from "@/components/crm/CRMLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Target,
  Plus,
  TrendingUp,
  TrendingDown,
  Euro,
  Users,
  Phone,
  Calendar,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { fr } from "date-fns/locale";

interface Objective {
  id: string;
  type: string;
  target_value: number;
  current_value: number;
  period_start: string;
  period_end: string;
  status: string;
  created_at: string;
}

interface Stats {
  leadsWon: number;
  revenue: number;
  activitiesCompleted: number;
  newLeads: number;
}

export default function Objectives() {
  const { toast } = useToast();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [stats, setStats] = useState<Stats>({
    leadsWon: 0,
    revenue: 0,
    activitiesCompleted: 0,
    newLeads: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");
  const [newObjective, setNewObjective] = useState({
    type: "revenue",
    target_value: "",
    period: "month",
  });

  useEffect(() => {
    fetchObjectives();
    fetchStats();
  }, [period]);

  const getPeriodDates = (p: string) => {
    const now = new Date();
    switch (p) {
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "quarter":
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case "year":
        return { start: startOfYear(now), end: endOfYear(now) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const fetchObjectives = async () => {
    const { start, end } = getPeriodDates(period);

    const { data, error } = await supabase
      .from("crm_objectives")
      .select("*")
      .gte("period_start", start.toISOString())
      .lte("period_end", end.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les objectifs",
        variant: "destructive",
      });
    } else {
      setObjectives(data || []);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    const { start, end } = getPeriodDates(period);

    // Fetch leads won (accepted quotes)
    const { data: quotesData } = await supabase
      .from("crm_quotes")
      .select("amount_ttc")
      .eq("status", "accepted")
      .gte("accepted_at", start.toISOString())
      .lte("accepted_at", end.toISOString());

    // Fetch activities completed
    const { count: activitiesCount } = await supabase
      .from("crm_activities")
      .select("*", { count: "exact", head: true })
      .not("completed_at", "is", null)
      .gte("completed_at", start.toISOString())
      .lte("completed_at", end.toISOString());

    // Fetch new leads
    const { count: newLeadsCount } = await supabase
      .from("crm_leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    // Fetch invoices paid
    const { data: invoicesData } = await supabase
      .from("crm_invoices")
      .select("amount_ttc")
      .eq("status", "paid")
      .gte("paid_at", start.toISOString())
      .lte("paid_at", end.toISOString());

    const revenue = invoicesData?.reduce((sum, i) => sum + i.amount_ttc, 0) || 0;
    const leadsWon = quotesData?.length || 0;

    setStats({
      leadsWon,
      revenue,
      activitiesCompleted: activitiesCount || 0,
      newLeads: newLeadsCount || 0,
    });

    // Update objectives current values
    for (const obj of objectives) {
      let currentValue = 0;
      switch (obj.type) {
        case "revenue":
          currentValue = revenue;
          break;
        case "leads_won":
          currentValue = leadsWon;
          break;
        case "activities":
          currentValue = activitiesCount || 0;
          break;
        case "new_leads":
          currentValue = newLeadsCount || 0;
          break;
      }

      if (currentValue !== obj.current_value) {
        await supabase
          .from("crm_objectives")
          .update({ current_value: currentValue })
          .eq("id", obj.id);
      }
    }
  };

  const createObjective = async () => {
    if (!newObjective.target_value) {
      toast({
        title: "Erreur",
        description: "Veuillez definir une valeur cible",
        variant: "destructive",
      });
      return;
    }

    const { start, end } = getPeriodDates(newObjective.period);

    const { error } = await supabase.from("crm_objectives").insert({
      type: newObjective.type,
      target_value: parseFloat(newObjective.target_value),
      current_value: 0,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      status: "in_progress",
    });

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de creer l'objectif",
        variant: "destructive",
      });
    } else {
      setDialogOpen(false);
      setNewObjective({ type: "revenue", target_value: "", period: "month" });
      fetchObjectives();
      toast({
        title: "Objectif cree",
        description: "L'objectif a ete defini avec succes",
      });
    }
  };

  const getObjectiveIcon = (type: string) => {
    switch (type) {
      case "revenue":
        return <Euro className="h-5 w-5" />;
      case "leads_won":
        return <CheckCircle className="h-5 w-5" />;
      case "activities":
        return <Phone className="h-5 w-5" />;
      case "new_leads":
        return <Users className="h-5 w-5" />;
      default:
        return <Target className="h-5 w-5" />;
    }
  };

  const getObjectiveLabel = (type: string) => {
    switch (type) {
      case "revenue":
        return "Chiffre d'affaires";
      case "leads_won":
        return "Affaires gagnees";
      case "activities":
        return "Activites realisees";
      case "new_leads":
        return "Nouveaux leads";
      default:
        return type;
    }
  };

  const formatValue = (type: string, value: number) => {
    if (type === "revenue") {
      return value.toLocaleString("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      });
    }
    return value.toString();
  };

  const getProgress = (objective: Objective) => {
    if (objective.target_value === 0) return 0;
    return Math.min(
      100,
      Math.round((objective.current_value / objective.target_value) * 100)
    );
  };

  const getStatusColor = (objective: Objective) => {
    const progress = getProgress(objective);
    if (progress >= 100) return "bg-green-500";
    if (progress >= 75) return "bg-blue-500";
    if (progress >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getPeriodLabel = (p: string) => {
    switch (p) {
      case "month":
        return "Ce mois";
      case "quarter":
        return "Ce trimestre";
      case "year":
        return "Cette annee";
      default:
        return p;
    }
  };

  return (
    <CRMLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Objectifs & Reporting</h1>
            <p className="text-muted-foreground">
              Suivez vos performances commerciales
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as typeof period)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Ce mois</SelectItem>
                <SelectItem value="quarter">Ce trimestre</SelectItem>
                <SelectItem value="year">Cette annee</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvel objectif
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Definir un objectif</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label>Type d'objectif</Label>
                    <Select
                      value={newObjective.type}
                      onValueChange={(v) =>
                        setNewObjective({ ...newObjective, type: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="revenue">Chiffre d'affaires</SelectItem>
                        <SelectItem value="leads_won">Affaires gagnees</SelectItem>
                        <SelectItem value="activities">Activites realisees</SelectItem>
                        <SelectItem value="new_leads">Nouveaux leads</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Valeur cible</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={newObjective.target_value}
                        onChange={(e) =>
                          setNewObjective({
                            ...newObjective,
                            target_value: e.target.value,
                          })
                        }
                        placeholder={
                          newObjective.type === "revenue" ? "50000" : "10"
                        }
                        className={newObjective.type === "revenue" ? "pr-8" : ""}
                      />
                      {newObjective.type === "revenue" && (
                        <Euro className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Periode</Label>
                    <Select
                      value={newObjective.period}
                      onValueChange={(v) =>
                        setNewObjective({ ...newObjective, period: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="month">Ce mois</SelectItem>
                        <SelectItem value="quarter">Ce trimestre</SelectItem>
                        <SelectItem value="year">Cette annee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={createObjective} className="w-full">
                    Creer l'objectif
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Current Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">CA encaisse</p>
                  <p className="text-2xl font-bold">
                    {stats.revenue.toLocaleString("fr-FR")} EUR
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <Euro className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Affaires gagnees</p>
                  <p className="text-2xl font-bold">{stats.leadsWon}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <CheckCircle className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Activites</p>
                  <p className="text-2xl font-bold">{stats.activitiesCompleted}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Phone className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Nouveaux leads</p>
                  <p className="text-2xl font-bold">{stats.newLeads}</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <Users className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Objectives */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Objectifs {getPeriodLabel(period).toLowerCase()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : objectives.length === 0 ? (
              <div className="text-center py-8">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucun objectif defini</h3>
                <p className="text-muted-foreground mb-4">
                  Definissez vos objectifs pour suivre vos performances
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Definir un objectif
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {objectives.map((objective) => {
                  const progress = getProgress(objective);
                  const isAchieved = progress >= 100;

                  return (
                    <div key={objective.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-full ${
                              isAchieved ? "bg-green-100" : "bg-muted"
                            }`}
                          >
                            {getObjectiveIcon(objective.type)}
                          </div>
                          <div>
                            <p className="font-medium">
                              {getObjectiveLabel(objective.type)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatValue(objective.type, objective.current_value)}{" "}
                              / {formatValue(objective.type, objective.target_value)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isAchieved ? (
                            <Badge className="bg-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Atteint
                            </Badge>
                          ) : progress >= 75 ? (
                            <Badge variant="default">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              En bonne voie
                            </Badge>
                          ) : progress < 50 ? (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Attention
                            </Badge>
                          ) : null}
                          <span className="text-lg font-bold">{progress}%</span>
                        </div>
                      </div>
                      <Progress value={progress} className={getStatusColor(objective)} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Analyse des performances</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Taux de conversion</p>
                  <p className="text-sm text-muted-foreground">
                    Leads convertis en clients
                  </p>
                </div>
                <p className="text-2xl font-bold">
                  {stats.newLeads > 0
                    ? Math.round((stats.leadsWon / stats.newLeads) * 100)
                    : 0}
                  %
                </p>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Panier moyen</p>
                  <p className="text-sm text-muted-foreground">
                    Montant moyen par affaire
                  </p>
                </div>
                <p className="text-2xl font-bold">
                  {stats.leadsWon > 0
                    ? (stats.revenue / stats.leadsWon).toLocaleString("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                        maximumFractionDigits: 0,
                      })
                    : "0 EUR"}
                </p>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Activites par lead</p>
                  <p className="text-sm text-muted-foreground">
                    Effort commercial moyen
                  </p>
                </div>
                <p className="text-2xl font-bold">
                  {stats.newLeads > 0
                    ? (stats.activitiesCompleted / stats.newLeads).toFixed(1)
                    : 0}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recommandations IA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats.activitiesCompleted < 10 && (
                <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800">
                      Augmentez votre activite commerciale
                    </p>
                    <p className="text-sm text-yellow-700">
                      Vous avez realise peu d'activites ce mois. Planifiez plus
                      d'appels et de reunions pour atteindre vos objectifs.
                    </p>
                  </div>
                </div>
              )}
              {stats.leadsWon > 0 && stats.revenue / stats.leadsWon < 1000 && (
                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <TrendingUp className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-800">
                      Ciblez des affaires plus importantes
                    </p>
                    <p className="text-sm text-blue-700">
                      Votre panier moyen est relativement bas. Concentrez-vous
                      sur des prospects avec un potentiel plus eleve.
                    </p>
                  </div>
                </div>
              )}
              {stats.newLeads > 0 &&
                stats.leadsWon / stats.newLeads < 0.1 && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                    <TrendingDown className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">
                        Ameliorez votre taux de conversion
                      </p>
                      <p className="text-sm text-red-700">
                        Moins de 10% de vos leads sont convertis. Revoyez votre
                        processus de qualification et de suivi.
                      </p>
                    </div>
                  </div>
                )}
              {stats.activitiesCompleted >= 10 &&
                stats.leadsWon > 0 &&
                stats.leadsWon / stats.newLeads >= 0.1 && (
                  <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-800">
                        Excellentes performances !
                      </p>
                      <p className="text-sm text-green-700">
                        Vos indicateurs sont bons. Continuez sur cette lancee
                        et maintenez votre rythme d'activite.
                      </p>
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
        </div>
      </div>
    </CRMLayout>
  );
}
