import { useMemo, useState } from "react";
import { AlertCircle, FileCheck2, FileWarning, Map } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { GscIndexation } from "@/hooks/useGscStatistics";

const fmtNum = (v: number) => v.toLocaleString("fr-FR");
const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "—");

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
        <div className="text-xl font-bold">{value}</div>
        {hint ? <div className="text-xs text-muted-foreground mt-1">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

const SeoIndexationPanel = ({ data, isLoading, error }: { data?: GscIndexation; isLoading: boolean; error: unknown }) => {
  const [filter, setFilter] = useState<"all" | "not_indexed" | "indexed">("not_indexed");

  const rows = useMemo(() => {
    const list = data?.inspections ?? [];
    if (filter === "indexed") return list.filter((r) => r.verdict === "PASS");
    if (filter === "not_indexed") return list.filter((r) => r.verdict !== "PASS");
    return list;
  }, [data, filter]);

  if (isLoading) return <div className="flex justify-center py-10"><Spinner /></div>;

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { summary, coverage } = data;
  const notInspected = Math.max(0, summary.articles_published - summary.inspected);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Articles publiés" value={fmtNum(summary.articles_published)} />
        <Stat
          label="URL inspectées"
          value={fmtNum(summary.inspected)}
          hint={notInspected > 0 ? `${fmtNum(notInspected)} pas encore inspectées` : "corpus couvert"}
        />
        <Stat
          label="Indexées"
          value={fmtNum(summary.indexed)}
          hint={summary.inspected > 0 ? `${Math.round((summary.indexed / summary.inspected) * 100)}% des inspectées` : undefined}
        />
        <Stat label="Résultats enrichis" value={fmtNum(summary.with_rich_results)} hint="pages avec balisage détecté" />
      </div>

      <p className="text-xs text-muted-foreground">
        Inspection progressive : Google limite l'API à 2000 URL par jour, le cron balaie le corpus par lots et rafraîchit
        ensuite les plus anciennes. Dernière inspection : {fmtDate(coverage.last_inspection)}.
      </p>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            {filter === "indexed" ? <FileCheck2 className="h-4 w-4" /> : <FileWarning className="h-4 w-4" />}
            État d'indexation
          </CardTitle>
          <ToggleGroup type="single" size="sm" variant="outline" value={filter} onValueChange={(v) => v && setFilter(v as typeof filter)}>
            <ToggleGroupItem value="not_indexed">Non indexées</ToggleGroupItem>
            <ToggleGroupItem value="indexed">Indexées</ToggleGroupItem>
            <ToggleGroupItem value="all">Toutes</ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune URL dans cette catégorie</p>
          ) : (
            <div className="overflow-auto max-h-[420px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4 font-medium text-muted-foreground">URL</th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Couverture</th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Dernière exploration</th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Enrichis</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 300).map((r) => (
                    <tr key={r.url} className="border-b border-border/50">
                      <td className="py-1.5 pr-4 truncate max-w-[340px]" title={r.url}>{shortUrl(r.url)}</td>
                      <td className="py-1.5 pr-4">
                        <span className={r.verdict === "PASS" ? "text-emerald-600" : "text-amber-600"}>
                          {r.coverage_state || r.error || r.verdict || "—"}
                        </span>
                      </td>
                      <td className="py-1.5 pr-4 text-muted-foreground">{fmtDate(r.last_crawl_time)}</td>
                      <td className="py-1.5 pr-4">
                        {(r.rich_result_types ?? []).length > 0 ? (r.rich_result_types ?? []).join(", ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Map className="h-4 w-4" />
            Sitemaps
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.sitemaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun sitemap synchronisé</p>
          ) : (
            <div className="space-y-2">
              {data.sitemaps.map((s) => (
                <div key={s.path} className="flex flex-wrap items-center gap-2 text-sm border-b border-border/50 pb-2">
                  <span className="truncate max-w-[380px]">{shortUrl(s.path)}</span>
                  <span className="text-xs text-muted-foreground">lu le {fmtDate(s.last_downloaded)}</span>
                  {s.errors > 0 ? <Badge variant="destructive">{s.errors} erreurs</Badge> : null}
                  {s.warnings > 0 ? <Badge variant="secondary">{s.warnings} avertissements</Badge> : null}
                  {s.is_pending ? <Badge variant="outline">en attente</Badge> : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SeoIndexationPanel;
