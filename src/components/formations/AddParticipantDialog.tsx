import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Loader2, AlertTriangle, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO, format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn, capitalizeName } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { subtractWorkingDays, fetchWorkingDays, fetchNeedsSurveyDelay, scheduleTrainerSummaryIfNeeded } from "@/lib/workingDays";

const addParticipantSchema = z.object({
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  email: z.string().min(1, "L'email est requis").email("Email invalide"),
  company: z.string().default(""),
  soldPriceHt: z.string().default(""),
  sponsorSameAsParticipant: z.boolean().default(false),
  sponsorFirstName: z.string().default(""),
  sponsorLastName: z.string().default(""),
  sponsorEmail: z.string().default(""),
  financeurSameAsSponsor: z.boolean().default(true),
  financeurName: z.string().default(""),
  financeurUrl: z.string().default(""),
  paymentMode: z.enum(["online", "invoice"]).default("invoice"),
  generateCoupon: z.boolean().default(true),
});

type AddParticipantFormValues = z.infer<typeof addParticipantSchema>;

interface AddParticipantDialogProps {
  trainingId: string;
  trainingStartDate?: string;
  clientName?: string;
  formatFormation?: string | null;
  onParticipantAdded: () => void;
  onScheduledEmailsRefresh?: () => void;
  initialFirstName?: string;
  initialLastName?: string;
  initialEmail?: string;
  initialCompany?: string;
  initialSoldPriceHt?: string;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

// capitalizeName imported from @/lib/utils

const AddParticipantDialog = ({ trainingId, trainingStartDate, clientName, formatFormation, onParticipantAdded, onScheduledEmailsRefresh, initialFirstName, initialLastName, initialEmail, initialCompany, initialSoldPriceHt, externalOpen, onExternalOpenChange }: AddParticipantDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (onExternalOpenChange) onExternalOpenChange(v);
    setInternalOpen(v);
  };
  const [financeurPopoverOpen, setFinanceurPopoverOpen] = useState(false);
  const [existingFinanceurs, setExistingFinanceurs] = useState<string[]>([]);
  const [isManualMode, setIsManualMode] = useState(false);
  const { toast } = useToast();

