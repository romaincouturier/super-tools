import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, CheckCircle2, XCircle, Clock, MessageSquare } from "lucide-react";
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
    label: "En attente",
    icon: Clock,
    variant: "secondary",
  },
  in_review: {
    label: "En cours",
    icon: MessageSquare,
    variant: "default",
  },
  approved: {
    label: "Approuvé",
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
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);

  useEffect(() => {
    fetchReviews();
  }, [cardId]);

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

  const handleStatusChange = async (reviewId: string, newStatus: Review["status"]) => {
    try {
      const updates: any = { status: newStatus };
      if (newStatus === "approved" || newStatus === "changes_requested") {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("content_reviews")
        .update(updates)
        .eq("id", reviewId);

      if (error) throw error;

      // Create notification
      const review = reviews.find((r) => r.id === reviewId);
      if (review) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user) {
          await supabase.from("content_notifications").insert({
            user_id: review.reviewer_id,
            type: "review_status_changed",
            reference_id: reviewId,
            message: `Statut de relecture modifié : ${statusConfig[newStatus].label}`,
          });
        }
      }

      toast.success("Statut mis à jour");
      fetchReviews();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

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
          Aucune demande de relecture
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => {
            const config = statusConfig[review.status];
            const Icon = config.icon;

            return (
              <div
                key={review.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      {review.reviewer_email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
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

                {review.status !== "approved" && (
                  <div className="flex gap-2">
                    {review.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(review.id, "in_review")}
                      >
                        Commencer la relecture
                      </Button>
                    )}
                {(review.status === "pending" || review.status === "in_review") && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-600 text-green-600 hover:bg-green-50"
                          onClick={() => handleStatusChange(review.id, "approved")}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approuver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-orange-600 text-orange-600 hover:bg-orange-50"
                          onClick={() => handleStatusChange(review.id, "changes_requested")}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Demander des modifications
                        </Button>
                      </>
                    )}
                  </div>
                )}

                <CommentThread reviewId={review.id} />
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
