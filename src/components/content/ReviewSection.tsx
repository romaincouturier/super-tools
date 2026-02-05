import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, CheckCircle2, Clock, MessageSquare, Bell, XCircle, ChevronDown, ChevronUp, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import ReviewRequestDialog from "./ReviewRequestDialog";
import CommentThread from "./CommentThread";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Review {
  id: string;
  reviewer_id: string;
  reviewer_email?: string;
  external_url: string | null;
  status: "pending" | "in_review" | "approved" | "changes_requested";
  created_at: string;
  completed_at: string | null;
  created_by: string | null;
  reminder_sent_at: string | null;
  general_opinion?: string | null;
  pending_comments_count?: number;
}

interface ReviewSectionProps {
  cardId: string;
  cardTitle: string;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending: {
    label: "En attente",
    icon: Clock,
    className: "bg-orange-100 text-orange-700 border-orange-200",
  },
  in_review: {
    label: "Commentaires",
    icon: MessageSquare,
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  approved: {
    label: "Clôturée",
    icon: CheckCircle2,
    className: "bg-green-100 text-green-700 border-green-200",
  },
  changes_requested: {
    label: "Modifications",
    icon: XCircle,
    className: "bg-red-100 text-red-700 border-red-200",
  },
};

const ReviewSection = ({ cardId, cardTitle }: ReviewSectionProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [opinionText, setOpinionText] = useState<Record<string, string>>({});
  const [savingOpinion, setSavingOpinion] = useState<string | null>(null);

  useEffect(() => {
    fetchReviews();
    getCurrentUser();
  }, [cardId]);

  const getCurrentUser = async () => {
    const { data } = await supabase.auth.getSession();
    setCurrentUserId(data.session?.user?.id || null);
  };

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from("content_reviews")
        .select("*")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch pending comments count for each review
      const reviewIds = (data || []).map(r => r.id);
      const { data: commentsData } = await supabase
        .from("review_comments")
        .select("review_id, status")
        .in("review_id", reviewIds)
        .eq("status", "pending");

      // Count pending comments per review
      const pendingCounts: Record<string, number> = {};
      (commentsData || []).forEach(c => {
        pendingCounts[c.review_id] = (pendingCounts[c.review_id] || 0) + 1;
      });

      const reviewsData = (data || []).map((r) => ({
        ...r,
        reviewer_email: r.reviewer_email || "Email non renseigné",
        pending_comments_count: pendingCounts[r.id] || 0,
      }));

      setReviews(reviewsData);

      // Auto-expand first non-approved review
      const activeReview = reviewsData.find(r => r.status !== "approved");
      if (activeReview) {
        setExpandedReview(activeReview.id);
      }

      // Initialize opinion texts
      const opinions: Record<string, string> = {};
      reviewsData.forEach(r => {
        opinions[r.id] = r.general_opinion || "";
      });
      setOpinionText(opinions);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async (reviewId: string, reviewerEmail: string) => {
    try {
      const { error } = await supabase
        .from("content_reviews")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", reviewId);

      if (error) throw error;

      const review = reviews.find((r) => r.id === reviewId);
      if (review) {
        await (supabase as any).from("content_notifications").insert({
          user_id: review.reviewer_id,
          type: "review_requested",
          reference_id: reviewId,
          card_id: cardId,
          message: `Rappel : Une relecture vous attend pour "${cardTitle}"`,
        });

        await supabase.functions.invoke("send-content-notification", {
          body: {
            type: "review_reminder",
            recipientEmail: reviewerEmail,
            cardTitle,
          },
        });
      }

      toast.success("Rappel envoyé");
      fetchReviews();
    } catch (error) {
      console.error("Error sending reminder:", error);
      toast.error("Erreur lors de l'envoi du rappel");
    }
  };

  const handleCloseReview = async (reviewId: string) => {
    try {
      const { error } = await supabase
        .from("content_reviews")
        .update({
          status: "approved",
          completed_at: new Date().toISOString()
        })
        .eq("id", reviewId);

      if (error) throw error;

      const review = reviews.find((r) => r.id === reviewId);
      if (review) {
        await (supabase as any).from("content_notifications").insert({
          user_id: review.reviewer_id,
          type: "review_status_changed",
          reference_id: reviewId,
          card_id: cardId,
          message: `Relecture clôturée pour "${cardTitle}"`,
        });
      }

      toast.success("Relecture clôturée");
      fetchReviews();
    } catch (error) {
      console.error("Error closing review:", error);
      toast.error("Erreur lors de la clôture");
    }
  };

  const handleSaveOpinion = async (reviewId: string) => {
    setSavingOpinion(reviewId);
    try {
      const { error } = await supabase
        .from("content_reviews")
        .update({ general_opinion: opinionText[reviewId]?.trim() || null })
        .eq("id", reviewId);

      if (error) throw error;
      fetchReviews();
      toast.success("Avis enregistré");
    } catch (error) {
      console.error("Error saving opinion:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSavingOpinion(null);
    }
  };

  const isAuthor = (review: Review) => currentUserId === review.created_by;
  const isReviewer = (review: Review) => currentUserId === review.reviewer_id;

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header avec bouton demande */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {reviews.length === 0 ? "Aucune relecture" : `${reviews.length} relecture${reviews.length > 1 ? "s" : ""}`}
        </span>
        <Button size="sm" variant="outline" onClick={() => setShowRequestDialog(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Associer
        </Button>
      </div>

      {/* Liste des relectures */}
      {reviews.length === 0 ? (
        <div className="text-center py-4 text-sm text-muted-foreground bg-muted/30 rounded-lg">
          Associez un collègue pour relire votre contenu
        </div>
      ) : (
        <div className="space-y-2">
          {reviews.map((review) => {
            const config = statusConfig[review.status];
            const Icon = config.icon;
            const isExpanded = expandedReview === review.id;
            const canSendReminder = isAuthor(review) && review.status === "pending";
            const hasPendingComments = (review.pending_comments_count || 0) > 0;
            const canClose = isAuthor(review) && review.status !== "approved" && !hasPendingComments;
            const showCloseButton = isAuthor(review) && review.status !== "approved";
            const canEditOpinion = isReviewer(review) && review.status !== "approved";

            return (
              <div
                key={review.id}
                className={cn(
                  "border rounded-lg overflow-hidden transition-colors",
                  review.status !== "approved" && "border-l-2 border-l-primary"
                )}
              >
                {/* Header cliquable */}
                <button
                  className="w-full p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left"
                  onClick={() => setExpandedReview(isExpanded ? null : review.id)}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="text-xs bg-primary/10">
                      {getInitials(review.reviewer_email)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {review.reviewer_email?.split("@")[0] || "Relecteur"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>

                  <Badge variant="outline" className={cn("text-xs", config.className)}>
                    <Icon className="h-3 w-3 mr-1" />
                    {config.label}
                  </Badge>

                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {/* Contenu expandé */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-3 border-t bg-muted/10">
                    {/* Actions rapides */}
                    {review.status !== "approved" && (
                      <div className="flex gap-2 pt-3">
                        {canSendReminder && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendReminder(review.id, review.reviewer_email || "");
                            }}
                          >
                            <Bell className="h-3 w-3 mr-1" />
                            Relancer
                          </Button>
                        )}
                        {showCloseButton && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className={cn(
                                      "h-7 text-xs",
                                      canClose
                                        ? "text-green-600 hover:text-green-700 hover:bg-green-50"
                                        : "text-muted-foreground cursor-not-allowed opacity-50"
                                    )}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (canClose) {
                                        handleCloseReview(review.id);
                                      }
                                    }}
                                    disabled={!canClose}
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Clôturer
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              {!canClose && hasPendingComments && (
                                <TooltipContent>
                                  <p>{review.pending_comments_count} commentaire{(review.pending_comments_count || 0) > 1 ? "s" : ""} en attente de traitement</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {review.external_url && (
                          <a
                            href={review.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Lien externe →
                          </a>
                        )}
                      </div>
                    )}

                    {/* Avis général */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Avis général</p>
                      {canEditOpinion ? (
                        <div className="flex gap-2">
                          <Textarea
                            value={opinionText[review.id] || ""}
                            onChange={(e) => setOpinionText({ ...opinionText, [review.id]: e.target.value })}
                            placeholder="Votre avis général..."
                            rows={2}
                            className="resize-none text-sm flex-1"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-auto self-end"
                            onClick={() => handleSaveOpinion(review.id)}
                            disabled={savingOpinion === review.id}
                          >
                            {savingOpinion === review.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ) : review.general_opinion ? (
                        <p className="text-sm p-2 bg-muted/50 rounded">{review.general_opinion}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Aucun avis pour le moment</p>
                      )}
                    </div>

                    {/* Commentaires */}
                    <CommentThread
                      reviewId={review.id}
                      cardId={cardId}
                      cardTitle={cardTitle}
                      isAuthor={isAuthor(review)}
                      isReviewer={isReviewer(review)}
                      reviewStatus={review.status}
                      onCommentAdded={() => {
                        // Update status to in_review when reviewer adds first comment
                        if (review.status === "pending" && isReviewer(review)) {
                          supabase
                            .from("content_reviews")
                            .update({ status: "in_review" })
                            .eq("id", review.id)
                            .then(() => fetchReviews());
                        } else {
                          // Always refresh to update pending count
                          fetchReviews();
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ReviewRequestDialog
        open={showRequestDialog}
        onOpenChange={setShowRequestDialog}
        cardId={cardId}
        cardTitle={cardTitle}
        onCreated={fetchReviews}
      />
    </div>
  );
};

export default ReviewSection;
