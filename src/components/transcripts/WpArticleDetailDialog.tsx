import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Eye } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useWpArticle } from "@/hooks/useWpArticles";

interface Props {
  articleId: string | null;
  onOpenChange: (open: boolean) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm py-1.5 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{children ?? <em className="text-muted-foreground">—</em>}</span>
    </div>
  );
}

export default function WpArticleDetailDialog({ articleId, onOpenChange }: Props) {
  const { data: a, isLoading } = useWpArticle(articleId);

  return (
    <Dialog open={!!articleId} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="pr-8">{a?.title ?? "Article"}</DialogTitle>
        </DialogHeader>
        {isLoading || !a ? (
          <div className="flex justify-center py-12"><Spinner size="md" /></div>
        ) : (
          <ScrollArea className="flex-1 pr-3">
            <div className="space-y-4">
              <div className="rounded border p-3">
                <Field label="ID WordPress">{a.wp_id ?? null}</Field>
                <Field label="URL">
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      {a.url}<ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </Field>
                <Field label="Statut">{a.status}</Field>
                <Field label="Publié le">{a.published_at ? new Date(a.published_at).toLocaleString("fr-FR") : null}</Field>
                <Field label="Modifié le">{a.modified_at ? new Date(a.modified_at).toLocaleString("fr-FR") : null}</Field>
                <Field label="Importé le">{a.imported_at ? new Date(a.imported_at).toLocaleString("fr-FR") : null}</Field>
                <Field label="Auteur">{a.author}</Field>
                <Field label="Catégorie">{a.category}</Field>
                <Field label="Vues">
                  {a.views != null ? (
                    <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{a.views.toLocaleString("fr-FR")}</span>
                  ) : null}
                </Field>
                <Field label="Popularité">
                  {a.popularity ? (
                    <Badge
                      variant={a.popularity === "forte" ? "default" : a.popularity === "moyenne" ? "secondary" : "outline"}
                      className="capitalize"
                    >
                      {a.popularity}
                    </Badge>
                  ) : null}
                </Field>
                <Field label="Note interne">
                  {a.internal_note ? <span className="text-xs italic">{a.internal_note}</span> : null}
                </Field>
                <Field label="Tags">
                  {a.tags?.length ? (
                    <span className="flex gap-1 flex-wrap">
                      {a.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                    </span>
                  ) : null}
                </Field>
              </div>

              <section>
                <h3 className="text-sm font-semibold mb-2">Extrait</h3>
                {a.excerpt ? (
                  <p className="text-sm whitespace-pre-wrap rounded border p-3 bg-muted/30">{a.excerpt}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Aucun extrait importé</p>
                )}
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-2">
                  Contenu {a.content ? <span className="text-xs text-muted-foreground font-normal">({a.content.length.toLocaleString("fr-FR")} caractères)</span> : null}
                </h3>
                {a.content ? (
                  <div
                    className="prose prose-sm max-w-none rounded border p-3 bg-muted/30 dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: a.content }}
                  />
                ) : (
                  <p className="text-sm text-destructive">Aucun contenu importé — vérifie la colonne « Contenu » du CSV.</p>
                )}
              </section>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
