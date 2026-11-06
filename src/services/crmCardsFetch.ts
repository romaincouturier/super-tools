import { supabase } from "@/integrations/supabase/client";

const PAGE = 1000;

/** Tous les champs d'une opportunité sauf source_metadata (la fiche noCRM complète y est volumineuse). */
export const CRM_CARD_LIGHT_COLUMNS =
  "acquisition_source,address,assigned_to,brief_questions,city,column_id,company,confidence_score,country,created_at,description_html,email,emoji,estimated_value,expected_close_date,first_name,gender,id,last_name,linked_mission_id,linkedin_url,loss_reason,loss_reason_detail,lost_at,next_action_done,next_action_text,next_action_type,org_id,phone,phone_2,position,postal_code,quote_url,raw_input,sales_status,service_type,siren,status_operational,title,updated_at,waiting_next_action_date,waiting_next_action_text,website_url,won_at";

type Row = Record<string, unknown>;

async function fetchPaged(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/**
 * Toutes les opportunités, paginées (au-delà de 1000 lignes).
 * Les fiches importées de noCRM reçoivent un source_metadata réduit ({ import_source, nocrm_id }).
 */
export async function fetchAllCrmCards(): Promise<Row[]> {
  const [regular, imported] = await Promise.all([
    fetchPaged((from, to) => supabase.from("crm_cards").select("*")
      .or("source_metadata->>import_source.is.null,source_metadata->>import_source.neq.nocrm")
      .order("position", { ascending: true }).order("id").range(from, to)),
    fetchPaged((from, to) => supabase.from("crm_cards")
      .select(`${CRM_CARD_LIGHT_COLUMNS},nocrm_id:source_metadata->>nocrm_id`)
      .eq("source_metadata->>import_source", "nocrm")
      .order("position", { ascending: true }).order("id").range(from, to)),
  ]);
  const light = imported.map(({ nocrm_id, ...rest }) => ({ ...rest, source_metadata: { import_source: "nocrm", nocrm_id } }));
  return [...regular, ...light].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
}

export const isNocrmImported = (card: { source_metadata?: unknown }) =>
  (card.source_metadata as { import_source?: string } | null | undefined)?.import_source === "nocrm";

/** Tous les liens opportunité-tag, paginés. */
export async function fetchAllCardTags(): Promise<Row[]> {
  return fetchPaged((from, to) => supabase.from("crm_card_tags").select("*").order("created_at", { ascending: true }).range(from, to));
}
