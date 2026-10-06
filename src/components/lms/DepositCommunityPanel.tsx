import { CheckSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { Spinner } from "@/components/ui/spinner";
import PracticePostCard from "@/components/learner/community/PracticePostCard";
import {
  usePracticePosts,
  useTogglePracticeReaction,
  useDeletePracticePost,
  useMarkPostStaffTreated,
} from "@/hooks/usePracticeFeed";

interface Props {
  depositId: string;
}

function useStaffDisplayName(userId: string | undefined, email: string) {
  return useQuery({
    queryKey: ["staff_display_name", userId],
    enabled: !!userId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", userId)
        .maybeSingle();
      const name = [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim();
      return name || (email ? email.split("@")[0] : null);
    },
  });
}

/**
 * Publication communauté du travail partagé : mêmes réactions, mêmes
 * commentaires et même statut « traité » que l'écran Communauté, car c'est
 * le même fil (practice_posts.deposit_id).
 */
export default function DepositCommunityPanel({ depositId }: Props) {
  const { user } = useAuth();
  const myEmail = (user?.email || "").toLowerCase();
  const { toast } = useToast();
  const { data: adminName = null } = useStaffDisplayName(user?.id, myEmail);
  const { data: posts = [], isLoading } = usePracticePosts(myEmail || null, 1, { depositId }, true);
  const toggleReaction = useTogglePracticeReaction(myEmail || null);
  const deletePost = useDeletePracticePost(myEmail || null, true);
  const markTreated = useMarkPostStaffTreated();
  const post = posts[0];

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner />
      </div>
    );
  }

  if (!post) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Ce travail n'est pas publié dans la communauté (privé ou masqué).
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <PracticePostCard
        post={post}
        currentEmail={myEmail}
        isAdmin
        currentUserName={adminName}
        onReact={async (postId, emoji, iReacted) => {
          try {
            await toggleReaction.mutateAsync({ postId, emoji, iReacted });
            if (!post.is_staff_treated) markTreated.mutate({ postId, treated: true });
          } catch {
            toastError(toast, "Action impossible.");
          }
        }}
        onDelete={async (postId) => {
          if (!window.confirm("Retirer ce travail de la communauté ?")) return;
          try {
            await deletePost.mutateAsync(postId);
          } catch {
            toastError(toast, "Impossible de supprimer.");
          }
        }}
        onVote={() => {}}
        onSelectTag={() => {}}
      />
      <div className="flex justify-end pr-1">
        <button
          onClick={() =>
            markTreated
              .mutateAsync({ postId: post.id, treated: !post.is_staff_treated })
              .catch(() => toastError(toast, "Impossible de mettre à jour."))
          }
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            post.is_staff_treated ? "text-primary hover:text-muted-foreground" : "text-muted-foreground hover:text-primary"
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          {post.is_staff_treated ? "Traité · marquer non traité" : "Marquer traité"}
        </button>
      </div>
    </div>
  );
}
