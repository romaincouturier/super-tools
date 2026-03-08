/**
 * Pure context-builder functions for the Commercial Coach.
 *
 * Each function takes typed data and returns a plain-text block
 * that gets injected into the Arena session prompt.
 *
 * Extracted from useCommercialCoachData to keep the hook thin
 * and make these builders independently testable.
 */
import type { CrmColumn, CrmCard, CrmRevenueTarget } from "@/types/crm";
import { acquisitionSourceConfig, lossReasonConfig } from "@/types/crm";
import type { OKRObjective, OKRKeyResult } from "@/types/okr";
import type { Mission } from "@/types/missions";

// Format a number as euros
export const fmtEuro = (v: number | null | undefined) =>
  v != null ? `${v.toLocaleString("fr-FR")}€` : "—";

// Build annual ambition context from configurable text + OKRs
export function buildAmbitionContext(
  objectives: (OKRObjective & { okr_key_results: OKRKeyResult[] })[],
  ambitionText?: string
): string {
  const currentYear = new Date().getFullYear();
  let result = "";

  if (ambitionText?.trim()) {
    result += `Vision et ambition ${currentYear} (definie par l'utilisateur):\n${ambitionText}\n`;
  }

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

// Build CRM pipeline context from live data
export function buildCRMContext(columns: CrmColumn[], cards: CrmCard[]): string {
  if (!cards.length) return "Pipeline vide.";

  const colMap = new Map(columns.map((c) => [c.id, c.name]));

  const openCards = cards.filter((c) => c.sales_status === "OPEN");
  const wonCards = cards.filter((c) => c.sales_status === "WON");
  const lostCards = cards.filter((c) => c.sales_status === "LOST");

  let result = "";

  // OPEN PIPELINE
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

  // Weighted pipeline
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

  // Deals at risk
  const atRisk = openCards.filter(
    (c) => c.confidence_score != null && c.confidence_score < 40 && (c.estimated_value || 0) > 0
  );
  if (atRisk.length > 0) {
    result += `\n>> Deals a risque (confiance < 40%):\n`;
    for (const card of atRisk) {
      result += `  - ${card.title} ${card.company ? `(${card.company})` : ""} ${fmtEuro(card.estimated_value)} — confiance: ${card.confidence_score}%\n`;
    }
  }

  // WON
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

  // LOST
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

  // VELOCITY
  result += `\n>> Velocite commerciale:\n`;
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

  // CONVERSION
  const winRate =
    wonCards.length + lostCards.length > 0
      ? Math.round((wonCards.length / (wonCards.length + lostCards.length)) * 100)
      : 0;
  result += `\n>> Metriques de conversion:\n`;
  result += `  - Taux de conversion: ${winRate}% (${wonCards.length} gagnes / ${wonCards.length + lostCards.length} clotures)\n`;
  result += `  - Total en cours: ${openCards.length} deals\n`;
  result += `  - Total traites: ${wonCards.length + lostCards.length} deals\n`;

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

  if (acquisitionText?.trim()) {
    result += `Description de la structure d'acquisition (definie par l'utilisateur):\n${acquisitionText}\n\n`;
  }

  result += "Analyse des donnees CRM:\n";

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

// Build CRM comments context
export function buildCrmCommentsContext(
  comments: { card_id: string; author_email: string; content: string; created_at: string }[],
  cards: CrmCard[]
): string {
  if (!comments.length) return "Aucun commentaire CRM enregistre.";

  const cardMap = new Map(cards.map((c) => [c.id, c]));

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

  const now = Date.now();
  const last7d = emails.filter((e) => now - new Date(e.sent_at).getTime() < 7 * 24 * 60 * 60 * 1000).length;
  const last30d = emails.filter((e) => now - new Date(e.sent_at).getTime() < 30 * 24 * 60 * 60 * 1000).length;
  result += `\nFrequence: ${last7d} emails ces 7 derniers jours, ${last30d} ces 30 derniers jours.\n`;

  return result;
}

// Build training evaluations context
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
    const testimonials = evals.filter((e) => e.message_recommandation).slice(0, 2);
    for (const t of testimonials) {
      result += `    "${t.message_recommandation}"${t.company ? ` — ${t.company}` : ""}\n`;
    }
    const improvements = evals.filter((e) => e.amelioration_suggeree).slice(0, 2);
    for (const imp of improvements) {
      result += `    Amelioration: "${imp.amelioration_suggeree}"\n`;
    }
  }

  return result;
}

