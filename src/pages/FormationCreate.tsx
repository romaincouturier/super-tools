import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/services/activityLog";
import { sendVenueBookingRequest } from "@/services/training-venues";
import { Calendar, Save, Plus } from "lucide-react";
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
import VenueSelector from "@/components/formations/VenueSelector";
import { FormationFormula } from "@/types/training";
import type { TrainingVenue } from "@/types/training-venue";
import {
  SessionTypeFormatSelector,
  ElearningDatesFields,
  TrainingDaysCalendar,
  LocationRadioGroup,
  SponsorCard,
  FinanceurCard,
  CatalogSummaryCard,
} from "@/components/formations/FormationFormFields";
import CreateCatalogEntryDialog from "@/components/formations/CreateCatalogEntryDialog";
import { AlertTriangle } from "lucide-react";

const FormationCreate = () => {
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const form = useFormationForm();
  const [venueId, setVenueId] = useState<string | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<TrainingVenue | null>(null);
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);

  // Applique une entrée catalogue fraîchement créée au formulaire.
  const applyCreatedCatalog = async (created: FormationConfig) => {
    form.setTrainingName(created.formation_name);
    form.applyCatalogFields(created);
    const { data: formulas } = await supabase
      .from("formation_formulas")
      .select("*")
      .eq("formation_config_id", created.id)
      .order("display_order");
    form.setCatalogFormulas((formulas as FormationFormula[]) || []);
    form.setHasFormulas((formulas?.length ?? 0) > 0);
    form.setSelectedFormulaId(null);
  };

  const fromCrmCardId = searchParams.get("fromCrmCardId");

  // Fetch SuperTilt site URL
  useEffect(() => {
    form.fetchSupertiltSiteUrl();
  }, []);

  // Pre-fill from URL params (coming from CRM) + enrich from CRM card / latest quote
  useEffect(() => {
    const paramClientName = searchParams.get("clientName");
    const paramSponsorFirstName = searchParams.get("sponsorFirstName");
    const paramSponsorLastName = searchParams.get("sponsorLastName");
    const paramSponsorEmail = searchParams.get("sponsorEmail");
    const paramSponsorPhone = searchParams.get("sponsorPhone");
    const paramTrainingName = searchParams.get("trainingName");
    const paramClientAddress = searchParams.get("clientAddress");
    const paramEstimatedValue = searchParams.get("estimatedValue");

    if (paramClientName) form.setClientName(paramClientName);
    if (paramSponsorFirstName) form.setSponsorFirstName(paramSponsorFirstName);
    if (paramSponsorLastName) form.setSponsorLastName(paramSponsorLastName);
    if (paramSponsorEmail) form.setSponsorEmail(paramSponsorEmail);
    if (paramSponsorPhone) form.setSponsorPhone(paramSponsorPhone);
    if (paramTrainingName) form.setTrainingName(paramTrainingName);
    if (paramClientAddress) form.setClientAddress(paramClientAddress);
    if (paramEstimatedValue && parseFloat(paramEstimatedValue) > 0) {
      form.setSoldPriceHt(paramEstimatedValue);
    }

    if (!fromCrmCardId) return;

    let cancelled = false;
    (async () => {
      try {
        const [{ data: crmCard }, { data: quote }] = await Promise.all([
          supabase
            .from("crm_cards")
            .select("company, address, postal_code, city, country, first_name, last_name, email, phone, estimated_value")
            .eq("id", fromCrmCardId)
            .maybeSingle(),
          supabase
            .from("quotes")
            .select("total_ht, client_address, client_zip, client_city, line_items")
            .eq("crm_card_id", fromCrmCardId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        if (cancelled) return;

        // Client address: prefer CRM structured fields, fall back to quote
        const addrParts = [
          crmCard?.address,
          [crmCard?.postal_code, crmCard?.city].filter(Boolean).join(" ").trim() || null,
          crmCard?.country && crmCard.country !== "France" ? crmCard.country : null,
        ].filter(Boolean);
        const crmAddr = addrParts.join(", ");
        const quoteAddr = [quote?.client_address, [quote?.client_zip, quote?.client_city].filter(Boolean).join(" ").trim() || null]
          .filter(Boolean)
          .join(", ");
        const bestAddr = crmAddr || quoteAddr;
        if (bestAddr && !paramClientAddress) form.setClientAddress(bestAddr);

        // Sold price: prefer quote total, then CRM estimated_value
        if (!paramEstimatedValue) {
          const price = (quote?.total_ht && quote.total_ht > 0)
            ? quote.total_ht
            : (crmCard?.estimated_value && crmCard.estimated_value > 0 ? crmCard.estimated_value : null);
          if (price) form.setSoldPriceHt(String(price));
        }

        // Max participants from quote line items (first item quantity)
        const lineItems = (quote?.line_items ?? []) as Array<{ quantity?: number; participant_name?: string[] }>;
        const firstQty = lineItems[0]?.quantity;
        const firstParts = lineItems[0]?.participant_name?.length;
        const nb = typeof firstQty === "number" && firstQty > 0
          ? firstQty
          : (typeof firstParts === "number" && firstParts > 0 ? firstParts : null);
        if (nb) form.setMaxParticipants(String(nb));

        // Try to match a catalog formation by name and apply its fields
        const nameForMatch = paramTrainingName || crmCard?.company || "";
        if (nameForMatch) {
          const { data: match } = await supabase
            .from("formation_configs")
            .select("id, formation_name, duree_heures, prix, programme_url, objectives, prerequisites, supports_url, elearning_access_email_content, supertilt_link, woocommerce_product_id, description, is_active, format_formation")
            .ilike("formation_name", nameForMatch)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();
          if (!cancelled && match) {
            form.setTrainingName(match.formation_name);
            form.applyCatalogFields(match as unknown as FormationConfig);
            const { data: formulas } = await supabase
              .from("formation_formulas")
              .select("*")
              .eq("formation_config_id", match.id)
              .order("display_order");
            if (!cancelled) {
              form.setCatalogFormulas((formulas as FormationFormula[]) || []);
              form.setHasFormulas((formulas?.length ?? 0) > 0);
            }
          }
        }
      } catch (err) {
        console.warn("Prefill from CRM failed:", err);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, fromCrmCardId]);

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
    const isDistancielSynchrone = form.sessionFormat === "distanciel_synchrone";
    const isIntraClassique = !form.isPermanent && !form.isElearning && !form.isInter;
    const hasValidDates = form.isElearning ? true : (isIntraClassique ? true : form.selectedDates.length > 0);

    // Validate
    const missingFields: string[] = [];
    if (!form.trainingName) missingFields.push("nom de la formation");
    if (!form.catalogId) missingFields.push("formation du catalogue (sélectionnez une entrée du catalogue)");
    if (form.isPermanent && !form.selectedFormulaId) missingFields.push("formule (sélectionnez une formule pour la session permanente)");
    if (!hasValidDates) missingFields.push("jours de formation");
    if (!form.isPermanent && !form.isElearning && !isDistancielSynchrone && form.isInter && !venueId) missingFields.push("lieu de la formation (sélectionnez un lieu)");
    if (!form.isPermanent && !form.isElearning && !isDistancielSynchrone && !form.isInter && !isIntraClassique && !form.getFinalLocation()) missingFields.push("lieu de la formation");
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
      if (venueId && selectedVenue) {
        payload.venue_id = venueId;
        payload.location = [
          selectedVenue.name,
          selectedVenue.address,
          [selectedVenue.postal_code, selectedVenue.city].filter(Boolean).join(" "),
        ]
          .filter(Boolean)
          .join(", ");
      }

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

      // Auto-send venue booking request if a venue is selected (fire-and-forget)
      if (venueId) {
        sendVenueBookingRequest(training.id).catch((err) =>
          console.error("Failed to send venue booking request:", err)
        );
      }

      // Bootstrap logistics checklist from default template (best-effort).
      try {
        const { bootstrapChecklist, createItemsBatch, fetchItems } = await import("@/services/logistics");
        await bootstrapChecklist({
          entityType: "training",
          entityId: training.id,
          format: training.format_formation as string | null,
          sessionType: (training as { session_type?: string | null }).session_type ?? null,
          startDate: (training as { start_date?: string | null }).start_date ?? null,
        });

        // For intra sessions, always add a "send training agreement" item, plus
        // dedicated confirm-date / confirm-location items if those are missing.
        // Reminder due date: tomorrow (aujourd'hui + 1 jour).
        if (isIntraClassique) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const dueDate = format(tomorrow, "yyyy-MM-dd");
          const existing = await fetchItems("training", training.id).catch(() => []);
          const basePos = existing.length;
          const extras: Array<{
            entity_type: "training";
            entity_id: string;
            label: string;
            position: number;
            due_date: string;
            notify_days_before: number;
          }> = [];
          extras.push({
            entity_type: "training",
            entity_id: training.id,
            label: "Envoyer la convention de formation au client",
            position: basePos + extras.length,
            due_date: dueDate,
            notify_days_before: 0,
          });
          if (!hasValidDates || form.selectedDates.length === 0) {
            extras.push({
              entity_type: "training",
              entity_id: training.id,
              label: "Confirmer la date de la formation avec le client",
              position: basePos + extras.length,
              due_date: dueDate,
              notify_days_before: 0,
            });
          }
          if (!form.getFinalLocation()) {
            extras.push({
              entity_type: "training",
              entity_id: training.id,
              label: "Confirmer le lieu de la formation avec le client",
              position: basePos + extras.length,
              due_date: dueDate,
              notify_days_before: 0,
            });
          }
          await createItemsBatch(extras);
        }
      } catch (err) {
        console.warn("bootstrapChecklist (training) failed:", err);
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
                    {form.trainingName && !form.catalogId && (
                      <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <div className="flex-1 space-y-2">
                          <p>
                            <strong>"{form.trainingName}"</strong> n'existe pas
                            au catalogue. Créez l'entrée pour pouvoir enregistrer
                            la formation.
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="bg-white"
                            onClick={() => setCatalogDialogOpen(true)}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Créer "{form.trainingName}" au catalogue
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Session type/format - hidden for permanent */}
                  {!form.isPermanent && (
                    <SessionTypeFormatSelector
                      form={form}
                      onFormatChange={(val) => {
                        if ((val === "distanciel_asynchrone" || val === "distanciel_synchrone") && form.locationType !== "en_ligne") {
                          form.setLocationType("en_ligne");
                        }
                      }}
                    />
                  )}

                  {/* Dates */}
                  {form.isPermanent ? null : form.isElearning ? (
                    <ElearningDatesFields form={form} />
                  ) : (
                    <TrainingDaysCalendar form={form} optional={!form.isInter} />
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

                  {/* Location */}
                  {!form.isPermanent && form.isInter && !form.isElearning && form.sessionFormat !== "distanciel_synchrone" && (
                    <div className="space-y-2">
                      <Label>Lieu *</Label>
                      <VenueSelector
                        value={venueId}
                        onChange={(id, venue) => { setVenueId(id); setSelectedVenue(venue); }}
                      />
                    </div>
                  )}
                  {!form.isPermanent && !form.isInter && form.sessionFormat !== "distanciel_synchrone" && <LocationRadioGroup form={form} />}

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

        <CreateCatalogEntryDialog
          open={catalogDialogOpen}
          onOpenChange={setCatalogDialogOpen}
          initialName={form.trainingName}
          onCreated={applyCreatedCatalog}
        />
      </main>
    </ModuleLayout>
  );
};

export default FormationCreate;
