import { useState, useMemo } from "react";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  BarChart3,
  CalendarDays,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useCrmReports, type CrmReportFilters } from "@/hooks/crm/useCrmReports";
import ModuleLayout from "@/components/ModuleLayout";
import { format, startOfYear, startOfQuarter, startOfMonth, endOfMonth, endOfQuarter, endOfYear } from "date-fns";
import { fr } from "date-fns/locale";
import type { CrmTag } from "@/types/crm";

// ── Period helpers ──────────────────────────────────────────

type PeriodPreset = "year" | "quarter" | "month" | "custom";

function getPresetDates(preset: PeriodPreset, now: Date): { start: string; end: string } | null {
  if (preset === "custom") return null;
  if (preset === "year") return { start: format(startOfYear(now), "yyyy-MM-dd"), end: format(endOfYear(now), "yyyy-MM-dd") };
  if (preset === "quarter") return { start: format(startOfQuarter(now), "yyyy-MM-dd"), end: format(endOfQuarter(now), "yyyy-MM-dd") };
  return { start: format(startOfMonth(now), "yyyy-MM-dd"), end: format(endOfMonth(now), "yyyy-MM-dd") };
}

const fmt = (v: number) => v.toLocaleString("fr-FR");

// ── Page ────────────────────────────────────────────────────

const CrmReports = () => {
  const [preset, setPreset] = useState<PeriodPreset>("year");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();

  const filters: CrmReportFilters = useMemo(() => {
    if (preset === "custom") {
      return {
        startDate: customStart ? format(customStart, "yyyy-MM-dd") : null,
        endDate: customEnd ? format(customEnd, "yyyy-MM-dd") : null,
      };
    }
    const dates = getPresetDates(preset, new Date());
    return { startDate: dates?.start ?? null, endDate: dates?.end ?? null };
  }, [preset, customStart, customEnd]);

  const { data: reports, isLoading } = useCrmReports(filters);

  if (isLoading) {
    return (
      <ModuleLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </ModuleLayout>
    );
  }

  if (!reports) {
    return (
      <ModuleLayout>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Aucune donnée disponible</p>
        </div>
      </ModuleLayout>
    );
  }

  const winRate =
    reports.wonCount + reports.lostCount > 0
      ? Math.round((reports.wonCount / (reports.wonCount + reports.lostCount)) * 100)
      : 0;

  return (
    <ModuleLayout>
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        <PageHeader
          icon={BarChart3}
          title="Reporting CRM"
          subtitle="Statistiques du pipeline commercial"
          backTo="/crm"
          actions={<PeriodSelector preset={preset} onPresetChange={setPreset} customStart={customStart} customEnd={customEnd} onCustomStartChange={setCustomStart} onCustomEndChange={setCustomEnd} />}
        />

        {/* KPIs — value-first layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard
            title="Pipeline ouvert"
            icon={<Target className="h-4 w-4 text-muted-foreground" />}
            mainValue={`${fmt(reports.openValue)} €`}
            secondary={`${reports.openCount} opportunité${reports.openCount > 1 ? "s" : ""}`}
          />
          <KpiCard
            title="Pipeline pondéré"
            icon={<DollarSign className="h-4 w-4 text-amber-600" />}
            mainValue={`${fmt(Math.round(reports.weightedPipeline))} €`}
            secondary="confiance × valeur"
            mainColor="text-amber-600"
          />
          <KpiCard
            title="Gagné"
            icon={<TrendingUp className="h-4 w-4 text-green-600" />}
            mainValue={`${fmt(reports.wonValue)} €`}
            secondary={`${reports.wonCount} vente${reports.wonCount > 1 ? "s" : ""}`}
            mainColor="text-green-600"
          />
          <KpiCard
            title="Perdu"
            icon={<TrendingDown className="h-4 w-4 text-red-600" />}
            mainValue={`${fmt(reports.lostValue)} €`}
            secondary={`${reports.lostCount} opportunité${reports.lostCount > 1 ? "s" : ""}`}
            mainColor="text-red-600"
          />
          <KpiCard
            title="Taux de conversion"
            icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
            mainValue={`${winRate}%`}
            secondary={`sur ${reports.wonCount + reports.lostCount} clôturée${reports.wonCount + reports.lostCount > 1 ? "s" : ""}`}
          />
        </div>

        {/* Pivot table */}
        {reports.categories.length >= 2 && (
          <PivotTable
            cardsWithTags={reports.cardsWithTags}
            categories={reports.categories}
          />
        )}

        {reports.categories.length < 2 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              Le tableau croisé nécessite au moins 2 catégories de tags pour fonctionner.
              Ajoutez des catégories dans les paramètres CRM.
            </CardContent>
          </Card>
        )}
      </main>
    </ModuleLayout>
  );
};

