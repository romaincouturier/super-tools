import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, X } from "lucide-react";
import type { CrmTag } from "@/types/crm";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// ── Types ────────────────────────────────────────────────────

type SalesStatus = "OPEN" | "WON" | "LOST";

interface ProvenanceCard {
  id: string;
  title: string | null;
  sales_status: SalesStatus;
  service_type: string | null;
  estimated_value: number | null;
  created_at: string;
  won_at: string | null;
  source_metadata: Record<string, unknown> | null;
}

interface ActivityRow {
  card_id: string;
  action_type: string;
  created_at: string;
}

// ── Helpers ──────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString("fr-FR");
const eur = (v: number) => `${fmt(Math.round(v))} €`;

function parseUA(ua: string | null | undefined): { browser: string; os: string; device: "Mobile" | "Desktop" | "Tablet" } {
  if (!ua) return { browser: "Inconnu", os: "Inconnu", device: "Desktop" };
  const u = ua.toLowerCase();
  let browser = "Autre";
  if (/edg\//.test(u)) browser = "Edge";
  else if (/chrome\//.test(u) && !/edg\//.test(u)) browser = "Chrome";
  else if (/firefox\//.test(u)) browser = "Firefox";
  else if (/safari\//.test(u) && !/chrome\//.test(u)) browser = "Safari";
  else if (/opera|opr\//.test(u)) browser = "Opera";

  let os = "Autre";
  if (/iphone|ipad|ipod/.test(u)) os = "iOS";
  else if (/android/.test(u)) os = "Android";
  else if (/windows/.test(u)) os = "Windows";
  else if (/mac os x|macintosh/.test(u)) os = "macOS";
  else if (/linux/.test(u)) os = "Linux";

  let device: "Mobile" | "Desktop" | "Tablet" = "Desktop";
  if (/ipad|tablet/.test(u)) device = "Tablet";
  else if (/mobile|iphone|android.*mobile/.test(u)) device = "Mobile";

  return { browser, os, device };
}

function normalizePageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/$/, "") || "/";
  } catch {
    return url;
  }
}

function normalizeReferrer(ref: string | null | undefined): string | null {
  if (!ref) return null;
  try {
    const u = new URL(ref);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return ref;
  }
}

const PARIS_TZ = "Europe/Paris";

function toParisDate(iso: string): Date {
  // Returns a Date whose getHours/etc. reflect Paris time.
  // Trick: format then re-parse.
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "0";
  return new Date(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")) === 24 ? 0 : Number(get("hour")),
    Number(get("minute")),
    Number(get("second")),
  );
}

// ── Data hook ────────────────────────────────────────────────

function useProvenanceData() {
  return useQuery({
    queryKey: ["crm", "provenance"],
    queryFn: async () => {
      const [cardsRes, actsRes, tagsRes, cardTagsRes] = await Promise.all([
        supabase
          .from("crm_cards")
          .select("id, title, sales_status, service_type, estimated_value, created_at, won_at, source_metadata"),
        supabase
          .from("crm_activity_log")
          .select("card_id, action_type, created_at")
          .eq("action_type", "email_sent"),
        supabase.from("crm_tags").select("*"),
        supabase.from("crm_card_tags").select("card_id, tag_id"),
      ]);
      if (cardsRes.error) throw cardsRes.error;
      if (actsRes.error) throw actsRes.error;
      if (tagsRes.error) throw tagsRes.error;
      if (cardTagsRes.error) throw cardTagsRes.error;
      return {
        cards: (cardsRes.data || []) as unknown as ProvenanceCard[],
        activities: (actsRes.data || []) as ActivityRow[],
        tags: (tagsRes.data || []) as unknown as CrmTag[],
        cardTags: (cardTagsRes.data || []) as { card_id: string; tag_id: string }[],
      };
    },
  });
}

// ── Component ────────────────────────────────────────────────

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"];

export default function ProvenanceTab() {
  const { data, isLoading } = useProvenanceData();

  // Heatmap filters
  const [heatmapStart, setHeatmapStart] = useState<string>("");
  const [heatmapEnd, setHeatmapEnd] = useState<string>("");
  const [heatmapTagIds, setHeatmapTagIds] = useState<string[]>([]);

  const stats = useMemo(() => {
    if (!data) return null;
    const cards = data.cards;

    // card_id -> Set(tag_id)
    const cardTagSet = new Map<string, Set<string>>();
    for (const ct of data.cardTags) {
      const s = cardTagSet.get(ct.card_id) || new Set<string>();
      s.add(ct.tag_id);
      cardTagSet.set(ct.card_id, s);
    }

    // Build per-card derived
    const enriched = cards.map((c) => {
      const meta = (c.source_metadata || {}) as Record<string, string | undefined>;
      const receivedRaw = meta.received_at || c.created_at;
      const received = receivedRaw ? new Date(receivedRaw) : null;
      const ua = meta.user_agent || null;
      const { browser, os, device } = parseUA(ua);
      return {
        ...c,
        received,
        page: normalizePageUrl(meta.page_url),
        referrer: normalizeReferrer(meta.referrer),
        ua,
        browser,
        os,
        device,
      };
    });

    const withReceived = enriched.filter((c) => c.received instanceof Date && !isNaN(c.received.getTime()));

    // Volumes par mois (12 derniers mois glissants)
    const now = new Date();
    const monthBuckets: { key: string; label: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
      monthBuckets.push({ key, label, count: 0 });
    }
    const monthIndex = new Map(monthBuckets.map((b, i) => [b.key, i]));
    for (const c of withReceived) {
      const d = toParisDate(c.received!.toISOString());
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const idx = monthIndex.get(key);
      if (idx !== undefined) monthBuckets[idx].count += 1;
    }

    // Heatmap jour × heure — filtré par période et tags
    const startTs = heatmapStart ? new Date(heatmapStart + "T00:00:00").getTime() : -Infinity;
    const endTs = heatmapEnd ? new Date(heatmapEnd + "T23:59:59").getTime() : Infinity;
    const heatmapFiltered = withReceived.filter((c) => {
      const t = c.received!.getTime();
      if (t < startTs || t > endTs) return false;
      if (heatmapTagIds.length > 0) {
        const tags = cardTagSet.get(c.id);
        if (!tags) return false;
        if (!heatmapTagIds.every((id) => tags.has(id))) return false;
      }
      return true;
    });
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let heatmapMax = 0;
    for (const c of heatmapFiltered) {
      const d = toParisDate(c.received!.toISOString());
      const dow = (d.getDay() + 6) % 7; // 0 = Lundi
      const h = d.getHours();
      heatmap[dow][h] += 1;
      if (heatmap[dow][h] > heatmapMax) heatmapMax = heatmap[dow][h];
    }
    const heatmapTotal = heatmapFiltered.length;

    // Top user agents normalisés (Browser × OS)
    const uaMap = new Map<string, number>();
    let mobile = 0, desktop = 0, tablet = 0;
    for (const c of enriched) {
      if (!c.ua) continue;
      const key = `${c.browser} / ${c.os}`;
      uaMap.set(key, (uaMap.get(key) || 0) + 1);
      if (c.device === "Mobile") mobile += 1;
      else if (c.device === "Tablet") tablet += 1;
      else desktop += 1;
    }
    const uaTop = Array.from(uaMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Top pages d'entrée
    const pageMap = new Map<string, { count: number; won: number; estTotal: number; estCount: number }>();
    for (const c of enriched) {
      if (!c.page) continue;
      const cur = pageMap.get(c.page) || { count: 0, won: 0, estTotal: 0, estCount: 0 };
      cur.count += 1;
      if (c.sales_status === "WON") cur.won += 1;
      if (c.estimated_value && c.estimated_value > 0) {
        cur.estTotal += Number(c.estimated_value);
        cur.estCount += 1;
      }
      pageMap.set(c.page, cur);
    }
    const topPages = Array.from(pageMap.entries())
      .map(([page, v]) => ({
        page,
        count: v.count,
        won: v.won,
        conversion: v.count ? Math.round((v.won / v.count) * 100) : 0,
        avgValue: v.estCount ? Math.round(v.estTotal / v.estCount) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // Top referrers (hors supertilt.fr)
    const refMap = new Map<string, number>();
    for (const c of enriched) {
      if (!c.referrer) continue;
      if (/supertilt\.fr$/i.test(c.referrer)) continue;
      refMap.set(c.referrer, (refMap.get(c.referrer) || 0) + 1);
    }
    const topReferrers = Array.from(refMap.entries())
      .map(([host, count]) => ({ host, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Délai moyen de 1ère réponse (email_sent)
    const firstEmailByCard = new Map<string, string>();
    for (const a of data.activities) {
      const cur = firstEmailByCard.get(a.card_id);
      if (!cur || a.created_at < cur) firstEmailByCard.set(a.card_id, a.created_at);
    }
    let totalDelayHours = 0;
    let delayCount = 0;
    let under1h = 0, under24h = 0, over24h = 0;
    for (const c of withReceived) {
      const first = firstEmailByCard.get(c.id);
      if (!first) continue;
      const delta = (new Date(first).getTime() - c.received!.getTime()) / 3_600_000;
      if (delta < 0 || delta > 24 * 60) continue; // ignore aberrant
      totalDelayHours += delta;
      delayCount += 1;
      if (delta <= 1) under1h += 1;
      else if (delta <= 24) under24h += 1;
      else over24h += 1;
    }
    const avgDelay = delayCount > 0 ? totalDelayHours / delayCount : 0;

    // Top heures rentables (créneaux qui produisent les WON)
    const wonByHour: number[] = Array(24).fill(0);
    for (const c of withReceived) {
      if (c.sales_status !== "WON") continue;
      const d = toParisDate(c.received!.toISOString());
      wonByHour[d.getHours()] += 1;
    }
    const wonHourBuckets = wonByHour.map((count, h) => ({ hour: `${String(h).padStart(2, "0")}h`, count }));

    // Saisonnalité par type de service
    const seasonality: { month: string; formation: number; mission: number }[] = monthBuckets.map((b) => ({
      month: b.label,
      formation: 0,
      mission: 0,
    }));
    const seasonIndex = new Map(monthBuckets.map((b, i) => [b.key, i]));
    for (const c of withReceived) {
      const d = toParisDate(c.received!.toISOString());
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const idx = seasonIndex.get(key);
      if (idx === undefined) continue;
      if (c.service_type === "formation") seasonality[idx].formation += 1;
      else if (c.service_type === "mission") seasonality[idx].mission += 1;
    }

    return {
      totalWithMetadata: withReceived.length,
      totalCards: cards.length,
      monthBuckets,
      heatmap,
      heatmapMax,
      heatmapTotal,
      uaTop,
      mobile,
      desktop,
      tablet,
      topPages,
      topReferrers,
      avgDelay,
      delayCount,
      under1h,
      under24h,
      over24h,
      wonHourBuckets,
      seasonality,
    };
  }, [data, heatmapStart, heatmapEnd, heatmapTagIds]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  if (!stats) {
    return <p className="text-center text-muted-foreground py-8">Aucune donnée de provenance.</p>;
  }

  const dayLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const totalDevice = stats.mobile + stats.desktop + stats.tablet;
  const mobilePct = totalDevice ? Math.round((stats.mobile / totalDevice) * 100) : 0;
  const desktopPct = totalDevice ? Math.round((stats.desktop / totalDevice) * 100) : 0;
  const tabletPct = totalDevice ? Math.round((stats.tablet / totalDevice) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* En-tête couverture */}
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{stats.totalWithMetadata}</span> opportunité(s) avec métadonnées de provenance sur{" "}
          <span className="font-medium text-foreground">{stats.totalCards}</span> au total.
        </CardContent>
      </Card>

      {/* Volumes par mois */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Volumes reçus — 12 derniers mois</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthBuckets}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Heatmap */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Heatmap — Jour × Heure (Europe/Paris)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtres heatmap */}
          <div className="flex flex-wrap items-end gap-3 pb-2 border-b">
            <div className="flex flex-col gap-1">
              <Label htmlFor="hm-start" className="text-xs text-muted-foreground">Du</Label>
              <Input
                id="hm-start"
                type="date"
                value={heatmapStart}
                onChange={(e) => setHeatmapStart(e.target.value)}
                className="h-8 w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="hm-end" className="text-xs text-muted-foreground">Au</Label>
              <Input
                id="hm-end"
                type="date"
                value={heatmapEnd}
                onChange={(e) => setHeatmapEnd(e.target.value)}
                className="h-8 w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Tags</Label>
              <TagFilterPopover
                tags={data?.tags ?? []}
                selectedIds={heatmapTagIds}
                onChange={setHeatmapTagIds}
              />
            </div>
            {(heatmapStart || heatmapEnd || heatmapTagIds.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => {
                  setHeatmapStart("");
                  setHeatmapEnd("");
                  setHeatmapTagIds([]);
                }}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Réinitialiser
              </Button>
            )}
            <div className="ml-auto text-xs text-muted-foreground">
              {stats.heatmapTotal} demande(s) dans la sélection
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="text-xs border-separate border-spacing-px">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  {Array.from({ length: 24 }).map((_, h) => (
                    <th key={h} className="w-7 text-center font-normal text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dayLabels.map((dayLabel, dow) => (
                  <tr key={dow}>
                    <td className="pr-2 text-right font-medium text-muted-foreground">{dayLabel}</td>
                    {stats.heatmap[dow].map((v, h) => {
                      const intensity = stats.heatmapMax ? v / stats.heatmapMax : 0;
                      const bg = v === 0 ? "hsl(var(--muted))" : `rgba(59, 130, 246, ${0.15 + intensity * 0.85})`;
                      return (
                        <td
                          key={h}
                          title={`${dayLabel} ${h}h — ${v} demande(s)`}
                          className="w-7 h-7 text-center text-[10px]"
                          style={{ backgroundColor: bg, color: intensity > 0.5 ? "white" : "inherit" }}
                        >
                          {v || ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* User agents + Mobile vs Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top navigateurs / OS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.uaTop} dataKey="value" nameKey="name" outerRadius={90} label>
                    {stats.uaTop.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Mobile vs Desktop</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <DeviceBar label="Desktop" pct={desktopPct} count={stats.desktop} color="#3b82f6" />
              <DeviceBar label="Mobile" pct={mobilePct} count={stats.mobile} color="#10b981" />
              <DeviceBar label="Tablette" pct={tabletPct} count={stats.tablet} color="#f59e0b" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top pages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top pages d'entrée — conversion & valeur moyenne</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left text-muted-foreground">
                <th className="py-2">Page</th>
                <th className="py-2 text-right">Demandes</th>
                <th className="py-2 text-right">Gagnées</th>
                <th className="py-2 text-right">Taux</th>
                <th className="py-2 text-right">Valeur moy.</th>
              </tr>
            </thead>
            <tbody>
              {stats.topPages.map((p) => (
                <tr key={p.page} className="border-b last:border-0">
                  <td className="py-2 font-mono text-xs truncate max-w-[420px]">{p.page}</td>
                  <td className="py-2 text-right">{p.count}</td>
                  <td className="py-2 text-right text-green-600">{p.won}</td>
                  <td className="py-2 text-right">{p.conversion}%</td>
                  <td className="py-2 text-right">{p.avgValue ? eur(p.avgValue) : "—"}</td>
                </tr>
              ))}
              {stats.topPages.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-muted-foreground">
                    Aucune page d'entrée détectée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Top referrers */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top referrers (hors supertilt.fr)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left text-muted-foreground">
                <th className="py-2">Domaine</th>
                <th className="py-2 text-right">Demandes</th>
              </tr>
            </thead>
            <tbody>
              {stats.topReferrers.map((r) => (
                <tr key={r.host} className="border-b last:border-0">
                  <td className="py-2">{r.host}</td>
                  <td className="py-2 text-right">{r.count}</td>
                </tr>
              ))}
              {stats.topReferrers.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-4 text-center text-muted-foreground">
                    Aucun referrer externe détecté.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Délai 1ère réponse */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Délai moyen de 1ʳᵉ réponse commerciale</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Stat label="Délai moyen" value={stats.delayCount ? `${stats.avgDelay.toFixed(1)} h` : "—"} />
            <Stat label="≤ 1 h" value={`${stats.under1h}`} color="text-green-600" />
            <Stat label="≤ 24 h" value={`${stats.under24h}`} color="text-amber-600" />
            <Stat label="> 24 h" value={`${stats.over24h}`} color="text-red-600" />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Calculé sur {stats.delayCount} opportunité(s) ayant un email envoyé après réception.
          </p>
        </CardContent>
      </Card>

      {/* Heures rentables (WON) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Heures de réception qui produisent des WON</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.wonHourBuckets}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={1} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Saisonnalité par type */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Saisonnalité — Formation vs Mission</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.seasonality}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="formation" name="Formation" stackId="a" fill="#3b82f6" />
                <Bar dataKey="mission" name="Mission" stackId="a" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${color ?? ""}`}>{value}</div>
    </div>
  );
}

function DeviceBar({ label, pct, count, color }: { label: string; pct: number; count: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="text-muted-foreground">{pct}% — {count}</span>
      </div>
      <div className="h-2 rounded bg-muted overflow-hidden">
        <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function TagFilterPopover({
  tags,
  selectedIds,
  onChange,
}: {
  tags: CrmTag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const grouped = useMemo(() => {
    const m = new Map<string, CrmTag[]>();
    for (const t of tags) {
      const cat = t.category || "Sans catégorie";
      const arr = m.get(cat) || [];
      arr.push(t);
      m.set(cat, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.name.localeCompare(b.name));
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tags]);

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 min-w-[180px] justify-between">
          <span className="truncate">
            {selectedIds.length === 0 ? "Tous les tags" : `${selectedIds.length} tag(s)`}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="max-h-80 overflow-y-auto p-2 space-y-3">
          {grouped.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">Aucun tag disponible.</p>
          )}
          {grouped.map(([cat, list]) => (
            <div key={cat}>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-1 mb-1">{cat}</div>
              <div className="space-y-1">
                {list.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={selectedIds.includes(t.id)}
                      onCheckedChange={() => toggle(t.id)}
                    />
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={{ borderColor: t.color, color: t.color }}
                    >
                      {t.name}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {selectedIds.length > 0 && (
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" className="w-full h-7" onClick={() => onChange([])}>
              Effacer la sélection
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
