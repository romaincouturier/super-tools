import { useState, useMemo, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
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
  LmsLesson, LmsModule,
} from "@/hooks/useLms";
import QuizPlayer from "@/components/lms/QuizPlayer";
import LessonComments from "@/components/lms/LessonComments";
import LessonBlocksPlayer from "@/components/lms/blocks/LessonBlocksPlayer";
import CourseProgressSidebar from "@/components/lms/CourseProgressSidebar";
import { useLessonBlocks } from "@/hooks/useLmsBlocks";
import {
  BookOpen, CheckCircle2, ChevronRight, ChevronLeft,
  Clock, Paperclip, Download, Menu, Bell,
} from "lucide-react";
import SupertiltLogo from "@/components/SupertiltLogo";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import WorkDepositSection from "@/components/lms/WorkDepositSection";
import type { WorkDepositConfig } from "@/types/lms-work-deposit";

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
  const markComplete = useMarkLessonComplete();
  const trackView = useTrackPageView();

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Group lessons by module
  const lessonsByModule = useMemo(() => {
    const map: Record<string, LmsLesson[]> = {};
    for (const m of modules) {
      map[m.id] = allLessons.filter((l) => l.module_id === m.id).sort((a, b) => a.position - b.position);
    }
    return map;
  }, [modules, allLessons]);

  // Flat ordered list of lessons
  const orderedLessons = useMemo(() => {
    return modules.flatMap((m) => lessonsByModule[m.id] || []);
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

  const selectedLesson = orderedLessons.find((l) => l.id === selectedLessonId);
  const currentIndex = orderedLessons.findIndex((l) => l.id === selectedLessonId);

  const completedIds = new Set(progress.filter((p) => p.status === "completed").map((p) => p.lesson_id));
  const completionPct = orderedLessons.length > 0
    ? Math.round((completedIds.size / orderedLessons.length) * 100)
    : 0;

  // Check if a module is unlocked (all lessons of prerequisite module completed)
  const isModuleUnlocked = (mod: LmsModule) => {
    if (!mod.is_prerequisite_gated || !mod.prerequisite_module_id) return true;
    const prereqLessons = lessonsByModule[mod.prerequisite_module_id] || [];
    return prereqLessons.every((l) => completedIds.has(l.id));
  };

  const handleMarkComplete = async () => {
    if (!selectedLesson || !courseId || !learnerEmail) return;
    await markComplete.mutateAsync({
      course_id: courseId,
      lesson_id: selectedLesson.id,
      learner_email: learnerEmail,
    });
  };

  const goNext = () => {
    if (currentIndex < orderedLessons.length - 1) {
      setSelectedLessonId(orderedLessons[currentIndex + 1].id);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setSelectedLessonId(orderedLessons[currentIndex - 1].id);
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
      <header
        className="sticky top-0 z-30 flex flex-col bg-white shrink-0"
        style={{ borderBottom: "1px solid #EDEDED" }}
      >
        <div className="flex items-center gap-3 h-16 px-6">
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors hover:bg-black/5 shrink-0"
            aria-label={sidebarOpen ? "Fermer le menu" : "Ouvrir le menu de parcours"}
          >
            <Menu size={18} style={{ color: "#101820" }} />
          </button>

          {/* Logo — learners go to their portal, admins/trainers go to the back-office LMS */}
          <a
            href={learnerEmail && !isPreview ? "/espace-apprenant" : "/lms"}
            className="shrink-0 flex items-center"
            title="Retour aux formations"
          >
            <SupertiltLogo className="h-8" />
          </a>

          {/* Vertical divider — desktop only */}
          <div
            className="hidden lg:block w-px h-7 shrink-0"
            style={{ background: "#EDEDED" }}
          />

          {/* Breadcrumb + course title */}
          <div className="flex-1 min-w-0">
            <p
              className="text-[11px] font-medium leading-none mb-0.5 hidden lg:block"
              style={{ color: "#9CA3AF" }}
            >
              Mes formations
            </p>
            <p
              className="text-sm font-semibold truncate leading-tight"
              style={{ color: "#101820" }}
            >
              {course.title}
            </p>
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Progress — desktop */}
            <div className="hidden md:flex flex-col items-end gap-1.5 mr-1">
              <span className="text-[11px] font-medium" style={{ color: "#101820" }}>
                {completionPct === 100
                  ? "Formation terminée"
                  : `Progression : ${completionPct} %`}
              </span>
              <div
                className="w-28 h-[3px] rounded-full overflow-hidden"
                style={{ background: "#F2F4F4" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${completionPct}%`,
                    background: completionPct === 100 ? "#69c3c4" : "#FFD100",
                  }}
                />
              </div>
            </div>

            {/* Notification bell */}
            <button
              className="hidden sm:flex w-9 h-9 items-center justify-center rounded-full transition-colors hover:bg-black/5"
              aria-label="Notifications"
            >
              <Bell size={18} style={{ color: "#101820" }} />
            </button>

            {/* Avatar with initials */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 select-none cursor-default"
              style={{ background: "#FFD100", color: "#101820" }}
              title={learnerEmail || "Administrateur"}
            >
              {getLearnerInitials(learnerEmail)}
            </div>
          </div>
        </div>

        {/* Mobile progress bar — thin line below the main row */}
        <div className="md:hidden h-[3px] w-full" style={{ background: "#F2F4F4" }}>
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${completionPct}%`,
              background: completionPct === 100 ? "#69c3c4" : "#FFD100",
            }}
          />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — desktop: fixed left, mobile: overlay */}

        {/* Desktop sidebar */}
        <aside
          className={`hidden lg:flex flex-col shrink-0 transition-all duration-300 overflow-hidden ${sidebarOpen ? "w-[316px]" : "w-0"}`}
          aria-hidden={!sidebarOpen}
          style={{ padding: sidebarOpen ? "1rem" : undefined }}
        >
          {sidebarOpen && (
            <div style={{ background: "#ffffff", borderRadius: 20, boxShadow: "0 2px 12px rgba(16,24,32,0.06)", overflow: "hidden", display: "flex", flexDirection: "column", flex: 1 }}>
              <CourseProgressSidebar
                modules={modules}
                lessonsByModule={lessonsByModule}
                completedIds={completedIds}
                selectedLessonId={selectedLessonId}
                onSelectLesson={setSelectedLessonId}
                isModuleUnlocked={isModuleUnlocked}
              />
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
              <CourseProgressSidebar
                modules={modules}
                lessonsByModule={lessonsByModule}
                completedIds={completedIds}
                selectedLessonId={selectedLessonId}
                onSelectLesson={(id) => { setSelectedLessonId(id); setSidebarOpen(false); }}
                isModuleUnlocked={isModuleUnlocked}
              />
            </div>
          </>
        )}


        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {selectedLesson ? (
            <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">

              {/* ── Card 1 : titre + contenu pédagogique ─────────────────── */}
              <div style={{ background: "#ffffff", borderRadius: 20, padding: "1.75rem", boxShadow: "0 2px 8px rgba(16,24,32,0.05)" }}>
                <div className="flex items-start gap-3 mb-6">
                  <h2
                    className="text-2xl sm:text-3xl font-bold flex-1 leading-tight"
                    style={{ color: "#101820" }}
                  >
                    {selectedLesson.title}
                  </h2>
                  {selectedLesson.estimated_minutes > 0 && (
                    <span
                      className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                      style={{ background: "#F2F4F4", color: "rgba(16,24,32,0.55)" }}
                    >
                      <Clock className="w-3 h-3" /> {selectedLesson.estimated_minutes} min
                    </span>
                  )}
                </div>

                {/* Lesson content (block-based with legacy fallback) */}
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

              {/* ── CTA communauté ───────────────────────────────────────── */}
              <CommunityCtaBlock />

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

// ── Helpers ──────────────────────────────────────────────────────────────────
function getLearnerInitials(email: string): string {
  if (!email) return "?";
  const name = email.split("@")[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2 && parts[0] && parts[1])
    return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
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
