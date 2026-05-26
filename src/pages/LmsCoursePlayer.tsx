import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useCourse, useCourseModules, useCourseLessons, useModuleLessons,
  useLearnerProgress, useMarkLessonComplete,
  useSubmitAssignment, useLearnerSubmissions, uploadAssignmentFile,
  useLearnerBadges, useTrackPageView,
  useCourseForums, useForumPosts,
  useCourseLiveMeetings,
  LmsLesson, LmsModule,
} from "@/hooks/useLms";
import QuizPlayer from "@/components/lms/QuizPlayer";
import LessonComments from "@/components/lms/LessonComments";
import LessonBlocksPlayer from "@/components/lms/blocks/LessonBlocksPlayer";
import CourseHomeSidebar, { CommunityCtaButton, type ModuleStatus } from "@/components/lms/CourseHomeSidebar";
import LearnerCourseHeader from "@/components/lms/LearnerCourseHeader";
import { useLessonBlocks } from "@/hooks/useLmsBlocks";
import { useMyDeposit } from "@/hooks/useLmsWorkDeposit";
import type { ExerciseBlockContent, WorkDepositBlockContent } from "@/types/lms-blocks";
import {
  BookOpen, CheckCircle2, ChevronRight, ChevronLeft, ChevronDown,
  Clock, Paperclip, Download, Menu, Bell, MessageSquare, Sparkles, Home,
  User, HelpCircle, LogOut,
} from "lucide-react";
import SupertiltLogo from "@/components/SupertiltLogo";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import WorkDepositSection from "@/components/lms/WorkDepositSection";
import type { WorkDepositConfig } from "@/types/lms-work-deposit";
import { useConfirm } from "@/hooks/useConfirm";
import { supabase } from "@/integrations/supabase/client";

