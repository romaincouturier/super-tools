import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  useRecurringExpenseDetection,
  type RecurringExpenseCandidate,
} from "@/hooks/useRecurringExpenseDetection";
import { useCreateForecastLinesBatch } from "@/hooks/useCashFlowForecast";
import { EUR } from "@/components/finance/InvoicesTable";

interface ImportRecurringProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function buildNext12Months(): string[] {
  const today = new Date();
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  }
  return months;
}

export default function CashFlowImportRecurringDialog({ open, onOpenChange }: ImportRecurringProps) {
  const { toast } = useToast();
  const { loading, candidates } = useRecurringExpenseDetection();
  const batch = useCreateForecastLinesBatch();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const next12Months = useMemo(buildNext12Months, []);

  const handleImport = async () => {
    const picked: RecurringExpenseCandidate[] = candidates.filter((c) => selected.has(c.supplierName));
    if (picked.length === 0) return;
    try {
      const lines = picked.flatMap((c) =>
        next12Months.map((month) => ({
          month,
          category: c.supplierName,
          amount: Math.round(c.avgAmount * 100) / 100,
          type: "expense" as const,
          is_recurring: true,
          source: "recurring_detected" as const,
          notes: `Détecté depuis ${c.occurrences} factures Pennylane`,
        })),
      );
      await batch.mutateAsync(lines);
      toast({ title: `${picked.length} charge(s) projetée(s) sur 12 mois` });
      setSelected(new Set());
      onOpenChange(false);
    } catch (err) {
      toastError(toast, err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Détecter les charges récurrentes</DialogTitle>
          <DialogDescription>
            Fournisseurs facturés ≥ 3 fois sur 12 mois avec moins de 10% d'écart de montant. Les lignes
            sélectionnées seront projetées sur les 12 prochains mois.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Aucune charge récurrente détectée.</p>
        ) : (
          <div className="space-y-2">
            {candidates.map((c) => (
              <label
                key={c.supplierName}
                className="flex items-center gap-3 p-3 rounded-md border hover:bg-muted/30 cursor-pointer"
              >
                <Checkbox checked={selected.has(c.supplierName)} onCheckedChange={() => toggle(c.supplierName)} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{c.supplierName}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.occurrences} factures sur 12 mois • dernière le {c.lastDate}
                  </div>
                </div>
                <div className="text-sm font-semibold tabular-nums">{EUR.format(c.avgAmount)} / mois</div>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleImport} disabled={selected.size === 0 || batch.isPending}>
            {batch.isPending ? <Spinner className="mr-2" /> : null}
            Projeter ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
