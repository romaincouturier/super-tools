import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useCreateForecastLine, type CashFlowType } from "@/hooks/useCashFlowForecast";

interface CashFlowAddLineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMonth?: string;
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function CashFlowAddLineDialog({ open, onOpenChange, defaultMonth }: CashFlowAddLineDialogProps) {
  const { toast } = useToast();
  const create = useCreateForecastLine();
  const [month, setMonth] = useState<string>(defaultMonth ?? firstOfMonth());
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [type, setType] = useState<CashFlowType>("income");
  const [isRecurring, setIsRecurring] = useState(false);
  const [notes, setNotes] = useState("");

  const handleSave = async () => {
    const parsed = parseFloat(amount.replace(",", "."));
    if (!category.trim() || !Number.isFinite(parsed) || parsed <= 0) return;
    try {
      await create.mutateAsync({
        month,
        category: category.trim(),
        amount: parsed,
        type,
        is_recurring: isRecurring,
        notes: notes.trim() || null,
      });
      toast({ title: "Ligne ajoutée" });
      setCategory("");
      setAmount("");
      setNotes("");
      setIsRecurring(false);
      onOpenChange(false);
    } catch (err) {
      toastError(toast, err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une ligne prévisionnelle</DialogTitle>
          <DialogDescription>Cette ligne sera intégrée au budget de trésorerie.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cf-month">Mois</Label>
            <Input id="cf-month" type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(`${e.target.value}-01`)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-category">Catégorie</Label>
            <Input
              id="cf-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex : Salaires, Loyer, Mission X"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-amount">Montant</Label>
            <Input
              id="cf-amount"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <RadioGroup value={type} onValueChange={(v) => setType(v as CashFlowType)} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="income" id="cf-income" />
                <Label htmlFor="cf-income">Recette</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="expense" id="cf-expense" />
                <Label htmlFor="cf-expense">Dépense</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="cf-recurring">Récurrent (mensuel)</Label>
            <Switch id="cf-recurring" checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-notes">Notes</Label>
            <Textarea id="cf-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={create.isPending || !category.trim() || !amount}>
            {create.isPending ? <Spinner className="mr-2" /> : null}
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
