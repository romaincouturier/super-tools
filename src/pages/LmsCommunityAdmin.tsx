import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, FileText, Settings, Eye, CheckSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { supabase } from "@/integrations/supabase/client";
import PostComposer from "@/components/learner/community/PostComposer";
import { useQuery } from "@tanstack/react-query";
import PracticePostCard from "@/components/learner/community/PracticePostCard";
import {
  usePracticePosts,
  useCreatePracticePost,
  useDeletePracticePost,
  usePinPracticePost,
  useTogglePracticeReaction,
  useVotePracticePoll,
  useMarkPostStaffTreated,
  type PracticePost,
} from "@/hooks/usePracticeFeed";

// ── Course info hook ──────────────────────────────────────────────────────────

function useCourseInfo(courseId: string) {
  return useQuery({
    queryKey: ["lms_course_info", courseId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("lms_courses")
        .select("id, title, community_preview_count")
        .eq("id", courseId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; title: string; community_preview_count: number | null } | null;
    },
    enabled: !!courseId,
  });
}

function useCourseEnrollments(courseId: string) {
  return useQuery({
    queryKey: ["lms_enrollments_admin", courseId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("lms_enrollments")
        .select("id, learner_email, status, enrolled_at, completion_percentage")
        .eq("course_id", courseId)
        .order("enrolled_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        learner_email: string;
        status: string;
        enrolled_at: string;
        completion_percentage: number | null;
      }>;
    },
    enabled: !!courseId,
  });
}

// ── PostsFeed — Publications + Travaux tabs with "À traiter" toggle ──────────

