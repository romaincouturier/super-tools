import { useState, useEffect } from "react";
import CRMLayout from "@/components/crm/CRMLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Phone,
  Mail,
  Calendar,
  CheckCircle,
  Clock,
  Plus,
  Filter,
  Building2,
} from "lucide-react";
import { format, isToday, isTomorrow, isPast, startOfDay, endOfDay, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface Activity {
  id: string;
  lead_id: string;
  type: string;
  subject: string;
  description: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  crm_leads?: {
    id: string;
    company_name: string;
    contact_name: string | null;
  };
}

interface Lead {
  id: string;
  company_name: string;
}

export default function Activities() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("pending");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newActivity, setNewActivity] = useState({
    lead_id: "",
    type: "call",
    subject: "",
    description: "",
    due_date: "",
  });

  useEffect(() => {
    fetchActivities();
    fetchLeads();
  }, [filter, typeFilter]);

  const fetchActivities = async () => {
    let query = supabase
      .from("crm_activities")
      .select("*, crm_leads(id, company_name, contact_name)")
      .order("due_date", { ascending: true, nullsFirst: false });

    if (filter === "pending") {
      query = query.is("completed_at", null);
    } else if (filter === "completed") {
      query = query.not("completed_at", "is", null);
    }

    if (typeFilter !== "all") {
      query = query.eq("type", typeFilter);
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les activites",
        variant: "destructive",
      });
    } else {
      setActivities(data || []);
    }
    setLoading(false);
  };

  const fetchLeads = async () => {
    const { data } = await supabase
      .from("crm_leads")
      .select("id, company_name")
      .order("company_name");

    if (data) setLeads(data);
  };

  const createActivity = async () => {
    if (!newActivity.lead_id || !newActivity.subject.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("crm_activities").insert({
      lead_id: newActivity.lead_id,
      type: newActivity.type,
      subject: newActivity.subject,
      description: newActivity.description || null,
      due_date: newActivity.due_date || null,
    });

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de creer l'activite",
        variant: "destructive",
      });
    } else {
      setDialogOpen(false);
      setNewActivity({
        lead_id: "",
        type: "call",
        subject: "",
        description: "",
        due_date: "",
      });
      fetchActivities();
      toast({
        title: "Activite creee",
        description: "L'activite a ete planifiee avec succes",
      });
    }
  };

  const completeActivity = async (activityId: string) => {
    const { error } = await supabase
      .from("crm_activities")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", activityId);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de marquer l'activite comme terminee",
        variant: "destructive",
      });
    } else {
      fetchActivities();
      toast({
        title: "Activite terminee",
        description: "L'activite a ete marquee comme terminee",
      });
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      case "meeting":
        return <Calendar className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getActivityTypeLabel = (type: string) => {
    switch (type) {
      case "call":
        return "Appel";
      case "email":
        return "Email";
      case "meeting":
        return "Reunion";
      case "task":
        return "Tache";
      default:
        return type;
    }
  };

  const getDateBadge = (dueDate: string | null) => {
    if (!dueDate) return null;

    const date = new Date(dueDate);
    if (isPast(date) && !isToday(date)) {
      return <Badge variant="destructive">En retard</Badge>;
    }
    if (isToday(date)) {
      return <Badge variant="default">Aujourd'hui</Badge>;
    }
    if (isTomorrow(date)) {
      return <Badge variant="secondary">Demain</Badge>;
    }
    return null;
  };

  // Group activities by date
  const groupedActivities = activities.reduce((acc, activity) => {
    let dateKey = "Sans date";
    if (activity.due_date) {
      const date = new Date(activity.due_date);
      if (isPast(date) && !isToday(date)) {
        dateKey = "En retard";
      } else if (isToday(date)) {
        dateKey = "Aujourd'hui";
      } else if (isTomorrow(date)) {
        dateKey = "Demain";
      } else {
        dateKey = format(date, "EEEE dd MMMM", { locale: fr });
      }
    }

    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(activity);
    return acc;
  }, {} as Record<string, Activity[]>);

  // Sort groups
  const sortOrder = ["En retard", "Aujourd'hui", "Demain"];
  const sortedGroups = Object.entries(groupedActivities).sort(([a], [b]) => {
    const aIndex = sortOrder.indexOf(a);
    const bIndex = sortOrder.indexOf(b);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    if (a === "Sans date") return 1;
    if (b === "Sans date") return -1;
    return 0;
  });

  // Stats
  const todayCount = activities.filter(
    (a) => a.due_date && isToday(new Date(a.due_date)) && !a.completed_at
  ).length;
  const overdueCount = activities.filter(
    (a) =>
      a.due_date &&
      isPast(new Date(a.due_date)) &&
      !isToday(new Date(a.due_date)) &&
      !a.completed_at
  ).length;
  const thisWeekCount = activities.filter((a) => {
    if (!a.due_date || a.completed_at) return false;
    const date = new Date(a.due_date);
    const weekEnd = addDays(startOfDay(new Date()), 7);
    return date <= weekEnd;
  }).length;

  return (
    <CRMLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Activites</h1>
            <p className="text-muted-foreground">
              Gerez vos taches et rendez-vous
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle activite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Planifier une activite</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Lead *</Label>
                  <Select
                    value={newActivity.lead_id}
                    onValueChange={(v) =>
                      setNewActivity({ ...newActivity, lead_id: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selectionner un lead" />
                    </SelectTrigger>
                    <SelectContent>
                      {leads.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type</Label>
                  <Select
                    value={newActivity.type}
                    onValueChange={(v) =>
                      setNewActivity({ ...newActivity, type: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">Appel</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="meeting">Reunion</SelectItem>
                      <SelectItem value="task">Tache</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sujet *</Label>
                  <Input
                    value={newActivity.subject}
                    onChange={(e) =>
                      setNewActivity({ ...newActivity, subject: e.target.value })
                    }
                    placeholder="Ex: Appel de suivi"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newActivity.description}
                    onChange={(e) =>
                      setNewActivity({
                        ...newActivity,
                        description: e.target.value,
                      })
                    }
                    placeholder="Details de l'activite..."
                  />
                </div>
                <div>
                  <Label>Date d'echeance</Label>
                  <Input
                    type="datetime-local"
                    value={newActivity.due_date}
                    onChange={(e) =>
                      setNewActivity({ ...newActivity, due_date: e.target.value })
                    }
                  />
                </div>
                <Button onClick={createActivity} className="w-full">
                  Creer l'activite
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{todayCount}</p>
                  <p className="text-sm text-muted-foreground">Aujourd'hui</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <Clock className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{overdueCount}</p>
                  <p className="text-sm text-muted-foreground">En retard</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{thisWeekCount}</p>
                  <p className="text-sm text-muted-foreground">Cette semaine</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Tabs
            value={filter}
            onValueChange={(v) => setFilter(v as typeof filter)}
            className="w-full sm:w-auto"
          >
            <TabsList>
              <TabsTrigger value="pending">A faire</TabsTrigger>
              <TabsTrigger value="completed">Terminees</TabsTrigger>
              <TabsTrigger value="all">Toutes</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="call">Appels</SelectItem>
              <SelectItem value="email">Emails</SelectItem>
              <SelectItem value="meeting">Reunions</SelectItem>
              <SelectItem value="task">Taches</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Activities List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : activities.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucune activite</h3>
              <p className="text-muted-foreground mb-4">
                Commencez par planifier une nouvelle activite
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle activite
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {sortedGroups.map(([dateGroup, groupActivities]) => (
              <div key={dateGroup}>
                <h3
                  className={`text-sm font-medium mb-3 ${
                    dateGroup === "En retard"
                      ? "text-red-600"
                      : dateGroup === "Aujourd'hui"
                      ? "text-blue-600"
                      : "text-muted-foreground"
                  }`}
                >
                  {dateGroup}
                </h3>
                <div className="space-y-2">
                  {groupActivities.map((activity) => (
                    <Card
                      key={activity.id}
                      className={activity.completed_at ? "opacity-60" : ""}
                    >
                      <CardContent className="py-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start sm:items-center gap-3">
                            <div className="p-2 bg-muted rounded-full shrink-0">
                              {getActivityIcon(activity.type)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p
                                  className={`font-medium ${
                                    activity.completed_at
                                      ? "line-through text-muted-foreground"
                                      : ""
                                  }`}
                                >
                                  {activity.subject}
                                </p>
                                <Badge variant="outline" className="text-xs">
                                  {getActivityTypeLabel(activity.type)}
                                </Badge>
                                {!activity.completed_at &&
                                  getDateBadge(activity.due_date)}
                              </div>
                              {activity.crm_leads && (
                                <button
                                  onClick={() =>
                                    navigate(
                                      `/crm/leads/${activity.crm_leads!.id}`
                                    )
                                  }
                                  className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mt-1"
                                >
                                  <Building2 className="h-3 w-3" />
                                  {activity.crm_leads.company_name}
                                  {activity.crm_leads.contact_name &&
                                    ` - ${activity.crm_leads.contact_name}`}
                                </button>
                              )}
                              {activity.due_date && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(
                                    new Date(activity.due_date),
                                    "HH:mm",
                                    { locale: fr }
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                          {!activity.completed_at && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => completeActivity(activity.id)}
                              className="shrink-0"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Terminer
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CRMLayout>
  );
}