export default function LmsCoursePlayer() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const learnerEmail = searchParams.get("email") || "";
  const isPreview = searchParams.get("preview") === "admin";
  const initialLessonId = searchParams.get("lesson");

  const { data: course } = useCourse(courseId);
  const { data: modules = [] } = useCourseModules(courseId);
  const { data: allLessons = [] } = useCourseLessons(courseId);
  const { data: progress = [] } = useLearnerProgress(courseId, learnerEmail || undefined);
  const { data: badges = [] } = useLearnerBadges(learnerEmail || undefined);
  const { data: liveData } = useCourseLiveMeetings(courseId);
  const markComplete = useMarkLessonComplete();
  const trackView = useTrackPageView();
  const { toast } = useToast();

  const nextLiveAt = useMemo(() => {
    const now = Date.now();
    const upcoming = (liveData?.meetings ?? [])
      .filter((m) => new Date(m.scheduled_at).getTime() >= now)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    return upcoming[0]?.scheduled_at ?? null;
  }, [liveData]);

  const livesCalendarHref = useMemo(() => {
    const qs = new URLSearchParams();
    if (learnerEmail) qs.set("email", learnerEmail);
    if (isPreview) qs.set("preview", "admin");
    qs.set("view", "calendar");
    return `/lms/${courseId}/home?${qs.toString()}`;
  }, [courseId, learnerEmail, isPreview]);

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const mainRef = useRef<HTMLElement>(null);

  const { data: lessonBlocks = [] } = useLessonBlocks(selectedLessonId);
  const { data: myDeposit, isLoading: myDepositLoading } = useMyDeposit(
    selectedLessonId || undefined,
    learnerEmail || undefined,
  );

  // Group lessons by module
  const lessonsByModule = useMemo(() => {
    const map: Record<string, LmsLesson[]> = {};
    for (const m of modules) {
      map[m.id] = allLessons.filter((l) => l.module_id === m.id).sort((a, b) => a.position - b.position);
    }
    return map;
  }, [modules, allLessons]);

  // Flat ordered list of lessons — special sections excluded from progression
  const orderedLessons = useMemo(() => {
    return modules
      .filter((m) => !m.is_special_section)
      .flatMap((m) => lessonsByModule[m.id] || []);
  }, [modules, lessonsByModule]);

  // Auto-select lesson: prefer ?lesson= param, else first lesson
  useEffect(() => {
    if (!selectedLessonId && orderedLessons.length > 0) {
      const target = initialLessonId && orderedLessons.find((l) => l.id === initialLessonId);
      setSelectedLessonId(target ? target.id : orderedLessons[0].id);
    }
  }, [orderedLessons, selectedLessonId]);

  // Track page view when lesson changes
  useEffect(() => {
    if (selectedLessonId && courseId && (learnerEmail || isPreview)) {
      trackView.mutate({ courseId, lessonId: selectedLessonId, learnerEmail: learnerEmail || "admin-preview" });
    }
  }, [selectedLessonId, courseId]);

  // Scroll to top of lesson content when navigating
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [selectedLessonId]);

  const selectedLesson = orderedLessons.find((l) => l.id === selectedLessonId);
  const currentIndex = orderedLessons.findIndex((l) => l.id === selectedLessonId);

  const completedIds = new Set(progress.filter((p) => p.status === "completed").map((p) => p.lesson_id));
  const completedRegularCount = orderedLessons.filter((l) => completedIds.has(l.id)).length;
  const completionPct = orderedLessons.length > 0
    ? Math.round((completedRegularCount / orderedLessons.length) * 100)
    : 0;

  // Shared home-sidebar data
  const navigate = useNavigate();
  const sidebarModules = useMemo(
    () => modules.filter((m) => !m.is_special_section).map((m) => ({ id: m.id, title: m.title, position: m.position })),
    [modules],
  );
  const lessonCountByModule = useMemo(() => {
    const out: Record<string, number> = {};
    for (const m of modules) out[m.id] = (lessonsByModule[m.id] || []).length;
    return out;
  }, [modules, lessonsByModule]);
  const lessonsDoneByModule = useMemo(() => {
    const out: Record<string, number> = {};
    for (const m of modules) {
      const lessons = lessonsByModule[m.id] || [];
      out[m.id] = lessons.filter((l) => completedIds.has(l.id)).length;
    }
    return out;
  }, [modules, lessonsByModule, completedIds]);
  const moduleStatuses = useMemo<Record<string, ModuleStatus>>(() => {
    const out: Record<string, ModuleStatus> = {};
    for (const m of modules) {
      const total = lessonCountByModule[m.id] ?? 0;
      const done = lessonsDoneByModule[m.id] ?? 0;
      out[m.id] = total > 0 && done === total ? "completed" : done > 0 ? "in_progress" : "not_started";
    }
    return out;
  }, [modules, lessonCountByModule, lessonsDoneByModule]);
  const handleSidebarModuleClick = useCallback((moduleId: string) => {
    const first = (lessonsByModule[moduleId] || [])[0];
    if (first) setSelectedLessonId(first.id);
  }, [lessonsByModule]);
  const handleSidebarViewChange = useCallback((view: string) => {
    const qs = new URLSearchParams();
    if (learnerEmail) qs.set("email", learnerEmail);
    if (isPreview) qs.set("preview", "admin");
    qs.set("view", view);
    navigate(`/lms/${courseId}/home?${qs.toString()}`);
  }, [courseId, learnerEmail, isPreview, navigate]);


  // Check if a module is unlocked (all lessons of prerequisite module completed)
  const isModuleUnlocked = (mod: LmsModule) => {
    if (!mod.is_prerequisite_gated || !mod.prerequisite_module_id) return true;
    const prereqLessons = lessonsByModule[mod.prerequisite_module_id] || [];
    return prereqLessons.every((l) => completedIds.has(l.id));
  };

  // Does the current lesson require a submitted deposit before completion?
  const requiresDeposit = useMemo(() => {
    return lessonBlocks.some((b) => {
      if (b.hidden) return false;
      if (b.type === "work_deposit") {
        return (b.content as WorkDepositBlockContent).require_deposit_to_complete !== false;
      }
      if (b.type === "exercise") {
        const c = b.content as ExerciseBlockContent;
        return !!(c.work_deposit_enabled && c.work_deposit && c.work_deposit.require_deposit_to_complete !== false);
      }
      return false;
    });
  }, [lessonBlocks]);

  const handleMarkComplete = async () => {
    if (!selectedLesson || !courseId || !learnerEmail) return;
    if (requiresDeposit && !myDepositLoading && !myDeposit) {
      toast({
        title: "Déposez d'abord votre travail",
        description: "Cette leçon ne peut être marquée comme terminée qu'après le dépôt de votre travail.",
      });
      return;
    }
    await markComplete.mutateAsync({
      course_id: courseId,
      lesson_id: selectedLesson.id,
      learner_email: learnerEmail,
    });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "auto" });
    document.querySelectorAll<HTMLElement>("[data-lms-scroll]").forEach((el) => {
      el.scrollTop = 0;
    });
  };

  const goNext = () => {
    if (currentIndex < orderedLessons.length - 1) {
      setSelectedLessonId(orderedLessons[currentIndex + 1].id);
      scrollToTop();
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setSelectedLessonId(orderedLessons[currentIndex - 1].id);
      scrollToTop();
    }
  };

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Chargement du cours...</p>
      </div>
    );
  }

  if (course.status !== "published" && !isPreview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center space-y-4">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-bold">Cours pas encore publié</h2>
            <p className="text-muted-foreground">Ce cours n'est pas encore disponible. Veuillez réessayer plus tard.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!learnerEmail && !isPreview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center space-y-4">
            <BookOpen className="w-12 h-12 mx-auto text-primary" />
            <h2 className="text-xl font-bold">{course.title}</h2>
            <p className="text-muted-foreground">Accès non autorisé. Veuillez utiliser le lien fourni par votre formateur.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F2F4F4", fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif" }}>
      {isPreview && (
        <div className="bg-amber-500 text-white text-center text-sm py-1 font-medium">
          🔍 Mode prévisualisation admin — les progressions ne sont pas enregistrées
        </div>
      )}
      {/* Top bar */}
      <LearnerCourseHeader
        courseTitle={course.title}
        learnerEmail={learnerEmail}
        isPreview={isPreview}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />


      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — desktop: fixed left, mobile: overlay */}

        {/* Desktop sidebar */}
        <aside
          className={`hidden lg:flex flex-col shrink-0 transition-all duration-300 overflow-hidden ${sidebarOpen ? "w-[360px]" : "w-0"}`}
          aria-hidden={!sidebarOpen}
          style={{ padding: sidebarOpen ? "1rem" : undefined }}
        >
          {sidebarOpen && (
            <div style={{ background: "#ffffff", borderRadius: 20, boxShadow: "0 2px 12px rgba(16,24,32,0.06)", overflow: "hidden", display: "flex", flexDirection: "column", flex: 1 }}>
              
              {courseId && (
                <CourseHomeSidebar
                  courseId={courseId}
                  email={learnerEmail}
                  isPreview={isPreview}
                  modules={sidebarModules}
                  moduleStatuses={moduleStatuses}
                  lessonCountByModule={lessonCountByModule}
                  lessonsDoneByModule={lessonsDoneByModule}
                  communityPreviewCount={course.community_preview_count ?? 2}
                  meetings={liveData?.meetings ?? []}
                  activeView="home"
                  onModuleClick={handleSidebarModuleClick}
                  onViewChange={handleSidebarViewChange}
                  lessonsByModule={lessonsByModule}
                  activeLessonId={selectedLessonId}
                  completedLessonIds={completedIds}
                  onLessonClick={setSelectedLessonId}
                />
              )}
            </div>
          )}
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <>
            <div
              className="lg:hidden fixed inset-0 z-40 bg-black/30"
              onClick={() => setSidebarOpen(false)}
            />
            <div
              className="lg:hidden fixed left-0 top-16 bottom-0 z-50 w-[300px] overflow-hidden"
              style={{ background: "#ffffff", boxShadow: "4px 0 20px rgba(16,24,32,0.1)" }}
            >
              {courseId && (
                <CourseHomeSidebar
                  courseId={courseId}
                  email={learnerEmail}
                  isPreview={isPreview}
                  modules={sidebarModules}
                  moduleStatuses={moduleStatuses}
                  lessonCountByModule={lessonCountByModule}
                  lessonsDoneByModule={lessonsDoneByModule}
                  communityPreviewCount={course.community_preview_count ?? 2}
                  meetings={liveData?.meetings ?? []}
                  activeView="home"
                  onModuleClick={(id) => { handleSidebarModuleClick(id); setSidebarOpen(false); }}
                  onViewChange={(v) => { handleSidebarViewChange(v); setSidebarOpen(false); }}
                  lessonsByModule={lessonsByModule}
                  activeLessonId={selectedLessonId}
                  completedLessonIds={completedIds}
                  onLessonClick={(id) => { setSelectedLessonId(id); setSidebarOpen(false); }}
                />
              )}
            </div>
          </>
        )}


        {/* Main content */}
        <main ref={mainRef} className="flex-1 overflow-auto">
          {selectedLesson ? (
            <div className="p-4 sm:p-6">
              <div className="flex flex-col gap-6 items-start">

                {/* ── Center column ──────────────────────────────────────── */}
                <div className="space-y-4">

              {/* ── Card 1 : titre + contenu pédagogique ─────────────────── */}
              <div style={{ background: "#ffffff", borderRadius: 20, padding: "1.75rem", boxShadow: "0 2px 8px rgba(16,24,32,0.05)" }}>
                <div className="flex items-start gap-3 mb-6">
                  <h1
                    className="text-2xl sm:text-4xl font-bold flex-1 leading-tight"
                    style={{ color: "#101820" }}
                  >
                    {selectedLesson.title}
                  </h1>
                  {selectedLesson.estimated_minutes > 0 && (
                    <span
                      className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                      style={{ background: "#F2F4F4", color: "rgba(16,24,32,0.55)" }}
                    >
                      <Clock className="w-3 h-3" /> {selectedLesson.estimated_minutes} min
                    </span>
                  )}
                </div>
                <LessonContent
                  lessonId={selectedLesson.id}
                  courseId={courseId}
                  learnerEmail={learnerEmail}
                  renderQuiz={(quizId) => (
                    <QuizPlayer quizId={quizId} learnerEmail={learnerEmail} onComplete={handleMarkComplete} />
                  )}
                  renderAssignment={(lessonId) => (
                    <AssignmentSubmitter lessonId={lessonId} learnerEmail={learnerEmail} />
                  )}
                  renderWorkDeposit={(lessonId, config) => courseId ? (
                    <WorkDepositSection
                      lessonId={lessonId}
                      courseId={courseId}
                      moduleId={selectedLesson.module_id}
                      learnerEmail={learnerEmail}
                      rawConfig={config as unknown as WorkDepositConfig}
                      lessonTitle={selectedLesson.title}
                    />
                  ) : null}
                  legacy={
                    <>
                      {selectedLesson.lesson_type === "text" && selectedLesson.content_html && (
                        <div
                          className="prose prose-sm max-w-none prose-img:max-w-full prose-img:h-auto prose-img:rounded-lg"
                          dangerouslySetInnerHTML={{ __html: selectedLesson.content_html }}
                        />
                      )}
                      {selectedLesson.lesson_type === "video" && selectedLesson.video_url && (
                        <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                          {selectedLesson.video_url.includes("youtube") || selectedLesson.video_url.includes("youtu.be") ? (
                            <iframe
                              src={selectedLesson.video_url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                              className="w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          ) : selectedLesson.video_url.includes("vimeo") ? (
                            <iframe
                              src={selectedLesson.video_url.replace("vimeo.com/", "player.vimeo.com/video/")}
                              className="w-full h-full"
                              allow="autoplay; fullscreen"
                              allowFullScreen
                            />
                          ) : (
                            <video src={selectedLesson.video_url} controls className="w-full h-full" />
                          )}
                        </div>
                      )}
                      {selectedLesson.lesson_type === "quiz" && selectedLesson.quiz_id && (
                        <QuizPlayer
                          quizId={selectedLesson.quiz_id}
                          learnerEmail={learnerEmail}
                          onComplete={handleMarkComplete}
                        />
                      )}
                      {selectedLesson.lesson_type === "assignment" && (
                        <div className="space-y-4">
                          {selectedLesson.content_html && (
                            <div
                              className="prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: selectedLesson.content_html }}
                            />
                          )}
                          <AssignmentSubmitter lessonId={selectedLesson.id} learnerEmail={learnerEmail} />
                        </div>
                      )}
                      {selectedLesson.lesson_type === "image" && (
                        <div className="space-y-4">
                          {selectedLesson.image_url && (
                            <div className="rounded-lg overflow-hidden bg-muted border w-full">
                              <img
                                src={selectedLesson.image_url}
                                alt={selectedLesson.title}
                                className="w-full h-auto object-contain max-h-[70vh]"
                              />
                            </div>
                          )}
                          {selectedLesson.content_html && (
                            <div
                              className="prose prose-sm max-w-none prose-img:max-w-full prose-img:h-auto prose-img:rounded-lg"
                              dangerouslySetInnerHTML={{ __html: selectedLesson.content_html }}
                            />
                          )}
                        </div>
                      )}
                      {selectedLesson.lesson_type === "file" && (
                        <div className="space-y-4">
                          {selectedLesson.file_url && (
                            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg border">
                              <Paperclip className="w-5 h-5 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{selectedLesson.file_name || "Fichier"}</p>
                                {selectedLesson.file_size && (
                                  <p className="text-sm text-muted-foreground">
                                    {selectedLesson.file_size < 1024 * 1024
                                      ? `${(selectedLesson.file_size / 1024).toFixed(1)} Ko`
                                      : `${(selectedLesson.file_size / (1024 * 1024)).toFixed(1)} Mo`}
                                  </p>
                                )}
                              </div>
                              <Button asChild>
                                <a href={selectedLesson.file_url} target="_blank" rel="noopener noreferrer" download>
                                  <Download className="w-4 h-4 mr-2" /> Télécharger
                                </a>
                              </Button>
                            </div>
                          )}
                          {selectedLesson.content_html && (
                            <div
                              className="prose prose-sm max-w-none prose-img:max-w-full prose-img:h-auto prose-img:rounded-lg"
                              dangerouslySetInnerHTML={{ __html: selectedLesson.content_html }}
                            />
                          )}
                        </div>
                      )}
                    </>
                  }
                />
              </div>

              {/* ── Card 2 : commentaires ────────────────────────────────── */}
              {!isPreview && learnerEmail && (
                <div style={{ background: "#ffffff", borderRadius: 20, padding: "1.5rem 1.75rem", boxShadow: "0 2px 8px rgba(16,24,32,0.05)" }}>
                  <LessonComments
                    courseId={courseId!}
                    lessonId={selectedLesson.id}
                    learnerEmail={learnerEmail}
                    learnerName={learnerEmail}
                  />
                </div>
              )}

              {/* ── Card 3 : navigation précédent / terminé / suivant ────── */}
              <div style={{ background: "#ffffff", borderRadius: 20, padding: "1.25rem", boxShadow: "0 2px 8px rgba(16,24,32,0.05)" }}>
                <div className="flex items-center gap-3">
                  <Button variant="outline" className="flex-1" onClick={goPrev} disabled={currentIndex <= 0}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Précédent
                  </Button>
                  {!completedIds.has(selectedLesson.id) && selectedLesson.lesson_type !== "quiz" ? (
                    <Button
                      onClick={handleMarkComplete}
                      disabled={markComplete.isPending}
                      className="flex-1"
                      style={{ background: "#FFD100", color: "#101820", fontWeight: 700 }}
                    >
                      {markComplete.isPending
                        ? <Spinner className="mr-2" />
                        : <CheckCircle2 className="w-4 h-4 mr-2" />}
                      Terminé
                    </Button>
                  ) : completedIds.has(selectedLesson.id) ? (
                    <div className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold" style={{ color: "#69c3c4" }}>
                      <CheckCircle2 className="w-4 h-4" /> Terminé
                    </div>
                  ) : null}
                  <Button variant="outline" className="flex-1" onClick={goNext} disabled={currentIndex >= orderedLessons.length - 1}>
                    Suivant <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>

                </div>{/* end center column */}

              </div>{/* end grid */}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full" style={{ color: "rgba(16,24,32,0.4)" }}>
              Sélectionnez une leçon pour commencer
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Right panel: module progress ─────────────────────────────────────────────
function ModuleProgressWidget({
  selectedLesson,
  modules,
  lessonsByModule,
  completedIds,
}: {
  selectedLesson: LmsLesson;
  modules: LmsModule[];
  lessonsByModule: Record<string, LmsLesson[]>;
  completedIds: Set<string>;
}) {
  const modLessons = lessonsByModule[selectedLesson.module_id] ?? [];
  const done = modLessons.filter((l) => completedIds.has(l.id)).length;
  const total = modLessons.length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (circ * Math.min(pct, 100)) / 100;

  return (
    <div style={{ background: "#ffffff", borderRadius: 20, padding: "1.25rem", boxShadow: "0 2px 8px rgba(16,24,32,0.05)" }}>
      <p className="text-sm font-bold mb-4" style={{ color: "#101820" }}>Ma progression dans ce module</p>
      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: 80, height: 80 }}>
          <svg width={80} height={80} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={40} cy={40} r={r} fill="none" stroke="#EDEDED" strokeWidth={7} />
            <circle
              cx={40} cy={40} r={r} fill="none"
              stroke={pct === 100 ? "#69C3C4" : "#FFD100"} strokeWidth={7}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              style={{ transition: "stroke-dasharray 0.8s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold leading-none" style={{ color: "#101820" }}>{Math.round(pct)}%</span>
          </div>
        </div>
        <div>
          <p className="text-base font-bold leading-tight" style={{ color: "#101820" }}>{done} / {total} séquences</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(16,24,32,0.45)" }}>terminées</p>
        </div>
      </div>
      <button
        className="mt-4 flex items-center gap-1 text-xs font-medium"
        style={{ color: "rgba(16,24,32,0.45)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
      >
        Voir toutes les séquences <ChevronRight size={12} />
      </button>
    </div>
  );
}

// ── Right panel: community ────────────────────────────────────────────────────
const COMMUNITY_AVATAR_COLORS = ["#FFD100", "#69C3C4", "#F2A541", "#A8D8A8", "#D4A5A5"];

function CommunityWidget({ courseId, learnerEmail }: { courseId: string; learnerEmail: string }) {
  const { data: forums = [] } = useCourseForums(courseId);
  const mainForum = forums[0] ?? null;
  const { data: allPosts = [] } = useForumPosts(mainForum?.id);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentPosts = allPosts.filter((p) => new Date(p.created_at) >= weekAgo);
  const recentAuthors = [...new Set(recentPosts.map((p) => p.author_email))].slice(0, 4);

  return (
    <div style={{ background: "#FFFBEA", borderRadius: 20, padding: "1.25rem", border: "1px solid rgba(255,209,0,0.3)", boxShadow: "0 2px 8px rgba(16,24,32,0.05)" }}>
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare size={15} style={{ color: "#101820" }} />
        <p className="text-sm font-bold" style={{ color: "#101820" }}>Besoin d'échanger ?</p>
      </div>
      <p className="text-xs leading-relaxed mb-3" style={{ color: "rgba(16,24,32,0.6)" }}>
        Posez vos questions, partagez vos essais et progressez ensemble.
      </p>
      {recentAuthors.length > 0 && (
        <div className="flex items-center mb-3">
          {recentAuthors.map((a, i) => (
            <div
              key={a}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white"
              style={{ background: COMMUNITY_AVATAR_COLORS[i % COMMUNITY_AVATAR_COLORS.length], color: "#101820", marginLeft: i > 0 ? -6 : 0 }}
            >
              {a.split("@")[0].slice(0, 2).toUpperCase()}
            </div>
          ))}
        </div>
      )}
      <CommunityCtaButton email={learnerEmail} />
      {recentPosts.length > 0 && (
        <p className="text-[11px] text-center mt-2" style={{ color: "rgba(16,24,32,0.45)" }}>
          {recentPosts.length} apprenant{recentPosts.length > 1 ? "s ont" : " a"} déposé {recentPosts.length > 1 ? "leur" : "son"} exercice cette semaine.
        </p>
      )}
    </div>
  );
}

// ── Right panel: tip ─────────────────────────────────────────────────────────
function TipWidget() {
  return (
    <div style={{ background: "#ffffff", borderRadius: 20, padding: "1.25rem", boxShadow: "0 2px 8px rgba(16,24,32,0.05)" }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#F2F4F4" }}>
          <Sparkles size={14} style={{ color: "#101820" }} />
        </div>
        <p className="text-sm font-bold" style={{ color: "#101820" }}>Conseil pratique</p>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: "rgba(16,24,32,0.6)" }}>
        Pas besoin de savoir dessiner pour avancer ! Ce qui compte, c'est de s'exprimer et de prendre plaisir à pratiquer.
      </p>
    </div>
  );
}

// ── Community CTA ────────────────────────────────────────────────────────────
function CommunityCtaBlock() {
  return (
    <div
      style={{
        background: "#FFFBEA",
        borderRadius: 20,
        border: "1px solid rgba(255,209,0,0.35)",
        padding: "1.25rem 1.5rem",
        display: "flex",
        alignItems: "center",
        gap: "1.25rem",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#101820", marginBottom: 4 }}>
          Besoin d'un retour sur votre travail ?
        </p>
        <p style={{ fontSize: "0.8125rem", color: "rgba(16,24,32,0.6)", margin: 0 }}>
          Partagez votre exercice dans l'espace de pratique et échangez avec les autres apprenants.
        </p>
      </div>
      <a
        href="/espace-apprenant"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "0.5625rem 1.125rem",
          background: "#FFD100",
          color: "#101820",
          borderRadius: 12,
          fontWeight: 700,
          fontSize: "0.8125rem",
          textDecoration: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        Aller à l'espace de pratique
      </a>
    </div>
  );
}






// ---- Legacy work-deposit opt-in (suppressed when a work_deposit block exists) ----
function LegacyWorkDepositOptIn({
  lessonId,
  enabled,
  courseId,
  moduleId,
  learnerEmail,
  rawConfig,
  lessonTitle,
}: {
  lessonId: string;
  enabled: boolean;
  courseId: string;
  moduleId: string;
  learnerEmail: string;
  rawConfig: WorkDepositConfig;
  lessonTitle: string;
}) {
  const { data: blocks = [] } = useLessonBlocks(lessonId);
  if (!enabled) return null;
  // If a work_deposit block already covers this lesson, defer to it.
  if (blocks.some((b) => b.type === "work_deposit" && !b.hidden)) return null;
  return (
    <WorkDepositSection
      lessonId={lessonId}
      courseId={courseId}
      moduleId={moduleId}
      learnerEmail={learnerEmail}
      rawConfig={rawConfig}
      lessonTitle={lessonTitle}
    />
  );
}

// ---- Lesson Content (block-based with legacy fallback) ----
function LessonContent({
  lessonId,
  courseId,
  learnerEmail,
  renderQuiz,
  renderAssignment,
  renderWorkDeposit,
  legacy,
}: {
  lessonId: string;
  courseId?: string | null;
  learnerEmail?: string;
  renderQuiz: (quizId: string, lessonId: string) => React.ReactNode;
  renderAssignment: (lessonId: string) => React.ReactNode;
  renderWorkDeposit: (lessonId: string, config: import("@/types/lms-blocks").WorkDepositBlockContent) => React.ReactNode;
  /** Rendered when no blocks exist for this lesson (e.g. before backfill). */
  legacy: React.ReactNode;
}) {
  const { data: blocks = [], isLoading } = useLessonBlocks(lessonId);
  if (isLoading) return null;
  if (blocks.length === 0) return <>{legacy}</>;
  return (
    <LessonBlocksPlayer
      blocks={blocks}
      renderQuiz={renderQuiz}
      renderAssignment={renderAssignment}
      renderWorkDeposit={renderWorkDeposit}
      learnerEmail={learnerEmail}
      shortcodeCourseId={courseId}
    />
  );
}

// ---- Assignment Submitter ----
function AssignmentSubmitter({ lessonId, learnerEmail }: { lessonId: string; learnerEmail: string }) {
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const submitAssignment = useSubmitAssignment();
  const { data: submissions = [] } = useLearnerSubmissions(lessonId, learnerEmail);
  const { toast } = useToast();

  const handleSubmit = async () => {
    setUploading(true);
    try {
      let fileData: { url: string; name: string; size: number } | undefined;
      if (file) {
        fileData = await uploadAssignmentFile(file, lessonId, learnerEmail);
      }
      await submitAssignment.mutateAsync({
        lesson_id: lessonId,
        learner_email: learnerEmail,
        comment: comment || undefined,
        file_url: fileData?.url,
        file_name: fileData?.name,
        file_size: fileData?.size,
      });
      setComment("");
      setFile(null);
      toast({ title: "Devoir soumis !" });
    } catch (err: unknown) {
      toastError(toast, err instanceof Error ? err : "Erreur inconnue");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {submissions.length > 0 && (
        <Card>
          <CardContent className="py-4 space-y-2">
            <p className="text-sm font-medium">Soumissions précédentes</p>
            {submissions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 text-sm p-2 rounded-md bg-muted/50">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1">
                  {s.file_name && <span className="font-medium">{s.file_name}</span>}
                  {s.comment && <p className="text-xs text-muted-foreground">{s.comment}</p>}
                </div>
                <Badge variant="outline" className="text-xs">
                  {s.status === "graded" ? `${s.score} pts` : s.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Remettre votre travail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Fichier</Label>
            <Input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              accept=".pdf,.doc,.docx,.zip,.jpg,.png,.mp4"
            />
            {file && <p className="text-xs text-muted-foreground mt-1">{file.name} ({(file.size / 1024 / 1024).toFixed(1)} Mo)</p>}
          </div>
          <div>
            <Label>Commentaire (optionnel)</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Un commentaire pour le formateur..."
              rows={3}
            />
          </div>
          <Button onClick={handleSubmit} disabled={uploading || (!file && !comment)}>
            {uploading ? "Envoi en cours..." : "Soumettre le devoir"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function HomeMenuLink({
  courseId,
  learnerEmail,
  isPreview,
  onClick,
}: {
  courseId: string | undefined;
  learnerEmail: string;
  isPreview: boolean;
  onClick?: () => void;
}) {
  if (!courseId) return null;
  const params = new URLSearchParams();
  if (learnerEmail) params.set("email", learnerEmail);
  if (isPreview) params.set("preview", "admin");
  const qs = params.toString();
  const href = `/lms/${courseId}/home${qs ? `?${qs}` : ""}`;
  return (
    <a
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors hover:bg-black/5"
      style={{
        color: "#101820",
        borderBottom: "1px solid rgba(16,24,32,0.07)",
        fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif",
        textDecoration: "none",
      }}
    >
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
        style={{ background: "#FFD100" }}
      >
        <Home size={13} style={{ color: "#101820" }} />
      </span>
      Accueil
      {isPreview && (
        <span
          className="ml-auto text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ background: "rgba(16,24,32,0.08)", color: "rgba(16,24,32,0.55)" }}
        >
          Éditable
        </span>
      )}
    </a>
  );
}
