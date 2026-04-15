import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/services/activityLog";
import { Calendar, Save } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import PageHeader from "@/components/PageHeader";
import { format } from "date-fns";
import ModuleLayout from "@/components/ModuleLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useFormationForm } from "@/hooks/useFormationForm";
import ScheduleEditor from "@/components/formations/ScheduleEditor";
import TrainingNameCombobox, { FormationConfig } from "@/components/formations/TrainingNameCombobox";
import ScheduledActionsEditor from "@/components/formations/ScheduledActionsEditor";
import { FormationFormula } from "@/types/training";
import {
  SessionTypeFormatSelector,
  ElearningDatesFields,
  TrainingDaysCalendar,
  LocationRadioGroup,
  SponsorCard,
  FinanceurCard,
  CatalogSummaryCard,
} from "@/components/formations/FormationFormFields";

const FormationCreate = () => {
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const form = useFormationForm();

  const fromCrmCardId = searchParams.get("fromCrmCardId");

  // Fetch SuperTilt site URL
  useEffect(() => {
    form.fetchSupertiltSiteUrl();
  }, []);

  // Pre-fill from URL params (coming from CRM)
  useEffect(() => {
    const paramClientName = searchParams.get("clientName");
    const paramSponsorFirstName = searchParams.get("sponsorFirstName");
    const paramSponsorLastName = searchParams.get("sponsorLastName");
    const paramSponsorEmail = searchParams.get("sponsorEmail");
    const paramTrainingName = searchParams.get("trainingName");

    if (paramClientName) form.setClientName(paramClientName);
    if (paramSponsorFirstName) form.setSponsorFirstName(paramSponsorFirstName);
    if (paramSponsorLastName) form.setSponsorLastName(paramSponsorLastName);
    if (paramSponsorEmail) form.setSponsorEmail(paramSponsorEmail);
    if (paramTrainingName) form.setTrainingName(paramTrainingName);
  }, [searchParams]);

  // Generate schedules when selected dates change
  useEffect(() => {
    if (form.selectedDates.length === 0) {
      form.setSchedules([]);
      return;
    }
    form.setSchedules(form.regenerateSchedules(form.selectedDates, form.schedules));
  }, [form.selectedDates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const startDate = form.getStartDate();
    const hasValidDates = form.isElearning ? true : form.selectedDates.length > 0;

    // Validate
    const missingFields: string[] = [];
    if (!form.trainingName) missingFields.push("nom de la formation");
    if (!form.catalogId) missingFields.push("formation du catalogue (sélectionnez une entrée du catalogue)");
    if (form.isPermanent && !form.selectedFormulaId) missingFields.push("formule (sélectionnez une formule pour la session permanente)");
    if (!hasValidDates) missingFields.push("jours de formation");
    if (!form.isPermanent && !form.isElearning && !form.getFinalLocation()) missingFields.push("lieu de la formation");
    if (!form.isInter && !form.clientName) missingFields.push("client");
    if (!form.isPermanent && (!form.maxParticipants || parseInt(form.maxParticipants, 10) < 1)) missingFields.push("nombre maximum de participants (minimum 1)");

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
      const payload = form.buildTrainingPayload({ isCreate: true });
      payload.created_by = user.id;

      const { data: training, error: trainingError } = await supabase
        .from("trainings")
        .insert(payload as any)
        .select()
        .single();

      if (trainingError) throw trainingError;

      // Create schedules
      if (form.schedules.length > 0) {
        const { error: schedulesError } = await supabase
          .from("training_schedules")
          .insert(
            form.schedules.map((s) => ({
              training_id: training.id,
              day_date: s.day_date,
              start_time: s.start_time,
              end_time: s.end_time,
            }))
          );
        if (schedulesError) throw schedulesError;
      }

      // Create scheduled actions
      const validActions = form.scheduledActions.filter(
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
      await logActivity({
        actionType: "training_created",
        recipientEmail: user.email || "unknown",
        userId: user.id,
        details: {
          training_id: training.id,
          training_name: form.trainingName,
          client_name: form.clientName,
          start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
          total_days: form.isPermanent ? 0 : form.selectedDates.length,
          is_permanent: form.isPermanent,
        },
      });

      toast({ title: "Formation créée", description: "La formation a été créée avec succès." });
      navigate(`/formations/${training.id}`);
    } catch (error: unknown) {
      console.error("Error creating training:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
            title="Nouvelle session de formation"
            backTo="/formations"
            actions={
              <>
                <Button type="button" variant="outline" onClick={() => navigate("/formations")}>
                  Annuler
                </Button>
                <Button type="submit" form="formation-form" disabled={saving}>
                  {saving ? (
                    <>
                      <Spinner className="mr-2" />
                      Création...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Créer la session
                    </>
                  )}
                </Button>
              </>
            }
          />
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
                    variant={!form.isPermanent ? "default" : "ghost"}
                    size="sm"
                    onClick={() => form.setIsPermanent(false)}
                  >
                    Session classique
                  </Button>
                  <Button
                    type="button"
                    variant={form.isPermanent ? "default" : "ghost"}
                    size="sm"
                    onClick={() => form.setIsPermanent(true)}
                  >
                    Formation permanente
                  </Button>
                </div>
                {form.isPermanent && (
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
                      onFormationSelect={async (formation: FormationConfig | null) => {
                        form.applyCatalogFields(formation);
                        if (formation) {
                          const { data: formulas } = await supabase
                            .from("formation_formulas")
                            .select("*")
                            .eq("formation_config_id", formation.id)
                            .order("display_order");
                          form.setCatalogFormulas((formulas as FormationFormula[]) || []);
                          form.setSelectedFormulaId(null);
                        }
                      }}
                    />
                  </div>

                  {/* Session type/format - hidden for permanent */}
                  {!form.isPermanent && (
                    <SessionTypeFormatSelector
                      form={form}
                      onFormatChange={(val) => {
                        if (val === "distanciel_asynchrone" && form.locationType !== "en_ligne") {
                          form.setLocationType("en_ligne");
                        }
                      }}
                    />
                  )}

                  {/* Dates */}
                  {form.isPermanent ? null : form.isElearning ? (
                    <ElearningDatesFields form={form} />
                  ) : (
                    <TrainingDaysCalendar form={form} />
                  )}

                  {/* Client - hidden for inter */}
                  {!form.isInter && (
                    <>
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

                  {/* Location - hidden for permanent */}
                  {!form.isPermanent && <LocationRadioGroup form={form} />}

                  {/* Sold price HT - hidden for permanent and inter */}
                  {!form.isPermanent && !form.isInter && (
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

                  {/* Max Participants - hidden for permanent */}
                  {!form.isPermanent && (
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
                        Obligatoire pour la génération de la convention. Les places restantes seront indiquées comme "Prénom, nom, e-mail".
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Schedules */}
              {!form.isElearning && form.selectedDates.length > 0 && form.schedules.length > 0 && (
                <ScheduleEditor schedules={form.schedules} onSchedulesChange={form.setSchedules} />
              )}

              <SponsorCard form={form} />
              <FinanceurCard form={form} />
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <CatalogSummaryCard
                form={form}
                emptyMessage={
                  form.isPermanent
                    ? "Sélectionnez une formation du catalogue pour créer une formation permanente."
                    : "Sélectionnez une formation du catalogue pour voir les objectifs, prérequis et programme."
                }
              />

              {/* Formulas card */}
              {form.catalogId && form.catalogFormulas.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {form.isPermanent ? "Créer une session permanente sur une formule" : "Formules disponibles"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {form.catalogFormulas.map((formula) => (
                      <div
                        key={formula.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border",
                          form.isPermanent && "cursor-pointer hover:border-primary transition-colors",
                          form.isPermanent && form.selectedFormulaId === formula.id && "border-primary bg-primary/5 ring-1 ring-primary"
                        )}
                        onClick={form.isPermanent ? () => form.setSelectedFormulaId(
                          form.selectedFormulaId === formula.id ? null : formula.id
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
                    {!form.isPermanent && (
                      <p className="text-xs text-muted-foreground italic">
                        Les participants choisiront leur formule à l'inscription.
                      </p>
                    )}
                    {form.isPermanent && !form.selectedFormulaId && (
                      <p className="text-xs text-muted-foreground italic">
                        Sélectionnez une formule pour créer la session permanente.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Warning: permanent mode needs catalog with formulas */}
              {form.isPermanent && form.catalogId && form.catalogFormulas.length === 0 && (
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

          {/* Scheduled Actions */}
          <ScheduledActionsEditor
            actions={form.scheduledActions}
            onActionsChange={form.setScheduledActions}
          />
        </form>
      </main>
    </ModuleLayout>
  );
};

export default FormationCreate;
