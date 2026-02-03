import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Loader2, MessageCircle, Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Comment {
  id: string;
  author_id: string;
  author_email?: string;
  content: string;
  proposed_correction?: string | null;
  created_at: string;
  parent_comment_id: string | null;
  status: "pending" | "approved" | "refused" | "corrected";
  resolved_at: string | null;
}

interface CommentThreadProps {
  reviewId: string;
  isAuthor: boolean;
  isReviewer: boolean;
  reviewStatus: string;
  onCommentAdded?: () => void;
}

const commentStatusConfig = {
  pending: { label: "En attente", className: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Approuvé", className: "bg-green-100 text-green-800" },
  refused: { label: "Refusé", className: "bg-red-100 text-red-800" },
  corrected: { label: "Corrigé", className: "bg-blue-100 text-blue-800" },
};

const CommentThread = ({ 
  reviewId, 
  isAuthor, 
  isReviewer, 
  reviewStatus,
  onCommentAdded 
}: CommentThreadProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [proposedCorrection, setProposedCorrection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showComments, setShowComments] = useState(true);

  useEffect(() => {
    fetchComments();
  }, [reviewId]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from("review_comments")
        .select("*")
        .eq("review_id", reviewId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setComments((data || []) as Comment[]);
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
        proposed_correction: proposedCorrection.trim() || null,
        status: "pending",
      });

      if (error) throw error;

      // Create notification for the other party
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
      setProposedCorrection("");
      fetchComments();
      onCommentAdded?.();
      toast.success("Commentaire ajouté");
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Erreur lors de l'ajout du commentaire");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCommentStatus = async (
    commentId: string, 
    status: "approved" | "refused" | "corrected"
  ) => {
    try {
      const { error } = await supabase
        .from("review_comments")
        .update({ 
          status, 
          resolved_at: new Date().toISOString() 
        })
        .eq("id", commentId);

      if (error) throw error;

      fetchComments();
      toast.success(
        status === "approved" 
          ? "Retour approuvé" 
          : status === "refused" 
            ? "Retour refusé" 
            : "Marqué comme corrigé"
      );
    } catch (error) {
      console.error("Error updating comment status:", error);
      toast.error("Erreur lors de la mise à jour");
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

  const pendingCount = comments.filter(c => c.status === "pending").length;

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
        {comments.length > 0 && (
          <span className="ml-1">
            ({comments.length})
            {pendingCount > 0 && (
              <span className="ml-1 text-orange-600">• {pendingCount} en attente</span>
            )}
          </span>
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
              {isReviewer 
                ? "Ajoutez vos commentaires de relecture ci-dessous"
                : "Aucun commentaire du relecteur pour le moment"
              }
            </p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {comments.map((comment) => {
                const statusConf = commentStatusConfig[comment.status];
                const canResolve = isAuthor && comment.status === "pending";

                return (
                  <div 
                    key={comment.id} 
                    className={cn(
                      "flex gap-2 p-2 rounded-lg transition-colors",
                      comment.status === "pending" && isAuthor && "bg-yellow-50 border border-yellow-200"
                    )}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="text-xs">
                        {getInitials(comment.author_email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
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
                        <Badge 
                          variant="secondary" 
                          className={cn("text-xs", statusConf.className)}
                        >
                          {statusConf.label}
                        </Badge>
                      </div>
                      <p className="text-sm mt-1">{comment.content}</p>

                      {/* Correction proposée (optionnelle) */}
                      {comment.proposed_correction && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                          <span className="font-medium text-blue-700">Correction proposée :</span>
                          <p className="text-blue-900 mt-1 whitespace-pre-wrap">{comment.proposed_correction}</p>
                        </div>
                      )}

                      {/* Actions pour l'auteur de la carte */}
                      {canResolve && (
                        <div className="flex gap-1 mt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleUpdateCommentStatus(comment.id, "approved")}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => handleUpdateCommentStatus(comment.id, "corrected")}
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            Corrigé
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleUpdateCommentStatus(comment.id, "refused")}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Refuser
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Zone de saisie - visible surtout pour le relecteur */}
          {reviewStatus !== "approved" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={
                    isReviewer
                      ? "Ajoutez un commentaire de relecture..."
                      : "Répondre au relecteur..."
                  }
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
              {isReviewer && (
                <div>
                  <Textarea
                    value={proposedCorrection}
                    onChange={(e) => setProposedCorrection(e.target.value)}
                    placeholder="Correction proposée (optionnel)"
                    rows={2}
                    className="resize-none text-sm"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentThread;
