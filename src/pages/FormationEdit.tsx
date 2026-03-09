import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, ArrowLeft, Calendar, Save, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import ModuleLayout from "@/components/ModuleLayout";
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
import TrainerSelector from "@/components/formations/TrainerSelector";
import AssignedUserSelector from "@/components/formations/AssignedUserSelector";

const FormationEdit = () => {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form state
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [trainingName, setTrainingName] = useState("");
  const [location, setLocation] = useState("");

  // E-learning specific fields
  const [elearningStartDate, setElearningStartDate] = useState<Date | null>(null);
  const [elearningEndDate, setElearningEndDate] = useState<Date | null>(null);
  const [elearningDuration, setElearningDuration] = useState<string>("");
  const [elearningAccessEmailContent, setElearningAccessEmailContent] = useState<string>("");
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
  const [privateGroupUrl, setPrivateGroupUrl] = useState<string>("");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  
  // Sponsor/Commanditaire
  const [sponsorFirstName, setSponsorFirstName] = useState("");
  const [sponsorLastName, setSponsorLastName] = useState("");
  const [sponsorEmail, setSponsorEmail] = useState("");
  const [sponsorFormalAddress, setSponsorFormalAddress] = useState(true); // true = vouvoiement (default)
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);

  // Financeur
  const [financeurSameAsSponsor, setFinanceurSameAsSponsor] = useState(true);
  const [financeurName, setFinanceurName] = useState("");
  const [financeurUrl, setFinanceurUrl] = useState("");

  // Catalog
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [hasFormulas, setHasFormulas] = useState(false);

  // Notes
  const [trainingNotes, setTrainingNotes] = useState("");

  // Track if data has been loaded (to prevent schedule regeneration)
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // SuperTilt site URL from settings
  const [supertiltSiteUrl, setSupertiltSiteUrl] = useState<string>("");

  // Derived helpers
  const isElearning = sessionFormat === "distanciel_asynchrone";
  const isInter = sessionType === "inter";

  // Compute legacy format_formation for backward compatibility
  const getLegacyFormatFormation = (): string | null => {
    if (!sessionType && !sessionFormat) return null;
    if (sessionFormat === "distanciel_asynchrone") return "e_learning";
    if (sessionFormat === "distanciel_synchrone") return "classe_virtuelle";
    if (sessionType === "inter") return "inter-entreprises";
    return "intra";
  };

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
      setClientAddress(training.client_address || "");
      setSoldPriceHt(training.sold_price_ht != null ? String(training.sold_price_ht) : "");
      setMaxParticipants(training.max_participants != null ? String(training.max_participants) : "");
      // Load session_type/session_format with fallback from legacy format_formation
      if ((training as any).session_type) {
        setSessionType((training as any).session_type);
      } else {
        // Derive from legacy format_formation
        const ff = training.format_formation;
        if (ff === "inter-entreprises" || ff === "e_learning") setSessionType("inter");
        else if (ff) setSessionType("intra");
      }
      if ((training as any).session_format) {
        setSessionFormat((training as any).session_format);
      } else {
        const ff = training.format_formation;
        if (ff === "e_learning") setSessionFormat("distanciel_asynchrone");
        else if (ff === "classe_virtuelle") setSessionFormat("distanciel_synchrone");
        else if (ff) setSessionFormat("presentiel");
      }
      setPrerequisites(training.prerequisites || []);
      setObjectives(training.objectives || []);
      setProgramFileUrl(training.program_file_url || "");
      setSupertiltLink(training.supertilt_link || "");
      setPrivateGroupUrl((training as any).private_group_url || "");
      setSponsorFirstName(training.sponsor_first_name || "");
      setSponsorLastName(training.sponsor_last_name || "");
      setSponsorEmail(training.sponsor_email || "");
      setSponsorFormalAddress(training.sponsor_formal_address ?? true);
      setTrainerId(training.trainer_id || null);
      setAssignedTo((training as any).assigned_to || null);
      setFinanceurSameAsSponsor(training.financeur_same_as_sponsor ?? true);
      setFinanceurName(training.financeur_name || "");
      setFinanceurUrl(training.financeur_url || "");
      setTrainingNotes((training as any).notes || "");
      setCatalogId((training as any).catalog_id || null);

      // For e-learning (distanciel asynchrone), load start/end dates directly (no schedules)
      const loadedIsElearning = (training as any).session_format === "distanciel_asynchrone" || training.format_formation === "e_learning";
      if (loadedIsElearning) {
        if (training.start_date) setElearningStartDate(parseISO(training.start_date));
        if (training.end_date) {
          setElearningEndDate(parseISO(training.end_date));
        }
        setElearningDuration(training.elearning_duration != null ? String(training.elearning_duration) : "");
        setElearningAccessEmailContent(training.elearning_access_email_content || "");
        // E-learning has no schedules
        setSchedules([]);
        setSelectedDates([]);
      } else {
        // Fetch schedules to get actual training days
        const { data: schedulesData } = await supabase
          .from("training_schedules")
          .select("*")
          .eq("training_id", id)
          .order("day_date", { ascending: true });

        if (schedulesData && schedulesData.length > 0) {
          // Set selected dates from schedules (actual training days)
          const dates = schedulesData.map(s => parseISO(s.day_date));
          setSelectedDates(dates);

          setSchedules(schedulesData.map(s => ({
            day_date: s.day_date,
            start_time: s.start_time,
            end_time: s.end_time,
          })));
        } else {
          // Fallback to start_date if no schedules exist
          if (training.start_date) {
            const start = parseISO(training.start_date);
            setSelectedDates([start]);
            setSchedules([{
              day_date: training.start_date,
              start_time: SESSION_PRESETS.full.start,
              end_time: SESSION_PRESETS.full.end,
              session_type: "full",
            }]);
          }
        }
      }

      setDataLoaded(true);

      // Fetch formulas if linked to catalog
      if ((training as any).catalog_id) {
        const { data: formulas } = await supabase
          .from("formation_formulas")
          .select("id")
          .eq("formation_config_id", (training as any).catalog_id);
        setHasFormulas((formulas?.length ?? 0) > 0);
      }

      // Fetch SuperTilt site URL from settings
      const { data: settingData } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "supertilt_site_url")
        .maybeSingle();
      if (settingData?.setting_value) {
        setSupertiltSiteUrl(settingData.setting_value);
      }
      
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

  // Generate schedules when selected dates change (only after initial load)
  useEffect(() => {
    if (!dataLoaded || selectedDates.length === 0) return;

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
  }, [selectedDates, dataLoaded]);

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
    if (isElearning) {
      return elearningStartDate;
    }
    if (selectedDates.length === 0) return null;
    return selectedDates.reduce((min, d) => d < min ? d : min, selectedDates[0]);
  };

  const getEndDate = (): Date | null => {
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

    const startDate = getStartDate();
    const endDate = getEndDate();

    // Validate dates based on format
    const hasValidDates = isElearning
      ? (elearningStartDate && elearningEndDate)
      : (selectedDates.length > 0);

    if (!hasValidDates || !trainingName || !location || (!isInter && !clientName) || !user || !id) {
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
      // Update training with derived start/end dates
      const { error: trainingError } = await supabase
        .from("trainings")
        .update({
          start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
          end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
          training_name: trainingName,
          location,
          client_name: clientName,
          client_address: clientAddress || null,
          sold_price_ht: soldPriceHt ? Math.round(parseFloat(soldPriceHt) * 100) / 100 : null,
          max_participants: maxParticipants ? parseInt(maxParticipants, 10) : 0,
          format_formation: getLegacyFormatFormation(),
          session_type: sessionType || null,
          session_format: sessionFormat || null,
          prerequisites,
          objectives,
          program_file_url: programFileUrl || null,
          supertilt_link: supertiltLink || null,
          sponsor_first_name: sponsorFirstName || null,
          sponsor_last_name: sponsorLastName || null,
          sponsor_email: sponsorEmail || null,
          sponsor_formal_address: sponsorFormalAddress,
          trainer_id: trainerId || null,
          assigned_to: assignedTo || null,
          financeur_same_as_sponsor: financeurSameAsSponsor,
          financeur_name: financeurSameAsSponsor ? null : (financeurName || null),
          financeur_url: financeurSameAsSponsor ? null : (financeurUrl || null),
          elearning_duration: isElearning && elearningDuration ? parseFloat(elearningDuration) : null,
          catalog_id: catalogId || null,
          notes: trainingNotes.trim() || null,
        } as any)
        .eq("id", id);

      if (trainingError) throw trainingError;

      // Delete existing schedules and recreate (only for selected dates)
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

      // Log activity
      await supabase.from("activity_logs").insert({
        action_type: "training_updated",
        recipient_email: user.email || "unknown",
        user_id: user.id,
        details: {
          training_id: id,
          training_name: trainingName,
          client_name: clientName,
          total_days: selectedDates.length,
        },
      });

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
    <ModuleLayout>

      {/* Main content */}
      <main className="max-w-7xl mx-auto p-6">
        {/* Sticky header with back button, title and action buttons */}
        <div className="sticky top-0 z-10 bg-background pb-4 -mx-6 px-6 pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
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
                <h1 className="text-2xl font-bold">Modifier la session</h1>
              </div>
            </div>
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/formations/${id}`)}
              >
                Annuler
              </Button>
              <Button type="submit" form="formation-form" disabled={saving}>
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
                      onFormationSelect={(formation: FormationConfig | null) => {
                        if (formation) {
                          setCatalogId(formation.id);
                          // Check if this catalog has formulas
                          supabase.from("formation_formulas").select("id").eq("formation_config_id", formation.id)
                            .then(({ data }) => setHasFormulas((data?.length ?? 0) > 0));
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
                          // Format is now chosen at session level, not from catalog
                        } else {
                          setCatalogId(null);
                          setHasFormulas(false);
                        }
                      }}
                    />
                  </div>

                  {/* Dates - different UI for e-learning vs regular training */}
                  {isElearning ? (
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
                      {/* Durée totale — hidden when formation uses formulas (duration is per formula) */}
                      {!hasFormulas && (
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
                      )}
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

                  {/* Session type and format — right below dates */}
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
                      <Select value={sessionFormat} onValueChange={setSessionFormat}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir le format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="presentiel">Présentiel</SelectItem>
                          <SelectItem value="distanciel_synchrone">Distanciel synchrone</SelectItem>
                          <SelectItem value="distanciel_asynchrone">Distanciel asynchrone (e-learning)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Location and client — hidden for inter (managed per participant) */}
                  {isInter ? (
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
                  ) : (
                    <>
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

                      {/* Client address */}
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
                    </>
                  )}

                  {/* Sold price HT — hidden when formation uses formulas (price is per formula) */}
                  {!hasFormulas && (
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

                  {/* Max Participants */}
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
                      Obligatoire pour la génération de la convention.
                    </p>
                  </div>

                  {/* Trainer selector */}
                  <div className="space-y-2">
                    <Label>Formateur</Label>
                    <TrainerSelector
                      value={trainerId}
                      onChange={setTrainerId}
                    />
                  </div>

                  {/* Assigned User */}
                  <div className="space-y-2">
                    <Label>Responsable (alertes)</Label>
                    <AssignedUserSelector
                      value={assignedTo}
                      onChange={setAssignedTo}
                    />
                    <p className="text-xs text-muted-foreground">
                      L'utilisateur assigné recevra les alertes quotidiennes pour cette formation
                    </p>
                  </div>


                </CardContent>
              </Card>

              {/* Sponsor/Commanditaire — hidden for inter (managed per participant) */}
              {!isInter && <Card>
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

              {/* Financeur — hidden for inter (managed per participant) */}
              {!isInter && <Card>
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

              {/* Notes */}
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={trainingNotes}
                    onChange={(e) => setTrainingNotes(e.target.value)}
                    placeholder="Ajoutez des notes libres sur cette formation..."
                    rows={4}
                    className="resize-y"
                  />
                </CardContent>
              </Card>

              {/* Schedules (not for e-learning) */}
              {!isElearning && selectedDates.length > 0 && schedules.length > 0 && (
                <ScheduleEditor
                  schedules={schedules}
                  onSchedulesChange={setSchedules}
                />
              )}
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
                      Ces informations proviennent du catalogue et sont modifiables depuis la page{" "}
                      <Link to="/catalogue" className="text-primary hover:underline not-italic font-medium">
                        Catalogue
                      </Link>.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <p className="text-sm">Session sans catalogue associé. Les données pédagogiques sont conservées en l'état.</p>
                    {(objectives.length > 0 || prerequisites.length > 0 || programFileUrl) && (
                      <div className="mt-4 text-left space-y-2">
                        {programFileUrl && (
                          <a href={programFileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline block truncate">
                            Programme PDF
                          </a>
                        )}
                        {objectives.length > 0 && <p className="text-xs">{objectives.length} objectif(s)</p>}
                        {prerequisites.length > 0 && <p className="text-xs">{prerequisites.length} prérequis</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </form>
      </main>
    </ModuleLayout>
  );
};

export default FormationEdit;
