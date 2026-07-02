import { useRef, useState } from "react";
import Papa from "papaparse";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Loader2, ExternalLink, Newspaper, Eye } from "lucide-react";
import { toast } from "sonner";

interface WpArticle {
  id: string;
  wp_id: number | null;
  url: string | null;
  title: string;
  published_at: string | null;
  author: string | null;
  category: string | null;
  tags: string[];
  views: number | null;
  status: string;
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

export default function WpArticlesTab() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");

  const { data: articles = [], isLoading } = useQuery({
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

  const handleFile = async (file: File) => {
    setImporting(true);
    try {
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

      const skippedMsg = [
        skippedNotPublished > 0 ? `${skippedNotPublished} non publié(s) ignoré(s)` : null,
        skippedNoKey > 0 ? `${skippedNoKey} sans ID ni URL` : null,
      ].filter(Boolean).join(", ");
      toast.success(`${records.length} article(s) importé(s) ou mis à jour${skippedMsg ? ` (${skippedMsg})` : ""}`);
      qc.invalidateQueries({ queryKey: ["wp-articles"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'import");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const filtered = search.trim()
    ? articles.filter((a) =>
        [a.title, a.author, a.category, ...(a.tags || [])]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(search.toLowerCase())))
    : articles;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <Button onClick={() => fileRef.current?.click()} disabled={importing}>
          {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Importer un CSV WordPress
        </Button>
        <Input
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <span className="text-sm text-muted-foreground ml-auto">
          {articles.length} article{articles.length > 1 ? "s" : ""}
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center gap-3">
            <Newspaper className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Aucun article importé</p>
            <p className="text-sm text-muted-foreground">
              Exportez vos articles publiés depuis WordPress au format CSV puis importez le fichier ici.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead>Publication</TableHead>
                <TableHead>Auteur</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead className="text-right">Vues</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-sm font-medium max-w-md">
                    <span className="line-clamp-2">{a.title}</span>
                    {a.tags?.length > 0 && (
                      <span className="flex gap-1 flex-wrap mt-1">
                        {a.tags.slice(0, 4).map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                        ))}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {a.published_at ? new Date(a.published_at).toLocaleDateString("fr-FR") : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.author ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.category ?? "—"}</TableCell>
                  <TableCell className="text-right text-sm">
                    {a.views != null ? (
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3 text-muted-foreground" />
                        {a.views.toLocaleString("fr-FR")}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {a.url && (
                      <a href={a.url} target="_blank" rel="noopener noreferrer" title="Ouvrir l'article">
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
