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
export const fmtEuro = (v: number | null | undefined) =>
  v != null ? `${v.toLocaleString("fr-FR")}€` : "—";

// Claude is always available via server-side key
export function hasAnyProvider(_keys: ApiKeys): boolean {
  return true;
}

// Build annual ambition context from configurable text + OKRs
export function buildAmbitionContext(
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
export function buildOKRContext(
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
export function buildCRMContext(columns: CrmColumn[], cards: CrmCard[]): string {
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
export function buildAcquisitionContext(cards: CrmCard[], missions: Mission[], acquisitionText?: string): string {
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
export function buildRevenueTargetContext(
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
export function buildCalendarContext(
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
export function buildMissionsContext(missions: Mission[]): string {
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
export function buildFormationsContext(
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

// Build CRM comments context — recent discussion threads on deals
export function buildCrmCommentsContext(
  comments: { card_id: string; author_email: string; content: string; created_at: string }[],
  cards: CrmCard[]
): string {
  if (!comments.length) return "Aucun commentaire CRM enregistre.";

  const cardMap = new Map(cards.map((c) => [c.id, c]));

  // Group by card
  const byCard = new Map<string, typeof comments>();
  for (const c of comments) {
    const arr = byCard.get(c.card_id) || [];
    arr.push(c);
    byCard.set(c.card_id, arr);
  }

  let result = `Commentaires CRM recents (${comments.length} commentaires sur ${byCard.size} deals):\n`;
  for (const [cardId, cardComments] of byCard) {
    const card = cardMap.get(cardId);
    const cardLabel = card ? `${card.title}${card.company ? ` (${card.company})` : ""}` : cardId;
    result += `\n  ${cardLabel} — ${cardComments.length} commentaire(s):\n`;
    // Show last 3 comments per deal to keep context concise
    for (const c of cardComments.slice(0, 3)) {
      const date = new Date(c.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      const snippet = c.content.length > 150 ? c.content.slice(0, 150) + "..." : c.content;
      result += `    [${date}] ${snippet}\n`;
    }
  }

  return result;
}

// Build CRM email outreach context
export function buildCrmEmailsContext(
  emails: { card_id: string; sender_email: string; recipient_email: string; subject: string; sent_at: string }[],
  cards: CrmCard[]
): string {
  if (!emails.length) return "Aucun email CRM enregistre.";

  const cardMap = new Map(cards.map((c) => [c.id, c]));

  // Group by card
  const byCard = new Map<string, typeof emails>();
  for (const e of emails) {
    const arr = byCard.get(e.card_id) || [];
    arr.push(e);
    byCard.set(e.card_id, arr);
  }

  let result = `Emails CRM envoyes (${emails.length} emails sur ${byCard.size} deals):\n`;
  for (const [cardId, cardEmails] of byCard) {
    const card = cardMap.get(cardId);
    const cardLabel = card ? `${card.title}${card.company ? ` (${card.company})` : ""}` : cardId;
    result += `\n  ${cardLabel} — ${cardEmails.length} email(s):\n`;
    for (const e of cardEmails.slice(0, 3)) {
      const date = new Date(e.sent_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      result += `    [${date}] "${e.subject}" → ${e.recipient_email}\n`;
    }
  }

  // Global stats
  const now = Date.now();
  const last7d = emails.filter((e) => now - new Date(e.sent_at).getTime() < 7 * 24 * 60 * 60 * 1000).length;
  const last30d = emails.filter((e) => now - new Date(e.sent_at).getTime() < 30 * 24 * 60 * 60 * 1000).length;
  result += `\nFrequence: ${last7d} emails cette semaine, ${last30d} ce mois-ci.\n`;

  return result;
}

// Build training evaluations context — satisfaction summary
export function buildTrainingEvaluationsContext(
  evaluations: {
    training_name: string;
    appreciation_generale: number | null;
    recommandation: string | null;
    message_recommandation: string | null;
    amelioration_suggeree: string | null;
    company: string | null;
  }[]
): string {
  if (!evaluations.length) return "Aucune evaluation de formation soumise.";

  const withRating = evaluations.filter((e) => e.appreciation_generale != null);
  const avgRating = withRating.length > 0
    ? (withRating.reduce((s, e) => s + (e.appreciation_generale || 0), 0) / withRating.length).toFixed(1)
    : "—";

  const recommenders = evaluations.filter(
    (e) => e.recommandation === "oui" || e.recommandation === "oui_avec_enthousiasme"
  ).length;
  const nonRecommenders = evaluations.filter((e) => e.recommandation === "non").length;
  const totalWithReco = evaluations.filter((e) => e.recommandation).length;
  const recoRate = totalWithReco > 0 ? Math.round((recommenders / totalWithReco) * 100) : 0;

  let result = `Evaluations de formation (${evaluations.length} evaluations):\n`;
  result += `  Note moyenne: ${avgRating}/5\n`;
  result += `  Taux de recommandation: ${recoRate}% (${recommenders}/${totalWithReco})\n`;
  if (nonRecommenders > 0) {
    result += `  ⚠ ${nonRecommenders} participant(s) ne recommandent pas la formation\n`;
  }

  // Group by training for per-training summary
  const byTraining = new Map<string, typeof evaluations>();
  for (const e of evaluations) {
    const arr = byTraining.get(e.training_name) || [];
    arr.push(e);
    byTraining.set(e.training_name, arr);
  }

  for (const [name, evals] of byTraining) {
    const avg = evals.filter((e) => e.appreciation_generale != null);
    const rating = avg.length > 0
      ? (avg.reduce((s, e) => s + (e.appreciation_generale || 0), 0) / avg.length).toFixed(1)
      : "—";
    result += `\n  ${name}: ${rating}/5 (${evals.length} eval.)\n`;
    // Show testimonials
    const testimonials = evals
      .filter((e) => e.message_recommandation)
      .slice(0, 2);
    for (const t of testimonials) {
      result += `    "${t.message_recommandation}"${t.company ? ` — ${t.company}` : ""}\n`;
    }
    // Show improvement suggestions
    const improvements = evals
      .filter((e) => e.amelioration_suggeree)
      .slice(0, 2);
    for (const imp of improvements) {
      result += `    Amelioration: "${imp.amelioration_suggeree}"\n`;
    }
  }

  return result;
}

// Build sponsor evaluations context — decision-maker satisfaction
export function buildSponsorEvaluationsContext(
  evaluations: {
    training_name: string;
    sponsor_name: string | null;
    company: string | null;
    satisfaction_globale: number | null;
    recommandation: string | null;
    message_recommandation: string | null;
    points_forts: string | null;
    axes_amelioration: string | null;
    impact_competences: string | null;
    objectifs_atteints: string | null;
  }[]
): string {
  if (!evaluations.length) return "Aucune evaluation commanditaire soumise.";

  const withRating = evaluations.filter((e) => e.satisfaction_globale != null);
  const avgRating = withRating.length > 0
    ? (withRating.reduce((s, e) => s + (e.satisfaction_globale || 0), 0) / withRating.length).toFixed(1)
    : "—";

  const recommenders = evaluations.filter((e) => e.recommandation === "oui").length;
  const totalWithReco = evaluations.filter((e) => e.recommandation).length;
  const recoRate = totalWithReco > 0 ? Math.round((recommenders / totalWithReco) * 100) : 0;

  let result = `Evaluations commanditaires/sponsors (${evaluations.length} evaluations):\n`;
  result += `  Satisfaction moyenne: ${avgRating}/5\n`;
  result += `  Taux de recommandation: ${recoRate}% (${recommenders}/${totalWithReco})\n`;

  // Impact assessment
  const impactOui = evaluations.filter((e) => e.impact_competences === "oui").length;
  const objectifsOui = evaluations.filter((e) => e.objectifs_atteints === "oui").length;
  if (impactOui > 0 || objectifsOui > 0) {
    result += `  Impact competences valide par ${impactOui}/${evaluations.length} sponsors\n`;
    result += `  Objectifs atteints pour ${objectifsOui}/${evaluations.length} sponsors\n`;
  }

  // Individual sponsor feedback
  for (const e of evaluations.slice(0, 5)) {
    const label = [e.sponsor_name, e.company].filter(Boolean).join(" — ") || "Anonyme";
    result += `\n  ${label} (${e.training_name}): ${e.satisfaction_globale || "—"}/5\n`;
    if (e.points_forts) result += `    Points forts: "${e.points_forts.slice(0, 120)}"\n`;
    if (e.message_recommandation) result += `    Temoignage: "${e.message_recommandation.slice(0, 120)}"\n`;
    if (e.axes_amelioration) result += `    Ameliorations: "${e.axes_amelioration.slice(0, 120)}"\n`;
  }

  return result;
}

// Build mission activities context — delivery and billing tracking
export function buildMissionActivitiesContext(
  activities: {
    mission_title: string;
    description: string;
    activity_date: string;
    duration: number;
    duration_type: string;
    billable_amount: number | null;
    is_billed: boolean;
  }[]
): string {
  if (!activities.length) return "Aucune activite mission enregistree.";

  const totalBillable = activities.reduce((s, a) => s + (a.billable_amount || 0), 0);
  const billed = activities.filter((a) => a.is_billed);
  const totalBilled = billed.reduce((s, a) => s + (a.billable_amount || 0), 0);
  const totalDays = activities
    .filter((a) => a.duration_type === "days")
    .reduce((s, a) => s + a.duration, 0);
  const totalHours = activities
    .filter((a) => a.duration_type === "hours")
    .reduce((s, a) => s + a.duration, 0);

  let result = `Activites missions (${activities.length} activites):\n`;
  result += `  Volume: ${totalDays > 0 ? `${totalDays}j` : ""}${totalDays > 0 && totalHours > 0 ? " + " : ""}${totalHours > 0 ? `${totalHours}h` : ""}\n`;
  result += `  Montant facturable: ${fmtEuro(totalBillable)} (dont ${fmtEuro(totalBilled)} facture)\n`;
  if (totalBillable > totalBilled) {
    result += `  ⚠ ${fmtEuro(totalBillable - totalBilled)} en attente de facturation\n`;
  }

  // Group by mission
  const byMission = new Map<string, typeof activities>();
  for (const a of activities) {
    const arr = byMission.get(a.mission_title) || [];
    arr.push(a);
    byMission.set(a.mission_title, arr);
  }

  for (const [title, acts] of byMission) {
    const missionTotal = acts.reduce((s, a) => s + (a.billable_amount || 0), 0);
    result += `\n  ${title}: ${acts.length} activites, ${fmtEuro(missionTotal)}\n`;
    // Show last 3 activities
    for (const a of acts.slice(0, 3)) {
      const date = new Date(a.activity_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      result += `    [${date}] ${a.description} (${a.duration}${a.duration_type === "days" ? "j" : "h"})${a.billable_amount ? ` — ${fmtEuro(a.billable_amount)}` : ""}\n`;
    }
  }

  return result;
}

// Build CRM activity log context — sales engagement metrics
export function buildCrmActivityLogContext(
  logs: { card_id: string; action_type: string; old_value: string | null; new_value: string | null; created_at: string }[],
  cards: CrmCard[]
): string {
  if (!logs.length) return "Aucune activite CRM enregistree.";

  const cardMap = new Map(cards.map((c) => [c.id, c]));

  // Action type breakdown
  const actionCounts = new Map<string, number>();
  for (const log of logs) {
    actionCounts.set(log.action_type, (actionCounts.get(log.action_type) || 0) + 1);
  }

  const actionLabels: Record<string, string> = {
    card_created: "Opportunites creees",
    card_moved: "Deplacements pipeline",
    sales_status_changed: "Changements statut vente",
    estimated_value_changed: "Modifications de valeur",
    email_sent: "Emails envoyes",
    comment_added: "Commentaires ajoutes",
    tag_added: "Tags ajoutes",
    attachment_added: "Pieces jointes",
  };

  let result = `Activite CRM (${logs.length} actions recentes):\n`;
  for (const [action, count] of [...actionCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const label = actionLabels[action] || action;
    result += `  - ${label}: ${count}\n`;
  }

  // Recent pipeline movements (last 10)
  const moves = logs
    .filter((l) => l.action_type === "card_moved" || l.action_type === "sales_status_changed")
    .slice(0, 10);
  if (moves.length > 0) {
    result += `\nDerniers mouvements pipeline:\n`;
    for (const m of moves) {
      const card = cardMap.get(m.card_id);
      const cardLabel = card ? `${card.title}${card.company ? ` (${card.company})` : ""}` : "Deal inconnu";
      const date = new Date(m.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      if (m.action_type === "sales_status_changed") {
        result += `  [${date}] ${cardLabel}: ${m.old_value || "?"} → ${m.new_value || "?"}\n`;
      } else {
        result += `  [${date}] ${cardLabel}: ${m.old_value || "?"} → ${m.new_value || "?"}\n`;
      }
    }
  }

  // Engagement cadence (last 7 days vs last 30 days)
  const now = Date.now();
  const last7d = logs.filter((l) => now - new Date(l.created_at).getTime() < 7 * 24 * 60 * 60 * 1000).length;
  const last30d = logs.filter((l) => now - new Date(l.created_at).getTime() < 30 * 24 * 60 * 60 * 1000).length;
  result += `\nCadence: ${last7d} actions cette semaine, ${last30d} ce mois-ci.\n`;

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

      // Fetch all data in parallel (14 queries)
      const [
        okrRes, columnsRes, cardsRes, missionsRes, trainingsRes, catalogueRes,
        revenueTargetsRes, coachContextsRes,
        commentsRes, emailsRes, evalRes, sponsorEvalRes, missionActivitiesRes, activityLogRes,
      ] =
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
          // NEW: CRM comments (last 90 days, non-deleted)
          (supabase as any)
            .from("crm_comments")
            .select("card_id, author_email, content, created_at")
            .eq("is_deleted", false)
            .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
            .order("created_at", { ascending: false })
            .limit(100),
          // NEW: CRM emails (last 90 days)
          (supabase as any)
            .from("crm_card_emails")
            .select("card_id, sender_email, recipient_email, subject, sent_at")
            .gte("sent_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
            .order("sent_at", { ascending: false })
            .limit(100),
          // NEW: Training evaluations (submitted)
          supabase
            .from("training_evaluations")
            .select("appreciation_generale, recommandation, message_recommandation, amelioration_suggeree, company, trainings!inner(training_name)")
            .eq("etat", "soumis")
            .order("date_soumission", { ascending: false })
            .limit(100),
          // NEW: Sponsor evaluations (submitted)
          (supabase as any)
            .from("sponsor_cold_evaluations")
            .select("satisfaction_globale, recommandation, message_recommandation, points_forts, axes_amelioration, impact_competences, objectifs_atteints, sponsor_name, company, trainings!inner(training_name)")
            .eq("etat", "soumis")
            .order("date_soumission", { ascending: false })
            .limit(50),
          // NEW: Mission activities (last 6 months)
          (supabase as any)
            .from("mission_activities")
            .select("description, activity_date, duration, duration_type, billable_amount, is_billed, missions!inner(title)")
            .gte("activity_date", new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
            .order("activity_date", { ascending: false })
            .limit(100),
          // NEW: CRM activity log (last 60 days)
          (supabase as any)
            .from("crm_activity_log")
            .select("card_id, action_type, old_value, new_value, created_at")
            .gte("created_at", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
            .order("created_at", { ascending: false })
            .limit(200),
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

      // Cast new data (non-blocking — these may fail on older DBs)
      const commentsData = (commentsRes?.data || []) as { card_id: string; author_email: string; content: string; created_at: string }[];
      const emailsData = (emailsRes?.data || []) as { card_id: string; sender_email: string; recipient_email: string; subject: string; sent_at: string }[];
      const evalData = ((evalRes?.data || []) as any[]).map((e: any) => ({
        training_name: e.trainings?.training_name || "Inconnue",
        appreciation_generale: e.appreciation_generale,
        recommandation: e.recommandation,
        message_recommandation: e.message_recommandation,
        amelioration_suggeree: e.amelioration_suggeree,
        company: e.company,
      }));
      const sponsorEvalData = ((sponsorEvalRes?.data || []) as any[]).map((e: any) => ({
        training_name: e.trainings?.training_name || "Inconnue",
        sponsor_name: e.sponsor_name,
        company: e.company,
        satisfaction_globale: e.satisfaction_globale,
        recommandation: e.recommandation,
        message_recommandation: e.message_recommandation,
        points_forts: e.points_forts,
        axes_amelioration: e.axes_amelioration,
        impact_competences: e.impact_competences,
        objectifs_atteints: e.objectifs_atteints,
      }));
      const missionActivitiesData = ((missionActivitiesRes?.data || []) as any[]).map((a: any) => ({
        mission_title: a.missions?.title || "Inconnue",
        description: a.description,
        activity_date: a.activity_date,
        duration: a.duration,
        duration_type: a.duration_type,
        billable_amount: a.billable_amount,
        is_billed: a.is_billed,
      }));
      const activityLogData = (activityLogRes?.data || []) as { card_id: string; action_type: string; old_value: string | null; new_value: string | null; created_at: string }[];

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
      const commentsContext = buildCrmCommentsContext(commentsData, cardsData);
      const emailsContext = buildCrmEmailsContext(emailsData, cardsData);
      const evalContext = buildTrainingEvaluationsContext(evalData);
      const sponsorEvalContext = buildSponsorEvaluationsContext(sponsorEvalData);
      const missionActivitiesContext = buildMissionActivitiesContext(missionActivitiesData);
      const activityLogContext = buildCrmActivityLogContext(activityLogData, cardsData);

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

--- COMMENTAIRES CRM (echanges et notes sur les deals) ---
${commentsContext}

--- EMAILS CRM (historique de communication) ---
${emailsContext}

--- ACTIVITE CRM (mouvements et engagement recent) ---
${activityLogContext}

--- STRUCTURE D'ACQUISITION CLIENTS ---
${acquisitionContext}

--- KANBAN MISSIONS ---
${missionsContext}

--- ACTIVITES MISSIONS (delivery et facturation) ---
${missionActivitiesContext}

--- FORMATIONS ---
${formationsContext}

--- EVALUATIONS FORMATIONS (satisfaction participants) ---
${evalContext}

--- EVALUATIONS COMMANDITAIRES (satisfaction sponsors/decideurs) ---
${sponsorEvalContext}

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
7. La capacite de delivery vs le pipeline ouvert et les activites missions
8. L'agenda pour contextualiser les recommandations d'actions avec les rendez-vous a venir
9. Les commentaires et emails CRM pour identifier les preoccupations clients et le niveau d'engagement
10. Les evaluations formation et commanditaires pour identifier la qualite du service et les opportunites d'upsell
11. Les activites missions (facturation, delivery) pour evaluer la sante financiere et la charge
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
