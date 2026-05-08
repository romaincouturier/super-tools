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
import { useCrmPipelineForecast, type CrmPipelineDeal } from "@/hooks/useCrmPipelineForecast";
import { useCreateForecastLinesBatch } from "@/hooks/useCashFlowForecast";
import { EUR } from "@/components/finance/InvoicesTable";

interface ImportPipelineProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function monthFloor(dateISO: string): string {
  return `${dateISO.slice(0, 7)}-01`;
}

export default function CashFlowImportPipelineDialog({ open, onOpenChange }: ImportPipelineProps) {
  const { toast } = useToast();
  const pipelineQ = useCrmPipelineForecast();
  const batch = useCreateForecastLinesBatch();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const deals = useMemo<CrmPipelineDeal[]>(() => pipelineQ.data ?? [], [pipelineQ.data]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    const picked = deals.filter((d) => selected.has(d.id));
    if (picked.length === 0) return;
    try {
      await batch.mutateAsync(
        picked.map((d) => ({
          month: monthFloor(d.expected_close_date),
          category: d.company ? `${d.title} (${d.company})` : d.title,
          amount: d.estimated_value,
          type: "income" as const,
          source: "crm_deal" as const,
          source_ref: d.id,
        })),
      );
      toast({ title: `${picked.length} ligne(s) importée(s) du pipeline CRM` });
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
          <DialogTitle>Importer le pipeline CRM</DialogTitle>
          <DialogDescription>
            Sélectionne les opportunités à intégrer en recettes prévisionnelles. Seules les cartes ouvertes avec une
            date de closing prévue sont listées.
          </DialogDescription>
        </DialogHeader>

        {pipelineQ.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : deals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Aucune opportunité avec une date de closing prévue. Renseigne <code>expected_close_date</code> sur tes
            cartes CRM ouvertes.
          </p>
        ) : (
          <div className="space-y-2">
            {deals.map((deal) => (
              <label
                key={deal.id}
                className="flex items-center gap-3 p-3 rounded-md border hover:bg-muted/30 cursor-pointer"
              >
                <Checkbox checked={selected.has(deal.id)} onCheckedChange={() => toggle(deal.id)} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{deal.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {deal.company ? `${deal.company} • ` : ""}closing prévu {deal.expected_close_date}
                  </div>
                </div>
                <div className="text-sm font-semibold tabular-nums">{EUR.format(deal.estimated_value)}</div>
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
            Importer ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
