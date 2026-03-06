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
import { Plus, Trash2, Calculator, Car } from "lucide-react";
import TravelExpenseCalculator, {
  TravelDestination,
  TravelSettings,
} from "./TravelExpenseCalculator";

export interface PricingLine {
  id: string;
  label: string;
  tjm: number;
  quantity: number;
  travelCost: number;
  suppliesCost: number;
}

interface MacroPricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue: number;
  onConfirm: (total: number, lines: PricingLine[], travelTotal: number) => void;
  initialLines?: PricingLine[];
  initialTravelTotal?: number;
}

let lineCounter = 0;
const createId = () => `line_${Date.now()}_${++lineCounter}`;

const emptyLine = (): PricingLine => ({
  id: createId(),
  label: "",
  tjm: 0,
  quantity: 1,
  travelCost: 0,
  suppliesCost: 0,
});

const formatEur = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const MacroPricingDialog = ({
  open,
  onOpenChange,
  initialValue,
  onConfirm,
  initialLines,
  initialTravelTotal,
}: MacroPricingDialogProps) => {
  const [lines, setLines] = useState<PricingLine[]>([]);
  const [showTravelCalc, setShowTravelCalc] = useState(false);
  const [travelTotal, setTravelTotal] = useState(0);
  const [travelDestinations, setTravelDestinations] = useState<TravelDestination[]>([]);
  const [travelSettings, setTravelSettings] = useState<TravelSettings | undefined>();

  useEffect(() => {
    if (open) {
      if (initialLines && initialLines.length > 0) {
        setLines(initialLines);
      } else if (initialValue > 0) {
        setLines([{ ...emptyLine(), label: "Prestation", tjm: initialValue, quantity: 1 }]);
      } else {
        setLines([emptyLine()]);
      }
      setTravelTotal(initialTravelTotal ?? 0);
    }
  }, [open, initialLines, initialValue, initialTravelTotal]);

  const updateLine = (id: string, field: keyof PricingLine, value: string | number) => {
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [field]: value } : line))
    );
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (id: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
  };

  const lineTotal = (line: PricingLine) =>
    line.tjm * line.quantity + line.travelCost + line.suppliesCost;

  const linesTotal = useMemo(
    () => lines.reduce((sum, l) => sum + lineTotal(l), 0),
    [lines]
  );

  const grandTotal = linesTotal + travelTotal;

  const handleConfirm = () => {
    onConfirm(grandTotal, lines, travelTotal);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
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
            <div className="grid grid-cols-[1fr_90px_60px_90px_90px_80px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>Intitulé</span>
              <span className="text-right">TJM (€)</span>
              <span className="text-right">Qté (j)</span>
              <span className="text-right">Déplac. (€)</span>
              <span className="text-right">Fourn. (€)</span>
              <span className="text-right">Total</span>
              <span />
            </div>

            {/* Lines */}
            {lines.map((line) => (
              <div
                key={line.id}
                className="grid grid-cols-[1fr_90px_60px_90px_90px_80px_32px] gap-2 items-center"
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
                <Input
                  type="number"
                  min="0"
                  value={line.suppliesCost || ""}
                  onChange={(e) => updateLine(line.id, "suppliesCost", parseFloat(e.target.value) || 0)}
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

            {/* Travel calculator row */}
            <div className="border-t pt-3 mt-2">
              <div className="grid grid-cols-[1fr_90px_60px_90px_90px_80px_32px] gap-2 items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start text-xs text-violet-600 hover:text-violet-700 px-1 h-8"
                  onClick={() => setShowTravelCalc(true)}
                >
                  <Car className="h-3.5 w-3.5 mr-1.5" />
                  {travelTotal > 0 ? "Modifier le calcul déplacements" : "Calculer les frais de déplacement"}
                </Button>
                <span />
                <span />
                <span />
                <span />
                <div className="text-sm font-medium text-right pr-1 text-violet-600">
                  {travelTotal > 0 ? `${formatEur(travelTotal)} €` : "—"}
                </div>
                {travelTotal > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      setTravelTotal(0);
                      setTravelDestinations([]);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                {!travelTotal && <span />}
              </div>
            </div>

            {/* Grand Total */}
            <div className="border-t pt-3">
              <div className="grid grid-cols-[1fr_90px_60px_90px_90px_80px_32px] gap-2 items-center">
                <span className="text-sm font-semibold">Total</span>
                <span />
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

      {/* Travel calculator sub-dialog */}
      <TravelExpenseCalculator
        open={showTravelCalc}
        onOpenChange={setShowTravelCalc}
        initialDestinations={travelDestinations.length > 0 ? travelDestinations : undefined}
        initialSettings={travelSettings}
        onConfirm={(total, destinations, settings) => {
          setTravelTotal(total);
          setTravelDestinations(destinations);
          setTravelSettings(settings);
        }}
      />
    </>
  );
};

export default MacroPricingDialog;
