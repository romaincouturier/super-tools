import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/integrations/supabase/client";
import { loadArenaApiKeys, saveArenaApiKeys } from "@/lib/arena/api";
import { TEMPLATES } from "@/lib/arena/templates";
import type { SessionConfig, ApiKeys } from "@/lib/arena/types";
import type { CrmColumn, CrmCard } from "@/types/crm";
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

// Build annual ambition context from OKRs
function buildAmbitionContext(
  objectives: (OKRObjective & { okr_key_results: OKRKeyResult[] })[]
): string {
  const currentYear = new Date().getFullYear();
  const annualObjectives = objectives.filter(
    (obj) => obj.time_target === "annual" && obj.target_year === currentYear
  );

  if (!annualObjectives.length) {
    return "Aucune ambition annuelle definie. Il est recommande de definir des objectifs annuels pour orienter la strategie commerciale.";
  }

  let result = `Ambition ${currentYear}:\n`;
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
    const parts = [
      card.title,
      card.company ? `(${card.company})` : null,
      card.estimated_value ? fmtEuro(card.estimated_value) : null,
      card.service_type ? `[${card.service_type}]` : null,
      card.confidence_score != null ? `confiance: ${card.confidence_score}%` : null,
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

  // --- LOST DEALS ---
  if (lostCards.length > 0) {
    result += `\n>> Deals PERDUS (${lostCards.length}):\n`;
    for (const card of lostCards) {
      const parts = [
        card.title,
        card.company ? `(${card.company})` : null,
        card.estimated_value ? fmtEuro(card.estimated_value) : null,
        card.service_type ? `[${card.service_type}]` : null,
      ]
        .filter(Boolean)
        .join(" ");
      result += `  ✗ ${parts}\n`;
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

  return result;
}

// Build acquisition structure analysis
function buildAcquisitionContext(cards: CrmCard[], missions: Mission[]): string {
  let result = "";

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
      const [okrRes, columnsRes, cardsRes, missionsRes, trainingsRes, catalogueRes] =
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
        ]);

      // Check for Supabase errors
      const errors: string[] = [];
      if (okrRes.error) errors.push(`OKR: ${okrRes.error.message}`);
      if (columnsRes.error) errors.push(`CRM colonnes: ${columnsRes.error.message}`);
      if (cardsRes.error) errors.push(`CRM cartes: ${cardsRes.error.message}`);
      if (missionsRes.error) errors.push(`Missions: ${(missionsRes.error as Error).message}`);
      if (trainingsRes.error) errors.push(`Formations: ${trainingsRes.error.message}`);
      if (catalogueRes.error) errors.push(`Catalogue: ${catalogueRes.error.message}`);

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

      // Build context blocks
      const ambitionContext = buildAmbitionContext(okrData);
      const okrContext = buildOKRContext(okrData);
      const crmContext = buildCRMContext(columnsData, cardsData);
      const acquisitionContext = buildAcquisitionContext(cardsData, missionsData);
      const missionsContext = buildMissionsContext(missionsData);
      const formationsContext = buildFormationsContext(trainingsData, catalogueData);

      const today = new Date().toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const additionalContext = `=== DONNEES COMMERCIALES EN TEMPS REEL (${today}) ===

--- AMBITION ANNUELLE ---
${ambitionContext}

--- OKR PERIODIQUES ---
${okrContext}

--- PIPELINE CRM (avec indices de confiance) ---
${crmContext}

--- STRUCTURE D'ACQUISITION CLIENTS ---
${acquisitionContext}

--- KANBAN MISSIONS ---
${missionsContext}

--- FORMATIONS ---
${formationsContext}

=== FIN DES DONNEES ===

Instructions : Utilisez TOUTES ces donnees reelles pour analyser la situation commerciale. Portez une attention particuliere a :
1. L'ambition annuelle et l'ecart avec la situation actuelle
2. Les deals gagnes ET perdus pour comprendre les patterns de conversion
3. Les indices de confiance pour identifier les deals a risque ou a accelerer
4. La structure d'acquisition (formation vs mission) pour optimiser l'allocation d'effort
5. La capacite de delivery vs le pipeline ouvert
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
          "Analyse ma situation commerciale complete et produis un plan d'action structure avec : (1) ecart entre ambition annuelle et situation actuelle, (2) actions prioritaires cette semaine avec priorisation par indice de confiance, (3) plan de prospection physique pour missions et facilitation, (4) strategie d'acquisition en ligne pour les formations, (5) analyse des deals gagnes/perdus et recommandations, (6) jalons lies aux OKR.",
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
