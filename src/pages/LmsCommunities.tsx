import { useNavigate } from "react-router-dom";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Users, MessageSquare, FileText, AlertTriangle, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CommunityRow {
  courseId: string;
  courseTitle: string;
  formationName: string | null;
  memberCount: number;
  recentPostCount: number;
  pendingReplyCount: number;
  toModerateCount: number;
}

function useCommunityList() {
  return useQuery<CommunityRow[]>({
    queryKey: ["lms_communities_list"],
    queryFn: async () => {
      // Fetch all courses with their formation
      const { data: courses, error: coursesErr } = await (supabase as any)
        .from("lms_courses")
        .select("id, title, formation_config_id");
      if (coursesErr) throw coursesErr;

      if (!courses || courses.length === 0) return [];

      // Formation names
      const configIds = Array.from(new Set(courses.map((c: any) => c.formation_config_id).filter(Boolean)));
      const formationMap = new Map<string, string>();
      if (configIds.length > 0) {
        const { data: configs } = await (supabase as any)
          .from("formation_configs")
          .select("id, formation_name")
          .in("id", configIds);
        (configs || []).forEach((fc: any) => formationMap.set(fc.id, fc.formation_name));
      }

      const courseIds: string[] = courses.map((c: any) => c.id);

      // Enrollments per course
      const { data: enrollments } = await (supabase as any)
        .from("lms_enrollments")
        .select("course_id")
        .in("course_id", courseIds);

      const enrollCountMap = new Map<string, number>();
      (enrollments || []).forEach((e: any) => {
        enrollCountMap.set(e.course_id, (enrollCountMap.get(e.course_id) ?? 0) + 1);
      });

      // Recent posts (last 48h) per course
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: recentPosts } = await (supabase as any)
        .from("practice_posts")
        .select("id, course_id")
        .in("course_id", courseIds)
        .gte("created_at", since);

      const recentMap = new Map<string, number>();
      (recentPosts || []).forEach((p: any) => {
        recentMap.set(p.course_id, (recentMap.get(p.course_id) ?? 0) + 1);
      });

      // Travaux (posts liés à un dépôt) sans retour staff
      const { data: allPosts } = await (supabase as any)
        .from("practice_posts")
        .select("id, course_id, deposit_id, is_staff_treated")
        .in("course_id", courseIds)
        .not("deposit_id", "is", null);

      const allPostIds: string[] = (allPosts || []).map((p: any) => p.id);

      let postsWithStaffReply = new Set<string>();
      if (allPostIds.length > 0) {
        const { data: staffComments } = await (supabase as any)
          .from("practice_post_comments")
          .select("post_id")
          .in("post_id", allPostIds)
          .eq("is_staff_reply", true);
        (staffComments || []).forEach((c: any) => postsWithStaffReply.add(c.post_id));
      }

      const pendingMap = new Map<string, number>();
      (allPosts || []).forEach((p: any) => {
        if (!p.is_staff_treated && !postsWithStaffReply.has(p.id)) {
          pendingMap.set(p.course_id, (pendingMap.get(p.course_id) ?? 0) + 1);
        }
      });


      // Only include courses that have enrollments OR posts
      return courses
        .filter((c: any) => (enrollCountMap.get(c.id) ?? 0) > 0 || (allPosts || []).some((p: any) => p.course_id === c.id))
        .map((c: any): CommunityRow => ({
          courseId: c.id,
          courseTitle: c.title,
          formationName: c.formation_config_id ? (formationMap.get(c.formation_config_id) ?? null) : null,
          memberCount: enrollCountMap.get(c.id) ?? 0,
          recentPostCount: recentMap.get(c.id) ?? 0,
          pendingReplyCount: pendingMap.get(c.id) ?? 0,
          toModerateCount: 0,
        }))
        .sort((a: CommunityRow, b: CommunityRow) => b.pendingReplyCount - a.pendingReplyCount);
    },
  });
}

export default function LmsCommunities() {
  const navigate = useNavigate();
  const { data: communities = [], isLoading } = useCommunityList();

  return (
    <ModuleLayout>
      <div className="container py-6 space-y-6 max-w-5xl">
        <PageHeader
          icon={Users}
          title="Communautés e-learning"
          subtitle="Vue d'ensemble de toutes les communautés liées à vos cours"
          backTo="/lms"
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : communities.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
            Aucune communauté active pour l'instant.
            <br />
            Les communautés apparaissent dès qu'un cours a des inscrits ou des publications.
          </div>
        ) : (
          <div className="space-y-3">
            {communities.map((c) => (
              <Card
                key={c.courseId}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/lms/communautes/${c.courseId}`)}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{c.courseTitle}</span>
                        {c.formationName && (
                          <Badge variant="outline" className="text-xs shrink-0">{c.formationName}</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-5 shrink-0 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5" title="Membres inscrits">
                        <Users className="w-4 h-4" />
                        {c.memberCount}
                      </span>
                      <span className="flex items-center gap-1.5" title="Publications récentes (48h)">
                        <MessageSquare className="w-4 h-4" />
                        {c.recentPostCount > 0 ? (
                          <span className="text-primary font-medium">{c.recentPostCount} récentes</span>
                        ) : (
                          <span>0</span>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5" title="Travaux sans retour staff">
                        <FileText className="w-4 h-4" />
                        {c.pendingReplyCount > 0 ? (
                          <Badge variant="destructive" className="text-xs px-1.5 py-0">{c.pendingReplyCount} en attente</Badge>
                        ) : (
                          <span>0</span>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5" title="À modérer">
                        <AlertTriangle className="w-4 h-4" />
                        <span>{c.toModerateCount}</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ModuleLayout>
  );
}
