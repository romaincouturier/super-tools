import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Comment {
  id: string;
  author_id: string;
  author_email?: string;
  content: string;
  created_at: string;
  parent_comment_id: string | null;
}

interface CommentThreadProps {
  reviewId: string;
}

const CommentThread = ({ reviewId }: CommentThreadProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [reviewId, showComments]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from("review_comments")
        .select("*")
        .eq("review_id", reviewId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setComments(data || []);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        toast.error("Vous devez être connecté");
        return;
      }

      const { error } = await supabase.from("review_comments").insert({
        review_id: reviewId,
        author_id: userId,
        content: newComment.trim(),
      });

      if (error) throw error;

      // Create notification for the review owner
      const { data: reviewData } = await supabase
        .from("content_reviews")
        .select("reviewer_id, created_by")
        .eq("id", reviewId)
        .single();

      if (reviewData) {
        const notifyUserId =
          reviewData.reviewer_id === userId
            ? reviewData.created_by
            : reviewData.reviewer_id;

        if (notifyUserId) {
          await supabase.from("content_notifications").insert({
            user_id: notifyUserId,
            type: "comment_added",
            reference_id: reviewId,
            message: "Nouveau commentaire sur une relecture",
          });
        }
      }

      setNewComment("");
      fetchComments();
      toast.success("Commentaire ajouté");
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Erreur lors de l'ajout du commentaire");
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (email?: string) => {
    if (!email) return "?";
    return email
      .split("@")[0]
      .split(".")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="border-t pt-3 mt-3">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground"
        onClick={() => setShowComments(!showComments)}
      >
        <MessageCircle className="h-4 w-4 mr-2" />
        {showComments ? "Masquer" : "Afficher"} les commentaires
        {comments.length > 0 && !showComments && (
          <span className="ml-1">({comments.length})</span>
        )}
      </Button>

      {showComments && (
        <div className="mt-3 space-y-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              Aucun commentaire
            </p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {getInitials(comment.author_email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 bg-muted rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        {comment.author_email || "Utilisateur"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(comment.created_at).toLocaleString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Ajouter un commentaire..."
              rows={2}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSubmit();
                }
              }}
            />
            <Button
              size="icon"
              onClick={handleSubmit}
              disabled={submitting || !newComment.trim()}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentThread;
