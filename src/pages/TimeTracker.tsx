import { useState, useMemo, useRef } from "react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  startOfYear,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  subDays,
  getISOWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Clock,
  Plus,
  Trash2,
  RefreshCw,
  Github,
  Printer,
  Pencil,
  Check,
  X,
  AlertCircle,
  Key,
} from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { todayAsISO } from "@/lib/dateFormatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimeEntry {
  id: string;
  entry_date: string;
  duration_minutes: number;
  description: string;
  source: "manual" | "github_import";
  github_pr_number: number | null;
  github_pr_url: string | null;
  created_at: string;
  updated_at: string;
}

interface ProposedEntry {
  entry_date: string;
  duration_minutes: number;
  description: string;
  github_pr_number: number;
  github_pr_url: string;
  selected: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(",", ".");

  // "HH:MM" or "H:MM"
  const colonM = s.match(/^(\d+):(\d{2})$/);
  if (colonM) return parseInt(colonM[1]) * 60 + parseInt(colonM[2]);

  // "XhYY" or "XhYYmin"
  const fullM = s.match(/^(\d+)h(\d+)(min)?$/);
  if (fullM) return parseInt(fullM[1]) * 60 + parseInt(fullM[2]);

  // "Xh" or "X.Yh"
  const hoursM = s.match(/^(\d+(?:\.\d+)?)h$/);
  if (hoursM) return Math.round(parseFloat(hoursM[1]) * 60);

  // "Xmin"
  const minM = s.match(/^(\d+)\s*min$/);
  if (minM) return parseInt(minM[1]);

  // plain number → minutes
  const numM = s.match(/^(\d+(?:\.\d+)?)$/);
  if (numM) return Math.round(parseFloat(numM[1]));

  return null;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}


