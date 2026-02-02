import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, ArrowLeft, Calendar, Users, FileText, ExternalLink, Edit2, User as UserIcon, Mail, MapPin, Building, Map, Train, Hotel, Clock, Copy, Check, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import ParticipantList from "@/components/formations/ParticipantList";
import AddParticipantDialog from "@/components/formations/AddParticipantDialog";
import BulkAddParticipantsDialog from "@/components/formations/BulkAddParticipantsDialog";
import DocumentsManager from "@/components/formations/DocumentsManager";
import ScheduledEmailsSummary from "@/components/formations/ScheduledEmailsSummary";
import NeedsSurveySummaryDialog from "@/components/formations/NeedsSurveySummaryDialog";
import AttendanceSheetGenerator from "@/components/formations/AttendanceSheetGenerator";
import AttendanceSignatureBlock from "@/components/formations/AttendanceSignatureBlock";
import ScheduledActionsEditor, { ScheduledAction } from "@/components/formations/ScheduledActionsEditor";

interface Training {
  id: string;
  start_date: string;
  end_date: string | null;
  training_name: string;
  location: string;
  client_name: string;
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
}

const FormationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState<Training | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [scheduledActions, setScheduledActions] = useState<ScheduledAction[]>([]);
  const [savingActions, setSavingActions] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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
        
        const actionData = {
          id: action.id,
          training_id: id,
          description: action.description,
          due_date: action.dueDate.toISOString().split('T')[0],
          assigned_user_email: action.assignedEmail,
          assigned_user_name: action.assignedName || null,
          created_by: user.id,
        };
        
        if (existingIds.has(action.id)) {
          await supabase
            .from("training_actions")
            .update(actionData)
            .eq("id", action.id);
        } else {
          await supabase
            .from("training_actions")
            .insert(actionData);
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
    const start = parseISO(startDate);
    
    // Get unique time range (assuming consistent times across days)
    let timeRange = "";
    if (schedulesList.length > 0) {
      const firstSchedule = schedulesList[0];
      timeRange = ` • ${firstSchedule.start_time.slice(0, 5)} - ${firstSchedule.end_time.slice(0, 5)}`;
    }
    
    if (!endDate) {
      return format(start, "EEEE d MMMM yyyy", { locale: fr }) + timeRange;
    }
    const end = parseISO(endDate);
    return `Du ${format(start, "EEEE d MMMM", { locale: fr })} au ${format(end, "EEEE d MMMM yyyy", { locale: fr })}${timeRange}`;
  };

  const getFormatLabel = (formatValue: string | null) => {
    switch (formatValue) {
      case "intra":
        return "Intra-entreprise";
      case "inter-entreprises":
        return "Inter-entreprises";
      case "classe_virtuelle":
        return "Classe virtuelle";
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
      <AppHeader user={user} onLogout={handleLogout} />

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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a 
                href={`https://www.google.com/maps/place/${training.location.replace(/ /g, '+')}`} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Map className="h-4 w-4 mr-2" />
                Carte
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a 
                href={`https://www.trainline.fr/search/${encodeURIComponent(training.location)}`} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Train className="h-4 w-4 mr-2" />
                Train
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a 
                href={`https://www.booking.com/searchresults.fr.html?ss=${encodeURIComponent(training.location)}`} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Hotel className="h-4 w-4 mr-2" />
                Hôtel
              </a>
            </Button>
            <AttendanceSheetGenerator
              trainingName={training.training_name}
              trainerName={training.trainer_name}
              location={training.location}
              startDate={training.start_date}
              endDate={training.end_date}
              schedules={schedules}
              participants={participants}
            />
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
                <Badge variant="outline" className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {training.location}
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
                    />
                    <AddParticipantDialog
                      trainingId={training.id}
                      trainingStartDate={training.start_date}
                      clientName={training.client_name}
                      onParticipantAdded={fetchParticipants}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ParticipantList
                participants={participants}
                trainingId={training.id}
                trainingStartDate={training.start_date}
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
            onUpdate={fetchTrainingData}
          />

          {/* Right: Scheduled Emails */}
          <ScheduledEmailsSummary
            trainingId={training.id}
            participants={participants}
          />
        </div>

        {/* Row 3: Scheduled Actions + Attendance Signature */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Scheduled Actions Editor */}
          <div className="space-y-4">
            <ScheduledActionsEditor
              actions={scheduledActions}
              onActionsChange={setScheduledActions}
            />
            {scheduledActions.length > 0 && (
              <Button
                onClick={() => handleSaveActions(scheduledActions)}
                disabled={savingActions}
                className="w-full"
              >
                {savingActions ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  "Enregistrer les actions"
                )}
              </Button>
            )}
          </div>

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
    </div>
  );
};

export default FormationDetail;
