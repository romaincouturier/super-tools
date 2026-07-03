import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface NewsletterComment {
  id: string;
  author_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
}

interface UseNewsletterCommentsOptions {
  newsletterId: string | null;
  enabled: boolean;
  onCountChange?: (newsletterId: string, count: number) => void;
}

/**
 * Commentaires d'une newsletter : identité de l'auteur courant, chargement,
 * realtime, ajout et suppression (soft delete).
 */
export function useNewsletterComments({ newsletterId, enabled, onCountChange }: UseNewsletterCommentsOptions) {
  const [comments, setComments] = useState<NewsletterComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState("");
  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;

  // Identité de l'auteur courant (display_name puis email)
  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled]);

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
    if (enabled && newsletterId) fetchComments();
  }, [enabled, newsletterId, fetchComments]);

  // Realtime: nouveaux commentaires des autres utilisateurs
  useEffect(() => {
    if (!enabled || !newsletterId) return;
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
  }, [enabled, newsletterId, fetchComments]);

  const submitComment = useCallback(async (content: string): Promise<boolean> => {
    if (!content.trim() || !newsletterId || !userId) return false;
    setSubmitting(true);
    const { error } = await supabase.from("newsletter_comments").insert({
      newsletter_id: newsletterId,
      author_id: userId,
      author_name: authorName,
      content: content.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast.error("Échec de l'envoi du commentaire");
      return false;
    }
    fetchComments();
    return true;
  }, [newsletterId, userId, authorName, fetchComments]);

  const deleteComment = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("newsletter_comments")
      .update({ is_deleted: true })
      .eq("id", id);
    if (error) {
      toast.error("Échec de la suppression");
      return;
    }
    fetchComments();
  }, [fetchComments]);

  return { comments, loading, submitting, userId, submitComment, deleteComment };
}