// Build sponsor evaluations context
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

  const impactOui = evaluations.filter((e) => e.impact_competences === "oui").length;
  const objectifsOui = evaluations.filter((e) => e.objectifs_atteints === "oui").length;
  if (impactOui > 0 || objectifsOui > 0) {
    result += `  Impact competences valide par ${impactOui}/${evaluations.length} sponsors\n`;
    result += `  Objectifs atteints pour ${objectifsOui}/${evaluations.length} sponsors\n`;
  }

  for (const e of evaluations.slice(0, 5)) {
    const label = [e.sponsor_name, e.company].filter(Boolean).join(" — ") || "Anonyme";
    result += `\n  ${label} (${e.training_name}): ${e.satisfaction_globale || "—"}/5\n`;
    if (e.points_forts) result += `    Points forts: "${e.points_forts.slice(0, 120)}"\n`;
    if (e.message_recommandation) result += `    Temoignage: "${e.message_recommandation.slice(0, 120)}"\n`;
    if (e.axes_amelioration) result += `    Ameliorations: "${e.axes_amelioration.slice(0, 120)}"\n`;
  }

  return result;
}

// Build mission activities context
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

  const byMission = new Map<string, typeof activities>();
  for (const a of activities) {
    const arr = byMission.get(a.mission_title) || [];
    arr.push(a);
    byMission.set(a.mission_title, arr);
  }

  for (const [title, acts] of byMission) {
    const missionTotal = acts.reduce((s, a) => s + (a.billable_amount || 0), 0);
    result += `\n  ${title}: ${acts.length} activites, ${fmtEuro(missionTotal)}\n`;
    for (const a of acts.slice(0, 3)) {
      const date = new Date(a.activity_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      result += `    [${date}] ${a.description} (${a.duration}${a.duration_type === "days" ? "j" : "h"})${a.billable_amount ? ` — ${fmtEuro(a.billable_amount)}` : ""}\n`;
    }
  }

  return result;
}

// Build CRM activity log context
export function buildCrmActivityLogContext(
  logs: { card_id: string; action_type: string; old_value: string | null; new_value: string | null; created_at: string }[],
  cards: CrmCard[]
): string {
  if (!logs.length) return "Aucune activite CRM enregistree.";

  const cardMap = new Map(cards.map((c) => [c.id, c]));

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

  const moves = logs
    .filter((l) => l.action_type === "card_moved" || l.action_type === "sales_status_changed")
    .slice(0, 10);
  if (moves.length > 0) {
    result += `\nDerniers mouvements pipeline:\n`;
    for (const m of moves) {
      const card = cardMap.get(m.card_id);
      const cardLabel = card ? `${card.title}${card.company ? ` (${card.company})` : ""}` : "Deal inconnu";
      const date = new Date(m.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      result += `  [${date}] ${cardLabel}: ${m.old_value || "?"} → ${m.new_value || "?"}\n`;
    }
  }

  const now = Date.now();
  const last7d = logs.filter((l) => now - new Date(l.created_at).getTime() < 7 * 24 * 60 * 60 * 1000).length;
  const last30d = logs.filter((l) => now - new Date(l.created_at).getTime() < 30 * 24 * 60 * 60 * 1000).length;
  result += `\nCadence: ${last7d} actions ces 7 derniers jours, ${last30d} ces 30 derniers jours.\n`;

  return result;
}
