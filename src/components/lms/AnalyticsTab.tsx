import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLessonViewStats, useCourseLessons, useCourseModules, useAllCourseComments } from "@/hooks/useLms";
import { BarChart3, Eye, MessageCircle, Users } from "lucide-react";

interface Props {
  courseId: string;
}

export default function LmsAnalyticsTab({ courseId }: Props) {
  const { data: views = [] } = useLessonViewStats(courseId);
  const { data: lessons = [] } = useCourseLessons(courseId);
  const { data: modules = [] } = useCourseModules(courseId);
  const { data: comments = [] } = useAllCourseComments(courseId);

  const stats = useMemo(() => {
    const viewsByLesson: Record<string, { total: number; unique: Set<string> }> = {};
    for (const v of views) {
      if (!viewsByLesson[v.lesson_id]) viewsByLesson[v.lesson_id] = { total: 0, unique: new Set() };
      viewsByLesson[v.lesson_id].total++;
      viewsByLesson[v.lesson_id].unique.add(v.learner_email);
    }

    const commentsByLesson: Record<string, number> = {};
    for (const c of comments) {
      commentsByLesson[c.lesson_id] = (commentsByLesson[c.lesson_id] || 0) + 1;
    }

    const uniqueLearners = new Set(views.map((v) => v.learner_email));

    return { viewsByLesson, commentsByLesson, uniqueLearners, totalViews: views.length };
  }, [views, comments]);

  const moduleMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of modules) map[m.id] = m.title;
    return map;
  }, [modules]);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <Eye className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
            <div className="text-2xl font-bold">{stats.totalViews}</div>
            <div className="text-xs text-muted-foreground">Vues totales</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Users className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
            <div className="text-2xl font-bold">{stats.uniqueLearners.size}</div>
            <div className="text-xs text-muted-foreground">Apprenants actifs</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <BarChart3 className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
            <div className="text-2xl font-bold">{lessons.length}</div>
            <div className="text-xs text-muted-foreground">Leçons</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <MessageCircle className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
            <div className="text-2xl font-bold">{comments.length}</div>
            <div className="text-xs text-muted-foreground">Commentaires</div>
          </CardContent>
        </Card>
      </div>

      {/* Per-lesson breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consultations par leçon</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {modules.map((mod) => {
              const modLessons = lessons.filter((l) => l.module_id === mod.id).sort((a, b) => a.position - b.position);
              if (modLessons.length === 0) return null;
              return (
                <div key={mod.id} className="mb-4">
                  <div className="text-sm font-medium text-muted-foreground mb-2">{mod.title}</div>
                  {modLessons.map((lesson) => {
                    const lv = stats.viewsByLesson[lesson.id];
                    const lc = stats.commentsByLesson[lesson.id] || 0;
                    const totalViews = lv?.total || 0;
                    const uniqueViews = lv?.unique.size || 0;
                    const maxViews = Math.max(...Object.values(stats.viewsByLesson).map((v) => v.total), 1);
                    const barWidth = (totalViews / maxViews) * 100;

                    return (
                      <div key={lesson.id} className="flex items-center gap-3 py-1.5">
                        <span className="text-sm truncate min-w-0 flex-1">{lesson.title}</span>
                        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" /> {totalViews}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" /> {uniqueViews}
                          </span>
                          {lc > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <MessageCircle className="w-3 h-3 mr-1" /> {lc}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent comments */}
      {comments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Derniers commentaires</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {comments.slice(0, 10).map((c: any) => {
              const lesson = lessons.find((l) => l.id === c.lesson_id);
              return (
                <div key={c.id} className="bg-muted/50 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{c.learner_name || c.learner_email}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {lesson && (
                      <Badge variant="secondary" className="text-xs">{lesson.title}</Badge>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-muted-foreground">{c.content}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
