import { useState, useMemo, useCallback } from "react";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  BarChart3,
  CalendarDays,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
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
import { useCrmReports, type CrmReportFilters, type WeeklyPoint } from "@/hooks/crm/useCrmReports";
import ModuleLayout from "@/components/ModuleLayout";
import { format, startOfYear, startOfQuarter, startOfMonth, endOfMonth, endOfQuarter, endOfYear } from "date-fns";
import { fr } from "date-fns/locale";
import type { CrmTag } from "@/types/crm";

// ── Persistence ────────────────────────────────────────────

const STORAGE_KEY = "crm-reports-prefs";

interface StoredPrefs {
  preset?: string;
  pivot1Row?: string;
  pivot1Col?: string;
  pivot2Row?: string;
  pivot2Col?: string;
}

function loadPrefs(): StoredPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePrefs(partial: Partial<StoredPrefs>) {
  const current = loadPrefs();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...partial }));
}

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
  const prefs = useMemo(() => loadPrefs(), []);
  const [preset, setPreset] = useState<PeriodPreset>((prefs.preset as PeriodPreset) || "year");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();

  const handlePresetChange = useCallback((p: PeriodPreset) => {
    setPreset(p);
    savePrefs({ preset: p });
  }, []);

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
  const [activeChart, setActiveChart] = useState<string | null>(null);
  const toggleChart = useCallback((key: string) => setActiveChart((prev) => (prev === key ? null : key)), []);

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

  const hasPivot = reports.categories.length >= 2;

  const kpiChartConfig: Record<string, { dataKey: keyof WeeklyPoint; color: string; label: string; suffix: string }> = {
    open: { dataKey: "openValue", color: "#6b7280", label: "Pipeline ouvert", suffix: " €" },
    weighted: { dataKey: "weightedValue", color: "#d97706", label: "Pipeline pondéré", suffix: " €" },
    won: { dataKey: "wonValue", color: "#16a34a", label: "Gagné", suffix: " €" },
    lost: { dataKey: "lostValue", color: "#dc2626", label: "Perdu", suffix: " €" },
    conversion: { dataKey: "conversionRate", color: "#6b7280", label: "Taux de conversion", suffix: "%" },
  };

  return (
    <ModuleLayout>
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        <PageHeader
          icon={BarChart3}
          title="Reporting CRM"
          subtitle="Statistiques du pipeline commercial"
          backTo="/crm"
        />

        {/* KPIs — value-first layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard
            title="Pipeline ouvert"
            icon={<Target className="h-4 w-4 text-muted-foreground" />}
            mainValue={`${fmt(reports.openValue)} €`}
            secondary={`${reports.openCount} opportunité${reports.openCount > 1 ? "s" : ""}`}
            active={activeChart === "open"}
            onClick={() => toggleChart("open")}
          />
          <KpiCard
            title="Pipeline pondéré"
            icon={<DollarSign className="h-4 w-4 text-amber-600" />}
            mainValue={`${fmt(Math.round(reports.weightedPipeline))} €`}
            secondary="confiance × valeur"
            mainColor="text-amber-600"
            active={activeChart === "weighted"}
            onClick={() => toggleChart("weighted")}
          />
          <KpiCard
            title="Gagné"
            icon={<TrendingUp className="h-4 w-4 text-green-600" />}
            mainValue={`${fmt(reports.wonValue)} €`}
            secondary={`${reports.wonCount} vente${reports.wonCount > 1 ? "s" : ""}`}
            mainColor="text-green-600"
            active={activeChart === "won"}
            onClick={() => toggleChart("won")}
          />
          <KpiCard
            title="Perdu"
            icon={<TrendingDown className="h-4 w-4 text-red-600" />}
            mainValue={`${fmt(reports.lostValue)} €`}
            secondary={`${reports.lostCount} opportunité${reports.lostCount > 1 ? "s" : ""}`}
            mainColor="text-red-600"
            active={activeChart === "lost"}
            onClick={() => toggleChart("lost")}
          />
          <KpiCard
            title="Taux de conversion"
            icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
            mainValue={`${winRate}%`}
            secondary={`sur ${reports.wonCount + reports.lostCount} clôturée${reports.wonCount + reports.lostCount > 1 ? "s" : ""}`}
            active={activeChart === "conversion"}
            onClick={() => toggleChart("conversion")}
          />
        </div>

        {/* Weekly chart for selected KPI */}
        {activeChart && kpiChartConfig[activeChart] && (
          <WeeklyChart
            data={reports.weeklyData}
            config={kpiChartConfig[activeChart]}
          />
        )}

        {/* Pivot 1: Historical — all cards filtered by period */}
        {hasPivot && (
          <PivotTable
            storageKey="pivot1"
            title="Tableau croisé par tags"
            cardsWithTags={reports.cardsWithTags}
            categories={reports.categories}
            periodSelector={
              <PeriodSelector
                preset={preset}
                onPresetChange={handlePresetChange}
                customStart={customStart}
                customEnd={customEnd}
                onCustomStartChange={setCustomStart}
                onCustomEndChange={setCustomEnd}
              />
            }
          />
        )}

        {/* Pivot 2: Pipeline — OPEN cards only, no period */}
        {hasPivot && (
          <PivotTable
            storageKey="pivot2"
            title="Pipeline en cours"
            cardsWithTags={reports.pipelineCardsWithTags}
            categories={reports.categories}
          />
        )}

        {!hasPivot && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              Le tableau croisé nécessite au moins 2 catégories de tags pour fonctionner.
              Ajoutez des catégories dans les param\u00E8tres CRM.
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
  active,
  onClick,
}: {
  title: string;
  icon: React.ReactNode;
  mainValue: string;
  secondary: string;
  mainColor?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${active ? "ring-2 ring-primary" : ""}`}
      onClick={onClick}
    >
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

// ── Weekly Chart ────────────────────────────────────────────

function WeeklyChart({
  data,
  config,
}: {
  data: WeeklyPoint[];
  config: { dataKey: keyof WeeklyPoint; color: string; label: string; suffix: string };
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Suivi hebdomadaire — {config.label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id={`gradient-${config.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={config.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={config.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <YAxis
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                tickFormatter={(v) => config.suffix === "%" ? `${v}%` : `${fmt(v)}`}
              />
              <Tooltip
                formatter={(value: number) =>
                  config.suffix === "%" ? [`${value}%`, config.label] : [`${fmt(value)} €`, config.label]
                }
                labelFormatter={(label) => `Semaine du ${label}`}
                contentStyle={{ borderRadius: 8, fontSize: 13 }}
              />
              <Area
                type="monotone"
                dataKey={config.dataKey}
                stroke={config.color}
                strokeWidth={2}
                fill={`url(#gradient-${config.dataKey})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
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
        <SelectTrigger className="w-36 h-8 text-xs">
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
        <Button variant="outline" size="sm" className="gap-1.5 text-sm h-8">
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
  storageKey,
  title,
  cardsWithTags,
  categories,
  allTags,
  periodSelector,
}: {
  storageKey: string;
  title: string;
  cardsWithTags: CardWithTags[];
  categories: string[];
  allTags?: CrmTag[];
  periodSelector?: React.ReactNode;
}) {
  const prefs = useMemo(() => loadPrefs(), []);
  const rowKey = `${storageKey}Row` as keyof StoredPrefs;
  const colKey = `${storageKey}Col` as keyof StoredPrefs;

  const defaultRow = prefs[rowKey] && categories.includes(prefs[rowKey]!) ? prefs[rowKey]! : categories[0];
  const defaultCol = prefs[colKey] && categories.includes(prefs[colKey]!) ? prefs[colKey]! : (categories.length > 1 ? categories[1] : categories[0]);

  const [rowCat, setRowCat] = useState(defaultRow);
  const [colCat, setColCat] = useState(defaultCol);

  const handleRowChange = useCallback((v: string) => {
    setRowCat(v);
    savePrefs({ [rowKey]: v });
  }, [rowKey]);

  const handleColChange = useCallback((v: string) => {
    setColCat(v);
    savePrefs({ [colKey]: v });
  }, [colKey]);

  // Unique tag values per category
  const safeCards = cardsWithTags ?? [];

  const rowTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of safeCards) {
      for (const t of c.tagObjects) {
        if (t.category === rowCat) set.add(t.name);
      }
    }
    return [...set].sort();
  }, [safeCards, rowCat]);

  const colTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of safeCards) {
      for (const t of c.tagObjects) {
        if (t.category === colCat) set.add(t.name);
      }
    }
    return [...set].sort();
  }, [safeCards, colCat]);

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

    const cellSeen = new Map<string, Set<string>>();
    const rowSeen = new Map<string, Set<string>>();
    const colSeen = new Map<string, Set<string>>();
    const totalSeen = new Set<string>();

    for (const card of safeCards) {
      const val = card.estimated_value || 0;
      const cardRowTags = card.tagObjects.filter((t) => t.category === rowCat).map((t) => t.name);
      const cardColTags = card.tagObjects.filter((t) => t.category === colCat).map((t) => t.name);

      for (const rt of cardRowTags) {
        for (const ct of cardColTags) {
          if (!(mat[rt] && ct in mat[rt])) continue;

          const cellKey = `${rt}||${ct}`;
          if (!cellSeen.has(cellKey)) cellSeen.set(cellKey, new Set());
          if (cellSeen.get(cellKey)!.has(card.id)) continue;
          cellSeen.get(cellKey)!.add(card.id);
          mat[rt][ct] += val;

          if (!rowSeen.has(rt)) rowSeen.set(rt, new Set());
          if (!rowSeen.get(rt)!.has(card.id)) {
            rowSeen.get(rt)!.add(card.id);
            rTotals[rt] += val;
          }

          if (!colSeen.has(ct)) colSeen.set(ct, new Set());
          if (!colSeen.get(ct)!.has(card.id)) {
            colSeen.get(ct)!.add(card.id);
            cTotals[ct] += val;
          }

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
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-base">{title}</CardTitle>
            {periodSelector}
          </div>
        </CardHeader>
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
          <div className="flex items-center gap-3 flex-wrap">
            <CardTitle className="text-base">{title}</CardTitle>
            {periodSelector}
          </div>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="text-muted-foreground">Lignes</span>
            <Select value={rowCat} onValueChange={handleRowChange}>
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
            <Select value={colCat} onValueChange={handleColChange}>
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
