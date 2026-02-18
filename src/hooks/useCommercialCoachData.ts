import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/integrations/supabase/client";
import { loadArenaApiKeys } from "@/lib/arena/api";
import { TEMPLATES } from "@/lib/arena/templates";
import type { SessionConfig } from "@/lib/arena/types";
import type { CrmColumn, CrmCard } from "@/types/crm";
import type { OKRObjective, OKRKeyResult } from "@/types/okr";
import type { Mission } from "@/types/missions";

// Format a number as euros
const fmtEuro = (v: number | null | undefined) =>
  v != null ? `${v.toLocaleString("fr-FR")}€` : "—";

// Build OKR context block from live data
function buildOKRContext(
  objectives: (OKRObjective & { okr_key_results: OKRKeyResult[] })[]
): string {
  if (!objectives.length) return "Aucun OKR actif.";

  return objectives
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
function buildCRMContext(columns: CrmColumn[], cards: CrmCard[]): string {
  if (!cards.length) return "Pipeline vide.";

  const colMap = new Map(columns.map((c) => [c.id, c.name]));
  const grouped = new Map<string, { count: number; total: number; items: string[] }>();

  for (const col of columns) {
    grouped.set(col.name, { count: 0, total: 0, items: [] });
  }

  for (const card of cards) {
    const colName = colMap.get(card.column_id) || "Inconnu";
    const g = grouped.get(colName) || { count: 0, total: 0, items: [] };
    g.count++;
    g.total += card.estimated_value || 0;
    const label = [
      card.title,
      card.company ? `(${card.company})` : null,
      card.estimated_value ? fmtEuro(card.estimated_value) : null,
      card.service_type ? `[${card.service_type}]` : null,
    ]
      .filter(Boolean)
      .join(" ");
    g.items.push(label);
    grouped.set(colName, g);
  }

  const openCards = cards.filter((c) => c.sales_status === "OPEN");
  const wonCards = cards.filter((c) => c.sales_status === "WON");
  const lostCards = cards.filter((c) => c.sales_status === "LOST");
  const totalOpen = openCards.reduce((s, c) => s + (c.estimated_value || 0), 0);
  const winRate =
    wonCards.length + lostCards.length > 0
      ? Math.round((wonCards.length / (wonCards.length + lostCards.length)) * 100)
      : 0;

  let result = "";
  for (const [colName, g] of grouped) {
    if (g.count > 0) {
      result += `${colName}: ${g.count} opportunite(s) (${fmtEuro(g.total)})\n`;
      for (const item of g.items) {
        result += `  - ${item}\n`;
      }
    }
  }

  result += `\nResume pipeline:\n`;
  result += `- Total pipeline ouvert: ${fmtEuro(totalOpen)} (${openCards.length} deals)\n`;
  result += `- Gagnes: ${wonCards.length} deals (${fmtEuro(wonCards.reduce((s, c) => s + (c.estimated_value || 0), 0))})\n`;
  result += `- Perdus: ${lostCards.length} deals\n`;
  result += `- Taux de conversion: ${winRate}%`;

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
  const [isLoading, setIsLoading] = useState(false);

  const launchCoach = async (customTopic?: string) => {
    setIsLoading(true);
    try {
      // Fetch all data in parallel
      const [okrRes, columnsRes, cardsRes, missionsRes, trainingsRes, catalogueRes, apiKeys] =
        await Promise.all([
          (supabase as any)
            .from("okr_objectives")
            .select(`*, okr_key_results ( id, title, target_value, current_value, unit, progress_percentage, confidence_level )`)
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
          loadArenaApiKeys(),
        ]);

      // Build context blocks
      const okrContext = buildOKRContext(
        (okrRes.data || []) as (OKRObjective & { okr_key_results: OKRKeyResult[] })[]
      );
      const crmContext = buildCRMContext(
        (columnsRes.data || []) as CrmColumn[],
        (cardsRes.data || []) as CrmCard[]
      );
      const missionsContext = buildMissionsContext((missionsRes.data || []) as Mission[]);
      const formationsContext = buildFormationsContext(
        (trainingsRes.data || []) as { id: string; training_name: string; client_name: string; start_date: string; end_date: string | null; sold_price_ht: number | null }[],
        (catalogueRes.data || []) as { formation_name: string; prix: number | null; duree_heures: number | null }[]
      );

      const today = new Date().toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const additionalContext = `=== DONNEES COMMERCIALES EN TEMPS REEL (${today}) ===

--- OKR ACTIFS ---
${okrContext}

--- PIPELINE CRM ---
${crmContext}

--- KANBAN MISSIONS ---
${missionsContext}

--- FORMATIONS ---
${formationsContext}

=== FIN DES DONNEES ===

Instructions : Utilisez ces donnees reelles pour analyser la situation commerciale, challenger les priorites et produire un plan d'action concret. Ne demandez pas de donnees supplementaires, tout est ci-dessus.`;

      // Build session config from template
      const template = TEMPLATES.find((t) => t.id === "coach-commercial");
      if (!template) throw new Error("Template coach-commercial introuvable");

      const availableProvider: "claude" | "openai" | "gemini" = apiKeys.claude?.trim()
        ? "claude"
        : apiKeys.openai?.trim()
          ? "openai"
          : apiKeys.gemini?.trim()
            ? "gemini"
            : "claude";
      const defaultModel =
        availableProvider === "claude"
          ? "claude-haiku-4-5-20251001"
          : availableProvider === "openai"
            ? "gpt-4o-mini"
            : "gemini-2.0-flash";

      const config: SessionConfig = {
        topic:
          customTopic ||
          "Analyse ma situation commerciale et produis un plan d'action structure avec : (1) actions prioritaires cette semaine, (2) plan de prospection physique pour missions et facilitation, (3) strategie d'acquisition en ligne pour les formations, (4) jalons lies aux OKR.",
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
      navigate("/arena/discussion");
    } catch (err) {
      console.error("Erreur lancement Coach Commercial:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return { launchCoach, isLoading };
}