function PostsFeed({
  posts,
  isLoading,
  userEmail,
  adminName,
  emptyLabel,
  showTreatedToggle = false,
}: {
  posts: PracticePost[];
  isLoading: boolean;
  userEmail: string | null;
  adminName: string | null;
  emptyLabel: string;
  showTreatedToggle?: boolean;
}) {
  const { toast } = useToast();
  const [onlyPending, setOnlyPending] = useState(false);
  const deletePost = useDeletePracticePost(userEmail, true);
  const pinPost = usePinPracticePost();
  const toggleReaction = useTogglePracticeReaction(userEmail);
  const votePoll = useVotePracticePoll(userEmail);
  const markTreated = useMarkPostStaffTreated();

  const handleDelete = async (postId: string) => {
    if (!window.confirm("Supprimer ce message ?")) return;
    try {
      await deletePost.mutateAsync(postId);
    } catch {
      toastError(toast, "Impossible de supprimer ce message.");
    }
  };

  const handlePin = (postId: string, pin: boolean) =>
    pinPost.mutateAsync({ postId, pin }).catch(() =>
      toastError(toast, pin ? "Impossible d'épingler." : "Impossible de désépingler.")
    );

  const handleReact = (postId: string, emoji: string, iReacted: boolean) =>
    toggleReaction.mutateAsync({ postId, emoji, iReacted }).catch(() =>
      toastError(toast, "Action impossible.")
    );

  const handleVote = (pollId: string, optionId: string, currentOptionId: string | null) =>
    votePoll.mutateAsync({ pollId, optionId, currentOptionId }).catch(() =>
      toastError(toast, "Vote impossible.")
    );

  const handleToggleTreated = (postId: string, current: boolean) =>
    markTreated.mutateAsync({ postId, treated: !current }).catch(() =>
      toastError(toast, "Impossible de mettre à jour.")
    );

  const pendingCount = posts.filter((p) => !p.is_staff_treated).length;
  const visiblePosts = onlyPending ? posts.filter((p) => !p.is_staff_treated) : posts;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showTreatedToggle && posts.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOnlyPending(!onlyPending)}
            className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border transition-colors ${
              onlyPending
                ? "bg-destructive/10 border-destructive/30 text-destructive font-medium"
                : "border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40"
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            À traiter
            {pendingCount > 0 && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0 ml-0.5">{pendingCount}</Badge>
            )}
          </button>
          {onlyPending && (
            <span className="text-xs text-muted-foreground">{pendingCount} publication{pendingCount !== 1 ? "s" : ""} en attente</span>
          )}
        </div>
      )}

      {visiblePosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          {onlyPending ? "Aucune publication en attente de traitement." : emptyLabel}
        </div>
      ) : (
        visiblePosts.map((post) => (
          <div key={post.id} className="relative">
            {post.is_staff_treated && (
              <div className="absolute top-2 right-2 z-10">
                <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">Traité</Badge>
              </div>
            )}
            <PracticePostCard
              post={post}
              currentEmail={userEmail ?? ""}
              isAdmin
              currentUserName={adminName}
              onReact={async (postId, emoji, iReacted) => {
                await handleReact(postId, emoji, iReacted);
                if (!post.is_staff_treated)
                  markTreated.mutate({ postId, treated: true });
              }}
              onDelete={handleDelete}
              onVote={handleVote}
              onPin={handlePin}
              onSelectTag={() => {}}
            />
            <div className="flex justify-end mt-1 pr-1">
              <button
                onClick={() => handleToggleTreated(post.id, post.is_staff_treated)}
                className={`flex items-center gap-1.5 text-xs transition-colors ${
                  post.is_staff_treated
                    ? "text-green-600 hover:text-muted-foreground"
                    : "text-muted-foreground hover:text-green-600"
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                {post.is_staff_treated ? "Marquer non traité" : "Marquer traité"}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Membres tab ───────────────────────────────────────────────────────────────

function useLastPublicationByLearner(courseId: string) {
  return useQuery({
    queryKey: ["lms_last_publication_by_learner", courseId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("practice_posts")
        .select("author_email, created_at")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map = new Map<string, string>();
      ((data ?? []) as Array<{ author_email: string; created_at: string }>).forEach((p) => {
        const k = (p.author_email || "").toLowerCase();
        if (!map.has(k)) map.set(k, p.created_at);
      });
      return map;
    },
    enabled: !!courseId,
  });
}

function MembersTab({ courseId }: { courseId: string }) {
  const { data: enrollments = [], isLoading } = useCourseEnrollments(courseId);
  const { data: lastPubMap } = useLastPublicationByLearner(courseId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (enrollments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
        Aucun membre inscrit.
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Email</th>
            <th className="text-left px-4 py-3 font-medium">Dernière publication</th>
            <th className="text-left px-4 py-3 font-medium">Inscription</th>
            <th className="text-right px-4 py-3 font-medium">Progression</th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map((e, i) => {
            const last = lastPubMap?.get((e.learner_email || "").toLowerCase());
            return (
              <tr key={e.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                <td className="px-4 py-3">{e.learner_email}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {last ? new Date(last).toLocaleDateString("fr-FR") : <span className="italic">Aucune</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(e.enrolled_at).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-right">
                  {e.completion_percentage != null ? `${Math.round(e.completion_percentage)}%` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Paramètres tab ────────────────────────────────────────────────────────────

function SettingsTab({ courseId }: { courseId: string }) {
  const { toast } = useToast();
  const { data: course, refetch } = useCourseInfo(courseId);
  const [previewCount, setPreviewCount] = useState<number>(3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (course?.community_preview_count != null) {
      setPreviewCount(course.community_preview_count);
    }
  }, [course]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("lms_courses")
        .update({ community_preview_count: previewCount })
        .eq("id", courseId);
      if (error) throw error;
      await refetch();
      toast({ title: "Paramètres sauvegardés" });
    } catch {
      toastError(toast, "Impossible de sauvegarder.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle className="text-base">Aperçu communauté</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Nombre de publications affichées dans la sidebar du cours</Label>
          <Input
            type="number"
            min={0}
            max={20}
            value={previewCount}
            onChange={(e) => setPreviewCount(Number(e.target.value))}
            className="w-24"
          />
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Spinner size="sm" /> : "Sauvegarder"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LmsCommunityAdmin() {
  const { courseId = "" } = useParams<{ courseId: string }>();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) return;
      setUserEmail(user.email ?? null);
      const { data: profile } = await (supabase as any)
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

  const { data: course, isLoading: courseLoading } = useCourseInfo(courseId);
  const { data: posts = [], isLoading: postsLoading } = usePracticePosts(
    userEmail,
    200,
    { courseId },
    true,
  );
  const createPost = useCreatePracticePost(userEmail, true);

  const sharedPosts = posts.filter((p) => p.file_url != null);

  return (
    <ModuleLayout>
      <div className="container py-6 space-y-6 max-w-4xl">
        <PageHeader
          icon={Users}
          title={courseLoading ? "Communauté" : (course?.title ?? "Communauté")}
          subtitle="Administration de la communauté"
          backTo="/lms/communautes"
        />

        <Tabs defaultValue="posts">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="posts" className="gap-1.5">
              <MessageSquare className="w-4 h-4" />
              Publications
              {!postsLoading && posts.filter((p) => !p.is_staff_treated).length > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs px-1.5 py-0">
                  {posts.filter((p) => !p.is_staff_treated).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="shared" className="gap-1.5">
              <FileText className="w-4 h-4" />
              Travaux partagés
              {sharedPosts.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">{sharedPosts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-1.5">
              <Users className="w-4 h-4" />
              Membres
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="w-4 h-4" />
              Paramètres
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5">
              <Eye className="w-4 h-4" />
              Aperçu apprenant
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="posts">
              {userEmail && (
                <div className="mb-4">
                  <PostComposer
                    email={userEmail}
                    firstName={adminName?.split(" ")[0] ?? ""}
                    lastName={adminName?.split(" ").slice(1).join(" ") ?? ""}
                    photoUrl={null}
                    onCreate={async (content, file, poll, gifUrl) => {
                      await createPost.mutateAsync({ content, file: file ?? null, courseId, poll, gifUrl });
                    }}
                  />
                </div>
              )}
              <PostsFeed
                posts={posts}
                isLoading={postsLoading}
                userEmail={userEmail}
                adminName={adminName}
                emptyLabel="Aucune publication dans cette communauté."
                showTreatedToggle
              />
            </TabsContent>

            <TabsContent value="shared">
              <PostsFeed
                posts={sharedPosts}
                isLoading={postsLoading}
                userEmail={userEmail}
                adminName={adminName}
                emptyLabel="Aucun travail partagé dans cette communauté."
                showTreatedToggle
              />
            </TabsContent>

            <TabsContent value="members">
              <MembersTab courseId={courseId} />
            </TabsContent>

            <TabsContent value="settings">
              <SettingsTab courseId={courseId} />
            </TabsContent>

            <TabsContent value="preview">
              <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-2.5 text-sm text-primary font-medium mb-4">
                Mode aperçu — vue apprenant (lecture seule)
              </div>
              {postsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Spinner size="lg" />
                </div>
              ) : posts.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
                  Aucune publication dans cette communauté.
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <PracticePostCard
                      key={post.id}
                      post={post}
                      currentEmail=""
                      isAdmin={false}
                      currentUserName={null}
                      onReact={() => Promise.resolve()}
                      onDelete={() => Promise.resolve()}
                      onVote={() => Promise.resolve()}
                      onPin={() => Promise.resolve()}
                      onSelectTag={() => {}}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </ModuleLayout>
  );
}
