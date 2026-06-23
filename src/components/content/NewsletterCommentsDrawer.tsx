import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

interface NewsletterComment {
  id: string;
  author_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
}

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
  const [comments, setComments] = useState<NewsletterComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;

  // Identité de l'auteur courant (display_name puis email)
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("user_id", user.id)
        .maybeSingle();
      setAuthorName(profile?.display_name || profile?.email || user.email || "Utilisateur");
    })();
  }, [open]);

  const fetchComments = useCallback(async () => {
    if (!newsletterId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("newsletter_comments")
      .select("id, author_id, author_name, content, created_at")
      .eq("newsletter_id", newsletterId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error("Impossible de charger les commentaires");
      return;
    }
    const rows = (data || []) as NewsletterComment[];
    setComments(rows);
    onCountChangeRef.current?.(newsletterId, rows.length);
  }, [newsletterId]);

  useEffect(() => {
    if (open && newsletterId) fetchComments();
  }, [open, newsletterId, fetchComments]);

  // Realtime: nouveaux commentaires des autres utilisateurs
  useEffect(() => {
    if (!open || !newsletterId) return;
    const channel = supabase
      .channel(`newsletter_comments:${newsletterId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "newsletter_comments",
          filter: `newsletter_id=eq.${newsletterId}`,
        },
        () => fetchComments(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, newsletterId, fetchComments]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [comments]);

  const handleSubmit = async () => {
    const content = draft.trim();
    if (!content || !newsletterId || !userId) return;
    setSubmitting(true);
    const { error } = await supabase.from("newsletter_comments").insert({
      newsletter_id: newsletterId,
      author_id: userId,
      author_name: authorName,
      content,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Échec de l'envoi du commentaire");
      return;
    }
    setDraft("");
    fetchComments();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("newsletter_comments")
      .update({ is_deleted: true })
      .eq("id", id);
    if (error) {
      toast.error("Échec de la suppression");
      return;
    }
    fetchComments();
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
                    onClick={() => handleDelete(c.id)}
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
