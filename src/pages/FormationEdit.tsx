import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/services/activityLog";
import { Calendar, Save } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import PageHeader from "@/components/PageHeader";
import { format, parseISO } from "date-fns";
import ModuleLayout from "@/components/ModuleLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useFormationForm } from "@/hooks/useFormationForm";
import { SESSION_PRESETS } from "@/components/formations/ScheduleEditor";
import ScheduleEditor from "@/components/formations/ScheduleEditor";
import TrainingNameCombobox, { FormationConfig } from "@/components/formations/TrainingNameCombobox";
import TrainerSelector from "@/components/formations/TrainerSelector";
import AssignedUserSelector from "@/components/formations/AssignedUserSelector";
import {
  SessionTypeFormatSelector,
  ElearningDatesFields,
  TrainingDaysCalendar,
  SponsorCard,
  FinanceurCard,
  CatalogSummaryCard,
} from "@/components/formations/FormationFormFields";

const FormationEdit = () => {
  const { id } = useParams<{ id: string }>();
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const form = useFormationForm();
  const [loading, setLoading] = useState(true);

  // Edit uses a plain location string (not radio group)
  const [location, setLocation] = useState("");

  useEffect(() => {
    if (!authLoading && user) {
      fetchTrainingData();
    }
  }, [authLoading, user, id]);

  const fetchTrainingData = async () => {
    if (!id) return;

    try {
      const { data: training, error: trainingError } = await supabase
        .from("trainings")
        .select("*")
        .eq("id", id)
        .single();

      if (trainingError) throw trainingError;

      // Set form values
      form.setTrainingName(training.training_name);
      setLocation(training.location);
      form.setClientName(training.client_name);
      form.setClientAddress(training.client_address || "");
      form.setSoldPriceHt(training.sold_price_ht != null ? String(training.sold_price_ht) : "");
      form.setMaxParticipants(training.max_participants != null ? String(training.max_participants) : "");

      // Load session_type/session_format with fallback from legacy format_formation
      if ((training as unknown as { session_type?: string }).session_type) {
        form.setSessionType((training as unknown as { session_type?: string }).session_type);
      } else {
        const ff = training.format_formation;
        if (ff === "inter-entreprises" || ff === "e_learning") form.setSessionType("inter");
        else if (ff) form.setSessionType("intra");
      }
      if ((training as unknown as { session_format?: string }).session_format) {
        form.setSessionFormat((training as unknown as { session_format?: string }).session_format);
      } else {
        const ff = training.format_formation;
        if (ff === "e_learning") form.setSessionFormat("distanciel_asynchrone");
        else if (ff === "classe_virtuelle") form.setSessionFormat("distanciel_synchrone");
        else if (ff) form.setSessionFormat("presentiel");
      }

      form.setPrerequisites(training.prerequisites || []);
      form.setObjectives(training.objectives || []);
      form.setProgramFileUrl(training.program_file_url || "");
      form.setSupertiltLink(training.supertilt_link || "");
      form.setPrivateGroupUrl((training as unknown as { private_group_url?: string }).private_group_url || "");
      form.setSponsorFirstName(training.sponsor_first_name || "");
      form.setSponsorLastName(training.sponsor_last_name || "");
      form.setSponsorEmail(training.sponsor_email || "");
      form.setSponsorFormalAddress(training.sponsor_formal_address ?? false);
      form.setTrainerId(training.trainer_id || null);
      form.setAssignedTo((training as unknown as { assigned_to?: string | null }).assigned_to || null);
      form.setFinanceurSameAsSponsor(training.financeur_same_as_sponsor ?? true);
      form.setFinanceurName(training.financeur_name || "");
      form.setFinanceurUrl(training.financeur_url || "");
      form.setTrainingNotes((training as unknown as { notes?: string }).notes || "");
      form.setSpecificInstructions((training as unknown as { specific_instructions?: string }).specific_instructions || "");
      form.setCatalogId((training as unknown as { catalog_id?: string | null }).catalog_id || null);

      // For e-learning, load start/end dates directly
      const loadedIsElearning =
        (training as unknown as { session_format?: string }).session_format === "distanciel_asynchrone" ||
        training.format_formation === "e_learning";

      if (loadedIsElearning) {
        if (training.start_date) form.setElearningStartDate(parseISO(training.start_date));
        if (training.end_date) form.setElearningEndDate(parseISO(training.end_date));
        form.setElearningDuration(training.elearning_duration != null ? String(training.elearning_duration) : "");
        form.setElearningAccessEmailContent(training.elearning_access_email_content || "");
        form.setSchedules([]);
        form.setSelectedDates([]);
      } else {
        // Fetch schedules
        const { data: schedulesData } = await supabase
          .from("training_schedules")
          .select("*")
          .eq("training_id", id)
          .order("day_date", { ascending: true });

        if (schedulesData && schedulesData.length > 0) {
          const dates = schedulesData.map((s) => parseISO(s.day_date));
          form.setSelectedDates(dates);
          form.setSchedules(
            schedulesData.map((s) => ({
              day_date: s.day_date,
              start_time: s.start_time,
              end_time: s.end_time,
            }))
          );
        } else if (training.start_date) {
          const start = parseISO(training.start_date);
          form.setSelectedDates([start]);
          form.setSchedules([
            {
              day_date: training.start_date,
              start_time: SESSION_PRESETS.full.start,
              end_time: SESSION_PRESETS.full.end,
              session_type: "full",
            },
          ]);
        }
      }

      form.setDataLoaded(true);

      // Fetch formulas if linked to catalog
      if ((training as unknown as { catalog_id?: string | null }).catalog_id) {
        const { data: formulas } = await supabase
          .from("formation_formulas")
          .select("id")
          .eq("formation_config_id", (training as unknown as { catalog_id?: string | null }).catalog_id);
        form.setHasFormulas((formulas?.length ?? 0) > 0);
      }

      await form.fetchSupertiltSiteUrl();
      setLoading(false);
    } catch (error: unknown) {
      console.error("Error fetching training:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
      navigate("/formations");
    }
  };

  // Generate schedules when selected dates change (only after initial load)
  useEffect(() => {
    if (!form.dataLoaded || form.selectedDates.length === 0) return;
    form.setSchedules(form.regenerateSchedules(form.selectedDates, form.schedules));
  }, [form.selectedDates, form.dataLoaded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasValidDates = form.isElearning
      ? !!(form.elearningStartDate && form.elearningEndDate)
      : form.selectedDates.length > 0;

    if (!hasValidDates || !form.trainingName || !location || (!form.isInter && !form.clientName) || !user || !id) {
      toast({
        title: "Champs requis",
        description: form.isElearning
          ? "Veuillez remplir tous les champs obligatoires (dates de début et fin, nom, lieu, client)."
          : "Veuillez remplir tous les champs obligatoires (dates, nom, lieu, client).",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const payload = form.buildTrainingPayload({ isCreate: false });
      payload.location = location;

      const { error: trainingError } = await supabase
        .from("trainings")
        .update(payload as Record<string, unknown>)
        .eq("id", id);

      if (trainingError) throw trainingError;

      // Delete existing schedules and recreate
      await supabase.from("training_schedules").delete().eq("training_id", id);

      if (form.schedules.length > 0) {
        const { error: schedulesError } = await supabase
          .from("training_schedules")
          .insert(
            form.schedules.map((s) => ({
              training_id: id,
              day_date: s.day_date,
              start_time: s.start_time,
              end_time: s.end_time,
            }))
          );
        if (schedulesError) throw schedulesError;
      }

      // Log activity
      await logActivity({
        actionType: "training_updated",
        recipientEmail: user.email || "unknown",
        userId: user.id,
        details: {
          training_id: id,
          training_name: form.trainingName,
          client_name: form.clientName,
          total_days: form.selectedDates.length,
        },
      });

      toast({ title: "Formation modifiée", description: "Les modifications ont été enregistrées." });
      navigate(`/formations/${id}`);
    } catch (error: unknown) {
      console.error("Error updating training:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  return (
    <ModuleLayout>
      <main className="max-w-7xl mx-auto p-6">
        <div className="sticky top-0 z-10 bg-background pb-4 -mx-6 px-6 pt-0">
          <PageHeader
            icon={Calendar}
            title="Modifier la session"
            backTo="/formations"
            actions={
              <>
                <Button type="button" variant="outline" onClick={() => navigate(`/formations/${id}`)}>
                  Annuler
                </Button>
                <Button type="submit" form="formation-form" disabled={saving}>
                  {saving ? (
                    <>
                      <Spinner className="mr-2" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Enregistrer
                    </>
                  )}
                </Button>
              </>
            }
          />
        </div>

        <form id="formation-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Informations générales</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Training name */}
                  <div className="space-y-2">
                    <Label htmlFor="trainingName">Nom de la formation *</Label>
                    <TrainingNameCombobox
                      value={form.trainingName}
                      onChange={form.setTrainingName}
                      onFormationSelect={(formation: FormationConfig | null) => {
                        form.applyCatalogFields(formation);
                        if (formation) {
                          supabase
                            .from("formation_formulas")
                            .select("id")
                            .eq("formation_config_id", formation.id)
                            .then(({ data }) => form.setHasFormulas((data?.length ?? 0) > 0));
                        }
                      }}
                    />
                  </div>

                  {/* Dates */}
                  {form.isElearning ? (
                    <ElearningDatesFields form={form} showDuration={!form.hasFormulas} />
                  ) : (
                    <TrainingDaysCalendar form={form} />
                  )}

                  {/* Session type/format */}
                  <SessionTypeFormatSelector form={form} />

                  {/* Location and client */}
                  {form.isInter ? (
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
                            value={form.clientName}
                            onChange={(e) => form.setClientName(e.target.value)}
                            placeholder="Ex: ACME Corp"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="clientAddress">Adresse du client</Label>
                        <Input
                          id="clientAddress"
                          value={form.clientAddress}
                          onChange={(e) => form.setClientAddress(e.target.value)}
                          placeholder="Ex: 12 rue de la Paix, 75002 Paris"
                        />
                        <p className="text-xs text-muted-foreground">
                          Utilisée dans la convention de formation
                        </p>
                      </div>
                    </>
                  )}

                  {/* Sold price HT */}
                  {!form.hasFormulas && !form.isInter && (
                    <div className="space-y-2">
                      <Label htmlFor="soldPriceHt">Prix HT global (€)</Label>
                      <Input
                        id="soldPriceHt"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.soldPriceHt}
                        onChange={(e) => form.setSoldPriceHt(e.target.value)}
                        placeholder="Ex: 3500"
                      />
                      <p className="text-xs text-muted-foreground">
                        Montant total HT, utilisé dans la convention de formation
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
                      value={form.maxParticipants}
                      onChange={(e) => form.setMaxParticipants(e.target.value)}
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
                    <TrainerSelector value={form.trainerId} onChange={form.setTrainerId} />
                  </div>

                  {/* Assigned User */}
                  <div className="space-y-2">
                    <Label>Responsable (alertes)</Label>
                    <AssignedUserSelector value={form.assignedTo} onChange={form.setAssignedTo} />
                    <p className="text-xs text-muted-foreground">
                      L'utilisateur assigné recevra les alertes quotidiennes pour cette formation
                    </p>
                  </div>
                </CardContent>
              </Card>

              <SponsorCard form={form} />
              <FinanceurCard form={form} />

              {/* Notes */}
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={form.trainingNotes}
                    onChange={(e) => form.setTrainingNotes(e.target.value)}
                    placeholder="Ajoutez des notes libres sur cette formation..."
                    rows={4}
                    className="resize-y"
                  />
                </CardContent>
              </Card>

              {/* Instructions spécifiques */}
              <Card>
                <CardHeader>
                  <CardTitle>Instructions spécifiques</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={form.specificInstructions}
                    onChange={(e) => form.setSpecificInstructions(e.target.value)}
                    placeholder="Instructions visibles dans l'événement Google Calendar et la synthèse de la formation..."
                    rows={4}
                    className="resize-y"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Ces instructions apparaîtront dans le descriptif de l'événement calendrier et sur la page synthèse de la formation.
                  </p>
                </CardContent>
              </Card>

              {/* Schedules */}
              {!form.isElearning && form.selectedDates.length > 0 && form.schedules.length > 0 && (
                <ScheduleEditor schedules={form.schedules} onSchedulesChange={form.setSchedules} />
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <CatalogSummaryCard
                form={form}
                catalogLink={
                  <Link to="/catalogue" className="text-primary hover:underline not-italic font-medium">
                    Catalogue
                  </Link>
                }
                emptyMessage={
                  form.catalogId
                    ? undefined
                    : undefined
                }
              />
              {/* Show legacy data when no catalog */}
              {!form.catalogId && (form.objectives.length > 0 || form.prerequisites.length > 0 || form.programFileUrl) && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <p className="text-sm">Session sans catalogue associé. Les données pédagogiques sont conservées en l'état.</p>
                    <div className="mt-4 text-left space-y-2">
                      {form.programFileUrl && (
                        <a href={form.programFileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline block truncate">
                          Programme PDF
                        </a>
                      )}
                      {form.objectives.length > 0 && <p className="text-xs">{form.objectives.length} objectif(s)</p>}
                      {form.prerequisites.length > 0 && <p className="text-xs">{form.prerequisites.length} prérequis</p>}
                    </div>
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