function groupByMonth(entries: TimeEntry[]): Map<string, TimeEntry[]> {
  const map = new Map<string, TimeEntry[]>();
  for (const e of entries) {
    const key = e.entry_date.slice(0, 7); // "YYYY-MM"
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return map;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return format(d, "MMMM yyyy", { locale: fr });
}

// ---------------------------------------------------------------------------
// Hook: time entries
// ---------------------------------------------------------------------------

function useTimeEntries() {
  return useQuery<TimeEntry[]>({
    queryKey: ["time_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TimeEntry[];
    },
  });
}

// ---------------------------------------------------------------------------
// Tab: Nouvelle entrée
// ---------------------------------------------------------------------------

function NewEntryTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(todayAsISO());
  const [durationRaw, setDurationRaw] = useState("");
  const [description, setDescription] = useState("");

  const durationMinutes = parseDuration(durationRaw);
  const durationValid = durationMinutes !== null && durationMinutes > 0;

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!durationValid) throw new Error("Durée invalide");
      if (!description.trim()) throw new Error("Description requise");
      const { error } = await supabase.from("time_entries").insert({
        entry_date: date,
        duration_minutes: durationMinutes,
        description: description.trim(),
        source: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time_entries"] });
      setDurationRaw("");
      setDescription("");
      setDate(todayAsISO());
      toast({ title: "Entrée ajoutée" });
    },
    onError: (err: Error) => {
      toastError(toast, err);
    },
  });

  return (
    <div className="max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enregistrer une session de travail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Durée</label>
              <Input
                placeholder="ex: 1h30, 45min, 2h"
                value={durationRaw}
                onChange={(e) => setDurationRaw(e.target.value)}
                className={durationRaw && !durationValid ? "border-destructive" : ""}
              />
              {durationRaw && durationValid && (
                <p className="text-xs text-muted-foreground">{formatDuration(durationMinutes!)}</p>
              )}
              {durationRaw && !durationValid && (
                <p className="text-xs text-destructive">Format invalide</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Description du travail</label>
            <Textarea
              placeholder="Développement de la fonctionnalité X, correction du bug Y..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <Button
            className="w-full"
            onClick={() => addMutation.mutate()}
            disabled={!durationValid || !description.trim() || addMutation.isPending}
          >
            {addMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Ajouter l'entrée
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline edit row
// ---------------------------------------------------------------------------

interface EntryRowProps {
  entry: TimeEntry;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: { duration_minutes: number; description: string }) => void;
  deleting: boolean;
  updating: boolean;
}

function EntryRow({ entry, onDelete, onUpdate, deleting, updating }: EntryRowProps) {
  const [editing, setEditing] = useState(false);
  const [dur, setDur] = useState(formatDuration(entry.duration_minutes));
  const [desc, setDesc] = useState(entry.description);

  const durMin = parseDuration(dur);
  const valid = durMin !== null && durMin > 0 && desc.trim().length > 0;

  function save() {
    if (!valid) return;
    onUpdate(entry.id, { duration_minutes: durMin!, description: desc.trim() });
    setEditing(false);
  }

  function cancel() {
    setDur(formatDuration(entry.duration_minutes));
    setDesc(entry.description);
    setEditing(false);
  }

  if (editing) {
    return (
      <tr className="border-b bg-muted/20">
        <td className="px-4 py-2 text-sm">
          {format(parseISO(entry.entry_date), "d MMM yyyy", { locale: fr })}
        </td>
        <td className="px-4 py-2">
          <Input
            value={dur}
            onChange={(e) => setDur(e.target.value)}
            className="h-7 text-sm w-20"
          />
        </td>
        <td className="px-4 py-2">
          <Input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="h-7 text-sm"
          />
        </td>
        <td className="px-4 py-2">
          <Badge variant="outline" className="text-xs">
            {entry.source === "github_import" ? "GitHub" : "Manuel"}
          </Badge>
        </td>
        <td className="px-4 py-2 text-right">
          <div className="flex justify-end gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={save} disabled={!valid || updating}>
              <Check className="h-3.5 w-3.5 text-green-600" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancel}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-2.5 text-sm text-muted-foreground whitespace-nowrap">
        {format(parseISO(entry.entry_date), "d MMM yyyy", { locale: fr })}
      </td>
      <td className="px-4 py-2.5 text-sm font-medium whitespace-nowrap">
        {formatDuration(entry.duration_minutes)}
      </td>
      <td className="px-4 py-2.5 text-sm">
        {entry.description}
        {entry.github_pr_url && (
          <a
            href={entry.github_pr_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-xs text-blue-500 hover:underline"
          >
            PR #{entry.github_pr_number}
          </a>
        )}
      </td>
      <td className="px-4 py-2.5">
        <Badge variant="outline" className="text-xs">
          {entry.source === "github_import" ? "GitHub" : "Manuel"}
        </Badge>
      </td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(entry.id)}
            disabled={deleting}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Chart: heures travaillées par période
// ---------------------------------------------------------------------------

type Granularity = "day" | "week" | "month" | "year";

interface TimeChartProps {
  entries: TimeEntry[];
}

function bucketKey(date: Date, granularity: Granularity): string {
  switch (granularity) {
    case "day":
      return format(date, "yyyy-MM-dd");
    case "week": {
      const ws = startOfWeek(date, { weekStartsOn: 1 });
      return format(ws, "yyyy-MM-dd");
    }
    case "month":
      return format(startOfMonth(date), "yyyy-MM");
    case "year":
      return format(startOfYear(date), "yyyy");
  }
}

function bucketLabel(key: string, granularity: Granularity): string {
  switch (granularity) {
    case "day":
      return format(parseISO(key), "d MMM", { locale: fr });
    case "week": {
      const d = parseISO(key);
      return `S${getISOWeek(d)}`;
    }
    case "month": {
      const d = parseISO(key + "-01");
      return format(d, "MMM yy", { locale: fr });
    }
    case "year":
      return key;
  }
}

function nextBucket(date: Date, granularity: Granularity): Date {
  switch (granularity) {
    case "day":
      return addDays(date, 1);
    case "week":
      return addWeeks(date, 1);
    case "month":
      return addMonths(date, 1);
    case "year":
      return addYears(date, 1);
  }
}

function startBucket(date: Date, granularity: Granularity): Date {
  switch (granularity) {
    case "day":
      return date;
    case "week":
      return startOfWeek(date, { weekStartsOn: 1 });
    case "month":
      return startOfMonth(date);
    case "year":
      return startOfYear(date);
  }
}

function TimeChart({ entries }: TimeChartProps) {
  const today = todayAsISO();
  const defaultFrom = format(subDays(new Date(), 29), "yyyy-MM-dd");

  const [granularity, setGranularity] = useState<Granularity>("day");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(today);

  function applyPreset(preset: "7d" | "30d" | "90d" | "12m" | "all") {
    const now = new Date();
    setTo(format(now, "yyyy-MM-dd"));
    switch (preset) {
      case "7d":
        setFrom(format(subDays(now, 6), "yyyy-MM-dd"));
        setGranularity("day");
        break;
      case "30d":
        setFrom(format(subDays(now, 29), "yyyy-MM-dd"));
        setGranularity("day");
        break;
      case "90d":
        setFrom(format(subDays(now, 89), "yyyy-MM-dd"));
        setGranularity("week");
        break;
      case "12m":
        setFrom(format(addMonths(now, -11), "yyyy-MM-dd"));
        setGranularity("month");
        break;
      case "all": {
        if (entries.length > 0) {
          const oldest = entries.reduce(
            (min, e) => (e.entry_date < min ? e.entry_date : min),
            entries[0].entry_date,
          );
          setFrom(oldest);
        }
        setGranularity("month");
        break;
      }
    }
  }

  const { data, totalMinutes } = useMemo(() => {
    const fromDate = parseISO(from);
    const toDate = parseISO(to);
    const buckets = new Map<string, number>();

    let cursor = startBucket(fromDate, granularity);
    const end = toDate;
    while (cursor <= end) {
      buckets.set(bucketKey(cursor, granularity), 0);
      cursor = nextBucket(cursor, granularity);
    }

    let total = 0;
    for (const e of entries) {
      if (e.entry_date < from || e.entry_date > to) continue;
      const key = bucketKey(parseISO(e.entry_date), granularity);
      buckets.set(key, (buckets.get(key) ?? 0) + e.duration_minutes);
      total += e.duration_minutes;
    }

    const arr = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, minutes]) => ({
        key,
        label: bucketLabel(key, granularity),
        hours: Math.round((minutes / 60) * 100) / 100,
        minutes,
      }));

    return { data: arr, totalMinutes: total };
  }, [entries, from, to, granularity]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Heures travaillées
            <Badge variant="secondary" className="ml-2 text-xs font-semibold">
              {formatDuration(totalMinutes)}
            </Badge>
          </CardTitle>
          <ToggleGroup
            type="single"
            value={granularity}
            onValueChange={(v) => v && setGranularity(v as Granularity)}
            size="sm"
          >
            <ToggleGroupItem value="day">Jour</ToggleGroupItem>
            <ToggleGroupItem value="week">Semaine</ToggleGroupItem>
            <ToggleGroupItem value="month">Mois</ToggleGroupItem>
            <ToggleGroupItem value="year">Année</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">Du</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 w-auto text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">Au</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 w-auto text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1 ml-auto">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => applyPreset("7d")}>7j</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => applyPreset("30d")}>30j</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => applyPreset("90d")}>90j</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => applyPreset("12m")}>12 mois</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => applyPreset("all")}>Tout</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(_value, _name, item: any) => [formatDuration(item.payload.minutes), "Durée"]}
                labelFormatter={(label) => label}
              />
              <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tab: Historique
// ---------------------------------------------------------------------------


function HistoryTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: entries = [], isLoading } = useTimeEntries();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const grouped = useMemo(() => groupByMonth(entries), [entries]);
  const sortedMonths = useMemo(
    () => [...grouped.keys()].sort((a, b) => b.localeCompare(a)),
    [grouped]
  );

  const totalMinutes = useMemo(
    () => entries.reduce((sum, e) => sum + e.duration_minutes, 0),
    [entries]
  );

  async function handleDelete(id: string) {
    setDeletingId(id);
    const { error } = await supabase.from("time_entries").delete().eq("id", id);
    if (error) {
      toastError(toast, "Erreur lors de la suppression");
    } else {
      queryClient.invalidateQueries({ queryKey: ["time_entries"] });
      toast({ title: "Entrée supprimée" });
    }
    setDeletingId(null);
  }

  async function handleUpdate(
    id: string,
    patch: { duration_minutes: number; description: string }
  ) {
    setUpdatingId(id);
    const { error } = await supabase.from("time_entries").update(patch).eq("id", id);
    if (error) {
      toastError(toast, "Erreur lors de la mise à jour");
    } else {
      queryClient.invalidateQueries({ queryKey: ["time_entries"] });
    }
    setUpdatingId(null);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>Aucune entrée enregistrée.</p>
        <p className="text-sm mt-1">Ajoutez une session ou importez depuis GitHub.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TimeChart entries={entries} />


      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Total toutes périodes :</span>
        <Badge variant="secondary" className="text-sm font-semibold">
          {formatDuration(totalMinutes)}
        </Badge>
      </div>

      {sortedMonths.map((month) => {
        const monthEntries = grouped.get(month)!.sort(
          (a, b) => b.entry_date.localeCompare(a.entry_date)
        );
        const monthTotal = monthEntries.reduce((s, e) => s + e.duration_minutes, 0);

        return (
          <div key={month}>
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-sm">{monthLabel(month)}</h3>
              <Badge variant="outline" className="text-xs">
                {formatDuration(monthTotal)}
              </Badge>
            </div>
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-4 py-2 text-left font-medium text-xs">Date</th>
                      <th className="px-4 py-2 text-left font-medium text-xs">Durée</th>
                      <th className="px-4 py-2 text-left font-medium text-xs">Description</th>
                      <th className="px-4 py-2 text-left font-medium text-xs">Source</th>
                      <th className="px-4 py-2 text-right font-medium text-xs">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthEntries.map((entry) => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        onDelete={handleDelete}
                        onUpdate={handleUpdate}
                        deleting={deletingId === entry.id}
                        updating={updatingId === entry.id}
                      />
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Import GitHub
// ---------------------------------------------------------------------------

function GitHubImportTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [since, setSince] = useState("2026-02-01");
  const [until, setUntil] = useState(todayAsISO());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [proposed, setProposed] = useState<ProposedEntry[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [token, setToken] = useState("");
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [isEditingToken, setIsEditingToken] = useState(false);

  const { data: tokenSetting } = useQuery<{ setting_value: string } | null>({
    queryKey: ["app_settings", "github_personal_token"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "github_personal_token")
        .maybeSingle();
      return data as { setting_value: string } | null;
    },
  });

  const hasToken = Boolean(tokenSetting?.setting_value);

  async function saveToken() {
    if (!token.trim()) return;
    setIsSavingToken(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { setting_key: "github_personal_token", setting_value: token.trim() },
        { onConflict: "setting_key" }
      );
    if (error) {
      toastError(toast, "Erreur lors de la sauvegarde");
    } else {
      queryClient.invalidateQueries({ queryKey: ["app_settings", "github_personal_token"] });
      setToken("");
      setIsEditingToken(false);
      toast({ title: "Token enregistré" });
    }
    setIsSavingToken(false);
  }

  async function analyze() {
    setIsAnalyzing(true);
    setProposed([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/time-tracker-github-import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${session?.access_token ?? SUPABASE_KEY}`,
        },
        body: JSON.stringify({ since, until }),
      });
      const text = await resp.text();
      let payload: { entries?: Omit<ProposedEntry, "selected">[]; error?: string } = {};
      try { payload = text ? JSON.parse(text) : {}; } catch { /* keep empty */ }
      if (!resp.ok) {
        throw new Error(payload.error || `Erreur ${resp.status}`);
      }
      const entries = payload.entries ?? [];
      if (entries.length === 0) {
        toast({ title: "Aucune PR trouvée sur cette période" });
      } else {
        setProposed(entries.map((e) => ({ ...e, selected: true })));
        toast({ title: `${entries.length} PR${entries.length > 1 ? "s" : ""} analysée${entries.length > 1 ? "s" : ""}` });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'analyse";
      toastError(toast, message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function importSelected() {
    const toImport = proposed.filter((p) => p.selected);
    if (toImport.length === 0) return;
    setIsImporting(true);
    try {
      const rows = toImport.map((p) => ({
        entry_date: p.entry_date,
        duration_minutes: p.duration_minutes,
        description: p.description,
        source: "github_import" as const,
        github_pr_number: p.github_pr_number,
        github_pr_url: p.github_pr_url,
      }));
      const { error } = await supabase.from("time_entries").insert(rows);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["time_entries"] });
      setProposed([]);
      toast({ title: `${toImport.length} entrée${toImport.length > 1 ? "s" : ""} importée${toImport.length > 1 ? "s" : ""}` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'import";
      toastError(toast, message);
    } finally {
      setIsImporting(false);
    }
  }

  function toggleAll(val: boolean) {
    setProposed((prev) => prev.map((p) => ({ ...p, selected: val })));
  }

  function updateProposed(index: number, patch: Partial<ProposedEntry>) {
    setProposed((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  const selectedCount = proposed.filter((p) => p.selected).length;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Token config */}
      {(!hasToken || isEditingToken) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
              <Key className="h-4 w-4" />
              {isEditingToken ? "Modifier le token GitHub" : "Token GitHub requis"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-amber-700">
              Un token GitHub (classic) avec le scope <code>repo</code> est nécessaire pour lire les PRs privées.
              Créez-en un sur <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="underline">github.com/settings/tokens</a>.
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="ghp_..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <Button onClick={saveToken} disabled={!token.trim() || isSavingToken}>
                {isSavingToken ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Enregistrer"}
              </Button>
              {isEditingToken && (
                <Button variant="ghost" onClick={() => { setIsEditingToken(false); setToken(""); }}>
                  Annuler
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {hasToken && !isEditingToken && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Check className="h-4 w-4 text-green-500" />
          Token GitHub configuré
          <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setIsEditingToken(true)}>
            Modifier
          </Button>
        </div>
      )}

      {/* Period selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Github className="h-4 w-4" />
            Analyse des Pull Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="space-y-1">
              <label className="text-sm font-medium">Depuis</label>
              <Input type="date" value={since} onChange={(e) => setSince(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Jusqu'au</label>
              <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="w-40" />
            </div>
            <Button onClick={analyze} disabled={isAnalyzing || !hasToken} className="gap-2">
              {isAnalyzing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Github className="h-4 w-4" />
              )}
              {isAnalyzing ? "Analyse en cours..." : "Analyser avec l'IA"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Récupère toutes les PRs mergées sur la période, génère une description professionnelle et estime la durée de travail via l'IA.
          </p>
        </CardContent>
      </Card>

      {/* Proposed entries */}
      {proposed.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-sm">
                {proposed.length} entrée{proposed.length > 1 ? "s" : ""} proposée{proposed.length > 1 ? "s" : ""}
              </span>
              <Badge variant="outline" className="text-xs">
                {formatDuration(proposed.filter((p) => p.selected).reduce((s, p) => s + p.duration_minutes, 0))} sélectionnées
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>Tout sélectionner</Button>
              <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>Tout désélectionner</Button>
              <Button
                size="sm"
                onClick={importSelected}
                disabled={selectedCount === 0 || isImporting}
                className="gap-1"
              >
                {isImporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Importer {selectedCount > 0 ? `(${selectedCount})` : ""}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {proposed.map((entry, i) => {
              const durMin = parseDuration(String(entry.duration_minutes));
              return (
                <Card
                  key={i}
                  className={`transition-opacity ${entry.selected ? "" : "opacity-50"}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={entry.selected}
                        onChange={(e) => updateProposed(i, { selected: e.target.checked })}
                        className="mt-1 h-4 w-4 cursor-pointer"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm font-medium">
                            {format(parseISO(entry.entry_date), "d MMMM yyyy", { locale: fr })}
                          </span>
                          <Input
                            value={formatDuration(entry.duration_minutes)}
                            onChange={(e) => {
                              const min = parseDuration(e.target.value);
                              if (min) updateProposed(i, { duration_minutes: min });
                            }}
                            className="h-7 w-20 text-sm"
                          />
                          <a
                            href={entry.github_pr_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline"
                          >
                            PR #{entry.github_pr_number}
                          </a>
                        </div>
                        <Textarea
                          value={entry.description}
                          onChange={(e) => updateProposed(i, { description: e.target.value })}
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Rapport
// ---------------------------------------------------------------------------

function ReportTab() {
  const { data: entries = [], isLoading } = useTimeEntries();
  const printRef = useRef<HTMLDivElement>(null);

  const [since, setSince] = useState("2026-02-01");
  const [until, setUntil] = useState(todayAsISO());

  const filtered = useMemo(() => {
    return entries
      .filter((e) => e.entry_date >= since && e.entry_date <= until)
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  }, [entries, since, until]);

  const grouped = useMemo(() => groupByMonth(filtered), [filtered]);
  const sortedMonths = useMemo(
    () => [...grouped.keys()].sort(),
    [grouped]
  );

  const totalMinutes = useMemo(
    () => filtered.reduce((s, e) => s + e.duration_minutes, 0),
    [filtered]
  );

  function handlePrint() {
    window.print();
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-end gap-4 flex-wrap print:hidden">
        <div className="space-y-1">
          <label className="text-sm font-medium">Du</label>
          <Input type="date" value={since} onChange={(e) => setSince(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Au</label>
          <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="w-40" />
        </div>
        <Button variant="outline" onClick={handlePrint} className="gap-2" disabled={filtered.length === 0}>
          <Printer className="h-4 w-4" />
          Imprimer / PDF
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground print:hidden">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucune entrée sur cette période.</p>
        </div>
      ) : (
        /* Report content — printable */
        <div ref={printRef} className="space-y-6 print:text-black">
          {/* Header */}
          <div className="border-b pb-4">
            <h2 className="text-xl font-bold">Rapport de développement — SuperTools</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Période du {format(parseISO(since), "d MMMM yyyy", { locale: fr })} au{" "}
              {format(parseISO(until), "d MMMM yyyy", { locale: fr })}
            </p>
            <div className="mt-3 inline-flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">Total : {formatDuration(totalMinutes)}</span>
              <span className="text-muted-foreground text-sm">
                ({(totalMinutes / 60).toFixed(1)}h)
              </span>
            </div>
          </div>

          {/* Months */}
          {sortedMonths.map((month) => {
            const monthEntries = grouped.get(month)!;
            const monthTotal = monthEntries.reduce((s, e) => s + e.duration_minutes, 0);

            return (
              <div key={month} className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold">{monthLabel(month)}</h3>
                  <span className="text-sm text-muted-foreground">{formatDuration(monthTotal)}</span>
                </div>
                <div className="space-y-1 pl-0">
                  {monthEntries.map((e) => (
                    <div key={e.id} className="flex gap-4 py-1.5 border-b last:border-0">
                      <span className="text-sm text-muted-foreground whitespace-nowrap w-28 shrink-0">
                        {format(parseISO(e.entry_date), "d MMM yyyy", { locale: fr })}
                      </span>
                      <span className="text-sm font-medium whitespace-nowrap w-16 shrink-0">
                        {formatDuration(e.duration_minutes)}
                      </span>
                      <span className="text-sm">{e.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Footer */}
          <div className="border-t pt-4 text-sm text-muted-foreground print:block">
            <p>Document généré le {format(new Date(), "d MMMM yyyy 'à' HH:mm", { locale: fr })}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const TimeTracker = () => {
  return (
    <ModuleLayout>
      <div className="p-6 space-y-6 print:p-0">
        <div className="print:hidden">
          <PageHeader
            icon={Clock}
            title="Suivi du temps"
            subtitle="Valorisation du temps de développement SuperTools"
          />
        </div>

        <Tabs defaultValue="new" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-4 print:hidden">
            <TabsTrigger value="new">Nouvelle entrée</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
            <TabsTrigger value="import">Import GitHub</TabsTrigger>
            <TabsTrigger value="report">Rapport</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="print:hidden">
            <NewEntryTab />
          </TabsContent>

          <TabsContent value="history" className="print:hidden">
            <HistoryTab />
          </TabsContent>

          <TabsContent value="import" className="print:hidden">
            <GitHubImportTab />
          </TabsContent>

          <TabsContent value="report">
            <ReportTab />
          </TabsContent>
        </Tabs>
      </div>
    </ModuleLayout>
  );
};

export default TimeTracker;
