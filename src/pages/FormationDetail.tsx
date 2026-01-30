import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, ArrowLeft, Calendar, Users, FileText, ExternalLink, Edit2, User as UserIcon, Mail } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import SupertiltLogo from "@/components/SupertiltLogo";
import UserMenu from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import ParticipantList from "@/components/formations/ParticipantList";
import AddParticipantDialog from "@/components/formations/AddParticipantDialog";
import BulkAddParticipantsDialog from "@/components/formations/BulkAddParticipantsDialog";
import DocumentsManager from "@/components/formations/DocumentsManager";
import ScheduledEmailsSummary from "@/components/formations/ScheduledEmailsSummary";

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
  invoice_file_url: string | null;
  attendance_sheets_urls: string[];
  supports_url: string | null;
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
  const navigate = useNavigate();

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
      {/* Header */}
      <header className="bg-foreground text-background py-4 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SupertiltLogo className="h-10" invert />
            <span className="text-xl font-bold">SuperTools</span>
          </div>
          {user && <UserMenu user={user} onLogout={handleLogout} />}
        </div>
      </header>

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
          <Button
            variant="outline"
            onClick={() => navigate(`/formations/${id}/edit`)}
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Modifier
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Training info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Basic info card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Informations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Client</p>
                  <p className="font-medium">{training.client_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lieu</p>
                  <p className="font-medium">{training.location}</p>
                </div>
                {getFormatLabel(training.format_formation) && (
                  <div>
                    <p className="text-sm text-muted-foreground">Format</p>
                    <Badge variant="secondary">
                      {getFormatLabel(training.format_formation)}
                    </Badge>
                  </div>
                )}
                <Separator />
                <div>
                  <a
                    href={training.evaluation_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Lien d'évaluation
                  </a>
                </div>
                {training.program_file_url && (
                  <div>
                    <a
                      href={training.program_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      Programme de formation
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sponsor card */}
            {(training.sponsor_first_name || training.sponsor_last_name || training.sponsor_email) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserIcon className="h-5 w-5" />
                    Commanditaire
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(training.sponsor_first_name || training.sponsor_last_name) && (
                    <p className="font-medium">
                      {training.sponsor_first_name} {training.sponsor_last_name}
                    </p>
                  )}
                  {training.sponsor_email && (
                    <a
                      href={`mailto:${training.sponsor_email}`}
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Mail className="h-4 w-4" />
                      {training.sponsor_email}
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Prerequisites card */}
            {training.prerequisites && training.prerequisites.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Prérequis</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {training.prerequisites.map((prereq, index) => (
                      <li key={index}>{prereq}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Objectives card */}
            {training.objectives && training.objectives.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Objectifs pédagogiques</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {training.objectives.map((obj, index) => (
                      <li key={index}>{obj}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column - Participants, Documents, Emails */}
          <div className="lg:col-span-2 space-y-6">
            {/* Participants */}
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
                  <div className="flex gap-2">
                    <BulkAddParticipantsDialog
                      trainingId={training.id}
                      trainingStartDate={training.start_date}
                      onParticipantsAdded={fetchParticipants}
                    />
                    <AddParticipantDialog
                      trainingId={training.id}
                      trainingStartDate={training.start_date}
                      onParticipantAdded={fetchParticipants}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ParticipantList
                  participants={participants}
                  onParticipantUpdated={fetchParticipants}
                />
              </CardContent>
            </Card>

            {/* Documents and Communication */}
            <DocumentsManager
              trainingId={training.id}
              invoiceFileUrl={training.invoice_file_url}
              attendanceSheetsUrls={training.attendance_sheets_urls || []}
              sponsorEmail={training.sponsor_email}
              sponsorName={getSponsorName()}
              supportsUrl={training.supports_url}
              onUpdate={fetchTrainingData}
            />

            {/* Scheduled Emails */}
            <ScheduledEmailsSummary
              trainingId={training.id}
              participants={participants}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default FormationDetail;
