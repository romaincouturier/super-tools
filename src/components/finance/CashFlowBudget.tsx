import { useEffect, useMemo, useState } from "react";
import { Plus, Download, Wand2, Briefcase, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { useCashFlowAggregator, type CashFlowMonthRow } from "@/hooks/useCashFlowAggregator";
import { EUR } from "@/components/finance/InvoicesTable";
import { todayAsISO } from "@/lib/dateFormatters";
import CashFlowAddLineDialog from "@/components/finance/CashFlowAddLineDialog";
import CashFlowImportPipelineDialog from "@/components/finance/CashFlowImportPipelineDialog";
import CashFlowImportRecurringDialog from "@/components/finance/CashFlowImportRecurringDialog";

const THRESHOLD_KEY = "supertools.cashflow.threshold";
const DEFAULT_THRESHOLD = 5000;

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

function loadThreshold(): number {
  try {
    const raw = localStorage.getItem(THRESHOLD_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) ? n : DEFAULT_THRESHOLD;
  } catch {
    return DEFAULT_THRESHOLD;
  }
}

function buildCsv(rows: CashFlowMonthRow[]): string {
  const header = ["Mois", "Recettes prévues", "Dépenses prévues", "Recettes réalisées", "Dépenses réalisées", "Écart", "Solde cumulé prévu"];
  const lines = rows.map((r) => [
    r.month,
    r.forecastIncome.toFixed(2),
    r.forecastExpense.toFixed(2),
    r.realizedIncome.toFixed(2),
    r.realizedExpense.toFixed(2),
    r.variance.toFixed(2),
    r.cumulativeForecastBalance.toFixed(2),
  ].join(";"));
  return [header.join(";"), ...lines].join("\n");
}

export default function CashFlowBudget() {
  const aggregation = useCashFlowAggregator();
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [addOpen, setAddOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);

  useEffect(() => {
    setThreshold(loadThreshold());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(THRESHOLD_KEY, String(threshold));
    } catch {
      // localStorage indisponible (mode privé) — on ne persiste pas, pas critique.
    }
  }, [threshold]);

  const monthsBelow = useMemo(
    () => aggregation.rows.filter((r) => r.cumulativeForecastBalance < threshold),
    [aggregation.rows, threshold],
  );

  const handleExport = () => {
    const csv = buildCsv(aggregation.rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cashflow-${todayAsISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Trésorerie prévisionnelle</h2>
          <p className="text-sm text-muted-foreground">
            12 mois glissants. Réalisé synchronisé depuis Pennylane, prévu enrichi via le pipeline CRM et les charges
            récurrentes détectées.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setRecurringOpen(true)}>
            <Wand2 className="h-4 w-4 mr-1" />
            Détecter charges
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPipelineOpen(true)}>
            <Briefcase className="h-4 w-4 mr-1" />
            Importer pipeline
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Ligne prévisionnelle
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExport} disabled={aggregation.rows.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between gap-3">
            <span>Seuil d'alerte trésorerie</span>
            <span className="tabular-nums font-medium">{EUR.format(threshold)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Slider
            min={0}
            max={50000}
            step={500}
            value={[threshold]}
            onValueChange={(v) => setThreshold(v[0])}
          />
          <Label className="text-xs text-muted-foreground">
            Les mois où le solde cumulé prévu passe sous ce seuil seront mis en alerte.
          </Label>
        </CardContent>
      </Card>

      {monthsBelow.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Tension de trésorerie sur {monthsBelow.length} mois</AlertTitle>
          <AlertDescription>
            Le solde cumulé prévu passe sous {EUR.format(threshold)} en{" "}
            {monthsBelow.map((m) => formatMonth(m.month)).join(", ")}.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Budget mensuel</CardTitle>
          <CardDescription>Solde de départ : {EUR.format(aggregation.startingCash)} (banques Pennylane)</CardDescription>
        </CardHeader>
        <CardContent>
          {aggregation.loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 px-3 font-medium">Mois</th>
                    <th className="py-2 px-3 font-medium text-right">Recettes prévues</th>
                    <th className="py-2 px-3 font-medium text-right">Dépenses prévues</th>
                    <th className="py-2 px-3 font-medium text-right">Recettes réalisées</th>
                    <th className="py-2 px-3 font-medium text-right">Dépenses réalisées</th>
                    <th className="py-2 px-3 font-medium text-right">Écart</th>
                    <th className="py-2 px-3 font-medium text-right">Solde cumulé prévu</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregation.rows.map((row) => {
                    const belowThreshold = row.cumulativeForecastBalance < threshold;
                    return (
                      <tr key={row.month} className={`border-b last:border-b-0 ${belowThreshold ? "bg-destructive/5" : ""}`}>
                        <td className="py-2 px-3 font-medium">{formatMonth(row.month)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{EUR.format(row.forecastIncome)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{EUR.format(row.forecastExpense)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-emerald-600">
                          {row.realizedIncome > 0 ? EUR.format(row.realizedIncome) : "—"}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-rose-600">
                          {row.realizedExpense > 0 ? EUR.format(row.realizedExpense) : "—"}
                        </td>
                        <td
                          className={`py-2 px-3 text-right tabular-nums ${
                            row.variance > 0 ? "text-emerald-600" : row.variance < 0 ? "text-rose-600" : ""
                          }`}
                        >
                          {row.realizedIncome + row.realizedExpense > 0 ? EUR.format(row.variance) : "—"}
                        </td>
                        <td className={`py-2 px-3 text-right tabular-nums font-semibold ${belowThreshold ? "text-rose-600" : ""}`}>
                          {EUR.format(row.cumulativeForecastBalance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CashFlowAddLineDialog open={addOpen} onOpenChange={setAddOpen} />
      <CashFlowImportPipelineDialog open={pipelineOpen} onOpenChange={setPipelineOpen} />
      <CashFlowImportRecurringDialog open={recurringOpen} onOpenChange={setRecurringOpen} />
    </div>
  );
}
