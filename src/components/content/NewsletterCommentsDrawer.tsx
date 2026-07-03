import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Send, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useNewsletterComments } from "@/hooks/useNewsletterComments";

interface NewsletterCommentsDrawerProps {
  newsletterId: string | null;
  newsletterTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCountChange?: (newsletterId: string, count: number) => void;
}

const NewsletterCommentsDrawer = ({
  newsletterId,
  newsletterTitle,
  open,
  onOpenChange,
  onCountChange,
}: NewsletterCommentsDrawerProps) => {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { comments, loading, submitting, userId, submitComment, deleteComment } =
    useNewsletterComments({ newsletterId, enabled: open, onCountChange });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [comments]);

  const handleSubmit = async () => {
    if (await submitComment(draft)) setDraft("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="text-base">Commentaires</SheetTitle>
          <SheetDescription className="truncate">{newsletterTitle}</SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-5 w-5 text-primary" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun commentaire. Lancez la discussion.
            </p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="group rounded-lg bg-muted/50 px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{c.author_name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(c.created_at), "d MMM HH:mm", { locale: fr })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap mt-0.5">{c.content}</p>
                {c.author_id === userId && (
                  <button
                    className="text-xs text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 mt-1"
                    onClick={() => deleteComment(c.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                    Supprimer
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="border-t p-3 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ajouter un commentaire..."
            rows={3}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Cmd/Ctrl + Entrée pour envoyer</span>
            <Button size="sm" onClick={handleSubmit} disabled={submitting || !draft.trim()} className="gap-1.5">
              {submitting ? <Spinner className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
              Envoyer
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default NewsletterCommentsDrawer;
