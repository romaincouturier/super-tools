/**
 * Serialize CRM reporting data (the values shown on /crm/reports) into a plain
 * text block that can be injected as Arena session context. Mirrors the pattern
 * of `commercial-coach-context.ts`: pure function, typed input, text output.
 */
import type { CrmTag } from "@/types/crm";
import { fmtEuro } from "@/lib/commercial-coach-context";

interface CardWithTags {
  id: string;
  estimated_value: number | null;
  sales_status: string;
  tagObjects: CrmTag[];
}

interface WeeklyPoint {
  week: string;
  weekStart: string;
  openValue: number;
  weightedValue: number;
  wonValue: number;
  lostValue: number;
  wonCount: number;
  lostCount: number;
  conversionRate: number;
}

export interface CrmReportsForContext {
  wonCount: number;
  wonValue: number;
  lostCount: number;
  lostValue: number;
  openCount: number;
  openValue: number;
  weightedPipeline: number;
  cardsWithTags: CardWithTags[];
  pipelineCardsWithTags: CardWithTags[];
  categories: string[];
  weeklyData: WeeklyPoint[];
}

/** Aggregate sum of estimated_value of cards carrying a given tag (deduped). */
function sumByTag(cards: CardWithTags[], category: string): Map<string, { count: number; total: number }> {
  const map = new Map<string, { count: number; total: number }>();
  for (const card of cards) {
    const tagNames = new Set(
      card.tagObjects.filter((t) => t.category === category).map((t) => t.name),
    );
    for (const name of tagNames) {
      const entry = map.get(name) || { count: 0, total: 0 };
      entry.count += 1;
      entry.total += card.estimated_value || 0;
      map.set(name, entry);
    }
  }
  return map;
}

export function buildCrmReportsContext(
  reports: CrmReportsForContext,
  periodLabel: string,
): string {
  const closed = reports.wonCount + reports.lostCount;
  const winRate = closed > 0 ? Math.round((reports.wonCount / closed) * 100) : 0;

  const lines: string[] = [];
  lines.push(`>> Reporting CRM (${periodLabel})`);
  lines.push("");
  lines.push("KPIs:");
  lines.push(`- Pipeline ouvert: ${fmtEuro(reports.openValue)} sur ${reports.openCount} opportunite(s)`);
  lines.push(`- Pipeline pondere (confiance x valeur): ${fmtEuro(Math.round(reports.weightedPipeline))}`);
  lines.push(`- Gagne: ${fmtEuro(reports.wonValue)} sur ${reports.wonCount} vente(s)`);
  lines.push(`- Perdu: ${fmtEuro(reports.lostValue)} sur ${reports.lostCount} opportunite(s)`);
  lines.push(`- Taux de conversion: ${winRate}% (sur ${closed} cloturee(s))`);

  // Tag breakdowns — give the agents segment-level context
  if (reports.categories.length > 0) {
    lines.push("");
    lines.push("Repartition par categorie de tag (pipeline ouvert):");
    for (const category of reports.categories) {
      const byTag = sumByTag(reports.pipelineCardsWithTags, category);
      if (byTag.size === 0) continue;
      const sorted = [...byTag.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 6);
      lines.push(`- ${category}:`);
      for (const [name, { count, total }] of sorted) {
        lines.push(`  * ${name}: ${count} opp., ${fmtEuro(total)}`);
      }
    }

    lines.push("");
    lines.push("Repartition par categorie de tag (gagne sur la periode):");
    const wonOnly = reports.cardsWithTags.filter((c) => c.sales_status === "WON");
    let printedWonAny = false;
    for (const category of reports.categories) {
      const byTag = sumByTag(wonOnly, category);
      if (byTag.size === 0) continue;
      printedWonAny = true;
      const sorted = [...byTag.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 6);
      lines.push(`- ${category}:`);
      for (const [name, { count, total }] of sorted) {
        lines.push(`  * ${name}: ${count} vente(s), ${fmtEuro(total)}`);
      }
    }
    if (!printedWonAny) {
      lines.push("- (aucune opportunite gagnee taggee sur la periode)");
    }
  }

  // Weekly trend — last 8 weeks is enough for short-term reasoning
  if (reports.weeklyData.length > 0) {
    lines.push("");
    lines.push("Tendance hebdomadaire (8 dernieres semaines):");
    const recent = reports.weeklyData.slice(-8);
    for (const w of recent) {
      const parts = [
        `semaine du ${w.week}`,
        `pipeline ouvert ${fmtEuro(w.openValue)}`,
        `gagne ${fmtEuro(w.wonValue)} (${w.wonCount})`,
        `perdu ${fmtEuro(w.lostValue)} (${w.lostCount})`,
        `conversion ${w.conversionRate}%`,
      ];
      lines.push(`- ${parts.join(" | ")}`);
    }
  }

  return lines.join("\n");
}
