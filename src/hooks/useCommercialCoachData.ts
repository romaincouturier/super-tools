import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/integrations/supabase/client";
import { loadArenaApiKeys, saveArenaApiKeys } from "@/lib/arena/api";
import { TEMPLATES } from "@/lib/arena/templates";
import type { SessionConfig, ApiKeys } from "@/lib/arena/types";
import type { CrmColumn, CrmCard, CrmRevenueTarget, CommercialCoachContext } from "@/types/crm";
import { acquisitionSourceConfig, lossReasonConfig } from "@/types/crm";
import type { OKRObjective, OKRKeyResult } from "@/types/okr";
import type { Mission } from "@/types/missions";
import { useToast } from "@/hooks/use-toast";

// Format a number as euros
const fmtEuro = (v: number | null | undefined) =>
  v != null ? `${v.toLocaleString("fr-FR")}€` : "—";

// Claude is always available via server-side key
function hasAnyProvider(_keys: ApiKeys): boolean {
  return true;
}

// Build annual ambition context from configurable text + OKRs
function buildAmbitionContext(
  objectives: (OKRObjective & { okr_key_results: OKRKeyResult[] })[],
  ambitionText?: string
): string {
  const currentYear = new Date().getFullYear();
  let result = "";

  // User-defined ambition text (from settings)
  if (ambitionText?.trim()) {
    result += `Vision et ambition ${currentYear} (definie par l'utilisateur):\n${ambitionText}\n`;
  }

  // OKR annual objectives complement the ambition
  const annualObjectives = objectives.filter(
    (obj) => obj.time_target === "annual" && obj.target_year === currentYear
  );

  if (annualObjectives.length > 0) {
    result += `\nOKR annuels ${currentYear}:\n`;
    for (const obj of annualObjectives) {
      result += `\n★ ${obj.title}`;
      if (obj.description) result += `\n  Vision: ${obj.description}`;
      result += `\n  Progression: ${obj.progress_percentage}% | Confiance: ${obj.confidence_level}%`;

      const krs = obj.okr_key_results || [];
      if (krs.length > 0) {
        result += `\n  Resultats cles:`;
        for (const kr of krs) {
          const val =
            kr.target_value != null
              ? `${kr.current_value}/${kr.target_value} ${kr.unit || ""}`
              : `${kr.progress_percentage}%`;
          result += `\n    - ${kr.title} → ${val} (${kr.progress_percentage}%)`;
        }
      }
    }
  }

  if (!result.trim()) {
    return "Aucune ambition annuelle definie. Allez dans les parametres du Coach Commercial pour definir votre ambition.";
  }

  return result;
}

// Build OKR context block from live data (non-annual objectives for current year)
function buildOKRContext(
  objectives: (OKRObjective & { okr_key_results: OKRKeyResult[] })[]
): string {
  const currentYear = new Date().getFullYear();
  const nonAnnual = objectives.filter(
    (obj) => !(obj.time_target === "annual" && obj.target_year === currentYear)
  );

  if (!nonAnnual.length) return "Aucun OKR periodique actif.";

  return nonAnnual
    .map((obj) => {
      const krs = (obj.okr_key_results || [])
        .map((kr) => {
          const val =
            kr.target_value != null
              ? `${kr.current_value}/${kr.target_value} ${kr.unit || ""}`
              : `${kr.progress_percentage}%`;
          return `  - ${kr.title} → ${val} (${kr.progress_percentage}%)`;
        })
        .join("\n");
      return `- ${obj.title} (${obj.time_target} ${obj.target_year}, progression: ${obj.progress_percentage}%, confiance: ${obj.confidence_level}%)\n${krs}`;
    })
    .join("\n");
}

