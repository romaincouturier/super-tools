import { useState, useEffect } from "react";
import { Pencil, Loader2, FileText, Upload, Trash2, ExternalLink, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface Participant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  sponsor_first_name?: string | null;
  sponsor_last_name?: string | null;
  sponsor_email?: string | null;
  financeur_same_as_sponsor?: boolean;
  financeur_name?: string | null;
  financeur_url?: string | null;
  payment_mode?: string;
  sold_price_ht?: number | null;
  signed_convention_url?: string | null;
}

interface ConventionSignatureStatus {
  signed_pdf_url: string | null;
  signed_at: string | null;
  status: string;
}

interface EditParticipantDialogProps {
  participant: Participant;
  trainingId: string;
  formatFormation?: string | null;
  onParticipantUpdated: () => void;
}

const EditParticipantDialog = ({
  participant,
  trainingId,
  formatFormation,
  onParticipantUpdated,
}: EditParticipantDialogProps) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState(participant.first_name || "");
  const [lastName, setLastName] = useState(participant.last_name || "");
  const [email, setEmail] = useState(participant.email);
  const [company, setCompany] = useState(participant.company || "");
  const [sponsorFirstName, setSponsorFirstName] = useState(participant.sponsor_first_name || "");
  const [sponsorLastName, setSponsorLastName] = useState(participant.sponsor_last_name || "");
  const [sponsorEmail, setSponsorEmail] = useState(participant.sponsor_email || "");
  const [financeurSameAsSponsor, setFinanceurSameAsSponsor] = useState(
    participant.financeur_same_as_sponsor ?? true
  );
  const [financeurName, setFinanceurName] = useState(participant.financeur_name || "");
  const [financeurUrl, setFinanceurUrl] = useState(participant.financeur_url || "");
  const [paymentMode, setPaymentMode] = useState<"online" | "invoice">(
    (participant.payment_mode as "online" | "invoice") || "invoice"
  );
  const [soldPriceHt, setSoldPriceHt] = useState(
    participant.sold_price_ht != null ? String(participant.sold_price_ht) : ""
  );
  const [financeurPopoverOpen, setFinanceurPopoverOpen] = useState(false);
  const [existingFinanceurs, setExistingFinanceurs] = useState<string[]>([]);
  const [signedConventionUrl, setSignedConventionUrl] = useState(participant.signed_convention_url || null);
  const [uploadingConvention, setUploadingConvention] = useState(false);
  const [conventionSignature, setConventionSignature] = useState<ConventionSignatureStatus | null>(null);
  const { toast } = useToast();

  const isInterEntreprise = formatFormation === "inter-entreprises" || formatFormation === "e_learning";

  // Reset form values when participant changes
  useEffect(() => {
    setFirstName(participant.first_name || "");
    setLastName(participant.last_name || "");
    setEmail(participant.email);
    setCompany(participant.company || "");
    setSponsorFirstName(participant.sponsor_first_name || "");
    setSponsorLastName(participant.sponsor_last_name || "");
    setSponsorEmail(participant.sponsor_email || "");
    setFinanceurSameAsSponsor(participant.financeur_same_as_sponsor ?? true);
    setFinanceurName(participant.financeur_name || "");
    setFinanceurUrl(participant.financeur_url || "");
    setPaymentMode((participant.payment_mode as "online" | "invoice") || "invoice");
    setSoldPriceHt(participant.sold_price_ht != null ? String(participant.sold_price_ht) : "");
    setSignedConventionUrl(participant.signed_convention_url || null);
  }, [participant]);

  // Fetch electronic convention signature status
  useEffect(() => {
    const fetchConventionSignature = async () => {
      if (!participant.sponsor_email) return;
      
      const { data } = await supabase
        .from("convention_signatures")
        .select("signed_pdf_url, signed_at, status")
        .eq("training_id", trainingId)
        .eq("recipient_email", participant.sponsor_email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setConventionSignature(data);
      }
    };

    if (open && isInterEntreprise) {
      fetchConventionSignature();
    }
  }, [open, isInterEntreprise, trainingId, participant.sponsor_email]);

  // Fetch existing funders when dialog opens
  useEffect(() => {
    const fetchFinanceurs = async () => {
      const [fromTrainings, fromParticipants] = await Promise.all([
        supabase
          .from("trainings")
          .select("financeur_name")
          .not("financeur_name", "is", null)
          .not("financeur_name", "eq", ""),
        supabase
          .from("training_participants")
          .select("financeur_name")
          .not("financeur_name", "is", null)
          .not("financeur_name", "eq", ""),
      ]);

      const allNames = new Set<string>();
      (fromTrainings.data || []).forEach((r) => r.financeur_name && allNames.add(r.financeur_name));
      (fromParticipants.data || []).forEach((r) => r.financeur_name && allNames.add(r.financeur_name));
      setExistingFinanceurs(Array.from(allNames).sort());
    };

    if (open && isInterEntreprise) {
      fetchFinanceurs();
    }
  }, [open, isInterEntreprise]);

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
      const updateData: Record<string, unknown> = {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        email: email.trim().toLowerCase(),
        company: company.trim() || null,
      };

      // Add inter-enterprise fields if applicable
      if (isInterEntreprise) {
        updateData.sponsor_first_name = sponsorFirstName.trim() || null;
        updateData.sponsor_last_name = sponsorLastName.trim() || null;
        updateData.sponsor_email = sponsorEmail.trim().toLowerCase() || null;
        updateData.financeur_same_as_sponsor = financeurSameAsSponsor;
        updateData.financeur_name = !financeurSameAsSponsor ? (financeurName.trim() || null) : null;
        updateData.financeur_url = !financeurSameAsSponsor ? (financeurUrl.trim() || null) : null;
        updateData.payment_mode = paymentMode;
        updateData.sold_price_ht = soldPriceHt ? parseFloat(soldPriceHt) : null;
      }

      const { error } = await supabase
        .from("training_participants")
        .update(updateData)
        .eq("id", participant.id);

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Email en double",
            description: "Un autre participant avec cet email est déjà inscrit à cette formation.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      // Update training_evaluations if participant info changed
      await supabase
        .from("training_evaluations")
        .update({
          email: email.trim().toLowerCase(),
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          company: company.trim() || null,
        })
        .eq("participant_id", participant.id);

      // Log activity
      await supabase.from("activity_logs").insert({
        action_type: "participant_updated",
        recipient_email: email.trim().toLowerCase(),
        details: {
          training_id: trainingId,
          participant_id: participant.id,
          participant_name: `${firstName.trim() || ""} ${lastName.trim() || ""}`.trim() || null,
          changes: {
            email_changed: email.trim().toLowerCase() !== participant.email,
          },
        },
      });

      toast({
        title: "Participant mis à jour",
        description: `Les informations de ${email} ont été mises à jour.`,
      });

      setOpen(false);
      onParticipantUpdated();
    } catch (error: unknown) {
      console.error("Error updating participant:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Modifier le participant</p>
        </TooltipContent>
      </Tooltip>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} id="edit-participant-form">
          <DialogHeader>
            <DialogTitle>Modifier le participant</DialogTitle>
            <DialogDescription>
              Modifiez les informations du participant. Seul l'email est obligatoire.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">Prénom</Label>
                <Input
                  id="edit-firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jean"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lastName">Nom</Label>
                <Input
                  id="edit-lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Dupont"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jean.dupont@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-company">Société</Label>
              <Input
                id="edit-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="ACME Corp"
              />
            </div>

            {/* Inter-enterprise specific fields */}
            {isInterEntreprise && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-soldPriceHt">Montant vendu HT (€)</Label>
                  <Input
                    id="edit-soldPriceHt"
                    type="number"
                    step="0.01"
                    min="0"
                    value={soldPriceHt}
                    onChange={(e) => setSoldPriceHt(e.target.value)}
                    placeholder="1500.00"
                  />
                </div>

                {/* Sponsor/Commanditaire fields */}
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Commanditaire (facturation)
                  </Label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-sponsorFirstName">Prénom</Label>
                    <Input
                      id="edit-sponsorFirstName"
                      value={sponsorFirstName}
                      onChange={(e) => setSponsorFirstName(e.target.value)}
                      placeholder="Marie"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-sponsorLastName">Nom</Label>
                    <Input
                      id="edit-sponsorLastName"
                      value={sponsorLastName}
                      onChange={(e) => setSponsorLastName(e.target.value)}
                      placeholder="Martin"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-sponsorEmail">Email du commanditaire</Label>
                  <Input
                    id="edit-sponsorEmail"
                    type="email"
                    value={sponsorEmail}
                    onChange={(e) => setSponsorEmail(e.target.value)}
                    placeholder="marie.martin@example.com"
                  />
                </div>

                {/* Funder section for inter-enterprise */}
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium text-muted-foreground">Financeur</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-financeurSameAsSponsor"
                    checked={financeurSameAsSponsor}
                    onCheckedChange={(checked) => setFinanceurSameAsSponsor(checked === true)}
                  />
                  <Label
                    htmlFor="edit-financeurSameAsSponsor"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Le financeur est identique au commanditaire
                  </Label>
                </div>
                {!financeurSameAsSponsor && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="edit-financeurName">Nom du financeur</Label>
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
                      <Label htmlFor="edit-financeurUrl">URL du financeur</Label>
                      <Input
                        id="edit-financeurUrl"
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
                  <Label className="text-sm font-medium text-muted-foreground">
                    Mode de paiement
                  </Label>
                </div>
                <RadioGroup
                  value={paymentMode}
                  onValueChange={(v) => setPaymentMode(v as "online" | "invoice")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="online" id="edit-paymentOnline" />
                    <Label htmlFor="edit-paymentOnline" className="font-normal cursor-pointer">
                      Payé en ligne
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="invoice" id="edit-paymentInvoice" />
                    <Label htmlFor="edit-paymentInvoice" className="font-normal cursor-pointer">
                      À facturer
                    </Label>
                  </div>
                </RadioGroup>

                {/* Convention signée section */}
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Convention signée
                  </Label>
                </div>

                {/* Electronic signature status */}
                {conventionSignature?.status === "signed" && conventionSignature.signed_pdf_url && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">Signée électroniquement</p>
                      {conventionSignature.signed_at && (
                        <p className="text-xs text-green-600 dark:text-green-400">
                          le {new Date(conventionSignature.signed_at).toLocaleDateString("fr-FR")}
                        </p>
                      )}
                    </div>
                    <a
                      href={conventionSignature.signed_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button type="button" variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Voir
                      </Button>
                    </a>
                  </div>
                )}

                {conventionSignature?.status === "pending" && (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <Loader2 className="h-5 w-5 text-amber-600 animate-spin flex-shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-200">En attente de signature électronique</p>
                  </div>
                )}

                {/* Manual upload for signed convention */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Convention signée (upload manuel)
                  </Label>
                  
                  {signedConventionUrl ? (
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <a
                        href={signedConventionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-sm text-primary hover:underline truncate"
                      >
                        Convention signée
                      </a>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer la convention signée ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action est irréversible.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                try {
                                  const urlParts = signedConventionUrl.split("/training-documents/");
                                  if (urlParts.length > 1) {
                                    await supabase.storage.from("training-documents").remove([urlParts[1]]);
                                  }
                                  await supabase
                                    .from("training_participants")
                                    .update({ signed_convention_url: null } as Record<string, unknown>)
                                    .eq("id", participant.id);
                                  setSignedConventionUrl(null);
                                  onParticipantUpdated();
                                  toast({ title: "Convention supprimée" });
                                } catch (err) {
                                  console.error(err);
                                  toast({ title: "Erreur", description: "Impossible de supprimer.", variant: "destructive" });
                                }
                              }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ) : (
                    <Label htmlFor={`signed-convention-${participant.id}`} className="cursor-pointer">
                      <input
                        id={`signed-convention-${participant.id}`}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        disabled={uploadingConvention}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (!file.type.includes("pdf")) {
                            toast({ title: "Format non supporté", description: "Seuls les fichiers PDF sont acceptés.", variant: "destructive" });
                            return;
                          }
                          setUploadingConvention(true);
                          try {
                            const sanitized = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_.-]/g, "_");
                            const path = `${trainingId}/participant_${participant.id}/convention_signee_${Date.now()}_${sanitized}`;
                            const { error: uploadErr } = await supabase.storage.from("training-documents").upload(path, file);
                            if (uploadErr) throw uploadErr;
                            const { data: { publicUrl } } = supabase.storage.from("training-documents").getPublicUrl(path);
                            await supabase
                              .from("training_participants")
                              .update({ signed_convention_url: publicUrl } as Record<string, unknown>)
                              .eq("id", participant.id);
                            setSignedConventionUrl(publicUrl);
                            onParticipantUpdated();
                            toast({ title: "Convention uploadée" });
                          } catch (err) {
                            console.error(err);
                            toast({ title: "Erreur d'upload", description: err instanceof Error ? err.message : "Erreur.", variant: "destructive" });
                          } finally {
                            setUploadingConvention(false);
                          }
                        }}
                      />
                      <Button type="button" variant="outline" size="sm" disabled={uploadingConvention} asChild>
                        <span>
                          {uploadingConvention ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                          Uploader une convention signée
                        </span>
                      </Button>
                    </Label>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button 
              type="submit"
              form="edit-participant-form"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditParticipantDialog;
