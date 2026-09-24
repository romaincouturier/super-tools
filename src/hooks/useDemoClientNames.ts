import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { buildKnownNamesMatcher, maskKnownNames } from "@/lib/demoMask";

/** Réglage (app_settings) : noms à masquer en plus des clients connus, un par ligne. */
export const DEMO_MASKED_NAMES_SETTING = "demo_masked_names";

const PAGE_SIZE = 1000;

type NameTable =
  | "crm_cards"
  | "missions"
  | "mission_contacts"
  | "trainings"
  | "training_participants"
  | "quotes"
  | "testimonials";

async function fetchAll(table: NameTable, columns: string): Promise<Record<string, string | null>[]> {
  const rows: Record<string, string | null>[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as Record<string, string | null>[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchClientNames(): Promise<RegExp | null> {
  const [crm, missions, missionContacts, trainings, participants, quotes, testimonials, extra] = await Promise.all([
    fetchAll("crm_cards", "company, first_name, last_name, title"),
    fetchAll("missions", "client_name, title"),
    fetchAll("mission_contacts", "first_name, last_name"),
    fetchAll("trainings", "client_name"),
    fetchAll("training_participants", "company"),
    fetchAll("quotes", "client_company"),
    fetchAll("testimonials", "client_name, company"),
    supabase.from("app_settings").select("setting_value").eq("setting_key", DEMO_MASKED_NAMES_SETTING).maybeSingle(),
  ]);
  const names: (string | null)[] = [];
  const person = (first: string | null, last: string | null) => {
    if (first && last) names.push(`${first} ${last}`, last);
  };
  for (const c of crm) {
    names.push(c.company, c.title);
    person(c.first_name, c.last_name);
  }
  for (const c of missionContacts) person(c.first_name, c.last_name);
  for (const m of missions) names.push(m.client_name, m.title);
  for (const t of trainings) names.push(t.client_name);
  for (const p of participants) names.push(p.company);
  for (const q of quotes) names.push(q.client_company);
  for (const t of testimonials) names.push(t.client_name, t.company);
  const manual = String(extra.data?.setting_value ?? "").split("\n");
  return buildKnownNamesMatcher([...names.filter((n) => !/supertilt/i.test(n ?? "")), ...manual]);
}

/**
 * Masque, en mode démo, les noms de clients cités dans un texte libre : clients
 * connus et titres des missions et opportunités (CRM, missions et contacts, formations et sociétés des participants,
 * devis, témoignages) et noms ajoutés à la main dans le réglage
 * `demo_masked_names`. SuperTilt reste visible. Rien n'est chargé hors démo.
 *
 * `pending` vaut true tant que la liste n'est pas chargée, ou si son chargement
 * a échoué : l'appelant floute alors le texte plutôt que de l'afficher en clair.
 */
export function useDemoClientNames(): { mask: (value: string | null | undefined) => string; pending: boolean } {
  const { isDemoMode } = useDemoMode();
  const { data, isSuccess } = useQuery({
    queryKey: ["demo-client-names"],
    enabled: isDemoMode,
    staleTime: 30 * 60 * 1000,
    structuralSharing: false,
    queryFn: fetchClientNames,
  });
  const matcher = isDemoMode ? data ?? null : null;
  const mask = useCallback((value: string | null | undefined) => maskKnownNames(value, matcher), [matcher]);
  return { mask, pending: isDemoMode && !isSuccess };
}
