import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Euro,
  Plus,
  Send,
  CheckCircle,
  Clock,
  MessageSquare,
  FileText,
  History,
  ExternalLink,
  Linkedin,
  Globe,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Lead {
  id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  siren: string | null;
  website: string | null;
  linkedin_url: string | null;
  source: string;
  priority: string;
  temperature: string;
  estimated_amount: number | null;
  stage_id: string;
  assigned_to: string | null;
  notes: string | null;
  tags: string[] | null;
  next_action_date: string | null;
  next_action_type: string | null;
  created_at: string;
  crm_pipeline_stages?: { name: string; color: string };
}

interface Activity {
  id: string;
  type: string;
  subject: string;
  description: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
}

interface HistoryItem {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [newActivity, setNewActivity] = useState({
    type: "call",
    subject: "",
    description: "",
    due_date: "",
  });

  useEffect(() => {
    if (id) {
      fetchLead();
      fetchActivities();
      fetchNotes();
      fetchHistory();
      fetchStages();
    }
  }, [id]);

  const fetchLead = async () => {
    const { data, error } = await supabase
      .from("crm_leads")
      .select("*, crm_pipeline_stages(name, color)")
      .eq("id", id)
      .single();

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger le lead",
        variant: "destructive",
      });
      navigate("/crm/leads");
      return;
    }
    setLead(data);
    setLoading(false);
  };

  const fetchActivities = async () => {
    const { data } = await supabase
      .from("crm_activities")
      .select("*")
      .eq("lead_id", id)
      .order("due_date", { ascending: true });

    if (data) setActivities(data);
  };

  const fetchNotes = async () => {
    const { data } = await supabase
      .from("crm_notes")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false });

    if (data) setNotes(data);
  };

  const fetchHistory = async () => {
    const { data } = await supabase
      .from("crm_lead_history")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) setHistory(data);
  };

  const fetchStages = async () => {
    const { data } = await supabase
      .from("crm_pipeline_stages")
      .select("id, name")
      .order("position");

    if (data) setStages(data);
  };

  const updateLead = async (field: string, value: string | number | null) => {
    if (!lead) return;

    setSaving(true);
    const { error } = await supabase
      .from("crm_leads")
      .update({ [field]: value })
      .eq("id", id);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre a jour le lead",
        variant: "destructive",
      });
    } else {
      setLead({ ...lead, [field]: value });
      toast({
        title: "Sauvegarde",
        description: "Lead mis a jour",
      });
      fetchHistory();
    }
    setSaving(false);
  };

  const addNote = async () => {
    if (!newNote.trim()) return;

    const { error } = await supabase.from("crm_notes").insert({
      lead_id: id,
      content: newNote,
    });

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la note",
        variant: "destructive",
      });
    } else {
      setNewNote("");
      fetchNotes();
      toast({
        title: "Note ajoutee",
        description: "La note a ete ajoutee avec succes",
      });
    }
  };

  const addActivity = async () => {
    if (!newActivity.subject.trim()) return;

    const { error } = await supabase.from("crm_activities").insert({
      lead_id: id,
      type: newActivity.type,
      subject: newActivity.subject,
      description: newActivity.description || null,
      due_date: newActivity.due_date || null,
    });

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter l'activite",
        variant: "destructive",
      });
    } else {
      setActivityDialogOpen(false);
      setNewActivity({ type: "call", subject: "", description: "", due_date: "" });
      fetchActivities();
      toast({
        title: "Activite ajoutee",
        description: "L'activite a ete planifiee",
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
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTemperatureColor = (temp: string) => {
    switch (temp) {
      case "hot":
        return "bg-red-500";
      case "warm":
        return "bg-orange-400";
      default:
        return "bg-blue-400";
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

  if (loading) {
    return (
      <CRMLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </CRMLayout>
    );
  }

  if (!lead) {
    return (
      <CRMLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lead non trouve</p>
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/crm/leads")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{lead.company_name}</h1>
              <p className="text-muted-foreground">{lead.contact_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={getPriorityColor(lead.priority)}>
              {lead.priority === "high"
                ? "Haute"
                : lead.priority === "medium"
                ? "Moyenne"
                : "Basse"}
            </Badge>
            <div
              className={`w-3 h-3 rounded-full ${getTemperatureColor(
                lead.temperature
              )}`}
              title={`Temperature: ${lead.temperature}`}
            />
            <Badge
              variant="outline"
              style={{
                borderColor: lead.crm_pipeline_stages?.color,
                color: lead.crm_pipeline_stages?.color,
              }}
            >
              {lead.crm_pipeline_stages?.name}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="w-full flex flex-wrap">
                <TabsTrigger value="info" className="flex-1">
                  Informations
                </TabsTrigger>
                <TabsTrigger value="activities" className="flex-1">
                  Activites
                </TabsTrigger>
                <TabsTrigger value="notes" className="flex-1">
                  Notes
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1">
                  Historique
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Entreprise
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Nom de l'entreprise</Label>
                        <Input
                          value={lead.company_name}
                          onChange={(e) =>
                            setLead({ ...lead, company_name: e.target.value })
                          }
                          onBlur={() =>
                            updateLead("company_name", lead.company_name)
                          }
                        />
                      </div>
                      <div>
                        <Label>SIREN</Label>
                        <Input
                          value={lead.siren || ""}
                          onChange={(e) =>
                            setLead({ ...lead, siren: e.target.value })
                          }
                          onBlur={() => updateLead("siren", lead.siren)}
                        />
                      </div>
                      <div>
                        <Label>Site web</Label>
                        <div className="flex gap-2">
                          <Input
                            value={lead.website || ""}
                            onChange={(e) =>
                              setLead({ ...lead, website: e.target.value })
                            }
                            onBlur={() => updateLead("website", lead.website)}
                          />
                          {lead.website && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                window.open(lead.website!, "_blank")
                              }
                            >
                              <Globe className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label>LinkedIn</Label>
                        <div className="flex gap-2">
                          <Input
                            value={lead.linkedin_url || ""}
                            onChange={(e) =>
                              setLead({ ...lead, linkedin_url: e.target.value })
                            }
                            onBlur={() =>
                              updateLead("linkedin_url", lead.linkedin_url)
                            }
                          />
                          {lead.linkedin_url && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                window.open(lead.linkedin_url!, "_blank")
                              }
                            >
                              <Linkedin className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label>Adresse</Label>
                      <Input
                        value={lead.address || ""}
                        onChange={(e) =>
                          setLead({ ...lead, address: e.target.value })
                        }
                        onBlur={() => updateLead("address", lead.address)}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Code postal</Label>
                        <Input
                          value={lead.postal_code || ""}
                          onChange={(e) =>
                            setLead({ ...lead, postal_code: e.target.value })
                          }
                          onBlur={() =>
                            updateLead("postal_code", lead.postal_code)
                          }
                        />
                      </div>
                      <div>
                        <Label>Ville</Label>
                        <Input
                          value={lead.city || ""}
                          onChange={(e) =>
                            setLead({ ...lead, city: e.target.value })
                          }
                          onBlur={() => updateLead("city", lead.city)}
                        />
                      </div>
                    </div>
                    {(lead.address || lead.city) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(
                            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              `${lead.address || ""} ${lead.postal_code || ""} ${
                                lead.city || ""
                              }`
                            )}`,
                            "_blank"
                          )
                        }
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        Voir sur Google Maps
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Contact</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Nom du contact</Label>
                        <Input
                          value={lead.contact_name || ""}
                          onChange={(e) =>
                            setLead({ ...lead, contact_name: e.target.value })
                          }
                          onBlur={() =>
                            updateLead("contact_name", lead.contact_name)
                          }
                        />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <div className="flex gap-2">
                          <Input
                            type="email"
                            value={lead.contact_email || ""}
                            onChange={(e) =>
                              setLead({ ...lead, contact_email: e.target.value })
                            }
                            onBlur={() =>
                              updateLead("contact_email", lead.contact_email)
                            }
                          />
                          {lead.contact_email && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                (window.location.href = `mailto:${lead.contact_email}`)
                              }
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label>Telephone</Label>
                        <div className="flex gap-2">
                          <Input
                            value={lead.contact_phone || ""}
                            onChange={(e) =>
                              setLead({ ...lead, contact_phone: e.target.value })
                            }
                            onBlur={() =>
                              updateLead("contact_phone", lead.contact_phone)
                            }
                          />
                          {lead.contact_phone && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                (window.location.href = `tel:${lead.contact_phone}`)
                              }
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Commercial</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Etape</Label>
                        <Select
                          value={lead.stage_id}
                          onValueChange={(v) => updateLead("stage_id", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {stages.map((stage) => (
                              <SelectItem key={stage.id} value={stage.id}>
                                {stage.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Montant estime</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={lead.estimated_amount || ""}
                            onChange={(e) =>
                              setLead({
                                ...lead,
                                estimated_amount: parseFloat(e.target.value) || null,
                              })
                            }
                            onBlur={() =>
                              updateLead("estimated_amount", lead.estimated_amount)
                            }
                            className="pr-8"
                          />
                          <Euro className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div>
                        <Label>Priorite</Label>
                        <Select
                          value={lead.priority}
                          onValueChange={(v) => updateLead("priority", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Basse</SelectItem>
                            <SelectItem value="medium">Moyenne</SelectItem>
                            <SelectItem value="high">Haute</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Temperature</Label>
                        <Select
                          value={lead.temperature}
                          onValueChange={(v) => updateLead("temperature", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cold">Froid</SelectItem>
                            <SelectItem value="warm">Tiede</SelectItem>
                            <SelectItem value="hot">Chaud</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Source</Label>
                      <Select
                        value={lead.source}
                        onValueChange={(v) => updateLead("source", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Saisie manuelle</SelectItem>
                          <SelectItem value="website">Site web</SelectItem>
                          <SelectItem value="referral">Recommandation</SelectItem>
                          <SelectItem value="linkedin">LinkedIn</SelectItem>
                          <SelectItem value="cold_call">Appel a froid</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="zapier">Zapier</SelectItem>
                          <SelectItem value="other">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="activities" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Activites</h3>
                  <Dialog
                    open={activityDialogOpen}
                    onOpenChange={setActivityDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button size="sm">
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
                          <Label>Sujet</Label>
                          <Input
                            value={newActivity.subject}
                            onChange={(e) =>
                              setNewActivity({
                                ...newActivity,
                                subject: e.target.value,
                              })
                            }
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
                          />
                        </div>
                        <div>
                          <Label>Date d'echeance</Label>
                          <Input
                            type="datetime-local"
                            value={newActivity.due_date}
                            onChange={(e) =>
                              setNewActivity({
                                ...newActivity,
                                due_date: e.target.value,
                              })
                            }
                          />
                        </div>
                        <Button onClick={addActivity} className="w-full">
                          Creer l'activite
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {activities.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Aucune activite planifiee
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {activities.map((activity) => (
                      <Card
                        key={activity.id}
                        className={
                          activity.completed_at ? "opacity-60" : ""
                        }
                      >
                        <CardContent className="py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-full">
                              {getActivityIcon(activity.type)}
                            </div>
                            <div>
                              <p
                                className={
                                  activity.completed_at
                                    ? "line-through text-muted-foreground"
                                    : "font-medium"
                                }
                              >
                                {activity.subject}
                              </p>
                              {activity.due_date && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(
                                    new Date(activity.due_date),
                                    "dd MMM yyyy HH:mm",
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
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="notes" className="space-y-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Ajouter une note..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        className="flex-1"
                      />
                      <Button onClick={addNote} disabled={!newNote.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {notes.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Aucune note
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {notes.map((note) => (
                      <Card key={note.id}>
                        <CardContent className="py-3">
                          <p className="whitespace-pre-wrap">{note.content}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(
                              new Date(note.created_at),
                              "dd MMM yyyy HH:mm",
                              { locale: fr }
                            )}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Historique des modifications
                </h3>

                {history.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Aucun historique
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {history.map((item) => (
                      <Card key={item.id}>
                        <CardContent className="py-3">
                          <p className="text-sm">
                            <span className="font-medium">{item.field_name}</span>
                            {" : "}
                            <span className="text-muted-foreground line-through">
                              {item.old_value || "(vide)"}
                            </span>
                            {" → "}
                            <span>{item.new_value || "(vide)"}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(
                              new Date(item.created_at),
                              "dd MMM yyyy HH:mm",
                              { locale: fr }
                            )}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actions rapides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lead.contact_email && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() =>
                      (window.location.href = `mailto:${lead.contact_email}`)
                    }
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Envoyer un email
                  </Button>
                )}
                {lead.contact_phone && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() =>
                      (window.location.href = `tel:${lead.contact_phone}`)
                    }
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Appeler
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => navigate(`/crm/quotes/new?lead=${id}`)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Creer un devis
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cree le</span>
                  <span>
                    {format(new Date(lead.created_at), "dd MMM yyyy", {
                      locale: fr,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <span className="capitalize">{lead.source}</span>
                </div>
                {lead.estimated_amount && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Montant</span>
                    <span className="font-medium">
                      {lead.estimated_amount.toLocaleString("fr-FR")} EUR
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </CRMLayout>
  );
}
