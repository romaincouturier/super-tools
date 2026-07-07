import { useRef, useState } from "react";
import { useWpArticles, useImportWpArticlesCsv } from "@/hooks/useWpArticles";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Loader2, ExternalLink, Newspaper, Eye } from "lucide-react";
import { toast } from "sonner";
import WpArticleDetailDialog from "./WpArticleDetailDialog";

export default function WpArticlesTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: articles = [], isLoading } = useWpArticles();
  const importCsv = useImportWpArticlesCsv();

  const handleFile = (file: File) => {
    importCsv.mutate(file, {
      onSuccess: ({ imported, skippedNotPublished, skippedNoKey }) => {
        const skippedMsg = [
          skippedNotPublished > 0 ? `${skippedNotPublished} non publié(s) ignoré(s)` : null,
          skippedNoKey > 0 ? `${skippedNoKey} sans ID ni URL` : null,
        ].filter(Boolean).join(", ");
        toast.success(`${imported} article(s) importé(s) ou mis à jour${skippedMsg ? ` (${skippedMsg})` : ""}`);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Erreur lors de l'import");
      },
      onSettled: () => {
        if (fileRef.current) fileRef.current.value = "";
      },
    });
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
        <Button onClick={() => fileRef.current?.click()} disabled={importCsv.isPending}>
          {importCsv.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
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
                <TableRow
                  key={a.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedId(a.id)}
                >
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
                  <TableCell onClick={(e) => e.stopPropagation()}>
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
