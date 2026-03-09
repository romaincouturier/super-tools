import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, Users, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  status: "pending" | "in_review" | "approved" | "changes_requested";
  created_at: string;
  created_by: string | null;
}

interface ReviewSectionProps {
  cardId: string;
  cardTitle: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-orange-500",
  in_review: "bg-blue-500",
  approved: "bg-green-500",
  changes_requested: "bg-red-500",
};

const statusLabels: Record<string, string> = {
  pending: "En attente",
  in_review: "En cours",
  approved: "Clôturée",
  changes_requested: "Modifications demandées",
};

const ReviewSection = ({ cardId, cardTitle }: ReviewSectionProps) => {
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

      setReviews(
        (data || []).map((r) => ({
          ...r,
          reviewer_email: r.reviewer_email || "Email non renseigné",
        }))
      );
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseReview = async (reviewId: string) => {
    try {
      const { error } = await supabase
        .from("content_reviews")
        .update({ status: "approved", completed_at: new Date().toISOString() })
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

  const getInitials = (email?: string) => {
    if (!email) return "?";
    return email.split("@")[0].split(".").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const isAuthor = (review: Review) => currentUserId === review.created_by;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const reviewIds = reviews.map((r) => r.id);

  return (
    <div className="space-y-4">
      {/* Compact reviewer bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          {reviews.length === 0 ? (
            <span className="text-sm text-muted-foreground">Aucun relecteur</span>
          ) : (
            <div className="flex items-center gap-1">
              <TooltipProvider>
                {reviews.map((review) => (
                  <Tooltip key={review.id}>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        <Avatar className="h-7 w-7 cursor-default">
                          <AvatarFallback className="text-[10px] bg-primary/10">
                            {getInitials(review.reviewer_email)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                            statusColors[review.status]
                          )}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      <p className="font-medium">{review.reviewer_email?.split("@")[0]}</p>
                      <p className="text-muted-foreground">{statusLabels[review.status]}</p>
                      {isAuthor(review) && review.status !== "approved" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs mt-1 text-green-600"
                          onClick={() => handleCloseReview(review.id)}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Clôturer
                        </Button>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            </div>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowRequestDialog(true)}>
          <Plus className="h-3 w-3 mr-1" />
          Relecteur
        </Button>
      </div>

      {/* Unified comment thread across all reviews */}
      {reviewIds.length > 0 && (
        <CommentThread
          reviewIds={reviewIds}
          cardId={cardId}
          cardTitle={cardTitle}
          onCommentAdded={fetchReviews}
        />
      )}

      {reviewIds.length === 0 && (
        <div className="text-center py-6 text-sm text-muted-foreground bg-muted/20 rounded-lg">
          Associez un relecteur pour commencer la discussion
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
