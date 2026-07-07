import Papa from "papaparse";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WpArticle {
  id: string;
  wp_id: number | null;
  url: string | null;
  title: string;
  published_at: string | null;
  modified_at?: string | null;
  author: string | null;
  category: string | null;
  tags: string[];
  views: number | null;
  status: string;
  excerpt?: string | null;
  content?: string | null;
  imported_at?: string | null;
}

export function useWpArticle(id: string | null) {
  return useQuery({
    queryKey: ["wp-article", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("wp_articles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as WpArticle | null;
    },
  });
}

export interface WpImportResult {
  imported: number;
  skippedNotPublished: number;
  skippedNoKey: number;
}

/** Normalise un en-tête CSV : minuscules, sans accents ni ponctuation. */
function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// En-têtes acceptés par champ (exports WP variés : natif, WP All Export…).
const HEADER_MAP: Record<string, string[]> = {
  wp_id: ["id", "idwordpress", "postid", "wpid"],
  title: ["titre", "title", "posttitle"],
  url: ["url", "permalink", "lien", "postlink"],
  published_at: ["datedepublication", "date", "postdate", "datepublication", "publisheddate"],
  modified_at: ["datedemodification", "modified", "postmodified", "datemodification"],
  author: ["auteur", "author", "authorname"],
  category: ["categorie", "categories", "category"],
  tags: ["tags", "etiquettes", "motscles", "keywords"],
  excerpt: ["extrait", "excerpt", "postexcerpt"],
  content: ["contenu", "content", "postcontent"],
  status: ["statut", "status", "poststatus"],
  views: ["nombredevues", "vues", "views", "viewcount", "pageviews"],
};

function buildFieldIndex(headers: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  const normalized = headers.map(normalizeHeader);
  for (const [field, candidates] of Object.entries(HEADER_MAP)) {
    const found = normalized.findIndex((h) => candidates.includes(h));
    if (found !== -1) idx[field] = found;
  }
  return idx;
}

const PUBLISHED_VALUES = new Set(["publie", "publish", "published", "publiee"]);

function parseDate(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw.trim().replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function useWpArticles() {
  return useQuery({
    queryKey: ["wp-articles"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("wp_articles")
        .select("id, wp_id, url, title, published_at, author, category, tags, views, status")
        .order("published_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []) as WpArticle[];
    },
  });
}

/** Parse un export CSV WordPress et upsert les articles publiés (wp_id prioritaire, URL en fallback). */
export function useImportWpArticlesCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<WpImportResult> => {
      const text = await file.text();
      const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
      if (parsed.errors.length > 0 && parsed.data.length === 0) {
        throw new Error(`CSV illisible : ${parsed.errors[0].message}`);
      }
      const [headers, ...rows] = parsed.data;
      if (!headers?.length) throw new Error("CSV vide");

      const idx = buildFieldIndex(headers);
      if (idx.wp_id === undefined && idx.url === undefined) {
        throw new Error("Colonne d'identification introuvable (ID WordPress ou URL requis)");
      }

      const get = (row: string[], field: string): string =>
        idx[field] !== undefined ? (row[idx[field]] ?? "").trim() : "";

      let skippedNotPublished = 0;
      let skippedNoKey = 0;
      const records: Record<string, unknown>[] = [];
      const seenKeys = new Set<string>();

      for (const row of rows) {
        // Seuls les articles publiés sont importés.
        const status = normalizeHeader(get(row, "status") || "publie");
        if (idx.status !== undefined && !PUBLISHED_VALUES.has(status)) {
          skippedNotPublished++;
          continue;
        }
        const wpIdRaw = get(row, "wp_id");
        const wpId = wpIdRaw && /^\d+$/.test(wpIdRaw) ? Number(wpIdRaw) : null;
        const url = get(row, "url") || null;
        if (!wpId && !url) { skippedNoKey++; continue; }

        // Dédoublonnage intra-fichier (sinon l'upsert batch échoue).
        const key = wpId ? `id:${wpId}` : `url:${url}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const viewsRaw = get(row, "views").replace(/\s/g, "");
        records.push({
          wp_id: wpId,
          url,
          title: get(row, "title") || "(Sans titre)",
          published_at: parseDate(get(row, "published_at")),
          modified_at: parseDate(get(row, "modified_at")),
          author: get(row, "author") || null,
          category: get(row, "category") || null,
          tags: get(row, "tags") ? get(row, "tags").split(/[,;|]/).map((t) => t.trim()).filter(Boolean) : [],
          excerpt: get(row, "excerpt") || null,
          content: get(row, "content") || null,
          status: "publish",
          views: viewsRaw && /^\d+$/.test(viewsRaw) ? Number(viewsRaw) : null,
          imported_at: new Date().toISOString(),
        });
      }

      if (records.length === 0) {
        throw new Error("Aucun article publié identifiable dans ce fichier");
      }

      // Upsert par lots : wp_id prioritaire, URL en fallback.
      const withId = records.filter((r) => r.wp_id != null);
      const withoutId = records.filter((r) => r.wp_id == null);
      const BATCH = 100;
      for (let i = 0; i < withId.length; i += BATCH) {
        const { error } = await (supabase as any)
          .from("wp_articles")
          .upsert(withId.slice(i, i + BATCH), { onConflict: "wp_id" });
        if (error) throw error;
      }
      for (let i = 0; i < withoutId.length; i += BATCH) {
        const { error } = await (supabase as any)
          .from("wp_articles")
          .upsert(withoutId.slice(i, i + BATCH), { onConflict: "url" });
        if (error) throw error;
      }

      return { imported: records.length, skippedNotPublished, skippedNoKey };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wp-articles"] });
    },
  });
}