// Build CRM pipeline context from live data — with dedicated won/lost sections & confidence
function buildCRMContext(columns: CrmColumn[], cards: CrmCard[]): string {
  if (!cards.length) return "Pipeline vide.";

  const colMap = new Map(columns.map((c) => [c.id, c.name]));

  // Separate cards by status
  const openCards = cards.filter((c) => c.sales_status === "OPEN");
  const wonCards = cards.filter((c) => c.sales_status === "WON");
  const lostCards = cards.filter((c) => c.sales_status === "LOST");

  let result = "";

  // --- OPEN PIPELINE (grouped by column) ---
  result += ">> Pipeline ouvert (opportunites en cours):\n";
  const grouped = new Map<string, { count: number; total: number; items: string[] }>();
  for (const col of columns) {
    grouped.set(col.name, { count: 0, total: 0, items: [] });
  }

  for (const card of openCards) {
    const colName = colMap.get(card.column_id) || "Inconnu";
    const g = grouped.get(colName) || { count: 0, total: 0, items: [] };
    g.count++;
    g.total += card.estimated_value || 0;
    const daysInPipeline = card.created_at
      ? Math.floor((Date.now() - new Date(card.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const parts = [
      card.title,
      card.company ? `(${card.company})` : null,
      card.estimated_value ? fmtEuro(card.estimated_value) : null,
      card.service_type ? `[${card.service_type}]` : null,
      card.confidence_score != null ? `confiance: ${card.confidence_score}%` : null,
      card.acquisition_source ? `source: ${acquisitionSourceConfig[card.acquisition_source]}` : null,
      daysInPipeline != null ? `${daysInPipeline}j dans le pipeline` : null,
    ]
      .filter(Boolean)
      .join(" ");
    g.items.push(parts);
    grouped.set(colName, g);
  }

  for (const [colName, g] of grouped) {
    if (g.count > 0) {
      result += `  ${colName}: ${g.count} opportunite(s) (${fmtEuro(g.total)})\n`;
      for (const item of g.items) {
        result += `    - ${item}\n`;
      }
    }
  }

  const totalOpen = openCards.reduce((s, c) => s + (c.estimated_value || 0), 0);
  result += `  Total pipeline ouvert: ${fmtEuro(totalOpen)} (${openCards.length} deals)\n`;

  // --- Weighted pipeline (using confidence scores) ---
  const cardsWithConfidence = openCards.filter((c) => c.confidence_score != null);
  if (cardsWithConfidence.length > 0) {
    const weightedTotal = cardsWithConfidence.reduce(
      (s, c) => s + (c.estimated_value || 0) * ((c.confidence_score || 0) / 100),
      0
    );
    const avgConfidence = Math.round(
      cardsWithConfidence.reduce((s, c) => s + (c.confidence_score || 0), 0) /
        cardsWithConfidence.length
    );
    result += `  Pipeline pondere (confiance): ${fmtEuro(weightedTotal)} (confiance moyenne: ${avgConfidence}%)\n`;
  }

  // --- DEALS AT RISK (low confidence) ---
  const atRisk = openCards.filter(
    (c) => c.confidence_score != null && c.confidence_score < 40 && (c.estimated_value || 0) > 0
  );
  if (atRisk.length > 0) {
    result += `\n>> Deals a risque (confiance < 40%):\n`;
    for (const card of atRisk) {
      result += `  - ${card.title} ${card.company ? `(${card.company})` : ""} ${fmtEuro(card.estimated_value)} — confiance: ${card.confidence_score}%\n`;
    }
  }

  // --- WON DEALS ---
  if (wonCards.length > 0) {
    const totalWon = wonCards.reduce((s, c) => s + (c.estimated_value || 0), 0);
    result += `\n>> Deals GAGNES (${wonCards.length} deals, total: ${fmtEuro(totalWon)}):\n`;
    for (const card of wonCards) {
      const parts = [
        card.title,
        card.company ? `(${card.company})` : null,
        card.estimated_value ? fmtEuro(card.estimated_value) : null,
        card.service_type ? `[${card.service_type}]` : null,
      ]
        .filter(Boolean)
        .join(" ");
      result += `  ✓ ${parts}\n`;
    }
  } else {
    result += `\n>> Deals GAGNES: Aucun deal gagne pour le moment.\n`;
  }

  // --- LOST DEALS (with loss reasons) ---
  if (lostCards.length > 0) {
    const totalLost = lostCards.reduce((s, c) => s + (c.estimated_value || 0), 0);
    result += `\n>> Deals PERDUS (${lostCards.length}, total perdu: ${fmtEuro(totalLost)}):\n`;
    for (const card of lostCards) {
      const parts = [
        card.title,
        card.company ? `(${card.company})` : null,
        card.estimated_value ? fmtEuro(card.estimated_value) : null,
        card.service_type ? `[${card.service_type}]` : null,
        card.loss_reason ? `raison: ${lossReasonConfig[card.loss_reason]}` : null,
        card.loss_reason_detail ? `(${card.loss_reason_detail})` : null,
      ]
        .filter(Boolean)
        .join(" ");
      result += `  ✗ ${parts}\n`;
    }

    // Loss reason breakdown
    const reasonCounts = new Map<string, number>();
    for (const card of lostCards) {
      if (card.loss_reason) {
        const label = lossReasonConfig[card.loss_reason];
        reasonCounts.set(label, (reasonCounts.get(label) || 0) + 1);
      }
    }
    if (reasonCounts.size > 0) {
      result += `  Repartition des raisons de perte:\n`;
      for (const [reason, count] of [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])) {
        result += `    - ${reason}: ${count} deal(s)\n`;
      }
    }
  }

  // --- VELOCITY METRICS ---
  result += `\n>> Velocite commerciale:\n`;

  // Average days to close (won deals)
  const wonWithDates = wonCards.filter((c) => c.created_at && c.won_at);
  if (wonWithDates.length > 0) {
    const avgDaysToWin = Math.round(
      wonWithDates.reduce((s, c) => {
        const days = Math.floor((new Date(c.won_at!).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24));
        return s + days;
      }, 0) / wonWithDates.length
    );
    result += `  - Delai moyen de closing (deals gagnes): ${avgDaysToWin} jours\n`;
  }

  // Average days to lose
  const lostWithDates = lostCards.filter((c) => c.created_at && c.lost_at);
  if (lostWithDates.length > 0) {
    const avgDaysToLose = Math.round(
      lostWithDates.reduce((s, c) => {
        const days = Math.floor((new Date(c.lost_at!).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24));
        return s + days;
      }, 0) / lostWithDates.length
    );
    result += `  - Delai moyen de perte: ${avgDaysToLose} jours\n`;
  }

  // Stagnation alerts (open deals > 30 days without activity)
  const stagnatingDeals = openCards.filter((c) => {
    if (!c.created_at) return false;
    const days = Math.floor((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return days > 30;
  });
  if (stagnatingDeals.length > 0) {
    result += `\n>> ALERTE STAGNATION (deals ouverts > 30 jours):\n`;
    for (const card of stagnatingDeals) {
      const days = Math.floor((Date.now() - new Date(card.created_at).getTime()) / (1000 * 60 * 60 * 24));
      result += `  ⚠ ${card.title} ${card.company ? `(${card.company})` : ""} — ${days} jours, ${fmtEuro(card.estimated_value)}\n`;
    }
  }

  // --- CONVERSION METRICS ---
  const winRate =
    wonCards.length + lostCards.length > 0
      ? Math.round((wonCards.length / (wonCards.length + lostCards.length)) * 100)
      : 0;
  result += `\n>> Metriques de conversion:\n`;
  result += `  - Taux de conversion: ${winRate}% (${wonCards.length} gagnes / ${wonCards.length + lostCards.length} clotures)\n`;
  result += `  - Total en cours: ${openCards.length} deals\n`;
  result += `  - Total traites: ${wonCards.length + lostCards.length} deals\n`;

  // Acquisition source breakdown for open deals
  const sourceCounts = new Map<string, number>();
  for (const card of openCards) {
    if (card.acquisition_source) {
      const label = acquisitionSourceConfig[card.acquisition_source];
      sourceCounts.set(label, (sourceCounts.get(label) || 0) + 1);
    }
  }
  if (sourceCounts.size > 0) {
    result += `  - Sources d'acquisition (pipeline ouvert):\n`;
    for (const [source, count] of [...sourceCounts.entries()].sort((a, b) => b[1] - a[1])) {
      result += `      ${source}: ${count} deal(s)\n`;
    }
  }

  return result;
}

// Build acquisition structure analysis
function buildAcquisitionContext(cards: CrmCard[], missions: Mission[], acquisitionText?: string): string {
  let result = "";

  // User-defined acquisition structure description (from settings)
  if (acquisitionText?.trim()) {
    result += `Description de la structure d'acquisition (definie par l'utilisateur):\n${acquisitionText}\n\n`;
  }

  result += "Analyse des donnees CRM:\n";

  // --- Breakdown by service type ---
  const formationCards = cards.filter((c) => c.service_type === "formation");
  const missionCards = cards.filter((c) => c.service_type === "mission");
  const unclassifiedCards = cards.filter((c) => !c.service_type);

  const formationOpen = formationCards.filter((c) => c.sales_status === "OPEN");
  const formationWon = formationCards.filter((c) => c.sales_status === "WON");
  const formationLost = formationCards.filter((c) => c.sales_status === "LOST");
  const missionOpen = missionCards.filter((c) => c.sales_status === "OPEN");
  const missionWon = missionCards.filter((c) => c.sales_status === "WON");
  const missionLost = missionCards.filter((c) => c.sales_status === "LOST");

  result += "Repartition par type de service:\n";
  result += `  Formations: ${formationCards.length} total (${formationOpen.length} en cours, ${formationWon.length} gagnes, ${formationLost.length} perdus)\n`;
  result += `    - Pipeline ouvert: ${fmtEuro(formationOpen.reduce((s, c) => s + (c.estimated_value || 0), 0))}\n`;
  result += `    - CA gagne: ${fmtEuro(formationWon.reduce((s, c) => s + (c.estimated_value || 0), 0))}\n`;
  if (formationWon.length + formationLost.length > 0) {
    result += `    - Taux conversion: ${Math.round((formationWon.length / (formationWon.length + formationLost.length)) * 100)}%\n`;
  }

  result += `  Missions: ${missionCards.length} total (${missionOpen.length} en cours, ${missionWon.length} gagnes, ${missionLost.length} perdus)\n`;
  result += `    - Pipeline ouvert: ${fmtEuro(missionOpen.reduce((s, c) => s + (c.estimated_value || 0), 0))}\n`;
  result += `    - CA gagne: ${fmtEuro(missionWon.reduce((s, c) => s + (c.estimated_value || 0), 0))}\n`;
  if (missionWon.length + missionLost.length > 0) {
    result += `    - Taux conversion: ${Math.round((missionWon.length / (missionWon.length + missionLost.length)) * 100)}%\n`;
  }

  if (unclassifiedCards.length > 0) {
    result += `  Non classifie: ${unclassifiedCards.length} opportunites\n`;
  }

  // --- Average deal value ---
  const allWon = cards.filter((c) => c.sales_status === "WON");
  if (allWon.length > 0) {
    const avgDealValue = allWon.reduce((s, c) => s + (c.estimated_value || 0), 0) / allWon.length;
    result += `\nPanier moyen deals gagnes: ${fmtEuro(avgDealValue)}\n`;

    const formationAvg = formationWon.length > 0
      ? formationWon.reduce((s, c) => s + (c.estimated_value || 0), 0) / formationWon.length
      : 0;
    const missionAvg = missionWon.length > 0
      ? missionWon.reduce((s, c) => s + (c.estimated_value || 0), 0) / missionWon.length
      : 0;
    if (formationWon.length > 0) result += `  - Panier moyen formations: ${fmtEuro(formationAvg)}\n`;
    if (missionWon.length > 0) result += `  - Panier moyen missions: ${fmtEuro(missionAvg)}\n`;
  }

  // --- Top companies (recurring clients) ---
  const companyMap = new Map<string, { count: number; won: number; totalValue: number }>();
  for (const card of cards) {
    if (!card.company) continue;
    const key = card.company.toLowerCase();
    const existing = companyMap.get(key) || { count: 0, won: 0, totalValue: 0 };
    existing.count++;
    if (card.sales_status === "WON") existing.won++;
    existing.totalValue += card.estimated_value || 0;
    companyMap.set(key, existing);
  }

  const topCompanies = [...companyMap.entries()]
    .sort((a, b) => b[1].totalValue - a[1].totalValue)
    .slice(0, 5);

  if (topCompanies.length > 0) {
    result += `\nTop clients par valeur:\n`;
    for (const [company, stats] of topCompanies) {
      result += `  - ${company}: ${stats.count} opportunites, ${stats.won} gagnes, ${fmtEuro(stats.totalValue)} total\n`;
    }
  }

  // --- Mission delivery capacity ---
  const activeMissions = missions.filter(
    (m) => m.status === "in_progress" || m.status === "not_started"
  );
  const completedMissions = missions.filter((m) => m.status === "completed");
  result += `\nCapacite de delivery:\n`;
  result += `  - Missions actives: ${activeMissions.length}\n`;
  result += `  - Missions terminees: ${completedMissions.length}\n`;
  if (activeMissions.length > 0) {
    const totalActive = activeMissions.reduce((s, m) => s + (m.total_amount || 0), 0);
    const totalConsumed = activeMissions.reduce((s, m) => s + (m.consumed_amount || 0), 0);
    const consumptionRate = totalActive > 0 ? Math.round((totalConsumed / totalActive) * 100) : 0;
    result += `  - Montant missions actives: ${fmtEuro(totalActive)} (${consumptionRate}% consomme)\n`;
  }

  return result;
}

// Build revenue target context
function buildRevenueTargetContext(
  targets: CrmRevenueTarget[],
  wonCards: CrmCard[]
): string {
  if (!targets.length) {
    return "Aucun objectif de chiffre d'affaires defini. Il est recommande de definir des objectifs mensuels ou trimestriels.";
  }

  const now = new Date();
  let result = "Objectifs de chiffre d'affaires:\n";

  for (const target of targets) {
    const periodStart = new Date(target.period_start);
    let periodEnd: Date;
    let periodLabel: string;

    if (target.period_type === "monthly") {
      periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      periodLabel = periodStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    } else if (target.period_type === "quarterly") {
      periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 3);
      const quarter = Math.ceil((periodStart.getMonth() + 1) / 3);
      periodLabel = `T${quarter} ${periodStart.getFullYear()}`;
    } else {
      periodEnd = new Date(periodStart);
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      periodLabel = `Annee ${periodStart.getFullYear()}`;
    }

    // Calculate realized revenue from won deals in this period
    const realized = wonCards
      .filter((c) => {
        const wonDate = c.won_at ? new Date(c.won_at) : null;
        return wonDate && wonDate >= periodStart && wonDate < periodEnd;
      })
      .reduce((s, c) => s + (c.estimated_value || 0), 0);

    const progress = target.target_amount > 0
      ? Math.round((realized / target.target_amount) * 100)
      : 0;

    const isCurrent = now >= periodStart && now < periodEnd;
    const marker = isCurrent ? " ← PERIODE EN COURS" : "";

    result += `  ${target.period_type === "monthly" ? "📅" : target.period_type === "quarterly" ? "📊" : "🎯"} ${periodLabel}: ${fmtEuro(realized)} / ${fmtEuro(target.target_amount)} (${progress}%)${marker}\n`;

    if (isCurrent && target.target_amount > realized) {
      const remaining = target.target_amount - realized;
      const daysLeft = Math.max(1, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      result += `    → Reste ${fmtEuro(remaining)} a realiser en ${daysLeft} jours\n`;
    }
  }

  return result;
}

// Build calendar context from upcoming events
function buildCalendarContext(
  events: { summary: string; start: string; end: string; allDay: boolean; attendees: string[] }[]
): string {
  if (!events.length) return "Aucun evenement a venir dans les 14 prochains jours.";

  let result = `Agenda des 14 prochains jours (${events.length} evenements):\n`;
  for (const event of events) {
    const startDate = new Date(event.start);
    const dateStr = startDate.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
    const timeStr = event.allDay ? "journee entiere" : startDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const attendeesStr = event.attendees?.length ? ` (avec: ${event.attendees.join(", ")})` : "";
    result += `  - ${dateStr} ${timeStr}: ${event.summary}${attendeesStr}\n`;
  }

  return result;
}

// Build missions context from live data
function buildMissionsContext(missions: Mission[]): string {
  if (!missions.length) return "Aucune mission.";

  const byStatus: Record<string, Mission[]> = {};
  const statusLabels: Record<string, string> = {
    not_started: "A demarrer",
    in_progress: "En cours",
    completed: "Terminee",
    cancelled: "Annulee",
  };

  for (const m of missions) {
    const key = m.status || "not_started";
    if (!byStatus[key]) byStatus[key] = [];
    byStatus[key].push(m);
  }

  let result = "";
  for (const [status, label] of Object.entries(statusLabels)) {
    const ms = byStatus[status];
    if (ms && ms.length > 0) {
      result += `${label}: ${ms.length} mission(s)\n`;
      for (const m of ms) {
        const parts = [
          m.title,
          m.client_name ? `(${m.client_name})` : null,
          m.total_amount ? `Montant: ${fmtEuro(m.total_amount)}` : null,
          m.consumed_amount ? `Consomme: ${fmtEuro(m.consumed_amount)}` : null,
          m.billed_amount ? `Facture: ${fmtEuro(m.billed_amount)}` : null,
        ]
          .filter(Boolean)
          .join(" - ");
        result += `  - ${parts}\n`;
      }
    }
  }

  const active = [...(byStatus.not_started || []), ...(byStatus.in_progress || [])];
  const totalAmount = active.reduce((s, m) => s + (m.total_amount || 0), 0);
  const totalBilled = active.reduce((s, m) => s + (m.billed_amount || 0), 0);
  result += `\nResume missions actives: ${active.length} missions, montant total ${fmtEuro(totalAmount)}, facture ${fmtEuro(totalBilled)}`;

  return result;
}

// Build formations context from live data
function buildFormationsContext(
  trainings: { id: string; training_name: string; client_name: string; start_date: string; end_date: string | null; sold_price_ht: number | null }[],
  catalogue: { formation_name: string; prix: number | null; duree_heures: number | null }[]
): string {
  let result = "";

  if (trainings.length > 0) {
    result += `Formations planifiees (${trainings.length}):\n`;
    for (const t of trainings) {
      const parts = [
        t.training_name,
        t.client_name ? `(${t.client_name})` : null,
        t.start_date,
        t.sold_price_ht ? fmtEuro(t.sold_price_ht) : null,
      ]
        .filter(Boolean)
        .join(" - ");
      result += `  - ${parts}\n`;
    }
  } else {
    result += "Aucune formation planifiee.\n";
  }

  if (catalogue.length > 0) {
    result += `\nCatalogue formations (${catalogue.length}):\n`;
    for (const c of catalogue) {
      result += `  - ${c.formation_name} — ${c.prix != null ? fmtEuro(c.prix) : "prix libre"} — ${c.duree_heures || "?"}h\n`;
    }
  }

  return result;
}

// Main hook
export function useCommercialCoachData() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const launchCoach = async (customTopic?: string) => {
    setIsLoading(true);
    try {
      // Load API keys (Claude is always available via server-side key)
      const apiKeys = await loadArenaApiKeys();

      // Fetch all data in parallel
      const [okrRes, columnsRes, cardsRes, missionsRes, trainingsRes, catalogueRes, revenueTargetsRes, coachContextsRes] =
        await Promise.all([
          (supabase as any)
            .from("okr_objectives")
            .select(`*, okr_key_results ( id, title, description, target_value, current_value, unit, progress_percentage, confidence_level )`)
            .in("status", ["active", "draft"])
            .order("position", { ascending: true }),
          supabase
            .from("crm_columns")
            .select("*")
            .eq("is_archived", false)
            .order("position", { ascending: true }),
          supabase.from("crm_cards").select("*").order("position", { ascending: true }),
          (supabase as unknown as { from: (t: string) => { select: (c: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: Error | null }> } } })
            .from("missions")
            .select("*")
            .order("position", { ascending: true }),
          supabase
            .from("trainings")
            .select("id, training_name, client_name, start_date, end_date, sold_price_ht")
            .gte("start_date", new Date().toISOString().slice(0, 10))
            .order("start_date", { ascending: true }),
          supabase
            .from("formation_configs")
            .select("formation_name, prix, duree_heures")
            .order("display_order", { ascending: true }),
          (supabase as any)
            .from("crm_revenue_targets")
            .select("*")
            .order("period_start", { ascending: true }),
          (supabase as any)
            .from("commercial_coach_contexts")
            .select("*")
            .eq("year", new Date().getFullYear())
            .order("context_type", { ascending: true }),
        ]);

      // Fetch calendar events (non-blocking — calendar may not be connected)
      let calendarEvents: { summary: string; start: string; end: string; allDay: boolean; attendees: string[] }[] = [];
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const calRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-events?action=events`,
            { headers: { Authorization: `Bearer ${session.access_token}` } }
          );
          if (calRes.ok) {
            const calData = await calRes.json();
            calendarEvents = calData.events || [];
          }
        }
      } catch {
        // Calendar not connected — ignore silently
      }

      // Check for Supabase errors
      const errors: string[] = [];
      if (okrRes.error) errors.push(`OKR: ${okrRes.error.message}`);
      if (columnsRes.error) errors.push(`CRM colonnes: ${columnsRes.error.message}`);
      if (cardsRes.error) errors.push(`CRM cartes: ${cardsRes.error.message}`);
      if (missionsRes.error) errors.push(`Missions: ${(missionsRes.error as Error).message}`);
      if (trainingsRes.error) errors.push(`Formations: ${trainingsRes.error.message}`);
      if (catalogueRes.error) errors.push(`Catalogue: ${catalogueRes.error.message}`);
      // Revenue targets error is non-blocking
      if (revenueTargetsRes.error) console.warn("Revenue targets fetch error:", revenueTargetsRes.error.message);

      if (errors.length > 0) {
        toast({
          title: "Erreur de chargement",
          description: `Impossible de charger certaines donnees: ${errors.join(", ")}`,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Cast data
      const okrData = (okrRes.data || []) as (OKRObjective & { okr_key_results: OKRKeyResult[] })[];
      const columnsData = (columnsRes.data || []) as CrmColumn[];
      const cardsData = (cardsRes.data || []) as unknown as CrmCard[];
      const missionsData = (missionsRes.data || []) as Mission[];
      const trainingsData = (trainingsRes.data || []) as { id: string; training_name: string; client_name: string; start_date: string; end_date: string | null; sold_price_ht: number | null }[];
      const catalogueData = (catalogueRes.data || []) as { formation_name: string; prix: number | null; duree_heures: number | null }[];
      const revenueTargetsData = (revenueTargetsRes.data || []) as CrmRevenueTarget[];
      const coachContexts = (coachContextsRes.data || []) as CommercialCoachContext[];
      const ambitionText = coachContexts.find((c) => c.context_type === "ambition")?.content;
      const acquisitionText = coachContexts.find((c) => c.context_type === "acquisition_structure")?.content;

      // Build context blocks
      const ambitionContext = buildAmbitionContext(okrData, ambitionText);
      const okrContext = buildOKRContext(okrData);
      const crmContext = buildCRMContext(columnsData, cardsData);
      const acquisitionContext = buildAcquisitionContext(cardsData, missionsData, acquisitionText);
      const missionsContext = buildMissionsContext(missionsData);
      const formationsContext = buildFormationsContext(trainingsData, catalogueData);
      const wonCards = cardsData.filter((c) => c.sales_status === "WON");
      const revenueTargetContext = buildRevenueTargetContext(revenueTargetsData, wonCards);
      const calendarContext = buildCalendarContext(calendarEvents);

      const today = new Date().toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const additionalContext = `=== DONNEES COMMERCIALES EN TEMPS REEL (${today}) ===

--- AMBITION ANNUELLE ---
${ambitionContext}

--- OBJECTIFS CHIFFRE D'AFFAIRES ---
${revenueTargetContext}

--- OKR PERIODIQUES ---
${okrContext}

--- PIPELINE CRM (avec indices de confiance, velocite, stagnation) ---
${crmContext}

--- STRUCTURE D'ACQUISITION CLIENTS ---
${acquisitionContext}

--- KANBAN MISSIONS ---
${missionsContext}

--- FORMATIONS ---
${formationsContext}

--- AGENDA (14 prochains jours) ---
${calendarContext}

=== FIN DES DONNEES ===

Instructions : Utilisez TOUTES ces donnees reelles pour analyser la situation commerciale. Portez une attention particuliere a :
1. L'ambition annuelle et l'ecart avec la situation actuelle
2. Les objectifs CA et la progression par periode (mensuel/trimestriel)
3. Les deals gagnes ET perdus pour comprendre les patterns de conversion, les raisons de perte
4. Les indices de confiance pour identifier les deals a risque ou a accelerer
5. La velocite commerciale (delai moyen de closing, deals stagnants)
6. La structure d'acquisition (formation vs mission, sources) pour optimiser l'allocation d'effort
7. La capacite de delivery vs le pipeline ouvert
8. L'agenda pour contextualiser les recommandations d'actions avec les rendez-vous a venir
Ne demandez pas de donnees supplementaires, tout est ci-dessus.`;

      // Build session config from template
      const template = TEMPLATES.find((t) => t.id === "coach-commercial");
      if (!template) {
        toast({
          title: "Erreur",
          description: "Template Coach Commercial introuvable.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Always use Claude (server-side key available)
      const availableProvider: "claude" | "openai" | "gemini" = "claude";
      const defaultModel = "claude-haiku-4-5-20251001";

      const config: SessionConfig = {
        topic:
          customTopic ||
          "Analyse ma situation commerciale complete et produis un plan d'action structure avec : (1) ecart entre ambition annuelle et objectifs CA, (2) actions prioritaires cette semaine avec priorisation par indice de confiance et velocite, (3) plan de prospection physique pour missions et facilitation, (4) strategie d'acquisition en ligne pour les formations avec analyse des sources, (5) analyse des deals gagnes/perdus avec raisons de perte et patterns, (6) deals stagnants a debloquer, (7) jalons lies aux OKR, (8) recommandations basees sur l'agenda des 14 prochains jours.",
        additionalContext,
        mode: template.mode,
        userMode: "interventionist",
        agents: template.agents.map((a, i) => ({
          ...a,
          id: uuidv4(),
          provider: availableProvider,
          model: defaultModel,
          color: a.color || ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"][i],
        })),
        rules: template.rules,
      };

      sessionStorage.setItem("ai-arena-config", JSON.stringify(config));
      sessionStorage.setItem("ai-arena-api-keys", JSON.stringify(apiKeys));
      saveArenaApiKeys(apiKeys);
      navigate("/arena/discussion");
    } catch (err) {
      console.error("Erreur lancement Coach Commercial:", err);
      toast({
        title: "Erreur inattendue",
        description: "Impossible de lancer le Coach Commercial. Verifiez la console pour plus de details.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { launchCoach, isLoading };
}
