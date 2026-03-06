import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Calculator } from "lucide-react";

export interface PricingLine {
  id: string;
  label: string;
  tjm: number;
  quantity: number;
  travelCost: number;
}

interface MacroPricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue: number;
  onConfirm: (total: number, lines: PricingLine[]) => void;
  initialLines?: PricingLine[];
}

let lineCounter = 0;
const createId = () => `line_${Date.now()}_${++lineCounter}`;

const emptyLine = (): PricingLine => ({
  id: createId(),
  label: "",
  tjm: 0,
  quantity: 1,
  travelCost: 0,
});

const MacroPricingDialog = ({
  open,
  onOpenChange,
  initialValue,
  onConfirm,
  initialLines,
}: MacroPricingDialogProps) => {
  const [lines, setLines] = useState<PricingLine[]>([]);

  useEffect(() => {
    if (open) {
      if (initialLines && initialLines.length > 0) {
        setLines(initialLines);
      } else if (initialValue > 0) {
        setLines([{ ...emptyLine(), label: "Prestation", tjm: initialValue, quantity: 1 }]);
      } else {
        setLines([emptyLine()]);
      }
    }
  }, [open, initialLines, initialValue]);

  const updateLine = (id: string, field: keyof PricingLine, value: string | number) => {
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [field]: value } : line))
    );
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (id: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
  };

  const lineTotal = (line: PricingLine) => line.tjm * line.quantity + line.travelCost;

  const grandTotal = useMemo(
    () => lines.reduce((sum, l) => sum + lineTotal(l), 0),
    [lines]
  );

  const handleConfirm = () => {
    onConfirm(grandTotal, lines);
    onOpenChange(false);
  };

  const formatEur = (n: number) =>
    n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Macro chiffrage
          </DialogTitle>
          <DialogDescription>
            Détaillez les lignes de chiffrage pour estimer la valeur de l'opportunité.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[1fr_100px_70px_100px_90px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
            <span>Intitulé</span>
            <span className="text-right">TJM (€)</span>
            <span className="text-right">Qté (j)</span>
            <span className="text-right">Déplacement (€)</span>
            <span className="text-right">Total</span>
            <span />
          </div>

          {/* Lines */}
          {lines.map((line) => (
            <div
              key={line.id}
              className="grid grid-cols-[1fr_100px_70px_100px_90px_32px] gap-2 items-center"
            >
              <Input
                value={line.label}
                onChange={(e) => updateLine(line.id, "label", e.target.value)}
                placeholder="Ex: Animation formation"
                className="h-8 text-sm"
              />
              <Input
                type="number"
                min="0"
                value={line.tjm || ""}
                onChange={(e) => updateLine(line.id, "tjm", parseFloat(e.target.value) || 0)}
                className="h-8 text-sm text-right"
              />
              <Input
                type="number"
                min="0"
                step="0.5"
                value={line.quantity || ""}
                onChange={(e) => updateLine(line.id, "quantity", parseFloat(e.target.value) || 0)}
                className="h-8 text-sm text-right"
              />
              <Input
                type="number"
                min="0"
                value={line.travelCost || ""}
                onChange={(e) => updateLine(line.id, "travelCost", parseFloat(e.target.value) || 0)}
                className="h-8 text-sm text-right"
              />
              <div className="text-sm font-medium text-right pr-1">
                {formatEur(lineTotal(line))} €
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeLine(line.id)}
                disabled={lines.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          {/* Add line */}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={addLine}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Ajouter une ligne
          </Button>

          {/* Total */}
          <div className="border-t pt-3 mt-2">
            <div className="grid grid-cols-[1fr_100px_70px_100px_90px_32px] gap-2 items-center">
              <span className="text-sm font-semibold">Total</span>
              <span />
              <span />
              <span />
              <div className="text-sm font-bold text-right pr-1 text-green-700">
                {formatEur(grandTotal)} €
              </div>
              <span />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleConfirm}>
            Appliquer comme valeur estimée
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MacroPricingDialog;
