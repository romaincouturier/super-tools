import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, ArrowLeft, Calendar, Save, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ScheduleEditor, { Schedule, SESSION_PRESETS } from "@/components/formations/ScheduleEditor";
import TrainingNameCombobox, { FormationConfig } from "@/components/formations/TrainingNameCombobox";
import SupertiltLinkCombobox from "@/components/formations/SupertiltLinkCombobox";
import ScheduledActionsEditor, { ScheduledAction } from "@/components/formations/ScheduledActionsEditor";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FormationFormula } from "@/types/training";

const PREDEFINED_LOCATIONS = [
  { value: "en_ligne", label: "En ligne en accédant à son compte sur supertilt.fr" },
  { value: "lyon", label: "Espace Gailleton, 2 Pl. Gailleton, 69002 Lyon" },
  { value: "paris", label: "Agile Tribu, 4ter Pass. de la Main d'Or, 75011 Paris" },
  { value: "chez_client", label: "Chez le client (adresse du client)" },
  { value: "autre", label: "Autre" },
];

const FormationCreate = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // CRM card ID if coming from CRM
  const fromCrmCardId = searchParams.get("fromCrmCardId");

  // Form state
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [trainingName, setTrainingName] = useState("");

  // E-learning specific fields (dates without daily schedule)
  const [elearningStartDate, setElearningStartDate] = useState<Date | null>(null);
  const [elearningEndDate, setElearningEndDate] = useState<Date | null>(null);
  const [elearningDuration, setElearningDuration] = useState<string>("");
  const [elearningAccessEmailContent, setElearningAccessEmailContent] = useState<string>("");
  const [locationType, setLocationType] = useState<string>("");
  const [locationCustom, setLocationCustom] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [soldPriceHt, setSoldPriceHt] = useState<string>("");
  const [maxParticipants, setMaxParticipants] = useState<string>("");
  const [sessionType, setSessionType] = useState<string>("");
  const [sessionFormat, setSessionFormat] = useState<string>("");
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
  
  // Catalog
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [catalogFormulas, setCatalogFormulas] = useState<FormationFormula[]>([]);
  const [selectedFormulaId, setSelectedFormulaId] = useState<string | null>(null);

  
  // SuperTilt site URL from settings
  const [supertiltSiteUrl, setSupertiltSiteUrl] = useState<string>("");

  // Permanent formation mode
  const [isPermanent, setIsPermanent] = useState(false);

  // Derived helpers
  const isElearning = isPermanent || sessionFormat === "distanciel_asynchrone";
  const isInter = isPermanent || sessionType === "inter";

  // Compute legacy format_formation for backward compatibility with edge functions
  const getLegacyFormatFormation = (): string | null => {
    if (!sessionType && !sessionFormat) return null;
    if (sessionFormat === "distanciel_asynchrone") return "e_learning";
    if (sessionFormat === "distanciel_synchrone") return "classe_virtuelle";
    if (sessionType === "inter") return "inter-entreprises";
    return "intra";
  };

  // Get the final location string
  const getFinalLocation = (): string => {
    if (locationType === "autre") {
      return locationCustom;
    }
    if (locationType === "chez_client") {
      return clientAddress || "Chez le client";
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

  // Pre-fill form from URL params (coming from CRM)
  useEffect(() => {
    const paramClientName = searchParams.get("clientName");
    const paramSponsorFirstName = searchParams.get("sponsorFirstName");
    const paramSponsorLastName = searchParams.get("sponsorLastName");
    const paramSponsorEmail = searchParams.get("sponsorEmail");
    const paramTrainingName = searchParams.get("trainingName");

    if (paramClientName) setClientName(paramClientName);
    if (paramSponsorFirstName) setSponsorFirstName(paramSponsorFirstName);
    if (paramSponsorLastName) setSponsorLastName(paramSponsorLastName);
    if (paramSponsorEmail) setSponsorEmail(paramSponsorEmail);
    if (paramTrainingName) setTrainingName(paramTrainingName);
  }, [searchParams]);

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
    if (isElearning) {
      return elearningStartDate;
    }
    if (selectedDates.length === 0) return null;
    return selectedDates.reduce((min, d) => d < min ? d : min, selectedDates[0]);
  };

  const getEndDate = (): Date | null => {
    // For e-learning, use specific end date
    if (isElearning) {
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

    // Validate dates based on format (e-learning dates are optional for "formation permanente")
    const hasValidDates = isElearning
      ? true
      : (selectedDates.length > 0);

    // Build specific missing fields list
    const missingFields: string[] = [];
    if (!trainingName) missingFields.push("nom de la formation");
    if (isPermanent && !catalogId) missingFields.push("formation du catalogue (obligatoire pour une formation permanente)");
    if (isPermanent && !selectedFormulaId) missingFields.push("formule (sélectionnez une formule pour la session permanente)");
    if (!hasValidDates) missingFields.push("jours de formation");
    if (!isPermanent && !isElearning && !finalLocation) missingFields.push("lieu de la formation");
    if (!isPermanent && !clientName) missingFields.push("client");
    if (!isPermanent && (!maxParticipants || parseInt(maxParticipants, 10) < 1)) missingFields.push("nombre maximum de participants (minimum 1)");

    if (missingFields.length > 0 || !user) {
      toast({
        title: "Champs requis",
        description: `Veuillez remplir : ${missingFields.join(", ")}.`,
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
          start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
          end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
          training_name: trainingName,
          location: isPermanent ? "En ligne en accédant à son compte sur supertilt.fr" : finalLocation,
          client_name: isPermanent ? null : clientName,
          client_address: isPermanent ? null : (clientAddress || null),
          sold_price_ht: isPermanent ? null : (soldPriceHt ? Math.round(parseFloat(soldPriceHt) * 100) / 100 : null),
          max_participants: isPermanent ? 0 : (maxParticipants ? parseInt(maxParticipants, 10) : 0),
          evaluation_link: "", // Field hidden from UI but required by schema
          format_formation: isPermanent ? "e_learning" : getLegacyFormatFormation(),
          session_type: isPermanent ? "inter" : (sessionType || null),
          session_format: isPermanent ? "distanciel_asynchrone" : (sessionFormat || null),
          prerequisites,
          objectives,
          program_file_url: programFileUrl || null,
          supertilt_link: supertiltLink || null,
          sponsor_first_name: isPermanent ? null : (sponsorFirstName || null),
          sponsor_last_name: isPermanent ? null : (sponsorLastName || null),
          sponsor_email: isPermanent ? null : (sponsorEmail || null),
          sponsor_formal_address: isPermanent ? true : sponsorFormalAddress,
          financeur_same_as_sponsor: isPermanent ? true : financeurSameAsSponsor,
          financeur_name: (isPermanent || financeurSameAsSponsor) ? null : (financeurName || null),
          financeur_url: (isPermanent || financeurSameAsSponsor) ? null : (financeurUrl || null),
          trainer_id: null,
          elearning_duration: isElearning && elearningDuration ? parseFloat(elearningDuration) : null,
          catalog_id: catalogId || null,
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
          start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
          total_days: isPermanent ? 0 : selectedDates.length,
          is_permanent: isPermanent,
        },
      });

      toast({
        title: "Formation créée",
        description: "La formation a été créée avec succès.",
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
                <h1 className="text-2xl font-bold">Nouvelle session de formation</h1>
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
                    Créer la session
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <form id="formation-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Session mode toggle */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Label className="text-sm font-medium">Type de formation :</Label>
                <div className="flex items-center gap-2 rounded-lg border p-1">
                  <Button
                    type="button"
                    variant={!isPermanent ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setIsPermanent(false)}
                  >
                    Session classique
                  </Button>
                  <Button
                    type="button"
                    variant={isPermanent ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setIsPermanent(true)}
                  >
                    Formation permanente
                  </Button>
                </div>
                {isPermanent && (
                  <span className="text-xs text-muted-foreground">
                    E-learning continu, sans dates fixes. Les participants choisissent leur formule à l'inscription.
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

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
                  onFormationSelect={async (formation: FormationConfig | null) => {
                    if (formation) {
                      // Link to catalog entry
                      setCatalogId(formation.id);
                      // Fetch formulas for this formation
                      const { data: formulas } = await supabase
                        .from("formation_formulas")
                        .select("*")
                        .eq("formation_config_id", formation.id)
                        .order("display_order");
                      setCatalogFormulas((formulas as FormationFormula[]) || []);
                      setSelectedFormulaId(null);
                      // Pre-fill all catalog fields (denormalized on session for backward compat)
                      if (formation.programme_url) {
                        setProgramFileUrl(formation.programme_url);
                      }
                      if (formation.objectives?.length) {
                        setObjectives(formation.objectives);
                      }
                      if (formation.prerequisites?.length) {
                        setPrerequisites(formation.prerequisites);
                      }
                      if (formation.supertilt_link) {
                        setSupertiltLink(formation.supertilt_link);
                      }
                      if (formation.elearning_duration) {
                        setElearningDuration(String(formation.elearning_duration));
                      }
                      if (formation.elearning_access_email_content) {
                        setElearningAccessEmailContent(formation.elearning_access_email_content);
                      }
                      // E-learning content from catalog (used when format is distanciel_asynchrone)
                      // No format auto-set: format is chosen at session level
                    } else {
                      setCatalogId(null);
                      setCatalogFormulas([]);
                      setSelectedFormulaId(null);
                    }
                  }}
                />
              </div>

              {/* Session type (intra/inter) - hidden for permanent */}
              {!isPermanent && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type de session</Label>
                  <Select value={sessionType} onValueChange={setSessionType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Intra ou inter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intra">Intra-entreprise</SelectItem>
                      <SelectItem value="inter">Inter-entreprises</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Format de la session</Label>
                  <Select value={sessionFormat} onValueChange={async (val) => {
                    setSessionFormat(val);
                    if (val === "distanciel_asynchrone") {
                      if (locationType !== "en_ligne") setLocationType("en_ligne");
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir le format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="presentiel">Présentiel</SelectItem>
                      <SelectItem value="distanciel_synchrone">Distanciel synchrone (classe virtuelle)</SelectItem>
                      <SelectItem value="distanciel_asynchrone">Distanciel asynchrone (e-learning)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              )}

              {/* Dates - hidden for permanent, different UI for e-learning vs regular training */}
              {isPermanent ? null : isElearning ? (
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
                  <p className="text-xs text-muted-foreground">
                    Le contenu de l'email d'accès e-learning est géré dans <strong>Paramètres → Templates Email</strong>.
                  </p>
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

              {/* Client - hidden for permanent */}
              {!isPermanent && (
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
              )}

              {/* Client address - hidden for permanent */}
              {!isPermanent && (
              <div className="space-y-2">
                <Label htmlFor="clientAddress">Adresse du client</Label>
                <Input
                  id="clientAddress"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Ex: 12 rue de la Paix, 75002 Paris"
                />
                <p className="text-xs text-muted-foreground">
                  Utilisée dans la convention de formation
                </p>
              </div>
              )}

              {/* Location - hidden for permanent */}
              {!isPermanent && <div className="space-y-3">
                <Label>Lieu de la formation *</Label>
                <RadioGroup value={locationType} onValueChange={setLocationType} className="space-y-2">
                  {PREDEFINED_LOCATIONS.map((loc) => (
                    <div key={loc.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={loc.value} id={`location-${loc.value}`} />
                      <Label
                        htmlFor={`location-${loc.value}`}
                        className="font-normal cursor-pointer text-sm"
                      >
                        {loc.value === "chez_client" && clientAddress
                          ? `Chez le client (${clientAddress})`
                          : loc.label}
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
              </div>}

              {/* Sold price HT - hidden for permanent */}
              {!isPermanent && (
              <div className="space-y-2">
                <Label htmlFor="soldPriceHt">
                  {isInter
                    ? "Prix HT par participant (€)"
                    : "Prix HT global (€)"}
                </Label>
                <Input
                  id="soldPriceHt"
                  type="number"
                  min="0"
                  step="0.01"
                  value={soldPriceHt}
                  onChange={(e) => setSoldPriceHt(e.target.value)}
                  placeholder={isInter ? "Ex: 1250" : "Ex: 3500"}
                />
                <p className="text-xs text-muted-foreground">
                  {isInter
                    ? "Prix par participant, utilisé dans les conventions individuelles"
                    : "Montant total HT, utilisé dans la convention de formation"}
                </p>
              </div>
              )}

              {/* Max Participants - hidden for permanent */}
              {!isPermanent && (
              <div className="space-y-2">
                <Label htmlFor="maxParticipants">
                  Nombre maximum de participants <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="maxParticipants"
                  type="number"
                  min="1"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                  placeholder="Ex: 12"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Obligatoire pour la génération de la convention. Les places restantes seront indiquées comme "Prénom, nom, e-mail".
                </p>
              </div>
              )}


            </CardContent>
          </Card>

          {/* Schedules - before Commanditaire (not for e-learning) */}
          {!isElearning && selectedDates.length > 0 && schedules.length > 0 && (
            <ScheduleEditor
              schedules={schedules}
              onSchedulesChange={setSchedules}
            />
          )}

          {/* Sponsor/Commanditaire - hidden for permanent */}
          {!isPermanent && <Card>
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
          </Card>}

          {/* Financeur - hidden for permanent */}
          {!isPermanent && <Card>
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
          </Card>}
            </div>

            {/* Right Column - Catalog summary (read-only) */}
            <div className="space-y-6">
              {catalogId ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Infos du catalogue</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {programFileUrl && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Programme</Label>
                        <a href={programFileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline block truncate">
                          {programFileUrl.split("/").pop() || "Voir le programme"}
                        </a>
                      </div>
                    )}
                    {objectives.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Objectifs ({objectives.length})</Label>
                        <ul className="text-sm list-disc list-inside space-y-0.5">
                          {objectives.map((o, i) => (
                            <li key={i} className="text-muted-foreground">{o}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {prerequisites.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Prérequis ({prerequisites.length})</Label>
                        <ul className="text-sm list-disc list-inside space-y-0.5">
                          {prerequisites.map((p, i) => (
                            <li key={i} className="text-muted-foreground">{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {supertiltLink && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Lien SuperTilt</Label>
                        <a href={supertiltLink} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline block truncate">
                          {supertiltLink}
                        </a>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground italic pt-2 border-t">
                      Ces informations proviennent du catalogue et sont modifiables depuis la page Catalogue.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <p className="text-sm">
                      {isPermanent
                        ? "Sélectionnez une formation du catalogue pour créer une formation permanente."
                        : "Sélectionnez une formation du catalogue pour voir les objectifs, prérequis et programme."}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Formulas card - shown when catalog has formulas */}
              {catalogId && catalogFormulas.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {isPermanent ? "Créer une session permanente sur une formule" : "Formules disponibles"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {catalogFormulas.map((formula) => (
                      <div
                        key={formula.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border",
                          isPermanent && "cursor-pointer hover:border-primary transition-colors",
                          isPermanent && selectedFormulaId === formula.id && "border-primary bg-primary/5 ring-1 ring-primary"
                        )}
                        onClick={isPermanent ? () => setSelectedFormulaId(
                          selectedFormulaId === formula.id ? null : formula.id
                        ) : undefined}
                      >
                        <div>
                          <span className="font-medium text-sm">{formula.name}</span>
                          <div className="flex gap-2 mt-1">
                            {formula.duree_heures && (
                              <span className="text-xs text-muted-foreground">{formula.duree_heures}h</span>
                            )}
                            {formula.prix != null && (
                              <span className="text-xs text-muted-foreground">{formula.prix}€</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {!isPermanent && (
                      <p className="text-xs text-muted-foreground italic">
                        Les participants choisiront leur formule à l'inscription.
                      </p>
                    )}
                    {isPermanent && !selectedFormulaId && (
                      <p className="text-xs text-muted-foreground italic">
                        Sélectionnez une formule pour créer la session permanente.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Warning: permanent mode needs catalog with formulas */}
              {isPermanent && catalogId && catalogFormulas.length === 0 && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardContent className="py-4">
                    <p className="text-sm text-orange-800">
                      Cette formation n'a pas de formules configurées dans le catalogue. Ajoutez des formules (Solo, Communauté, Coachée...) depuis la page Catalogue.
                    </p>
                  </CardContent>
                </Card>
              )}
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
