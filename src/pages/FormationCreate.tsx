import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, ArrowLeft, Calendar, Save, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import AppHeader from "@/components/AppHeader";
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
import ScheduleEditor, { Schedule, SESSION_PRESETS } from "@/components/formations/ScheduleEditor";
import PrerequisitesEditor from "@/components/formations/PrerequisitesEditor";
import ProgramSelector from "@/components/formations/ProgramSelector";
import ObjectivesEditor from "@/components/formations/ObjectivesEditor";
import TrainingNameCombobox from "@/components/formations/TrainingNameCombobox";
import TrainerSelector from "@/components/formations/TrainerSelector";
import ScheduledActionsEditor, { ScheduledAction } from "@/components/formations/ScheduledActionsEditor";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const PREDEFINED_LOCATIONS = [
  { value: "en_ligne", label: "En ligne en accédant à son compte sur supertilt.fr" },
  { value: "lyon", label: "Espace Gailleton, 2 Pl. Gailleton, 69002 Lyon" },
  { value: "paris", label: "Agile Tribu, 4ter Pass. de la Main d'Or, 75011 Paris" },
  { value: "autre", label: "Autre" },
];

const FormationCreate = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form state
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [trainingName, setTrainingName] = useState("");

  // E-learning specific fields (dates without daily schedule)
  const [elearningStartDate, setElearningStartDate] = useState<Date | null>(null);
  const [elearningEndDate, setElearningEndDate] = useState<Date | null>(null);
  const [elearningDuration, setElearningDuration] = useState<string>("");
  const [locationType, setLocationType] = useState<string>("");
  const [locationCustom, setLocationCustom] = useState("");
  const [clientName, setClientName] = useState("");
  const [formatFormation, setFormatFormation] = useState<string>("");
  const [prerequisites, setPrerequisites] = useState<string[]>([]);
  const [objectives, setObjectives] = useState<string[]>([]);
  const [programFileUrl, setProgramFileUrl] = useState<string>("");
  const [supertiltLink, setSupertiltLink] = useState<string>("");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  
  // Sponsor/Commanditaire
  const [sponsorFirstName, setSponsorFirstName] = useState("");
  const [sponsorLastName, setSponsorLastName] = useState("");
  const [sponsorEmail, setSponsorEmail] = useState("");
  const [sponsorFormalAddress, setSponsorFormalAddress] = useState(true); // true = vouvoiement (default)
  
  // Financeur
  const [financeurSameAsSponsor, setFinanceurSameAsSponsor] = useState(true);
  const [financeurName, setFinanceurName] = useState("");
  const [financeurUrl, setFinanceurUrl] = useState("");
  
  // Scheduled actions
  const [scheduledActions, setScheduledActions] = useState<ScheduledAction[]>([]);
  
  // Trainer
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [trainerDetails, setTrainerDetails] = useState<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null>(null);
  
  // SuperTilt site URL from settings
  const [supertiltSiteUrl, setSupertiltSiteUrl] = useState<string>("");

  // Get the final location string
  const getFinalLocation = (): string => {
    if (locationType === "autre") {
      return locationCustom;
    }
    const predefined = PREDEFINED_LOCATIONS.find((l) => l.value === locationType);
    return predefined?.label || "";
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      setLoading(false);
      
      // Fetch SuperTilt site URL from settings
      const { data: settingData } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "supertilt_site_url")
        .maybeSingle();
      if (settingData?.setting_value) {
        setSupertiltSiteUrl(settingData.setting_value);
      }
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
  }, [navigate]);

  // Generate schedules when selected dates change
  useEffect(() => {
    if (selectedDates.length === 0) {
      setSchedules([]);
      return;
    }

    // Sort dates chronologically
    const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());

    // Keep existing schedules and add new ones
    const newSchedules = sortedDates.map((day, index) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const existing = schedules.find(s => s.day_date === dateStr);

      if (existing) {
        return existing;
      }

      // For new days, copy session type from first day if available
      if (index > 0 && schedules.length > 0) {
        const firstSchedule = schedules[0];
        return {
          day_date: dateStr,
          start_time: firstSchedule.start_time,
          end_time: firstSchedule.end_time,
          session_type: firstSchedule.session_type,
        };
      }

      // Default to full day (9h-17h = 7h)
      return {
        day_date: dateStr,
        start_time: SESSION_PRESETS.full.start,
        end_time: SESSION_PRESETS.full.end,
        session_type: "full" as const,
      };
    });

    // Filter to only keep schedules for selected dates
    const selectedDateStrs = sortedDates.map(d => format(d, "yyyy-MM-dd"));
    const filteredSchedules = newSchedules.filter(s => selectedDateStrs.includes(s.day_date));

    setSchedules(filteredSchedules);
  }, [selectedDates]);

  // Helper to format selected dates for display
  const formatSelectedDates = (): string => {
    if (selectedDates.length === 0) return "Sélectionner les jours";
    if (selectedDates.length === 1) {
      return format(selectedDates[0], "d MMMM yyyy", { locale: fr });
    }
    const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    return `${selectedDates.length} jours sélectionnés (${format(sorted[0], "d MMM", { locale: fr })} - ${format(sorted[sorted.length - 1], "d MMM", { locale: fr })})`;
  };

  // Get start and end dates from selected dates
  const getStartDate = (): Date | null => {
    // For e-learning, use specific start date
    if (formatFormation === "e_learning") {
      return elearningStartDate;
    }
    if (selectedDates.length === 0) return null;
    return selectedDates.reduce((min, d) => d < min ? d : min, selectedDates[0]);
  };

  const getEndDate = (): Date | null => {
    // For e-learning, use specific end date
    if (formatFormation === "e_learning") {
      return elearningEndDate;
    }
    if (selectedDates.length <= 1) return null;
    return selectedDates.reduce((max, d) => d > max ? d : max, selectedDates[0]);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalLocation = getFinalLocation();
    const startDate = getStartDate();
    const endDate = getEndDate();

    // Validate dates based on format
    const isElearning = formatFormation === "e_learning";
    const hasValidDates = isElearning
      ? (elearningStartDate && elearningEndDate)
      : (selectedDates.length > 0);

    if (!hasValidDates || !trainingName || !finalLocation || !clientName || !user) {
      toast({
        title: "Champs requis",
        description: isElearning
          ? "Veuillez remplir tous les champs obligatoires (dates de début et fin, nom, lieu, client)."
          : "Veuillez remplir tous les champs obligatoires (dates, nom, lieu, client).",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      // Create training with derived start/end dates
      const { data: training, error: trainingError } = await supabase
        .from("trainings")
        .insert({
          start_date: format(startDate!, "yyyy-MM-dd"),
          end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
          training_name: trainingName,
          location: finalLocation,
          client_name: clientName,
          evaluation_link: "", // Field hidden from UI but required by schema
          format_formation: formatFormation || null,
          prerequisites,
          objectives,
          program_file_url: programFileUrl || null,
          supertilt_link: supertiltLink || null,
          sponsor_first_name: sponsorFirstName || null,
          sponsor_last_name: sponsorLastName || null,
          sponsor_email: sponsorEmail || null,
          sponsor_formal_address: sponsorFormalAddress,
          financeur_same_as_sponsor: financeurSameAsSponsor,
          financeur_name: financeurSameAsSponsor ? null : (financeurName || null),
          financeur_url: financeurSameAsSponsor ? null : (financeurUrl || null),
          trainer_id: trainerId || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (trainingError) throw trainingError;

      // Create schedules (only for selected dates, not gap dates)
      if (schedules.length > 0) {
        const { error: schedulesError } = await supabase
          .from("training_schedules")
          .insert(
            schedules.map(s => ({
              training_id: training.id,
              day_date: s.day_date,
              start_time: s.start_time,
              end_time: s.end_time,
            }))
          );

        if (schedulesError) throw schedulesError;
      }

      // Create scheduled actions
      const validActions = scheduledActions.filter(
        (a) => a.description && a.dueDate && a.assignedEmail
      );

      if (validActions.length > 0) {
        const { error: actionsError } = await supabase
          .from("training_actions")
          .insert(
            validActions.map((a) => ({
              training_id: training.id,
              description: a.description,
              due_date: format(a.dueDate!, "yyyy-MM-dd"),
              assigned_user_email: a.assignedEmail,
              assigned_user_name: a.assignedName || null,
              created_by: user.id,
            }))
          );

        if (actionsError) throw actionsError;
      }

      // Log activity
      await supabase.from("activity_logs").insert({
        action_type: "training_created",
        recipient_email: user.email || "unknown",
        user_id: user.id,
        details: {
          training_id: training.id,
          training_name: trainingName,
          client_name: clientName,
          start_date: format(startDate!, "yyyy-MM-dd"),
          total_days: selectedDates.length,
        },
      });

      // Send calendar invite to trainer if one is selected
      if (trainerDetails && schedules.length > 0) {
        try {
          const { error: emailError } = await supabase.functions.invoke("send-training-calendar-invite", {
            body: {
              trainingId: training.id,
              trainingName,
              clientName,
              location: finalLocation,
              schedules: schedules.map(s => ({
                day_date: s.day_date,
                start_time: s.start_time,
                end_time: s.end_time,
              })),
              trainerEmail: trainerDetails.email,
              trainerFirstName: trainerDetails.first_name,
              trainerLastName: trainerDetails.last_name,
            },
          });

          if (emailError) {
            console.error("Error sending calendar invite:", emailError);
          } else {
            console.log("Calendar invite sent to trainer:", trainerDetails.email);
          }
        } catch (emailErr) {
          console.error("Failed to send calendar invite:", emailErr);
          // Don't block the creation - this is a secondary notification
        }
      }

      toast({
        title: "Formation créée",
        description: trainerDetails
          ? "La formation a été créée et une invitation calendrier a été envoyée au formateur."
          : "La formation a été créée avec succès.",
      });

      navigate(`/formations/${training.id}`);
    } catch (error: any) {
      console.error("Error creating training:", error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la création.",
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
      <AppHeader />

      {/* Main content */}
      <main className="max-w-7xl mx-auto p-6">
        {/* Sticky header with back button, title and action buttons */}
        <div className="sticky top-0 z-10 bg-background pb-4 -mx-6 px-6 pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/formations")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">Nouvelle formation</h1>
              </div>
            </div>
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/formations")}
              >
                Annuler
              </Button>
              <Button type="submit" form="formation-form" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Créer la formation
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <form id="formation-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Two column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
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

              {/* Dates - different UI for e-learning vs regular training */}
              {formatFormation === "e_learning" ? (
                /* E-learning: simple start/end dates + duration */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date de début *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !elearningStartDate && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {elearningStartDate ? format(elearningStartDate, "d MMMM yyyy", { locale: fr }) : "Sélectionner"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={elearningStartDate || undefined}
                            onSelect={(date) => setElearningStartDate(date || null)}
                            initialFocus
                            locale={fr}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>Date de fin *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !elearningEndDate && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {elearningEndDate ? format(elearningEndDate, "d MMMM yyyy", { locale: fr }) : "Sélectionner"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={elearningEndDate || undefined}
                            onSelect={(date) => setElearningEndDate(date || null)}
                            initialFocus
                            locale={fr}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="elearningDuration">Durée totale (heures)</Label>
                    <Input
                      id="elearningDuration"
                      type="number"
                      placeholder="Ex: 25"
                      value={elearningDuration}
                      onChange={(e) => setElearningDuration(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Durée estimée du parcours e-learning
                    </p>
                  </div>
                </div>
              ) : (
                /* Regular training: Multi-select calendar for specific days */
                <div className="space-y-2">
                  <Label>Jours de formation *</Label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          selectedDates.length === 0 && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {formatSelectedDates()}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="multiple"
                        selected={selectedDates}
                        onSelect={(dates) => setSelectedDates(dates || [])}
                        initialFocus
                        className="pointer-events-auto"
                        locale={fr}
                      />
                      <div className="border-t p-3 flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          {selectedDates.length} jour{selectedDates.length > 1 ? "s" : ""} sélectionné{selectedDates.length > 1 ? "s" : ""}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedDates([])}
                          disabled={selectedDates.length === 0}
                        >
                          Effacer
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    Cliquez sur plusieurs dates pour les sélectionner (journées contigües ou espacées)
                  </p>
                </div>
              )}

              {/* Location */}
              <div className="space-y-3">
                <Label>Lieu de la formation *</Label>
                <RadioGroup value={locationType} onValueChange={setLocationType} className="space-y-2">
                  {PREDEFINED_LOCATIONS.map((loc) => (
                    <div key={loc.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={loc.value} id={`location-${loc.value}`} />
                      <Label
                        htmlFor={`location-${loc.value}`}
                        className="font-normal cursor-pointer text-sm"
                      >
                        {loc.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                {locationType === "autre" && (
                  <Input
                    placeholder="Adresse personnalisée"
                    value={locationCustom}
                    onChange={(e) => setLocationCustom(e.target.value)}
                    className="mt-2"
                    required
                  />
                )}
              </div>

              {/* Client */}
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

              {/* Format */}
              <div className="space-y-2">
                <Label htmlFor="format">Format de formation</Label>
                <Select value={formatFormation} onValueChange={setFormatFormation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="intra">Intra-entreprise</SelectItem>
                    <SelectItem value="inter-entreprises">Inter-entreprises</SelectItem>
                    <SelectItem value="e_learning">E-learning</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* SuperTilt Link */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="supertiltLink">Lien SuperTilt de la formation</Label>
                  {supertiltSiteUrl && (
                    <a
                      href={supertiltSiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title="Ouvrir le site SuperTilt"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
                <Input
                  id="supertiltLink"
                  type="url"
                  value={supertiltLink}
                  onChange={(e) => setSupertiltLink(e.target.value)}
                  placeholder="https://supertilt.fr/formations/..."
                />
              </div>

              {/* Trainer selector */}
              <div className="space-y-2">
                <Label>Formateur</Label>
                <TrainerSelector
                  value={trainerId}
                  onChange={setTrainerId}
                  onTrainerSelect={(trainer) => setTrainerDetails(trainer ? {
                    id: trainer.id,
                    first_name: trainer.first_name,
                    last_name: trainer.last_name,
                    email: trainer.email,
                  } : null)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Schedules - before Commanditaire (not for e-learning) */}
          {formatFormation !== "e_learning" && selectedDates.length > 0 && schedules.length > 0 && (
            <ScheduleEditor
              schedules={schedules}
              onSchedulesChange={setSchedules}
            />
          )}

          {/* Sponsor/Commanditaire */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Commanditaire</CardTitle>
                <div className="flex items-center gap-2">
                  <Label htmlFor="formalAddress" className="text-sm text-muted-foreground">
                    Tutoiement
                  </Label>
                  <Switch
                    id="formalAddress"
                    checked={sponsorFormalAddress}
                    onCheckedChange={setSponsorFormalAddress}
                  />
                  <Label htmlFor="formalAddress" className="text-sm text-muted-foreground">
                    Vouvoiement
                  </Label>
                </div>
              </div>
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

          {/* Financeur */}
          <Card>
            <CardHeader>
              <CardTitle>Financeur</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch
                  id="financeurSameAsSponsor"
                  checked={financeurSameAsSponsor}
                  onCheckedChange={setFinanceurSameAsSponsor}
                />
                <Label htmlFor="financeurSameAsSponsor" className="text-sm">
                  Identique au commanditaire
                </Label>
              </div>
              
              {!financeurSameAsSponsor && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="financeurName">Nom du financeur</Label>
                    <Input
                      id="financeurName"
                      value={financeurName}
                      onChange={(e) => setFinanceurName(e.target.value)}
                      placeholder="Ex: OPCO Atlas, France Travail..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="financeurUrl">URL du financeur</Label>
                    <Input
                      id="financeurUrl"
                      type="url"
                      value={financeurUrl}
                      onChange={(e) => setFinanceurUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Program - before Prerequisites */}
              <ProgramSelector
                programFileUrl={programFileUrl}
                onProgramChange={setProgramFileUrl}
                onPrerequisitesExtracted={(extracted) => {
                  // Merge with existing prerequisites, avoiding duplicates
                  setPrerequisites((prev) => {
                    const combined = [...prev, ...extracted];
                    return [...new Set(combined)];
                  });
                }}
                userId={user?.id || ""}
              />

              {/* Prerequisites */}
              <PrerequisitesEditor
                prerequisites={prerequisites}
                onPrerequisitesChange={setPrerequisites}
                programFileUrl={programFileUrl}
              />

              {/* Objectives */}
              <ObjectivesEditor
                objectives={objectives}
                onObjectivesChange={setObjectives}
                programFileUrl={programFileUrl}
              />
            </div>
          </div>

          {/* Scheduled Actions - Full width at the bottom */}
          <ScheduledActionsEditor
            actions={scheduledActions}
            onActionsChange={setScheduledActions}
          />
        </form>
      </main>
    </div>
  );
};

export default FormationCreate;
