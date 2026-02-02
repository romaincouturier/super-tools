import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, CheckCircle2, Clock, MessageSquare, Bell, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ReviewRequestDialog from "./ReviewRequestDialog";
import CommentThread from "./CommentThread";

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
}

interface ReviewPanelProps {
  cardId: string;
  cardTitle: string;
}

const statusConfig: Record<
  string,
  { label: string; icon: typeof Clock; variant: "secondary" | "default" | "destructive"; className?: string }
> = {
  pending: {
    label: "En attente du relecteur",
    icon: Clock,
    variant: "secondary",
  },
  in_review: {
    label: "Commentaires reçus",
    icon: MessageSquare,
    variant: "default",
  },
  approved: {
    label: "Clôturée",
    icon: CheckCircle2,
    variant: "default",
    className: "bg-green-600 hover:bg-green-700",
  },
  changes_requested: {
    label: "Modifications demandées",
    icon: XCircle,
    variant: "destructive" as const,
  },
};

const ReviewPanel = ({ cardId, cardTitle }: ReviewPanelProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

      // Fetch reviewer emails
      const reviewerIds = [...new Set((data || []).map((r) => r.reviewer_id))];
      const emails: Record<string, string> = {};

      for (const id of reviewerIds) {
        const { data: userData } = await supabase.auth.admin.getUserById(id).catch(() => ({ data: null }));
        if (userData?.user?.email) {
          emails[id] = userData.user.email;
        }
      }

      setReviews(
        (data || []).map((r) => ({
          ...r,
          reviewer_email: emails[r.reviewer_id] || "Utilisateur inconnu",
        }))
      );
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async (reviewId: string, reviewerEmail: string) => {
    try {
      // Update reminder timestamp
      const { error } = await supabase
        .from("content_reviews")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", reviewId);

      if (error) throw error;

      // Send notification
      const review = reviews.find((r) => r.id === reviewId);
      if (review) {
        await supabase.from("content_notifications").insert({
          user_id: review.reviewer_id,
          type: "review_requested",
          reference_id: reviewId,
          message: `Rappel : Une relecture vous attend pour "${cardTitle}"`,
        });

        // Optionally trigger email via edge function
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

      // Notify reviewer that the review is closed
      const review = reviews.find((r) => r.id === reviewId);
      if (review) {
        await supabase.from("content_notifications").insert({
          user_id: review.reviewer_id,
          type: "review_status_changed",
          reference_id: reviewId,
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

  const isAuthor = (review: Review) => currentUserId === review.created_by;
  const isReviewer = (review: Review) => currentUserId === review.reviewer_id;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Demandes de relecture</h4>
        <Button size="sm" onClick={() => setShowRequestDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Demander une relecture
        </Button>
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Aucune demande de relecture</p>
          <p className="text-sm mt-2">
            Demandez à un collègue de relire votre contenu avant publication
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => {
            const config = statusConfig[review.status];
            const Icon = config.icon;
            const canSendReminder = isAuthor(review) && review.status === "pending";
            const canClose = isAuthor(review) && review.status !== "approved";
            const hasComments = review.status === "in_review";

            return (
              <div
                key={review.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      Relecteur : {review.reviewer_email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Demandée le {new Date(review.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    {review.reminder_sent_at && (
                      <p className="text-xs text-orange-600">
                        Rappel envoyé le {new Date(review.reminder_sent_at).toLocaleDateString("fr-FR")}
                      </p>
                    )}
                    {review.external_url && (
                      <a
                        href={review.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Lien externe →
                      </a>
                    )}
                  </div>
                  <Badge variant={config.variant} className={config.className}>
                    <Icon className="h-3 w-3 mr-1" />
                    {config.label}
                  </Badge>
                </div>

                {/* Actions pour l'auteur */}
                {review.status !== "approved" && (
                  <div className="flex gap-2 flex-wrap">
                    {canSendReminder && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendReminder(review.id, review.reviewer_email || "")}
                      >
                        <Bell className="h-4 w-4 mr-1" />
                        Relancer
                      </Button>
                    )}
                    {canClose && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-600 text-green-600 hover:bg-green-50"
                        onClick={() => handleCloseReview(review.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Clôturer la relecture
                      </Button>
                    )}
                  </div>
                )}

                {/* Commentaires avec gestion des statuts */}
                <CommentThread 
                  reviewId={review.id} 
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
                    }
                  }}
                />
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

export default ReviewPanel;