// ── KPI Card ────────────────────────────────────────────────

function KpiCard({
  title,
  icon,
  mainValue,
  secondary,
  mainColor,
}: {
  title: string;
  icon: React.ReactNode;
  mainValue: string;
  secondary: string;
  mainColor?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${mainColor ?? ""}`}>{mainValue}</div>
        <p className="text-xs text-muted-foreground">{secondary}</p>
      </CardContent>
    </Card>
  );
}

// ── Period Selector ─────────────────────────────────────────

function PeriodSelector({
  preset,
  onPresetChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}: {
  preset: PeriodPreset;
  onPresetChange: (p: PeriodPreset) => void;
  customStart?: Date;
  customEnd?: Date;
  onCustomStartChange: (d: Date | undefined) => void;
  onCustomEndChange: (d: Date | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={preset} onValueChange={(v) => onPresetChange(v as PeriodPreset)}>
        <SelectTrigger className="w-36 h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="year">Cette année</SelectItem>
          <SelectItem value="quarter">Ce trimestre</SelectItem>
          <SelectItem value="month">Ce mois</SelectItem>
          <SelectItem value="custom">Personnalisé</SelectItem>
        </SelectContent>
      </Select>

      {preset === "custom" && (
        <>
          <DatePickerButton label="Début" date={customStart} onChange={onCustomStartChange} />
          <DatePickerButton label="Fin" date={customEnd} onChange={onCustomEndChange} />
        </>
      )}
    </div>
  );
}

function DatePickerButton({
  label,
  date,
  onChange,
}: {
  label: string;
  date?: Date;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-sm h-9">
          <CalendarDays className="h-3.5 w-3.5" />
          {date ? format(date, "d MMM yyyy", { locale: fr }) : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onChange} locale={fr} />
      </PopoverContent>
    </Popover>
  );
}

// ── Pivot Table ─────────────────────────────────────────────

interface CardWithTags {
  id: string;
  estimated_value: number | null;
  sales_status: string;
  tagObjects: CrmTag[];
}

function PivotTable({
  cardsWithTags,
  categories,
}: {
  cardsWithTags: CardWithTags[];
  categories: string[];
}) {
  const [rowCat, setRowCat] = useState(categories[0]);
  const [colCat, setColCat] = useState(categories.length > 1 ? categories[1] : categories[0]);

  // Unique tag values per category
  const rowTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of cardsWithTags) {
      for (const t of c.tagObjects) {
        if (t.category === rowCat) set.add(t.name);
      }
    }
    return [...set].sort();
  }, [cardsWithTags, rowCat]);

  const colTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of cardsWithTags) {
      for (const t of c.tagObjects) {
        if (t.category === colCat) set.add(t.name);
      }
    }
    return [...set].sort();
  }, [cardsWithTags, colCat]);

  // Build pivot matrix
  const { matrix, rowTotals, colTotals, grandTotal } = useMemo(() => {
    const mat: Record<string, Record<string, number>> = {};
    const rTotals: Record<string, number> = {};
    const cTotals: Record<string, number> = {};
    let total = 0;

    for (const rt of rowTags) {
      mat[rt] = {};
      rTotals[rt] = 0;
      for (const ct of colTags) {
        mat[rt][ct] = 0;
      }
    }
    for (const ct of colTags) cTotals[ct] = 0;

    // Track card IDs per cell/row/col to avoid double-counting when a card
    // has multiple tags in the same category.
    const cellSeen = new Map<string, Set<string>>();
    const rowSeen = new Map<string, Set<string>>();
    const colSeen = new Map<string, Set<string>>();
    const totalSeen = new Set<string>();

    for (const card of cardsWithTags) {
      const val = card.estimated_value || 0;
      const cardRowTags = card.tagObjects.filter((t) => t.category === rowCat).map((t) => t.name);
      const cardColTags = card.tagObjects.filter((t) => t.category === colCat).map((t) => t.name);

      for (const rt of cardRowTags) {
        for (const ct of cardColTags) {
          if (!(mat[rt] && ct in mat[rt])) continue;

          // Cell dedup
          const cellKey = `${rt}||${ct}`;
          if (!cellSeen.has(cellKey)) cellSeen.set(cellKey, new Set());
          if (cellSeen.get(cellKey)!.has(card.id)) continue;
          cellSeen.get(cellKey)!.add(card.id);
          mat[rt][ct] += val;

          // Row dedup
          if (!rowSeen.has(rt)) rowSeen.set(rt, new Set());
          if (!rowSeen.get(rt)!.has(card.id)) {
            rowSeen.get(rt)!.add(card.id);
            rTotals[rt] += val;
          }

          // Col dedup
          if (!colSeen.has(ct)) colSeen.set(ct, new Set());
          if (!colSeen.get(ct)!.has(card.id)) {
            colSeen.get(ct)!.add(card.id);
            cTotals[ct] += val;
          }

          // Grand total dedup
          if (!totalSeen.has(card.id)) {
            totalSeen.add(card.id);
            total += val;
          }
        }
      }
    }

    return { matrix: mat, rowTotals: rTotals, colTotals: cTotals, grandTotal: total };
  }, [cardsWithTags, rowCat, colCat, rowTags, colTags]);

  if (rowTags.length === 0 || colTags.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Pas assez de données pour croiser ces catégories.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-base">Tableau croisé par tags</CardTitle>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="text-muted-foreground">Lignes</span>
            <Select value={rowCat} onValueChange={setRowCat}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">Colonnes</span>
            <Select value={colCat} onValueChange={setColCat}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left py-2 px-2 border-b font-medium text-muted-foreground">
                  {rowCat} \\ {colCat}
                </th>
                {colTags.map((ct) => (
                  <th key={ct} className="text-right py-2 px-2 border-b font-medium text-muted-foreground">
                    {ct}
                  </th>
                ))}
                <th className="text-right py-2 px-2 border-b font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {rowTags.map((rt) => (
                <tr key={rt} className="border-b hover:bg-muted/30">
                  <td className="py-2 px-2 font-medium">{rt}</td>
                  {colTags.map((ct) => (
                    <td key={ct} className="text-right py-2 px-2 tabular-nums">
                      {matrix[rt][ct] ? `${fmt(matrix[rt][ct])} €` : <span className="text-muted-foreground">-</span>}
                    </td>
                  ))}
                  <td className="text-right py-2 px-2 font-semibold tabular-nums">
                    {fmt(rowTotals[rt])} €
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2">
                <td className="py-2 px-2 font-semibold">Total</td>
                {colTags.map((ct) => (
                  <td key={ct} className="text-right py-2 px-2 font-semibold tabular-nums">
                    {fmt(colTotals[ct])} €
                  </td>
                ))}
                <td className="text-right py-2 px-2 font-bold tabular-nums">
                  {fmt(grandTotal)} €
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default CrmReports;
