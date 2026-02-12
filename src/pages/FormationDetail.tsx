import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, ArrowLeft, Calendar, Users, FileText, ExternalLink, Edit2, User as UserIcon, Mail, MapPin, Building, Map, Train, Hotel, UtensilsCrossed, DoorOpen, Clock, Copy, Check, AlertCircle, Share2, CheckCircle2, Euro } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import ParticipantList from "@/components/formations/ParticipantList";
import AddParticipantDialog from "@/components/formations/AddParticipantDialog";
import BulkAddParticipantsDialog from "@/components/formations/BulkAddParticipantsDialog";
import DocumentsManager from "@/components/formations/DocumentsManager";
import ScheduledEmailsSummary from "@/components/formations/ScheduledEmailsSummary";
import NeedsSurveySummaryDialog from "@/components/formations/NeedsSurveySummaryDialog";
import AttendanceSignatureBlock from "@/components/formations/AttendanceSignatureBlock";
import ScheduledActionsEditor, { ScheduledAction } from "@/components/formations/ScheduledActionsEditor";

interface Training {
  id: string;
  start_date: string;
  end_date: string | null;
  training_name: string;
  location: string;
  client_name: string;
  client_address: string | null;
  sold_price_ht: number | null;
  evaluation_link: string;
  program_file_url: string | null;
  prerequisites: string[];
  objectives: string[];
  format_formation: string | null;
  created_at: string;
  sponsor_first_name: string | null;
  sponsor_last_name: string | null;
  sponsor_email: string | null;
  sponsor_formal_address: boolean;
  participants_formal_address: boolean;
  invoice_file_url: string | null;
  attendance_sheets_urls: string[];
  supports_url: string | null;
  trainer_name: string;
  train_booked: boolean;
  hotel_booked: boolean;
  restaurant_booked: boolean;
  room_rental_booked: boolean;
  convention_file_url?: string | null;
  signed_convention_urls?: string[];
  elearning_duration?: number | null;
}

interface Schedule {
  id: string;
  day_date: string;
  start_time: string;
  end_time: string;
}

interface Participant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  needs_survey_status: string;
  needs_survey_sent_at: string | null;
  added_at: string;
  sponsor_first_name?: string | null;
  sponsor_last_name?: string | null;
  sponsor_email?: string | null;
  invoice_file_url?: string | null;
  payment_mode?: string;
  sold_price_ht?: number | null;
}

const FormationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState<Training | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedLocation, setCopiedLocation] = useState(false);
  const [scheduledActions, setScheduledActions] = useState<ScheduledAction[]>([]);
  const [savingActions, setSavingActions] = useState(false);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [emailsRefreshTrigger, setEmailsRefreshTrigger] = useState(0);
  const [autoAddParticipantOpen, setAutoAddParticipantOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Auto-open add participant dialog from URL params (CRM integration)
  const addParticipantFirstName = searchParams.get("addParticipantFirstName") || undefined;
  const addParticipantLastName = searchParams.get("addParticipantLastName") || undefined;
  const addParticipantEmail = searchParams.get("addParticipantEmail") || undefined;
  const addParticipantCompany = searchParams.get("addParticipantCompany") || undefined;
  const hasAddParticipantParams = !!(addParticipantFirstName || addParticipantLastName || addParticipantEmail);

  useEffect(() => {
    if (hasAddParticipantParams && !loading && training) {
      setAutoAddParticipantOpen(true);
      // Clean up URL params
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("addParticipantFirstName");
      newParams.delete("addParticipantLastName");
      newParams.delete("addParticipantEmail");
      newParams.delete("addParticipantCompany");
      newParams.delete("fromCrmCardId");
      setSearchParams(newParams, { replace: true });
    }
  }, [hasAddParticipantParams, loading, training]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      await fetchTrainingData();
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session?.user) {
          navigate("/auth");
        } else {
          setUser(session.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate, id]);

  const fetchTrainingData = async () => {
    if (!id) return;

    // Fetch training
    const { data: trainingData, error: trainingError } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", id)
      .single();

    if (trainingError) {
      console.error("Error fetching training:", trainingError);
      navigate("/formations");
      return;
    }

    setTraining(trainingData);

    // Fetch schedules
    const { data: schedulesData } = await supabase
      .from("training_schedules")
      .select("*")
      .eq("training_id", id)
      .order("day_date", { ascending: true });

    setSchedules(schedulesData || []);

    // Fetch participants
    await fetchParticipants();
    
    // Fetch scheduled actions
    await fetchScheduledActions();
  };
  
  const fetchScheduledActions = async () => {
    if (!id) return;
    
    const { data: actionsData } = await supabase
      .from("training_actions")
      .select("*")
      .eq("training_id", id)
      .order("due_date", { ascending: true });
    
    if (actionsData) {
      setScheduledActions(actionsData.map(action => ({
        id: action.id,
        description: action.description,
        dueDate: new Date(action.due_date),
        assignedEmail: action.assigned_user_email,
        assignedName: action.assigned_user_name || "",
        completed: action.status === "completed",
      })));
    }
  };
  
  const handleSaveActions = async (actions: ScheduledAction[]) => {
    if (!id || !user) return;
    
    setSavingActions(true);
    
    try {
      // Get current actions from DB
      const { data: existingActions } = await supabase
        .from("training_actions")
        .select("id")
        .eq("training_id", id);
      
      const existingIds = new Set((existingActions || []).map(a => a.id));
      const newIds = new Set(actions.map(a => a.id));
      
      // Delete removed actions
      const toDelete = [...existingIds].filter(id => !newIds.has(id));
      if (toDelete.length > 0) {
        await supabase
          .from("training_actions")
          .delete()
          .in("id", toDelete);
      }
      
      // Upsert actions
      for (const action of actions) {
        if (!action.description || !action.dueDate || !action.assignedEmail) continue;
        
        // Check if this is an existing action (UUID format) or a new one (generated string)
        const isExistingAction = existingIds.has(action.id);
        
        if (isExistingAction) {
          // Update existing action
          await supabase
            .from("training_actions")
            .update({
              description: action.description,
              due_date: format(action.dueDate, 'yyyy-MM-dd'),
              assigned_user_email: action.assignedEmail,
              assigned_user_name: action.assignedName || null,
            })
            .eq("id", action.id);
        } else {
          // Insert new action - don't include the generated id, let DB create UUID
          await supabase
            .from("training_actions")
            .insert({
              training_id: id,
              description: action.description,
              due_date: format(action.dueDate, 'yyyy-MM-dd'),
              assigned_user_email: action.assignedEmail,
              assigned_user_name: action.assignedName || null,
              created_by: user.id,
            });
        }
      }
      
      toast({
        title: "Actions enregistrées",
        description: "Les actions programmées ont été sauvegardées.",
      });
      
      await fetchScheduledActions();
    } catch (error) {
      console.error("Error saving actions:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les actions.",
        variant: "destructive",
      });
    } finally {
      setSavingActions(false);
    }
  };

  const handleToggleActionComplete = async (actionId: string, completed: boolean) => {
    if (!id) return;
    try {
      const { error } = await supabase
        .from("training_actions")
        .update({
          status: completed ? "completed" : "pending",
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", actionId);

      if (error) throw error;

      setScheduledActions((prev) =>
        prev.map((a) => (a.id === actionId ? { ...a, completed } : a))
      );
    } catch (error) {
      console.error("Error toggling action:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour l'action.",
        variant: "destructive",
      });
    }
  };

  const fetchParticipants = async () => {
    if (!id) return;

    const { data: participantsData } = await supabase
      .from("training_participants")
      .select("*")
      .eq("training_id", id)
      .order("added_at", { ascending: true });

    setParticipants(participantsData || []);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const formatDateWithSchedule = (startDate: string, endDate: string | null, schedulesList: Schedule[]) => {
    // If we have actual schedules, use them for display
    if (schedulesList.length > 0) {
      const totalDays = schedulesList.length;
      const firstSchedule = schedulesList[0];
      const lastSchedule = schedulesList[schedulesList.length - 1];
      const firstDate = parseISO(firstSchedule.day_date);
      const lastDate = parseISO(lastSchedule.day_date);

      // Check if all days have same times
      const allSameTimes = schedulesList.every(
        s => s.start_time === firstSchedule.start_time && s.end_time === firstSchedule.end_time
      );
      const timeInfo = allSameTimes
        ? ` • ${firstSchedule.start_time.slice(0, 5)} - ${firstSchedule.end_time.slice(0, 5)}`
        : " • horaires variables";

      if (totalDays === 1) {
        return format(firstDate, "EEEE d MMMM yyyy", { locale: fr }) + timeInfo;
      }

      // Check if days are contiguous
      const isContiguous = schedulesList.every((schedule, index) => {
        if (index === 0) return true;
        const prevDate = parseISO(schedulesList[index - 1].day_date);
        const currDate = parseISO(schedule.day_date);
        const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays === 1;
      });

      if (isContiguous) {
        return `Du ${format(firstDate, "EEEE d MMMM", { locale: fr })} au ${format(lastDate, "EEEE d MMMM yyyy", { locale: fr })}${timeInfo}`;
      }

      // Non-contiguous: show number of days and date range
      return `${totalDays} jours • ${format(firstDate, "d MMM", { locale: fr })} au ${format(lastDate, "d MMM yyyy", { locale: fr })}${timeInfo}`;
    }

    // Fallback to start/end dates if no schedules
    const start = parseISO(startDate);
    if (!endDate) {
      return format(start, "EEEE d MMMM yyyy", { locale: fr });
    }
    const end = parseISO(endDate);
    return `Du ${format(start, "EEEE d MMMM", { locale: fr })} au ${format(end, "EEEE d MMMM yyyy", { locale: fr })}`;
  };

  const getFormatLabel = (formatValue: string | null) => {
    switch (formatValue) {
      case "intra":
        return "Intra-entreprise";
      case "inter-entreprises":
        return "Inter-entreprises";
      case "e_learning":
        return "E-learning";
      default:
        return null;
    }
  };

  const getSponsorName = () => {
    if (training?.sponsor_first_name && training?.sponsor_last_name) {
      return `${training.sponsor_first_name} ${training.sponsor_last_name}`;
    }
    if (training?.sponsor_first_name) return training.sponsor_first_name;
    if (training?.sponsor_last_name) return training.sponsor_last_name;
    return null;
  };

  // Calculate total training duration in hours based on schedules
  // Duration logic: sessions ≤4h count as 3.5h, sessions >4h count as 7h
  const calculateTotalDuration = (): number => {
    if (schedules.length === 0) return 0;
    
    return schedules.reduce((total, schedule) => {
      const [startHours, startMinutes] = schedule.start_time.split(":").map(Number);
      const [endHours, endMinutes] = schedule.end_time.split(":").map(Number);
      
      const startInMinutes = startHours * 60 + startMinutes;
      const endInMinutes = endHours * 60 + endMinutes;
      const durationInHours = (endInMinutes - startInMinutes) / 60;
      
      // Normalized duration: ≤4h = 3.5h, >4h = 7h
      return total + (durationInHours <= 4 ? 3.5 : 7);
    }, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!training) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Main content */}
      <main className="max-w-7xl mx-auto p-6">
        {/* Back button and title */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/formations")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{training.training_name}</h1>
              <p className="text-muted-foreground">
                {formatDateWithSchedule(training.start_date, training.end_date, schedules)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Map button - opens dialog (hidden for e-learning, disabled for online/visio) */}
            {training.format_formation !== "e_learning" && (() => {
              const isOnline = training.location?.toLowerCase().includes("visio") ||
                               training.location?.toLowerCase().includes("en ligne") ||
                               training.location?.toLowerCase().includes("distanciel");
              return (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMapDialogOpen(true)}
                  disabled={isOnline}
                  title={isOnline ? "Non disponible pour les formations en ligne" : "Voir la carte"}
                >
                  <Map className="h-4 w-4 mr-2" />
                  Carte
                </Button>
              );
            })()}
            
            {/* Train button with checkbox - Hidden for e-learning */}
            {training.format_formation !== "e_learning" && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={training.train_booked}
                  title={training.train_booked ? "Réservation déjà effectuée" : "Réserver un train"}
                  asChild={!training.train_booked}
                >
                  {training.train_booked ? (
                    <span className="flex items-center">
                      <Train className="h-4 w-4 mr-2" />
                      Train
                    </span>
                  ) : (
                    <a
                      href={`https://www.trainline.fr/search/${encodeURIComponent(training.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Train className="h-4 w-4 mr-2" />
                      Train
                    </a>
                  )}
                </Button>
                <Checkbox
                  checked={training.train_booked}
                  onCheckedChange={async (checked) => {
                    const newValue = checked === true;
                    const { error } = await supabase
                      .from("trainings")
                      .update({ train_booked: newValue })
                      .eq("id", training.id);
                    if (!error) {
                      setTraining({ ...training, train_booked: newValue });
                      toast({
                        title: newValue ? "Train réservé" : "Réservation train annulée",
                        description: newValue ? "La réservation train a été marquée comme effectuée." : "Le statut de réservation a été réinitialisé.",
                      });
                    }
                  }}
                  className="ml-1"
                  title="Marquer la réservation comme effectuée"
                />
              </div>
            )}

            {/* Hotel button with checkbox - Hidden for e-learning */}
            {training.format_formation !== "e_learning" && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={training.hotel_booked}
                  title={training.hotel_booked ? "Réservation déjà effectuée" : "Réserver un hôtel"}
                  asChild={!training.hotel_booked}
                >
                  {training.hotel_booked ? (
                    <span className="flex items-center">
                      <Hotel className="h-4 w-4 mr-2" />
                      Hôtel
                    </span>
                  ) : (
                    <a
                      href={`https://www.booking.com/searchresults.fr.html?ss=${encodeURIComponent(training.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Hotel className="h-4 w-4 mr-2" />
                      Hôtel
                    </a>
                  )}
                </Button>
                <Checkbox
                  checked={training.hotel_booked}
                  onCheckedChange={async (checked) => {
                    const newValue = checked === true;
                    const { error } = await supabase
                      .from("trainings")
                      .update({ hotel_booked: newValue })
                      .eq("id", training.id);
                    if (!error) {
                      setTraining({ ...training, hotel_booked: newValue });
                      toast({
                        title: newValue ? "Hôtel réservé" : "Réservation hôtel annulée",
                        description: newValue ? "La réservation hôtel a été marquée comme effectuée." : "Le statut de réservation a été réinitialisé.",
                      });
                    }
                  }}
                  className="ml-1"
                  title="Marquer la réservation comme effectuée"
                />
              </div>
            )}
            
            {/* Restaurant button with checkbox - only for inter-entreprises */}
            {training.format_formation === "inter-entreprises" && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={training.restaurant_booked}
                  title={training.restaurant_booked ? "Réservation déjà effectuée" : "Réserver un restaurant"}
                  asChild={!training.restaurant_booked}
                >
                  {training.restaurant_booked ? (
                    <span className="flex items-center">
                      <UtensilsCrossed className="h-4 w-4 mr-2" />
                      Restaurant
                    </span>
                  ) : (
                    <a
                      href={`https://www.google.com/maps/search/restaurants+near+${encodeURIComponent(training.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <UtensilsCrossed className="h-4 w-4 mr-2" />
                      Restaurant
                    </a>
                  )}
                </Button>
                <Checkbox
                  checked={training.restaurant_booked}
                  onCheckedChange={async (checked) => {
                    const newValue = checked === true;
                    const { error } = await supabase
                      .from("trainings")
                      .update({ restaurant_booked: newValue })
                      .eq("id", training.id);
                    if (!error) {
                      setTraining({ ...training, restaurant_booked: newValue });
                      toast({
                        title: newValue ? "Restaurant réservé" : "Réservation restaurant annulée",
                        description: newValue ? "La réservation restaurant a été marquée comme effectuée." : "Le statut de réservation a été réinitialisé.",
                      });
                    }
                  }}
                  className="ml-1"
                  title="Marquer la réservation comme effectuée"
                />
              </div>
            )}

            {/* Room rental button with checkbox - for inter-entreprises and intra */}
            {(training.format_formation === "inter-entreprises" || training.format_formation === "intra") && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={training.room_rental_booked}
                  title={training.room_rental_booked ? "Location déjà effectuée" : "Rechercher une salle"}
                  asChild={!training.room_rental_booked}
                >
                  {training.room_rental_booked ? (
                    <span className="flex items-center">
                      <DoorOpen className="h-4 w-4 mr-2" />
                      Salle
                    </span>
                  ) : (
                    <a
                      href={`https://www.google.com/maps/search/location+salle+reunion+near+${encodeURIComponent(training.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <DoorOpen className="h-4 w-4 mr-2" />
                      Salle
                    </a>
                  )}
                </Button>
                <Checkbox
                  checked={training.room_rental_booked}
                  onCheckedChange={async (checked) => {
                    const newValue = checked === true;
                    const { error } = await supabase
                      .from("trainings")
                      .update({ room_rental_booked: newValue } as any)
                      .eq("id", training.id);
                    if (!error) {
                      setTraining({ ...training, room_rental_booked: newValue });
                      toast({
                        title: newValue ? "Salle réservée" : "Réservation salle annulée",
                        description: newValue ? "La location de salle a été marquée comme effectuée." : "Le statut de location a été réinitialisé.",
                      });
                    }
                  }}
                  className="ml-1"
                  title="Marquer la location comme effectuée"
                />
              </div>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const url = `${window.location.origin}/formation-info/${id}`;
                navigator.clipboard.writeText(url);
                toast({
                  title: "Lien copié",
                  description: "Le lien vers la page participant a été copié.",
                });
              }}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Page participant
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/formations/${id}/edit`)}
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          </div>
        </div>

        {/* Row 1: Informations + Participants */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left: Informations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Informations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quick info badges */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5" />
                  {training.client_name}
                </Badge>
                {training.client_address && (
                  <Badge variant="outline" className="flex items-center gap-1.5 group">
                    <MapPin className="h-3.5 w-3.5" />
                    {training.client_address}
                    <button
                      type="button"
                      className="ml-1 p-0.5 rounded hover:bg-muted transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(training.client_address!);
                        toast({
                          title: "Adresse copiée",
                          description: "L'adresse du client a été copiée.",
                        });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  </Badge>
                )}
                <Badge variant="outline" className="flex items-center gap-1.5 group">
                  <MapPin className="h-3.5 w-3.5" />
                  {training.location}
                  <button
                    type="button"
                    className="ml-1 p-0.5 rounded hover:bg-muted transition-colors"
                    onClick={() => {
                      navigator.clipboard.writeText(training.location);
                      setCopiedLocation(true);
                      toast({
                        title: "Adresse copiée",
                        description: "L'adresse a été copiée dans le presse-papiers.",
                      });
                      setTimeout(() => setCopiedLocation(false), 2000);
                    }}
                  >
                    {copiedLocation ? (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    )}
                  </button>
                </Badge>
                {getFormatLabel(training.format_formation) && (
                  <Badge variant="secondary">
                    {getFormatLabel(training.format_formation)}
                  </Badge>
                )}
                <Badge variant="outline" className="flex items-center gap-1.5">
                  <UserIcon className="h-3.5 w-3.5" />
                  {training.trainer_name}
                </Badge>
                {schedules.length > 0 && (
                  <Badge variant="outline" className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {calculateTotalDuration()}h
                  </Badge>
                )}
                {(training.format_formation === "inter-entreprises" || training.format_formation === "e_learning") ? (
                  (() => {
                    const totalCA = participants.reduce((sum, p) => sum + (p.sold_price_ht || 0), 0);
                    const resteAFacturer = participants
                      .filter(p => p.payment_mode === "invoice" && !p.invoice_file_url)
                      .reduce((sum, p) => sum + (p.sold_price_ht || 0), 0);
                    return (
                      <>
                        {totalCA > 0 && (
                          <Badge variant="outline" className="flex items-center gap-1.5">
                            <Euro className="h-3.5 w-3.5" />
                            CA : {totalCA.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT
                          </Badge>
                        )}
                        {resteAFacturer > 0 && (
                          <Badge variant="outline" className="flex items-center gap-1.5 text-amber-600 border-amber-300">
                            <Euro className="h-3.5 w-3.5" />
                            Reste à facturer : {resteAFacturer.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT
                          </Badge>
                        )}
                      </>
                    );
                  })()
                ) : (
                  training.sold_price_ht != null && (
                    <Badge variant="outline" className="flex items-center gap-1.5">
                      <Euro className="h-3.5 w-3.5" />
                      {training.sold_price_ht.toLocaleString("fr-FR")} € HT
                    </Badge>
                  )
                )}
              </div>

              {/* Sponsor */}
              {(training.sponsor_first_name || training.sponsor_last_name || training.sponsor_email) && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <UserIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Commanditaire</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>Tu</span>
                          <Switch
                            checked={training.sponsor_formal_address}
                            disabled
                            className="scale-75"
                          />
                          <span>Vous</span>
                        </div>
                      </div>
                      {(training.sponsor_first_name || training.sponsor_last_name) && (
                        <p className="font-medium">
                          {training.sponsor_first_name} {training.sponsor_last_name}
                        </p>
                      )}
                      {training.sponsor_email && (
                        <div className="flex items-center gap-2">
                          <a
                            href={`mailto:${training.sponsor_email}`}
                            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            {training.sponsor_email}
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              navigator.clipboard.writeText(training.sponsor_email!);
                              setCopiedEmail(true);
                              toast({
                                title: "Email copié",
                                description: "L'adresse email a été copiée dans le presse-papiers.",
                              });
                              setTimeout(() => setCopiedEmail(false), 2000);
                            }}
                          >
                            {copiedEmail ? (
                              <Check className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Links */}
              {training.program_file_url && (
                <>
                  <Separator />
                  <div className="flex flex-wrap gap-3">
                    <a
                      href={training.program_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      Programme
                    </a>
                  </div>
                </>
              )}

              {/* Prerequisites */}
              {training.prerequisites && training.prerequisites.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-2">Prérequis</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {training.prerequisites.map((prereq, index) => (
                        <li key={index}>{prereq}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {/* Objectives */}
              {training.objectives && training.objectives.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-2">Objectifs pédagogiques</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {training.objectives.map((obj, index) => (
                        <li key={index}>{obj}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {/* Training Schedule Details */}
              {schedules.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Planning ({schedules.length} session{schedules.length > 1 ? "s" : ""})
                    </p>
                    <div className="space-y-1.5">
                      {schedules.map((schedule) => {
                        const date = parseISO(schedule.day_date);
                        const duration = (() => {
                          const [startH, startM] = schedule.start_time.split(":").map(Number);
                          const [endH, endM] = schedule.end_time.split(":").map(Number);
                          const hours = (endH * 60 + endM - startH * 60 - startM) / 60;
                          return hours <= 4 ? 3.5 : 7;
                        })();
                        return (
                          <div
                            key={schedule.id}
                            className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-muted/50"
                          >
                            <span className="capitalize font-medium">
                              {format(date, "EEEE d MMMM", { locale: fr })}
                            </span>
                            <span className="text-muted-foreground">
                              {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                              <span className="ml-2 text-xs">({duration}h)</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Right: Participants */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Participants
                  </CardTitle>
                  <CardDescription>
                    {participants.length} participant{participants.length !== 1 ? "s" : ""} inscrit{participants.length !== 1 ? "s" : ""}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  {/* Formal address toggle for participants */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Tu</span>
                    <Switch
                      checked={training.participants_formal_address}
                      onCheckedChange={async (checked) => {
                        const { error } = await supabase
                          .from("trainings")
                          .update({ participants_formal_address: checked })
                          .eq("id", training.id);
                        if (!error) {
                          setTraining({ ...training, participants_formal_address: checked });
                        }
                      }}
                      className="scale-75"
                    />
                    <span>Vous</span>
                  </div>
                  <div className="flex gap-2">
                    <BulkAddParticipantsDialog
                      trainingId={training.id}
                      trainingStartDate={training.start_date}
                      onParticipantsAdded={fetchParticipants}
                      isInterEntreprise={training.format_formation === "inter-entreprises" || training.format_formation === "e_learning"}
                    />
                    <AddParticipantDialog
                      trainingId={training.id}
                      trainingStartDate={training.start_date}
                      clientName={training.client_name}
                      formatFormation={training.format_formation}
                      onParticipantAdded={fetchParticipants}
                      onScheduledEmailsRefresh={() => setEmailsRefreshTrigger(prev => prev + 1)}
                      initialFirstName={addParticipantFirstName}
                      initialLastName={addParticipantLastName}
                      initialEmail={addParticipantEmail}
                      initialCompany={addParticipantCompany}
                      externalOpen={autoAddParticipantOpen}
                      onExternalOpenChange={setAutoAddParticipantOpen}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ParticipantList
                participants={participants}
                trainingId={training.id}
                trainingName={training.training_name}
                trainingStartDate={training.start_date}
                trainingEndDate={training.end_date}
                formatFormation={training.format_formation}
                elearningDuration={training.elearning_duration}
                attendanceSheetsUrls={training.attendance_sheets_urls}
                clientName={training.client_name}
                trainingDuree={`${calculateTotalDuration()}h`}
                onParticipantUpdated={fetchParticipants}
              />
              
              {/* AI Summary Button */}
              <NeedsSurveySummaryDialog
                trainingId={training.id}
                trainingName={training.training_name}
                completedCount={participants.filter(p => p.needs_survey_status === "complete").length}
              />
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Documents + Scheduled Emails */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left: Documents and Communication */}
          <DocumentsManager
            trainingId={training.id}
            trainingName={training.training_name}
            startDate={training.start_date}
            endDate={training.end_date}
            invoiceFileUrl={training.invoice_file_url}
            attendanceSheetsUrls={training.attendance_sheets_urls || []}
            sponsorEmail={training.sponsor_email}
            sponsorName={getSponsorName()}
            sponsorFirstName={training.sponsor_first_name}
            sponsorFormalAddress={training.sponsor_formal_address}
            supportsUrl={training.supports_url}
            evaluationLink={training.evaluation_link}
            formatFormation={training.format_formation}
            conventionFileUrl={training.convention_file_url}
            trainerName={training.trainer_name}
            location={training.location}
            schedules={schedules}
            participants={participants}
            signedConventionUrls={training.signed_convention_urls || []}
            onUpdate={fetchTrainingData}
          />

          {/* Right: Scheduled Emails */}
          <ScheduledEmailsSummary
            trainingId={training.id}
            participants={participants}
            refreshTrigger={emailsRefreshTrigger}
          />
        </div>

        {/* Row 3: Scheduled Actions + Attendance Signature */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Scheduled Actions Editor */}
          <ScheduledActionsEditor
            actions={scheduledActions}
            onActionsChange={setScheduledActions}
            onSave={() => handleSaveActions(scheduledActions)}
            saving={savingActions}
            onToggleComplete={handleToggleActionComplete}
          />

          {/* Attendance Signature */}
          <AttendanceSignatureBlock
            trainingId={training.id}
            trainingName={training.training_name}
            schedules={schedules}
            participantsCount={participants.length}
            participants={participants}
          />
        </div>
      </main>

      {/* Map Dialog */}
      <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Localisation de la formation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{training.location}</p>
            <div className="aspect-video w-full rounded-lg overflow-hidden border">
              <iframe
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(training.location)}`}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" asChild>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(training.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Itinéraire Google Maps
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormationDetail;
