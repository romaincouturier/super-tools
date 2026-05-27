import { useState, useEffect, useMemo } from "react";
import { Users, ChevronDown } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { supabase } from "@/integrations/supabase/client";
import PracticePostCard from "@/components/learner/community/PracticePostCard";
import {
  useAdminCommunityCourses,
  usePracticePosts,
  useTogglePracticeReaction,
  useVotePracticePoll,
  useDeletePracticePost,
  usePinPracticePost,
} from "@/hooks/usePracticeFeed";

export default function LmsCommunity() {
  const { toast } = useToast();
  const { userEmail } = useModuleAccess();
  const [adminName, setAdminName] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");

  const { data: courses = [], isLoading: coursesLoading } = useAdminCommunityCourses();
  const courseIds = useMemo(() => courses.map((c) => c.courseId), [courses]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
      setAdminName(name || (user.email ? user.email.split("@")[0] : null));
    });
    return () => { cancelled = true; };
  }, []);

  const filterCourseIds = selectedCourseId ? [selectedCourseId] : courseIds;
  const { data: posts = [], isLoading: postsLoading } = usePracticePosts(
    userEmail,
    100,
    { courseIds: filterCourseIds },
    true,
  );

  const toggleReaction = useTogglePracticeReaction(userEmail);
  const votePoll = useVotePracticePoll(userEmail);
  const deletePost = useDeletePracticePost(userEmail, true);
  const pinPost = usePinPracticePost();

  const handleReact = (postId: string, iReacted: boolean) =>
    toggleReaction.mutateAsync({ postId, iReacted }).catch(() => toastError(toast, "Action impossible."));
  const handleVote = (pollId: string, optionId: string, currentOptionId: string | null) =>
    votePoll.mutateAsync({ pollId, optionId, currentOptionId }).catch(() => toastError(toast, "Vote impossible."));
  const handleDelete = async (postId: string) => {
    if (!window.confirm("Supprimer ce message ?")) return;
    try {
      await deletePost.mutateAsync(postId);
    } catch {
      toastError(toast, "Impossible de supprimer ce message.");
    }
  };
  const handlePin = (postId: string, pin: boolean) =>
    pinPost.mutateAsync({ postId, pin }).catch(() => toastError(toast, pin ? "Impossible d'épingler." : "Impossible de désépingler."));

  const noSessions = !coursesLoading && courses.length === 0;

  return (
    <ModuleLayout>
      <PageHeader
        title="Communauté e-learning"
        subtitle="Tous les messages des apprenants sur vos sessions actuelles et à venir"
        icon={Users}
      />

      {!noSessions && (
        <div className="mb-4 flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="appearance-none rounded-xl border pl-3 pr-9 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring bg-background"
            >
              <option value="">Toutes les sessions ({courses.length})</option>
              {courses.map((c) => (
                <option key={c.courseId} value={c.courseId}>{c.title}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        {coursesLoading || postsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : noSessions ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Aucune session de formation e-learning en cours ou à venir.
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Aucun message dans la communauté pour cette sélection.
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PracticePostCard
                key={post.id}
                post={post}
                currentEmail={userEmail ?? ""}
                isAdmin
                currentUserName={adminName}
                onReact={handleReact}
                onDelete={handleDelete}
                onVote={handleVote}
                onPin={handlePin}
                onSelectTag={() => {}}
              />
            ))}
          </div>
        )}
      </div>
    </ModuleLayout>
  );
}
