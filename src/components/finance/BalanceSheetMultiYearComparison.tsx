import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EUR } from "@/components/finance/InvoicesTable";
import type { BalanceSheetRow } from "@/hooks/useBalanceSheets";
import { useFinancialKPIs, periodCurrentYear } from "@/hooks/useFinancialKPIs";

interface BalanceSheetMultiYearComparisonProps {
  rows: BalanceSheetRow[];
}

interface ComparisonPoint {
  label: string;
  ca: number;
  resultat: number;
  capitauxPropres: number;
  estimated: boolean;
}

interface PassifPoint {
  label: string;
  capitaux_propres: number;
  dettes_lt: number;
  dettes_fournisseurs_ct: number;
  autres_dettes_ct: number;
}

export default function BalanceSheetMultiYearComparison({ rows }: BalanceSheetMultiYearComparisonProps) {
  const period = useMemo(periodCurrentYear, []);
  const pennylane = useFinancialKPIs(period);

  const comparison: ComparisonPoint[] = useMemo(() => {
    const sorted = [...rows].sort((a, b) => a.annee - b.annee);
    const out: ComparisonPoint[] = sorted.map((r) => ({
      label: String(r.annee),
      ca: r.data.compte_resultat.chiffre_affaires,
      resultat: r.data.compte_resultat.resultat_net,
      capitauxPropres: r.data.passif.capitaux_propres,
      estimated: false,
    }));
    const currentYear = new Date().getFullYear();
    const hasCurrentYear = sorted.some((r) => r.annee === currentYear);
    if (!hasCurrentYear && !pennylane.loading) {
      out.push({
        label: `${currentYear} (estimé)`,
        ca: pennylane.revenue.current,
        resultat: pennylane.netResult.current,
        capitauxPropres: 0,
        estimated: true,
      });
    }
    return out;
  }, [rows, pennylane]);

  const passifBreakdown: PassifPoint[] = useMemo(() => {
    return [...rows]
      .sort((a, b) => a.annee - b.annee)
      .map((r) => ({
        label: String(r.annee),
        capitaux_propres: r.data.passif.capitaux_propres,
        dettes_lt: r.data.passif.dettes_financieres_long_terme,
        dettes_fournisseurs_ct: r.data.passif.dettes_fournisseurs_court_terme,
        autres_dettes_ct:
          r.data.passif.dettes_financieres_court_terme +
          r.data.passif.dettes_fiscales_sociales_court_terme +
          r.data.passif.autres_dettes_court_terme,
      }));
  }, [rows]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Évolution multi-années</CardTitle>
          <CardDescription>
            Comparaison CA, résultat net et capitaux propres. L'année en cours est estimée à partir de Pennylane si
            aucun bilan n'est disponible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {comparison.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucune donnée à comparer.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={comparison} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip formatter={(v: number) => EUR.format(v)} />
                <Legend />
                <Bar dataKey="ca" name="Chiffre d'affaires" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar
                  dataKey="resultat"
                  name="Résultat net"
                  fill="hsl(var(--muted-foreground))"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="capitauxPropres"
                  name="Capitaux propres"
                  fill="hsl(var(--accent-foreground))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Structure du passif</CardTitle>
          <CardDescription>Décomposition des sources de financement par année.</CardDescription>
        </CardHeader>
        <CardContent>
          {passifBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucun bilan disponible.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={passifBreakdown} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip formatter={(v: number) => EUR.format(v)} />
                <Legend />
                <Bar
                  dataKey="capitaux_propres"
                  stackId="passif"
                  name="Capitaux propres"
                  fill="hsl(var(--primary))"
                />
                <Bar dataKey="dettes_lt" stackId="passif" name="Dettes LT" fill="hsl(var(--accent-foreground))" />
                <Bar
                  dataKey="dettes_fournisseurs_ct"
                  stackId="passif"
                  name="Dettes fournisseurs CT"
                  fill="hsl(var(--muted-foreground))"
                />
                <Bar dataKey="autres_dettes_ct" stackId="passif" name="Autres dettes CT" fill="hsl(var(--destructive))" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
