import { AlertCircle, ArrowUpRight, Copy, Target, TrendingDown, TrendingUp, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import type { GscOpportunities } from "@/hooks/useGscStatistics";

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtNum = (v: number) => v.toLocaleString("fr-FR");
const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

function Section({
  title,
  help,
  icon: Icon,
  children,
  empty,
}: {
  title: string;
  help: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  empty: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{help}</p>
      </CardHeader>
      <CardContent>
        {empty ? <p className="text-sm text-muted-foreground">Rien à signaler sur cette période</p> : children}
      </CardContent>
    </Card>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-auto max-h-[340px]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            {head.map((h, i) => (
              <th key={h} className={`py-2 pr-4 font-medium text-muted-foreground ${i === 0 ? "" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const SeoOpportunitiesPanel = ({ data, isLoading, error }: { data?: GscOpportunities; isLoading: boolean; error: unknown }) => {
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

  return (
    <div className="space-y-4">
      <Section
        title="Quick wins"
        help="Requêtes en position 4 à 20 : le gain de clics indiqué correspond au passage en position 3."
        icon={Target}
        empty={data.quick_wins.length === 0}
      >
        <Table head={["Requête", "Position", "Impressions", "Clics", "Gain potentiel"]}>
          {data.quick_wins.map((r) => (
            <tr key={r.query} className="border-b border-border/50">
              <td className="py-1.5 pr-4 truncate max-w-[300px]">{r.query}</td>
              <td className="py-1.5 pr-4 text-right">{r.position.toFixed(1)}</td>
              <td className="py-1.5 pr-4 text-right">{fmtNum(r.impressions)}</td>
              <td className="py-1.5 pr-4 text-right">{fmtNum(r.clicks)}</td>
              <td className="py-1.5 pr-4 text-right font-medium text-emerald-600">+{fmtNum(r.potential_extra_clicks)}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section
        title="CTR anormalement bas"
        help="Pages bien positionnées mais peu cliquées : le titre et la description affichés dans Google sont à retravailler."
        icon={ArrowUpRight}
        empty={data.low_ctr_pages.length === 0}
      >
        <Table head={["Page", "Position", "Impressions", "CTR", "CTR attendu"]}>
          {data.low_ctr_pages.map((r) => (
            <tr key={r.page} className="border-b border-border/50">
              <td className="py-1.5 pr-4 truncate max-w-[320px]" title={r.page}>{shortUrl(r.page)}</td>
              <td className="py-1.5 pr-4 text-right">{r.position.toFixed(1)}</td>
              <td className="py-1.5 pr-4 text-right">{fmtNum(r.impressions)}</td>
              <td className="py-1.5 pr-4 text-right text-destructive font-medium">{fmtPct(r.ctr)}</td>
              <td className="py-1.5 pr-4 text-right text-muted-foreground">{fmtPct(r.expected_ctr)}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section
        title="Cannibalisation"
        help="Une même requête servie par plusieurs pages : consolider ou différencier les contenus."
        icon={Copy}
        empty={data.cannibalisation.length === 0}
      >
        <Table head={["Requête", "Pages", "Impressions", "Meilleure position"]}>
          {data.cannibalisation.map((r) => (
            <tr key={r.query} className="border-b border-border/50">
              <td className="py-1.5 pr-4">
                <div className="truncate max-w-[320px]">{r.query}</div>
                <div className="text-xs text-muted-foreground truncate max-w-[320px]">{r.pages.map(shortUrl).join(" · ")}</div>
              </td>
              <td className="py-1.5 pr-4 text-right">{r.page_count}</td>
              <td className="py-1.5 pr-4 text-right">{fmtNum(r.impressions)}</td>
              <td className="py-1.5 pr-4 text-right">{Number(r.best_position).toFixed(1)}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Pages en déclin"
          help="Perte d'au moins 25 % de clics par rapport à la période précédente."
          icon={TrendingDown}
          empty={data.declining_pages.length === 0}
        >
          <Table head={["Page", "Clics", "Avant", "Écart"]}>
            {data.declining_pages.map((r) => (
              <tr key={r.page} className="border-b border-border/50">
                <td className="py-1.5 pr-4 truncate max-w-[220px]" title={r.page}>{shortUrl(r.page)}</td>
                <td className="py-1.5 pr-4 text-right">{fmtNum(r.clicks)}</td>
                <td className="py-1.5 pr-4 text-right text-muted-foreground">{fmtNum(r.previous_clicks)}</td>
                <td className="py-1.5 pr-4 text-right text-destructive font-medium">{r.variation_pct?.toFixed(0)}%</td>
              </tr>
            ))}
          </Table>
        </Section>

        <Section
          title="Sujets en croissance"
          help="Requêtes dont les impressions progressent d'au moins 40 % : matière pour les prochains contenus."
          icon={TrendingUp}
          empty={data.rising_queries.length === 0}
        >
          <Table head={["Requête", "Impressions", "Avant", "Écart"]}>
            {data.rising_queries.map((r) => (
              <tr key={r.query} className="border-b border-border/50">
                <td className="py-1.5 pr-4 truncate max-w-[220px]">{r.query}</td>
                <td className="py-1.5 pr-4 text-right">{fmtNum(r.impressions)}</td>
                <td className="py-1.5 pr-4 text-right text-muted-foreground">{fmtNum(r.previous_impressions)}</td>
                <td className="py-1.5 pr-4 text-right text-emerald-600 font-medium">
                  {r.variation_pct === null ? "nouveau" : `+${r.variation_pct.toFixed(0)}%`}
                </td>
              </tr>
            ))}
          </Table>
        </Section>
      </div>

      <Section
        title="Visibilité dans les moteurs génératifs"
        help="Visites venues de ChatGPT, Perplexity, Gemini ou Copilot, mesurées côté WordPress. Aucune API ne mesure les citations elles-mêmes : c'est la seule donnée factuelle disponible."
        icon={Sparkles}
        empty={data.geo_referrals.length === 0}
      >
        <div className="flex flex-wrap gap-2">
          {data.geo_referrals.map((r) => (
            <Badge key={r.source} variant="secondary" className="text-sm">
              {r.source} · {fmtNum(r.views)} visites
            </Badge>
          ))}
        </div>
      </Section>
    </div>
  );
};

export default SeoOpportunitiesPanel;
