import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, ArrowLeft, Calendar, Save } from "lucide-react";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import SupertiltLogo from "@/components/SupertiltLogo";
import UserMenu from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ScheduleEditor from "@/components/formations/ScheduleEditor";
import PrerequisitesEditor from "@/components/formations/PrerequisitesEditor";
import ProgramSelector from "@/components/formations/ProgramSelector";
import ObjectivesEditor from "@/components/formations/ObjectivesEditor";
import TrainingNameCombobox from "@/components/formations/TrainingNameCombobox";

interface Schedule {
  day_date: string;
  start_time: string;
  end_time: string;
}

const FormationEdit = () => {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form state
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [trainingName, setTrainingName] = useState("");
  const [location, setLocation] = useState("");
  const [clientName, setClientName] = useState("");
  const [evaluationLink, setEvaluationLink] = useState("");
  const [formatFormation, setFormatFormation] = useState<string>("");
  const [prerequisites, setPrerequisites] = useState<string[]>([]);
  const [objectives, setObjectives] = useState<string[]>([]);
  const [programFileUrl, setProgramFileUrl] = useState<string>("");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  
  // Sponsor/Commanditaire
  const [sponsorFirstName, setSponsorFirstName] = useState("");
  const [sponsorLastName, setSponsorLastName] = useState("");
  const [sponsorEmail, setSponsorEmail] = useState("");

  // Track if data has been loaded (to prevent schedule regeneration)
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      await fetchTrainingData();
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

    try {
      // Fetch training
      const { data: training, error: trainingError } = await supabase
        .from("trainings")
        .select("*")
        .eq("id", id)
        .single();

      if (trainingError) throw trainingError;

      // Set form values
      setTrainingName(training.training_name);
      setLocation(training.location);
      setClientName(training.client_name);
      setEvaluationLink(training.evaluation_link);
      setFormatFormation(training.format_formation || "");
      setPrerequisites(training.prerequisites || []);
      setObjectives(training.objectives || []);
      setProgramFileUrl(training.program_file_url || "");
      setSponsorFirstName(training.sponsor_first_name || "");
      setSponsorLastName(training.sponsor_last_name || "");
      setSponsorEmail(training.sponsor_email || "");
      
      const start = parseISO(training.start_date);
      setStartDate(start);
      
      if (training.end_date) {
        setIsMultiDay(true);
        setEndDate(parseISO(training.end_date));
      }

      // Fetch schedules
      const { data: schedulesData } = await supabase
        .from("training_schedules")
        .select("*")
        .eq("training_id", id)
        .order("day_date", { ascending: true });

      if (schedulesData && schedulesData.length > 0) {
        setSchedules(schedulesData.map(s => ({
          day_date: s.day_date,
          start_time: s.start_time,
          end_time: s.end_time,
        })));
      }

      setDataLoaded(true);
      setLoading(false);
    } catch (error: any) {
      console.error("Error fetching training:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger la formation.",
        variant: "destructive",
      });
      navigate("/formations");
    }
  };

  // Generate schedules when dates change (only after initial load)
  useEffect(() => {
    if (!dataLoaded || !startDate) return;

    const effectiveEndDate = isMultiDay && endDate ? endDate : startDate;
    const days = eachDayOfInterval({ start: startDate, end: effectiveEndDate });

    const newSchedules = days.map((day, index) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const existing = schedules.find(s => s.day_date === dateStr);
      
      if (existing) {
        return existing;
      }
      
      if (index > 0 && schedules.length > 0) {
        return {
          day_date: dateStr,
          start_time: schedules[0].start_time,
          end_time: schedules[0].end_time,
        };
      }
      
      return {
        day_date: dateStr,
        start_time: "09:00",
        end_time: "17:00",
      };
    });

    setSchedules(newSchedules);
  }, [startDate, endDate, isMultiDay, dataLoaded]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate || !trainingName || !location || !clientName || !evaluationLink || !user || !id) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      // Update training
      const { error: trainingError } = await supabase
        .from("trainings")
        .update({
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: isMultiDay && endDate ? format(endDate, "yyyy-MM-dd") : null,
          training_name: trainingName,
          location,
          client_name: clientName,
          evaluation_link: evaluationLink,
          format_formation: formatFormation || null,
          prerequisites,
          objectives,
          program_file_url: programFileUrl || null,
          sponsor_first_name: sponsorFirstName || null,
          sponsor_last_name: sponsorLastName || null,
          sponsor_email: sponsorEmail || null,
        })
        .eq("id", id);

      if (trainingError) throw trainingError;

      // Delete existing schedules and recreate
      await supabase
        .from("training_schedules")
        .delete()
        .eq("training_id", id);

      if (schedules.length > 0) {
        const { error: schedulesError } = await supabase
          .from("training_schedules")
          .insert(
            schedules.map(s => ({
              training_id: id,
              day_date: s.day_date,
              start_time: s.start_time,
              end_time: s.end_time,
            }))
          );

        if (schedulesError) throw schedulesError;
      }

      toast({
        title: "Formation modifiée",
        description: "Les modifications ont été enregistrées.",
      });

      navigate(`/formations/${id}`);
    } catch (error: any) {
      console.error("Error updating training:", error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la modification.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-foreground text-background py-4 px-6 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SupertiltLogo className="h-10" invert />
            <span className="text-xl font-bold">SuperTools</span>
          </div>
          {user && <UserMenu user={user} onLogout={handleLogout} />}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto p-6">
        {/* Back button and title */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/formations/${id}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Modifier la formation</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic info */}
          <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Training name */}
              <div className="space-y-2">
                <Label htmlFor="trainingName">Nom de la formation *</Label>
                <TrainingNameCombobox
                  value={trainingName}
                  onChange={setTrainingName}
                  onFormationSelect={(formation) => {
                    if (formation?.programme_url) {
                      setProgramFileUrl(formation.programme_url);
                    }
                  }}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date de début *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {startDate
                          ? format(startDate, "d MMMM yyyy", { locale: fr })
                          : "Sélectionner une date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Date de fin</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="multiDay"
                        checked={isMultiDay}
                        onCheckedChange={setIsMultiDay}
                      />
                      <Label htmlFor="multiDay" className="text-sm text-muted-foreground">
                        Multi-jours
                      </Label>
                    </div>
                  </div>
                  {isMultiDay && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {endDate
                            ? format(endDate, "d MMMM yyyy", { locale: fr })
                            : "Sélectionner une date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          disabled={(date) => startDate ? date < startDate : false}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>

              {/* Location and client */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Lieu *</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ex: Paris, Visio, Chez le client"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientName">Client *</Label>
                  <Input
                    id="clientName"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex: ACME Corp"
                    required
                  />
                </div>
              </div>

              {/* Evaluation link and format */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="evaluationLink">Lien vers l'évaluation *</Label>
                  <Input
                    id="evaluationLink"
                    type="url"
                    value={evaluationLink}
                    onChange={(e) => setEvaluationLink(e.target.value)}
                    placeholder="https://..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="format">Format de formation</Label>
                  <Select value={formatFormation} onValueChange={setFormatFormation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intra">Intra-entreprise</SelectItem>
                      <SelectItem value="inter-entreprises">Inter-entreprises</SelectItem>
                      <SelectItem value="classe_virtuelle">Classe virtuelle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sponsor/Commanditaire */}
          <Card>
            <CardHeader>
              <CardTitle>Commanditaire</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sponsorFirstName">Prénom</Label>
                  <Input
                    id="sponsorFirstName"
                    value={sponsorFirstName}
                    onChange={(e) => setSponsorFirstName(e.target.value)}
                    placeholder="Ex: Jean"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sponsorLastName">Nom</Label>
                  <Input
                    id="sponsorLastName"
                    value={sponsorLastName}
                    onChange={(e) => setSponsorLastName(e.target.value)}
                    placeholder="Ex: Dupont"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sponsorEmail">Email</Label>
                <Input
                  id="sponsorEmail"
                  type="email"
                  value={sponsorEmail}
                  onChange={(e) => setSponsorEmail(e.target.value)}
                  placeholder="jean.dupont@entreprise.fr"
                />
              </div>
            </CardContent>
          </Card>

          {/* Schedules */}
          {startDate && schedules.length > 0 && (
            <ScheduleEditor
              schedules={schedules}
              onSchedulesChange={setSchedules}
            />
          )}

          {/* Prerequisites */}
          <PrerequisitesEditor
            prerequisites={prerequisites}
            onPrerequisitesChange={setPrerequisites}
          />

          {/* Program */}
          <ProgramSelector
            programFileUrl={programFileUrl}
            onProgramChange={setProgramFileUrl}
            onObjectivesExtracted={(extracted) => {
              setObjectives((prev) => {
                const combined = [...prev, ...extracted];
                return [...new Set(combined)];
              });
            }}
            onPrerequisitesExtracted={(extracted) => {
              setPrerequisites((prev) => {
                const combined = [...prev, ...extracted];
                return [...new Set(combined)];
              });
            }}
            userId={user?.id || ""}
          />

          {/* Objectives */}
          <ObjectivesEditor
            objectives={objectives}
            onObjectivesChange={setObjectives}
          />

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/formations/${id}`)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Enregistrer
                </>
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default FormationEdit;
