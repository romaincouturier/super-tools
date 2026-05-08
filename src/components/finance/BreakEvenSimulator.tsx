import { useMemo, useState } from "react";
import {
  Line,
  LineChart,
  CartesianGrid,
  ReferenceDot,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { Save, Wand2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import { toastError } from "@/lib/toastError";
import {
  useBreakEvenScenarios,
  useSaveBreakEvenScenario,
  useDeleteBreakEvenScenario,
  useDetectedFixedCosts,
  type BreakEvenScenario,
} from "@/hooks/useBreakEvenScenarios";
import { EUR } from "@/components/finance/InvoicesTable";
import BreakEvenScenarioList from "@/components/finance/BreakEvenScenarioList";
import BreakEvenSaveDialog from "@/components/finance/BreakEvenSaveDialog";
import { SliderField, Metric } from "@/components/finance/BreakEvenControls";

interface SimulatorState {
  fixedCosts: number;
  variableCostRate: number;
  avgUnitPrice: number;
  monthlyUnits: number;
}

function computeMetrics(s: SimulatorState) {
  const monthlyRevenue = s.avgUnitPrice * s.monthlyUnits;
  const yearlyRevenue = monthlyRevenue * 12;
  const denominator = 1 - s.variableCostRate;
  const pointMortRevenue = denominator > 0 ? s.fixedCosts / denominator : Infinity;
  const pointMortUnits = s.avgUnitPrice > 0 ? pointMortRevenue / s.avgUnitPrice : Infinity;
  const daysToBreakEven =
    yearlyRevenue > 0 && Number.isFinite(pointMortRevenue) ? (pointMortRevenue * 12 / yearlyRevenue) * 30 : Infinity;
  const monthlyMargin = monthlyRevenue * (1 - s.variableCostRate) - s.fixedCosts;
  const marginRate = 1 - s.variableCostRate;
  return { pointMortRevenue, pointMortUnits, monthlyRevenue, monthlyMargin, yearlyRevenue, daysToBreakEven, marginRate };
}

function buildChartData(s: SimulatorState, max: number) {
  const steps = 24;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const revenue = (max * i) / steps;
    const charges = s.fixedCosts + revenue * s.variableCostRate;
    points.push({ revenue: Math.round(revenue), ca: Math.round(revenue), charges: Math.round(charges) });
  }
  return points;
}

function scenarioToState(s: BreakEvenScenario): SimulatorState {
  return {
    fixedCosts: Number(s.fixed_costs),
    variableCostRate: Number(s.variable_cost_rate),
    avgUnitPrice: Number(s.avg_unit_price),
    monthlyUnits: Number(s.monthly_units),
  };
}

const DEFAULT_STATE: SimulatorState = {
  fixedCosts: 3000,
  variableCostRate: 0.3,
  avgUnitPrice: 1500,
  monthlyUnits: 4,
};

export default function BreakEvenSimulator() {
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const detected = useDetectedFixedCosts();
  const scenariosQuery = useBreakEvenScenarios();
  const saveScenario = useSaveBreakEvenScenario();
  const deleteScenario = useDeleteBreakEvenScenario();

  const [state, setState] = useState<SimulatorState>(DEFAULT_STATE);
  const [autoDetected, setAutoDetected] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const [scenarioNotes, setScenarioNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [comparedIds, setComparedIds] = useState<string[]>([]);

  const metrics = useMemo(() => computeMetrics(state), [state]);
  const chartMax = useMemo(() => {
    const target = Math.max(metrics.pointMortRevenue * 1.5, metrics.monthlyRevenue * 2, 10000);
    return Number.isFinite(target) ? target : metrics.monthlyRevenue * 2 || 50000;
  }, [metrics]);
  const chartData = useMemo(() => buildChartData(state, chartMax), [state, chartMax]);
  const scenarios = scenariosQuery.data ?? [];

  const applyDetectedFixedCosts = () => {
    if (detected.totalMonthly > 0) {
      setState((prev) => ({ ...prev, fixedCosts: Math.round(detected.totalMonthly) }));
      setAutoDetected(true);
    }
  };

  const startSave = (scenario?: BreakEvenScenario) => {
    if (scenario) {
      setEditingId(scenario.id);
      setScenarioName(scenario.name);
      setScenarioNotes(scenario.notes ?? "");
    } else {
      setEditingId(null);
      setScenarioName("");
      setScenarioNotes("");
    }
    setSaveDialogOpen(true);
  };

  const handleSave = async () => {
    if (!scenarioName.trim()) return;
    try {
      await saveScenario.mutateAsync({
        id: editingId ?? undefined,
        name: scenarioName.trim(),
        fixed_costs: state.fixedCosts,
        variable_cost_rate: state.variableCostRate,
        avg_unit_price: state.avgUnitPrice,
        monthly_units: state.monthlyUnits,
        notes: scenarioNotes.trim() || null,
      });
      toast({ title: "Scénario enregistré" });
      setSaveDialogOpen(false);
    } catch (err) {
      toastError(toast, err);
    }
  };

  const handleLoad = (scenario: BreakEvenScenario) => {
    setState(scenarioToState(scenario));
    setAutoDetected(false);
  };

  const handleDelete = async (scenario: BreakEvenScenario) => {
    const ok = await confirm({
      title: "Supprimer ce scénario ?",
      description: `Le scénario « ${scenario.name} » sera définitivement supprimé.`,
      confirmText: "Supprimer",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteScenario.mutateAsync(scenario.id);
      setComparedIds((ids) => ids.filter((i) => i !== scenario.id));
      toast({ title: "Scénario supprimé" });
    } catch (err) {
      toastError(toast, err);
    }
  };

  const toggleCompare = (id: string) => {
    setComparedIds((ids) => {
      if (ids.includes(id)) return ids.filter((i) => i !== id);
      if (ids.length >= 2) return [ids[1], id];
      return [...ids, id];
    });
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Paramètres</CardTitle>
            <CardDescription>Ajuste les leviers pour visualiser ton point mort en temps réel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SliderField
              label="Charges fixes mensuelles"
              value={state.fixedCosts}
              suffix={EUR.format(state.fixedCosts)}
              min={0}
              max={Math.max(20000, Math.round(detected.totalMonthly * 2) || 20000)}
              step={50}
              onChange={(v) => {
                setState((s) => ({ ...s, fixedCosts: v }));
                setAutoDetected(false);
              }}
              badge={
                autoDetected ? (
                  <Badge variant="secondary">auto-détecté</Badge>
                ) : (
                  <Badge variant="outline">manuel</Badge>
                )
              }
              action={
                detected.totalMonthly > 0 && !autoDetected ? (
                  <Button size="sm" variant="ghost" onClick={applyDetectedFixedCosts}>
                    <Wand2 className="h-3.5 w-3.5 mr-1" />
                    Détecter ({EUR.format(detected.totalMonthly)})
                  </Button>
                ) : null
              }
            />
            <SliderField
              label="Taux de charges variables"
              value={Math.round(state.variableCostRate * 100)}
              suffix={`${Math.round(state.variableCostRate * 100)} %`}
              min={0}
              max={95}
              step={1}
              onChange={(v) => setState((s) => ({ ...s, variableCostRate: v / 100 }))}
            />
            <SliderField
              label="Prix moyen d'une prestation"
              value={state.avgUnitPrice}
              suffix={EUR.format(state.avgUnitPrice)}
              min={0}
              max={10000}
              step={50}
              onChange={(v) => setState((s) => ({ ...s, avgUnitPrice: v }))}
            />
            <SliderField
              label="Nombre de prestations / mois"
              value={state.monthlyUnits}
              suffix={`${state.monthlyUnits}`}
              min={0}
              max={50}
              step={1}
              onChange={(v) => setState((s) => ({ ...s, monthlyUnits: v }))}
            />

            {detected.loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner /> Détection des charges fixes en cours...
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Résultat</CardTitle>
            <CardDescription>Calcul instantané basé sur les paramètres.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Metric
              label="Point mort (CA)"
              value={Number.isFinite(metrics.pointMortRevenue) ? EUR.format(metrics.pointMortRevenue) : "—"}
              hint="CA mensuel à atteindre pour couvrir les charges"
            />
            <Metric
              label="Point mort (prestations)"
              value={Number.isFinite(metrics.pointMortUnits) ? metrics.pointMortUnits.toFixed(1) : "—"}
              hint="Nombre de prestations / mois"
            />
            <Metric
              label="Marge mensuelle actuelle"
              value={EUR.format(metrics.monthlyMargin)}
              tone={metrics.monthlyMargin >= 0 ? "positive" : "negative"}
            />
            <Metric label="Taux de marge sur coût variable" value={`${Math.round(metrics.marginRate * 100)} %`} />
            {Number.isFinite(metrics.daysToBreakEven) && metrics.daysToBreakEven > 0 ? (
              <Alert>
                <AlertTitle className="text-sm">Au rythme actuel</AlertTitle>
                <AlertDescription className="text-xs">
                  Tu atteins ton point mort vers le{" "}
                  <strong>
                    {new Date(new Date().getFullYear(), 0, Math.round(metrics.daysToBreakEven)).toLocaleDateString(
                      "fr-FR",
                      { day: "numeric", month: "long" },
                    )}
                  </strong>
                  .
                </AlertDescription>
              </Alert>
            ) : null}
            <Button className="w-full" onClick={() => startSave()}>
              <Save className="h-4 w-4 mr-2" />
              Sauvegarder ce scénario
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visualisation</CardTitle>
          <CardDescription>Le point d'intersection des courbes correspond au point mort.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="revenue"
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(v: number) => EUR.format(v)}
                labelFormatter={(v) => `CA mensuel : ${EUR.format(Number(v))}`}
              />
              <Legend />
              <Line type="monotone" dataKey="ca" name="Chiffre d'affaires" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="charges" name="Charges totales" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              {Number.isFinite(metrics.pointMortRevenue) && (
                <ReferenceDot
                  x={Math.round(metrics.pointMortRevenue)}
                  y={Math.round(metrics.pointMortRevenue)}
                  r={6}
                  fill="hsl(var(--primary))"
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                  label={{ value: "Point mort", position: "top", fontSize: 11 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scénarios sauvegardés</CardTitle>
          <CardDescription>Sélectionne jusqu'à 2 scénarios pour les comparer côte à côte.</CardDescription>
        </CardHeader>
        <CardContent>
          <BreakEvenScenarioList
            scenarios={scenarios}
            loading={scenariosQuery.isLoading}
            comparedIds={comparedIds}
            computeForScenario={(s) => {
              const m = computeMetrics(scenarioToState(s));
              return { pointMortRevenue: m.pointMortRevenue, monthlyMargin: m.monthlyMargin };
            }}
            onLoad={handleLoad}
            onToggleCompare={toggleCompare}
            onRename={startSave}
            onDelete={handleDelete}
          />
        </CardContent>
      </Card>

      <BreakEvenSaveDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        isEditing={editingId !== null}
        name={scenarioName}
        notes={scenarioNotes}
        onNameChange={setScenarioName}
        onNotesChange={setScenarioNotes}
        onSave={handleSave}
        saving={saveScenario.isPending}
      />
    </div>
  );
}

