import { useState, useEffect } from "react";
import { Plus, Loader2, AlertTriangle, ShoppingCart } from "lucide-react";
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
import { useAddParticipant, getEmailMode } from "@/hooks/useAddParticipant";
import { fetchExistingFinanceurs } from "@/services/participants";

interface AddParticipantDialogProps {
  trainingId: string;
  trainingStartDate?: string;
  clientName?: string;
  formatFormation?: string | null;
  isInterEntreprise?: boolean;
  availableFormulas?: FormationFormula[];
  trainingFormulaId?: string | null;
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

const AddParticipantDialog = ({ trainingId, trainingStartDate, clientName, formatFormation, isInterEntreprise: isInterEntrepriseProp, availableFormulas = [], trainingFormulaId, onParticipantAdded, onScheduledEmailsRefresh, initialFirstName, initialLastName, initialEmail, initialCompany, initialSoldPriceHt, externalOpen, onExternalOpenChange }: AddParticipantDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (onExternalOpenChange) onExternalOpenChange(v);
    setInternalOpen(v);
  };
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
  const [formulaId, setFormulaId] = useState<string>(trainingFormulaId || (availableFormulas.length === 1 ? availableFormulas[0].id : ""));
  const selectedFormula = availableFormulas.find(f => f.id === formulaId);
  const formula = selectedFormula?.name || "";
  const [financeurPopoverOpen, setFinanceurPopoverOpen] = useState(false);
  const [existingFinanceurs, setExistingFinanceurs] = useState<string[]>([]);
  const [isManualMode, setIsManualMode] = useState(false);
  const { toast } = useToast();

  const isInterEntreprise = isInterEntrepriseProp ?? (formatFormation === "inter-entreprises" || formatFormation === "e_learning");

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
    setFormulaId(trainingFormulaId || (availableFormulas.length === 1 ? availableFormulas[0].id : ""));
  };

  const mutation = useAddParticipant({
    trainingId,
    trainingStartDate,
    formatFormation,
    isInterEntreprise,
    onSuccess: () => {
      resetForm();
      setOpen(false);
      onParticipantAdded();
    },
    onScheduledEmailsRefresh,
  });

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
    if (open && isInterEntreprise) {
      fetchExistingFinanceurs().then(setExistingFinanceurs);
    }
  }, [open, isInterEntreprise]);

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

    mutation.mutate({
      firstName,
      lastName,
      email,
      company,
      formulaId,
      formulaName: formula,
      selectedFormula,
      sponsorFirstName,
      sponsorLastName,
      sponsorEmail,
      financeurSameAsSponsor,
      financeurName,
      financeurUrl,
      paymentMode,
      soldPriceHt,
      generateCoupon,
    });
  };

  const saving = mutation.isPending;

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

            {/* Formula selector (shown when catalog has 2+ formulas, hidden for permanent formations) */}
            {availableFormulas.length >= 2 && !trainingFormulaId && (
              <div className="space-y-2">
                <Label htmlFor="formula">Formule</Label>
                <Select value={formulaId} onValueChange={setFormulaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une formule" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFormulas.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
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
