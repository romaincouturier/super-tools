import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EUR } from "@/components/finance/InvoicesTable";
import type { BreakEvenScenario } from "@/hooks/useBreakEvenScenarios";

export interface BreakEvenComputed {
  pointMortRevenue: number;
  monthlyMargin: number;
}

interface BreakEvenScenarioListProps {
  scenarios: BreakEvenScenario[];
  loading: boolean;
  comparedIds: string[];
  computeForScenario: (s: BreakEvenScenario) => BreakEvenComputed;
  onLoad: (s: BreakEvenScenario) => void;
  onToggleCompare: (id: string) => void;
  onRename: (s: BreakEvenScenario) => void;
  onDelete: (s: BreakEvenScenario) => void;
}

export default function BreakEvenScenarioList({
  scenarios,
  loading,
  comparedIds,
  computeForScenario,
  onLoad,
  onToggleCompare,
  onRename,
  onDelete,
}: BreakEvenScenarioListProps) {
  const compared = scenarios.filter((s) => comparedIds.includes(s.id));

  if (loading) return <Spinner />;
  if (scenarios.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Aucun scénario enregistré.</p>;
  }

  return (
    <>
      <div className="space-y-2">
        {scenarios.map((s) => {
          const isCompared = comparedIds.includes(s.id);
          const m = computeForScenario(s);
          return (
            <div
              key={s.id}
              className={`flex items-center justify-between p-3 rounded-md border ${
                isCompared ? "border-primary bg-primary/5" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{s.name}</div>
                <div className="text-xs text-muted-foreground">
                  Point mort : {Number.isFinite(m.pointMortRevenue) ? EUR.format(m.pointMortRevenue) : "—"} • Marge :{" "}
                  {EUR.format(m.monthlyMargin)}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-3">
                <Button size="sm" variant="ghost" onClick={() => onLoad(s)}>
                  Charger
                </Button>
                <Button
                  size="sm"
                  variant={isCompared ? "default" : "outline"}
                  onClick={() => onToggleCompare(s.id)}
                >
                  {isCompared ? "Comparé" : "Comparer"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onRename(s)} title="Renommer">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(s)} title="Supprimer">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {compared.length === 2 && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {compared.map((s) => {
            const m = computeForScenario(s);
            return (
              <Card key={s.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{s.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs">
                  <div>Charges fixes : {EUR.format(Number(s.fixed_costs))}</div>
                  <div>Taux variable : {Math.round(Number(s.variable_cost_rate) * 100)}%</div>
                  <div>Prix moyen : {EUR.format(Number(s.avg_unit_price))}</div>
                  <div>Volume / mois : {Number(s.monthly_units)}</div>
                  <div className="pt-1 border-t">
                    <span className="text-muted-foreground">Point mort : </span>
                    <strong>
                      {Number.isFinite(m.pointMortRevenue) ? EUR.format(m.pointMortRevenue) : "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Marge : </span>
                    <strong className={m.monthlyMargin >= 0 ? "text-emerald-600" : "text-rose-600"}>
                      {EUR.format(m.monthlyMargin)}
                    </strong>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
