import { useState, useEffect, useMemo } from "react";
import { Plus, Loader2, AlertTriangle, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO, format } from "date-fns";
import type { FormationFormula } from "@/types/training";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { subtractWorkingDays, fetchWorkingDays, fetchNeedsSurveyDelay, scheduleTrainerSummaryIfNeeded } from "@/lib/workingDays";

interface AddParticipantDialogProps {
  trainingId: string;
  trainingStartDate?: string;
  clientName?: string;
  formatFormation?: string | null;
  availableFormulas?: FormationFormula[];
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

/**
 * Capitalize the first letter of each word in a name, handling compound names (hyphen, space).
 * "jean-pierre" → "Jean-Pierre", "DUPONT" → "Dupont", "marie claire" → "Marie Claire"
 */
const capitalizeName = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/(\s+|-)/g) // split keeping delimiters (spaces & hyphens)
    .map((part) => {
      if (part === "-" || /^\s+$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
};

const AddParticipantDialog = ({ trainingId, trainingStartDate, clientName, formatFormation, availableFormulas = [], onParticipantAdded, onScheduledEmailsRefresh, initialFirstName, initialLastName, initialEmail, initialCompany, initialSoldPriceHt, externalOpen, onExternalOpenChange }: AddParticipantDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (onExternalOpenChange) onExternalOpenChange(v);
    setInternalOpen(v);
  };
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [soldPriceHt, setSoldPriceHt] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [sponsorSameAsParticipant, setSponsorSameAsParticipant] = useState(false);
  const [sponsorFirstName, setSponsorFirstName] = useState("");
  const [sponsorLastName, setSponsorLastName] = useState("");
  const [sponsorEmail, setSponsorEmail] = useState("");
  const [financeurSameAsSponsor, setFinanceurSameAsSponsor] = useState(true);
  const [financeurName, setFinanceurName] = useState("");
  const [financeurUrl, setFinanceurUrl] = useState("");
  const [paymentMode, setPaymentMode] = useState<"online" | "invoice">("invoice");
  const [generateCoupon, setGenerateCoupon] = useState(true);
  const [formula, setFormula] = useState<string>(availableFormulas.length === 1 ? availableFormulas[0].name : "");
  const [financeurPopoverOpen, setFinanceurPopoverOpen] = useState(false);
  const [existingFinanceurs, setExistingFinanceurs] = useState<string[]>([]);
  const [isManualMode, setIsManualMode] = useState(false);
  const { toast } = useToast();
  
  const isInterEntreprise = formatFormation === "inter-entreprises" || formatFormation === "e_learning";

  // Populate initial values when dialog opens with prefill data
  useEffect(() => {
    if (open) {
      if (initialFirstName) setFirstName(initialFirstName);
      if (initialLastName) setLastName(initialLastName);
      if (initialEmail) setEmail(initialEmail);
      if (initialCompany) {
        setCompany(initialCompany);
      } else if (!isInterEntreprise && clientName) {
        // For intra trainings, prefill company with the training's client name
        setCompany(clientName);
      }
      if (initialSoldPriceHt) setSoldPriceHt(initialSoldPriceHt);
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

  // Determine email scheduling mode based on training date
  // - If training already started (past date) -> no email
  // - If training is upcoming -> send welcome email immediately
  // NOTE: This function is called at submit time, so trainingStartDate should always be defined
  // We use the prop directly to ensure we have the latest value
  const getEmailMode = (startDateStr: string | undefined): { status: string; sendWelcomeNow: boolean } => {
    console.log("[AddParticipantDialog] getEmailMode called with startDate:", startDateStr);
    
    if (!startDateStr) {
      console.warn("[AddParticipantDialog] No trainingStartDate provided, defaulting to non_envoye");
      return { status: "non_envoye", sendWelcomeNow: false };
    }
    
    const startDate = parseISO(startDateStr);
    const today = new Date();
    const daysUntilStart = differenceInDays(startDate, today);
    
    console.log("[AddParticipantDialog] Days until start:", daysUntilStart);
    
    // Training already started or is today
    if (daysUntilStart <= 0) {
      return { status: "non_envoye", sendWelcomeNow: false };
    }
    
    // Training is in the future -> send welcome email immediately
    // Initial status is "programme" which means "welcome sent, needs survey scheduled"
    // The send-welcome-email function will keep the status or update appropriately
    return { status: "programme", sendWelcomeNow: true };
  };

  useEffect(() => {
    if (trainingStartDate) {
      const { status } = getEmailMode(trainingStartDate);
      setIsManualMode(status === "non_envoye");
    }
  }, [trainingStartDate]);

  // Sync sponsor fields when "same as participant" is checked
  useEffect(() => {
    if (sponsorSameAsParticipant) {
      setSponsorFirstName(firstName);
      setSponsorLastName(lastName);
      setSponsorEmail(email);
    }
  }, [sponsorSameAsParticipant, firstName, lastName, email]);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setCompany("");
    setSoldPriceHt("");
    setSponsorSameAsParticipant(false);
    setSponsorFirstName("");
    setSponsorLastName("");
    setSponsorEmail("");
    setFinanceurSameAsSponsor(true);
    setFinanceurName("");
    setFinanceurUrl("");
    setPaymentMode("invoice");
    setGenerateCoupon(true);
    setFormula(availableFormulas.length === 1 ? availableFormulas[0].name : "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast({
        title: "Email requis",
        description: "L'adresse email est obligatoire.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      // Generate unique token for needs survey
      const token = crypto.randomUUID();

      // Determine initial status and whether to send welcome email
      // Pass the prop value explicitly to avoid stale closure issues
      const { status, sendWelcomeNow } = getEmailMode(trainingStartDate);
      console.log("[AddParticipantDialog] Submit - status:", status, "sendWelcomeNow:", sendWelcomeNow);

      const participantData = {
        training_id: trainingId,
        first_name: capitalizeName(firstName) || null,
        last_name: capitalizeName(lastName) || null,
        email: email.trim().toLowerCase(),
        company: company.trim() || null,
        needs_survey_token: token,
        needs_survey_status: status,
        // Add formula if available (from catalog formulas)
        ...(formula && {
          formula,
        }),
        // For inter-enterprise trainings, add sponsor, funder and payment fields
        ...(isInterEntreprise && {
          sponsor_first_name: capitalizeName(sponsorFirstName) || null,
          sponsor_last_name: capitalizeName(sponsorLastName) || null,
          sponsor_email: sponsorEmail.trim().toLowerCase() || null,
          financeur_same_as_sponsor: financeurSameAsSponsor,
          financeur_name: !financeurSameAsSponsor ? (financeurName.trim() || null) : null,
          financeur_url: !financeurSameAsSponsor ? (financeurUrl.trim() || null) : null,
          payment_mode: paymentMode,
          sold_price_ht: soldPriceHt ? parseFloat(soldPriceHt) : null,
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
            email: email.trim().toLowerCase(),
            prenom: firstName.trim() || null,
            nom: lastName.trim() || null,
            societe: company.trim() || null,
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
      if (formatFormation === "e_learning" && paymentMode !== "online" && insertedParticipant) {
        let couponCode: string | undefined;

        // Generate WooCommerce coupon if requested
        if (generateCoupon) {
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

      // For coachee participants: schedule coaching booking invitation (J+7 after enrollment)
      const selectedFormula = availableFormulas.find((f) => f.name === formula);
      if (selectedFormula && formula.toLowerCase().includes("coach") && insertedParticipant) {
        try {
          const inviteDate = new Date();
          inviteDate.setDate(inviteDate.getDate() + 7);
          inviteDate.setHours(9, 0, 0, 0);

          await supabase.from("scheduled_emails").insert({
            training_id: trainingId,
            participant_id: insertedParticipant.id,
            email_type: "coaching_booking_invite",
            scheduled_for: inviteDate.toISOString(),
            status: "pending",
          });
        } catch (err) {
          console.warn("Failed to schedule coaching booking invite:", err);
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
        recipient_email: email.trim().toLowerCase(),
        details: {
          training_id: trainingId,
          participant_name: `${firstName.trim() || ""} ${lastName.trim() || ""}`.trim() || null,
          company: company.trim() || null,
        },
      });

      let statusMessage = "";
      if (formatFormation === "e_learning" && paymentMode !== "online") {
        const parts = [];
        if (formula) parts.push(`Formule ${formula}`);
        if (generateCoupon) parts.push("coupon WooCommerce généré");
        parts.push("email d'accès envoyé");
        statusMessage = parts.join(", ") + ".";
      } else if (formula) {
        statusMessage = `Formule ${formula}.`;
      } else if (status === "non_envoye") {
        statusMessage = "Formation passée — aucun email programmé.";
      } else if (sendWelcomeNow && needsSurveySkipped) {
        statusMessage = "Mail de convocation envoyé. ⚠️ Le recueil des besoins n'a pas été programmé car la date d'envoi est dépassée.";
      } else if (sendWelcomeNow) {
        statusMessage = "Mail de convocation envoyé, recueil des besoins programmé.";
      }

      toast({
        title: "Participant ajouté",
        description: `${email} a été ajouté. ${statusMessage}`,
        ...(needsSurveySkipped && { variant: "default" as const, duration: 8000 }),
      });

      resetForm();
      setOpen(false);
      onParticipantAdded();
      // Trigger scheduled emails refresh
      if (onScheduledEmailsRefresh) {
        onScheduledEmailsRefresh();
      }
    } catch (error: any) {
      console.error("Error adding participant:", error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
      <DialogContent className="max-h-[85vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
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

          <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jean"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Dupont"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jean.dupont@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Société</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="ACME Corp"
              />
            </div>

            {/* Formula selector (shown when catalog has 2+ formulas) */}
            {availableFormulas.length >= 2 && (
              <div className="space-y-2">
                <Label htmlFor="formula">Formule</Label>
                <Select value={formula} onValueChange={setFormula}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une formule" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFormulas.map((f) => (
                      <SelectItem key={f.id} value={f.name}>
                        {f.name}
                        {(f.prix != null || f.duree_heures != null) && (
                          <span className="text-muted-foreground">
                            {" — "}
                            {f.prix != null ? `${f.prix}€` : ""}
                            {f.prix != null && f.duree_heures != null ? " · " : ""}
                            {f.duree_heures != null ? `${f.duree_heures}h` : ""}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Sale amount for inter-enterprise trainings */}
            {isInterEntreprise && (
              <div className="space-y-2">
                <Label htmlFor="soldPriceHt">Montant vendu HT (€)</Label>
                <Input
                  id="soldPriceHt"
                  type="number"
                  step="0.01"
                  min="0"
                  value={soldPriceHt}
                  onChange={(e) => setSoldPriceHt(e.target.value)}
                  placeholder="1500.00"
                />
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
                    onCheckedChange={(checked) => setSponsorSameAsParticipant(checked === true)}
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
                        <Input
                          id="sponsorFirstName"
                          value={sponsorFirstName}
                          onChange={(e) => setSponsorFirstName(e.target.value)}
                          placeholder="Marie"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sponsorLastName">Nom</Label>
                        <Input
                          id="sponsorLastName"
                          value={sponsorLastName}
                          onChange={(e) => setSponsorLastName(e.target.value)}
                          placeholder="Martin"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sponsorEmail">Email du commanditaire</Label>
                      <Input
                        id="sponsorEmail"
                        type="email"
                        value={sponsorEmail}
                        onChange={(e) => setSponsorEmail(e.target.value)}
                        placeholder="marie.martin@example.com"
                      />
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
                    onCheckedChange={(checked) => setFinanceurSameAsSponsor(checked === true)}
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
                              onValueChange={setFinanceurName}
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
                                      setFinanceurName(value);
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

                {/* Payment mode */}
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium text-muted-foreground">Mode de paiement</Label>
                </div>
                <RadioGroup value={paymentMode} onValueChange={(v) => setPaymentMode(v as "online" | "invoice")} className="flex gap-4">
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
                        onCheckedChange={(checked) => setGenerateCoupon(checked === true)}
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

          <DialogFooter className="shrink-0 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
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