  const form = useForm<AddParticipantFormValues>({
    resolver: zodResolver(addParticipantSchema),
    defaultValues: {
      firstName: "", lastName: "", email: "", company: "", soldPriceHt: "",
      sponsorSameAsParticipant: false, sponsorFirstName: "", sponsorLastName: "", sponsorEmail: "",
      financeurSameAsSponsor: true, financeurName: "", financeurUrl: "",
      paymentMode: "invoice", generateCoupon: true,
    },
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { isSubmitting, errors } } = form;
  const sponsorSameAsParticipant = watch("sponsorSameAsParticipant");
  const financeurSameAsSponsor = watch("financeurSameAsSponsor");
  const paymentMode = watch("paymentMode");
  const generateCoupon = watch("generateCoupon");
  const financeurName = watch("financeurName");

  const isInterEntreprise = formatFormation === "inter-entreprises" || formatFormation === "e_learning";

  // Populate initial values when dialog opens with prefill data
  useEffect(() => {
    if (open) {
      reset({
        firstName: initialFirstName || "",
        lastName: initialLastName || "",
        email: initialEmail || "",
        company: initialCompany || (!isInterEntreprise && clientName ? clientName : ""),
        soldPriceHt: initialSoldPriceHt || "",
        sponsorSameAsParticipant: false, sponsorFirstName: "", sponsorLastName: "", sponsorEmail: "",
        financeurSameAsSponsor: true, financeurName: "", financeurUrl: "",
        paymentMode: "invoice", generateCoupon: true,
      });
    }
  }, [open, initialFirstName, initialLastName, initialEmail, initialCompany, initialSoldPriceHt, clientName, isInterEntreprise]);

  // Fetch existing funders when dialog opens
  useEffect(() => {
    const fetchFinanceurs = async () => {
      const [fromTrainings, fromParticipants] = await Promise.all([
        supabase.from("trainings").select("financeur_name").not("financeur_name", "is", null).not("financeur_name", "eq", ""),
        supabase.from("training_participants").select("financeur_name").not("financeur_name", "is", null).not("financeur_name", "eq", ""),
      ]);

      const allNames = new Set<string>();
      (fromTrainings.data || []).forEach(r => r.financeur_name && allNames.add(r.financeur_name));
      (fromParticipants.data || []).forEach(r => r.financeur_name && allNames.add(r.financeur_name));
      setExistingFinanceurs(Array.from(allNames).sort());
    };

    if (open && isInterEntreprise) {
      fetchFinanceurs();
    }
  }, [open, isInterEntreprise]);

  const getEmailMode = (startDateStr: string | undefined): { status: string; sendWelcomeNow: boolean } => {
    if (!startDateStr) {
      return { status: "non_envoye", sendWelcomeNow: false };
    }
    const startDate = parseISO(startDateStr);
    const daysUntilStart = differenceInDays(startDate, new Date());
    if (daysUntilStart <= 0) {
      return { status: "non_envoye", sendWelcomeNow: false };
    }
    return { status: "programme", sendWelcomeNow: true };
  };

  useEffect(() => {
    if (trainingStartDate) {
      const { status } = getEmailMode(trainingStartDate);
      setIsManualMode(status === "non_envoye");
    }
  }, [trainingStartDate]);

  // Sync sponsor fields when "same as participant" is checked
  const [watchedFirstName, watchedLastName, watchedEmail] = watch(["firstName", "lastName", "email"]);
  useEffect(() => {
    if (sponsorSameAsParticipant) {
      setValue("sponsorFirstName", watchedFirstName);
      setValue("sponsorLastName", watchedLastName);
      setValue("sponsorEmail", watchedEmail);
    }
  }, [sponsorSameAsParticipant, watchedFirstName, watchedLastName, watchedEmail, setValue]);

  const onSubmit = async (data: AddParticipantFormValues) => {
    try {
      const token = crypto.randomUUID();
      const { status, sendWelcomeNow } = getEmailMode(trainingStartDate);
      const participantData = {
        training_id: trainingId,
        first_name: capitalizeName(data.firstName) || null,
        last_name: capitalizeName(data.lastName) || null,
        email: data.email.trim().toLowerCase(),
        company: data.company.trim() || null,
        needs_survey_token: token,
        needs_survey_status: status,
        ...(isInterEntreprise && {
          sponsor_first_name: capitalizeName(data.sponsorFirstName) || null,
          sponsor_last_name: capitalizeName(data.sponsorLastName) || null,
          sponsor_email: data.sponsorEmail.trim().toLowerCase() || null,
          financeur_same_as_sponsor: data.financeurSameAsSponsor,
          financeur_name: !data.financeurSameAsSponsor ? (data.financeurName.trim() || null) : null,
          financeur_url: !data.financeurSameAsSponsor ? (data.financeurUrl.trim() || null) : null,
          payment_mode: data.paymentMode,
          sold_price_ht: data.soldPriceHt ? parseFloat(data.soldPriceHt) : null,
        }),
      };

      const { data: insertedParticipant, error } = await supabase.from("training_participants").insert(participantData).select().single();

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Participant déjà inscrit",
            description: "Un participant avec cet email est déjà inscrit à cette formation.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      // Create questionnaire_besoins record immediately so the link works from day 1
      if (insertedParticipant) {
        try {
          await supabase.from("questionnaire_besoins").insert({
            participant_id: insertedParticipant.id,
            training_id: trainingId,
            token,
            etat: "non_envoye",
            email: data.email.trim().toLowerCase(),
            prenom: data.firstName.trim() || null,
            nom: data.lastName.trim() || null,
            societe: data.company.trim() || null,
          });
        } catch (qErr) {
          console.warn("Failed to pre-create questionnaire record:", qErr);
        }
      }
      // If we need to send welcome email now (J-7 to J-2 window), trigger the edge function
      if (sendWelcomeNow && insertedParticipant) {
        try {
          await supabase.functions.invoke("send-welcome-email", {
            body: {
              participantId: insertedParticipant.id,
              trainingId,
            },
          });
        } catch (emailError) {
          console.error("Failed to send welcome email:", emailError);
          // Don't fail the whole operation, just log the error
        }
      }

      // For e-learning: generate coupon if needed, then send access email
      if (formatFormation === "e_learning" && data.paymentMode !== "online" && insertedParticipant) {
        let couponCode: string | undefined;

        // Generate WooCommerce coupon if requested
        if (data.generateCoupon) {
          try {
            const { data: couponData, error: couponError } = await supabase.functions.invoke("generate-woocommerce-coupon", {
              body: {
                participantId: insertedParticipant.id,
                trainingId,
              },
            });
            if (couponError) {
              console.error("Failed to generate WooCommerce coupon:", couponError);
              toast({
                title: "Coupon non généré",
                description: "Le participant a été ajouté mais le coupon WooCommerce n'a pas pu être créé. Vérifiez la configuration WooCommerce.",
                variant: "default",
                duration: 8000,
              });
            } else if (couponData?.coupon_code) {
              couponCode = couponData.coupon_code;
            }
          } catch (couponErr) {
            console.error("Failed to generate WooCommerce coupon:", couponErr);
          }
        }

        // Send e-learning access email (with coupon code if available)
        try {
          await supabase.functions.invoke("send-elearning-access", {
            body: {
              participantId: insertedParticipant.id,
              trainingId,
              couponCode,
            },
          });
        } catch (emailError) {
          console.error("Failed to send e-learning access email:", emailError);
        }
      }

      // Schedule needs survey email for future trainings (after welcome email is sent)
      let needsSurveySkipped = false;
      if (sendWelcomeNow && insertedParticipant && trainingStartDate) {
        try {
          const [workingDays, needsSurveyDelay] = await Promise.all([
            fetchWorkingDays(supabase),
            fetchNeedsSurveyDelay(supabase),
          ]);

          const startDate = parseISO(trainingStartDate);
          const scheduledDate = subtractWorkingDays(startDate, needsSurveyDelay, workingDays);

          // Only schedule if the date is in the future
          if (scheduledDate > new Date()) {
            await supabase.from("scheduled_emails").insert({
              training_id: trainingId,
              participant_id: insertedParticipant.id,
              email_type: "needs_survey",
              scheduled_for: format(scheduledDate, "yyyy-MM-dd'T'09:00:00"),
              status: "pending",
            });
          } else {
            needsSurveySkipped = true;
          }
        } catch (scheduleError) {
          console.error("Failed to schedule needs survey email:", scheduleError);
        }
      }

      // Schedule trainer summary email if not already scheduled
      if (trainingStartDate && status !== "non_envoye") {
        await scheduleTrainerSummaryIfNeeded(supabase, trainingId, trainingStartDate);
      }

      // Log activity
      await supabase.from("activity_logs").insert({
        action_type: "participant_added",
        recipient_email: data.email.trim().toLowerCase(),
        details: {
          training_id: trainingId,
          participant_name: `${data.firstName.trim() || ""} ${data.lastName.trim() || ""}`.trim() || null,
          company: data.company.trim() || null,
        },
      });

      let statusMessage = "";
      if (status === "non_envoye") {
        statusMessage = "Formation passée — aucun email programmé.";
      } else if (sendWelcomeNow && needsSurveySkipped) {
        statusMessage = "Mail de convocation envoyé. ⚠️ Le recueil des besoins n'a pas été programmé car la date d'envoi est dépassée.";
      } else if (sendWelcomeNow) {
        statusMessage = "Mail de convocation envoyé, recueil des besoins programmé.";
      }

      toast({
        title: "Participant ajouté",
        description: `${data.email} a été ajouté. ${statusMessage}`,
        ...(needsSurveySkipped && { variant: "default" as const, duration: 8000 }),
      });

      reset();
      setOpen(false);
      onParticipantAdded();
      // Trigger scheduled emails refresh
      if (onScheduledEmailsRefresh) {
        onScheduledEmailsRefresh();
      }
    } catch (error: unknown) {
      console.error("Error adding participant:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Ajouter un participant</DialogTitle>
            <DialogDescription>
              Ajoutez un participant à cette formation. Seul l'email est obligatoire.
            </DialogDescription>
          </DialogHeader>

          {isManualMode && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                La formation est déjà passée ou commence aujourd'hui. Aucun mail ne sera envoyé automatiquement.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input id="firstName" {...register("firstName")} placeholder="Jean" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input id="lastName" {...register("lastName")} placeholder="Dupont" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" {...register("email")} placeholder="jean.dupont@example.com" />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Société</Label>
              <Input id="company" {...register("company")} placeholder="ACME Corp" />
            </div>

            {/* Sale amount for inter-enterprise trainings */}
            {isInterEntreprise && (
              <div className="space-y-2">
                <Label htmlFor="soldPriceHt">Montant vendu HT (€)</Label>
                <Input id="soldPriceHt" type="number" step="0.01" min="0" {...register("soldPriceHt")} placeholder="1500.00" />
              </div>
            )}

            {/* Sponsor/Commanditaire fields for inter-enterprise trainings */}
            {isInterEntreprise && (
              <>
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium text-muted-foreground">Commanditaire (facturation)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sponsorSameAsParticipant"
                    checked={sponsorSameAsParticipant}
                    onCheckedChange={(checked) => setValue("sponsorSameAsParticipant", checked === true)}
                  />
                  <Label htmlFor="sponsorSameAsParticipant" className="text-sm font-normal cursor-pointer">
                    Le commanditaire est le participant
                  </Label>
                </div>
                {!sponsorSameAsParticipant && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="sponsorFirstName">Prénom</Label>
                        <Input id="sponsorFirstName" {...register("sponsorFirstName")} placeholder="Marie" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sponsorLastName">Nom</Label>
                        <Input id="sponsorLastName" {...register("sponsorLastName")} placeholder="Martin" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sponsorEmail">Email du commanditaire</Label>
                      <Input id="sponsorEmail" type="email" {...register("sponsorEmail")} placeholder="marie.martin@example.com" />
                    </div>
                  </>
                )}

                {/* Funder section for inter-enterprise */}
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium text-muted-foreground">Financeur</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="financeurSameAsSponsor"
                    checked={financeurSameAsSponsor}
                    onCheckedChange={(checked) => setValue("financeurSameAsSponsor", checked === true)}
                  />
                  <Label htmlFor="financeurSameAsSponsor" className="text-sm font-normal cursor-pointer">
                    Le financeur est identique au commanditaire
                  </Label>
                </div>
                {!financeurSameAsSponsor && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="financeurName">Nom du financeur</Label>
                      <Popover open={financeurPopoverOpen} onOpenChange={setFinanceurPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={financeurPopoverOpen}
                            className="w-full justify-between font-normal"
                          >
                            {financeurName || "Sélectionner ou saisir un financeur..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput
                              placeholder="Rechercher ou saisir un financeur..."
                              value={financeurName}
                              onValueChange={(v) => setValue("financeurName", v)}
                            />
                            <CommandList>
                              <CommandEmpty>
                                <div className="p-2 text-sm text-muted-foreground">
                                  Appuyez sur Entrée pour utiliser "{financeurName}"
                                </div>
                              </CommandEmpty>
                              <CommandGroup>
                                {existingFinanceurs.map((f) => (
                                  <CommandItem
                                    key={f}
                                    value={f}
                                    onSelect={(value) => {
                                      setValue("financeurName", value);
                                      setFinanceurPopoverOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        financeurName === f ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {f}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="financeurUrl">URL du financeur</Label>
                      <Input id="financeurUrl" type="url" {...register("financeurUrl")} placeholder="https://..." />
                    </div>
                  </>
                )}

                {/* Payment mode */}
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium text-muted-foreground">Mode de paiement</Label>
                </div>
                <RadioGroup value={paymentMode} onValueChange={(v) => setValue("paymentMode", v as "online" | "invoice")} className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="online" id="paymentOnline" />
                    <Label htmlFor="paymentOnline" className="font-normal cursor-pointer">Payé en ligne</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="invoice" id="paymentInvoice" />
                    <Label htmlFor="paymentInvoice" className="font-normal cursor-pointer">À facturer</Label>
                  </div>
                </RadioGroup>

                {/* WooCommerce coupon generation for e-learning manual enrollment */}
                {formatFormation === "e_learning" && paymentMode !== "online" && (
                  <div className="pt-4 border-t space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="generateCoupon"
                        checked={generateCoupon}
                        onCheckedChange={(checked) => setValue("generateCoupon", checked === true)}
                      />
                      <Label htmlFor="generateCoupon" className="text-sm font-normal cursor-pointer flex items-center gap-1.5">
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Générer un coupon WooCommerce (100% réduction)
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      Un code promo unique sera créé sur WooCommerce et envoyé au participant avec les instructions d'accès.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ajout...
                </>
              ) : (
                "Ajouter"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddParticipantDialog;
