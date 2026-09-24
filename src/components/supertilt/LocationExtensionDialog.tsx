import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { demoBlur } from "@/lib/demoMask";
import PennylaneInvoiceFields, { type PennylaneCustomerDraft } from "@/components/missions/PennylaneInvoiceFields";
import { useLocationExtensionActions } from "@/hooks/useLocationExtensions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderItemId: string;
  contratReference: string | null;
}

export default function LocationExtensionDialog({ open, onOpenChange, orderItemId, contratReference }: Props) {
  const { toast } = useToast();
  const { isDemoMode } = useDemoMode();
  const { prepare, create, refresh } = useLocationExtensionActions(orderItemId);
  const [customer, setCustomer] = useState<PennylaneCustomerDraft | null>(null);
  const [vatRate, setVatRate] = useState("FR_200");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [amount, setAmount] = useState("");

  const prepareInvoke = prepare.invoke;
  useEffect(() => {
    if (!open || customer) return;
    prepareInvoke({ action: "prepare", order_item_id: orderItemId }).then((res) => {
      if (!res) return;
      setCustomer(res.customer);
      if (res.start_date) setStartDate(res.start_date);
      if (res.amount_ht != null) setAmount(String(res.amount_ht));
    });
  }, [open, customer, orderItemId, prepareInvoke]);

  const amountHt = Number(amount.replace(",", "."));
  const customerComplete =
    !!customer &&
    [customer.name, customer.email, customer.address, customer.postal_code, customer.city].every((v) => v.trim());
  const periodValid = !!startDate && !!endDate && endDate > startDate;
  const canSubmit = customerComplete && periodValid && amountHt > 0 && !!contratReference;

  const handleCreate = async () => {
    if (!customer) return;
    const res = await create.invoke({
      action: "create",
      order_item_id: orderItemId,
      start_date: startDate,
      end_date: endDate,
      amount_ht: amountHt,
      vat_rate: vatRate,
      customer,
    });
    if (!res) return;
    refresh();
    if (res.saved) {
      toast({
        title: `Prolongation ${res.contrat_reference} créée`,
        description: `Brouillon Pennylane ${res.invoice_number}, à finaliser dans Pennylane. Générez puis envoyez l'avenant.`,
      });
    } else {
      toastError(toast, `Brouillon ${res.invoice_number} créé, mais la prolongation n'a pas été mise à jour : ${res.update_error}`);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Prolonger la location</DialogTitle>
          <DialogDescription>
            {contratReference
              ? `Avenant au contrat ${contratReference} : facture brouillon Pennylane, puis avenant à faire signer.`
              : "Le contrat d'origine doit être généré avant de pouvoir le prolonger."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="ext-start">Début</Label>
            <Input id="ext-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ext-end">Nouvelle date de fin</Label>
            <Input id="ext-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div style={demoBlur(isDemoMode)}>
            <Label htmlFor="ext-amount">Montant HT (€)</Label>
            <Input
              id="ext-amount"
              inputMode="decimal"
              value={amount /* demo-safe: champ de saisie, conteneur flouté */}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        {startDate && endDate && !periodValid && (
          <p className="text-xs text-destructive">La date de fin doit être postérieure au début.</p>
        )}

        <PennylaneInvoiceFields
          customer={customer}
          loading={prepare.loading}
          source={null}
          sourceNote="Repris de l'adresse de facturation de la commande WooCommerce."
          onCustomerChange={setCustomer}
          vatRate={vatRate}
          onVatRateChange={setVatRate}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleCreate} disabled={create.loading || !canSubmit}>
            {create.loading ? <Spinner className="mr-2" /> : <Receipt className="h-4 w-4 mr-2" />}
            Créer la prolongation et le brouillon Pennylane
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
