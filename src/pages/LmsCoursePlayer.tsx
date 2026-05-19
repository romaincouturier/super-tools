import { useState, useMemo, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { useLessonBlocks } from "@/hooks/useLmsBlocks";
import {
  BookOpen, CheckCircle2, Circle, ChevronRight, ChevronLeft,
  Play, FileText, HelpCircle, ClipboardList, Video, Lock,
  Trophy, Clock, ImageIcon, Paperclip, Download,
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

  const lessonTypeIcon = (type: string) => {
    switch (type) {
      case "video": return <Video className="w-4 h-4" />;
      case "quiz": return <HelpCircle className="w-4 h-4" />;
      case "assignment": return <ClipboardList className="w-4 h-4" />;
      case "image": return <ImageIcon className="w-4 h-4" />;
      case "file": return <Paperclip className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {isPreview && (
        <div className="bg-amber-500 text-white text-center text-sm py-1 font-medium">
          🔍 Mode prévisualisation admin — les progressions ne sont pas enregistrées
        </div>
      )}
      {/* Top bar */}
      <header className="h-14 border-b bg-card flex items-center px-4 gap-4 shrink-0">
        <SupertiltLogo className="h-6" />
        <Separator orientation="vertical" className="h-6" />
        <h1 className="text-sm font-medium truncate flex-1">{course.title}</h1>
        <div className="flex items-center gap-2">
          <Progress value={completionPct} className="w-24 h-2" />
          <span className="text-xs text-muted-foreground">{completionPct}%</span>
        </div>
        {completionPct === 100 && (
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <Trophy className="w-3 h-3 mr-1" /> Terminé
          </Badge>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`border-r bg-card transition-all ${sidebarOpen ? "w-64 sm:w-72" : "w-0"} overflow-hidden shrink-0`}>
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {modules.map((mod) => {
                const lessons = lessonsByModule[mod.id] || [];
                const unlocked = isModuleUnlocked(mod);
                const modCompleted = lessons.every((l) => completedIds.has(l.id));

                return (
                  <div key={mod.id}>
                    <div className="flex items-center gap-2 mb-2">
                      {modCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      ) : !unlocked ? (
                        <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {mod.title}
                      </span>
                    </div>
                    {lessons.map((lesson) => {
                      const isComplete = completedIds.has(lesson.id);
                      const isActive = lesson.id === selectedLessonId;
                      return (
                        <button
                          key={lesson.id}
                          disabled={!unlocked}
                          onClick={() => setSelectedLessonId(lesson.id)}
                          className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors
                            ${isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent"}
                            ${!unlocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                          `}
                        >
                          {isComplete ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          )}
                          {lessonTypeIcon(lesson.lesson_type)}
                          <span className="truncate flex-1">{lesson.title}</span>
                          {lesson.estimated_minutes > 0 && (
                            <span className="text-xs text-muted-foreground">{lesson.estimated_minutes}m</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {selectedLesson ? (
            <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
              <div className="flex items-start gap-3">
                <h2 className="text-2xl sm:text-3xl font-bold flex-1 leading-tight text-foreground">{selectedLesson.title}</h2>
                {selectedLesson.estimated_minutes > 0 && (
                  <Badge variant="outline">
                    <Clock className="w-3 h-3 mr-1" /> {selectedLesson.estimated_minutes} min
                  </Badge>
                )}
              </div>

              {/* Lesson content (block-based with legacy fallback) */}
              <LessonContent
                lessonId={selectedLesson.id}
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


              {/* Legacy per-lesson opt-in (renders only if no work_deposit block exists for this lesson) */}
              {courseId && (
                <LegacyWorkDepositOptIn
                  lessonId={selectedLesson.id}
                  enabled={!!selectedLesson.work_deposit_enabled}
                  courseId={courseId}
                  moduleId={selectedLesson.module_id}
                  learnerEmail={learnerEmail}
                  rawConfig={(selectedLesson.work_deposit_config || {}) as WorkDepositConfig}
                  lessonTitle={selectedLesson.title}
                />
              )}

              {/* Comments */}
              {!isPreview && learnerEmail && (
                <LessonComments
                  courseId={courseId!}
                  lessonId={selectedLesson.id}
                  learnerEmail={learnerEmail}
                  learnerName={learnerEmail}
                />
              )}

              {/* Navigation */}
              <div className="rounded-lg border bg-card p-4 space-y-3">
                {!completedIds.has(selectedLesson.id) && selectedLesson.lesson_type !== "quiz" && (
                  <Button
                    size="lg"
                    onClick={handleMarkComplete}
                    disabled={markComplete.isPending}
                  >
                    {markComplete.isPending
                      ? <Spinner className="mr-2" />
                      : <CheckCircle2 className="w-5 h-5 mr-2" />}
                    Marquer comme terminé
                  </Button>
                )}
                {completedIds.has(selectedLesson.id) && (
                  <div className="flex items-center justify-center gap-2 py-1 text-sm font-medium text-primary">
                    <CheckCircle2 className="w-4 h-4" /> Leçon terminée
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Button variant="outline" className="flex-1" onClick={goPrev} disabled={currentIndex <= 0}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Précédent
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={goNext} disabled={currentIndex >= orderedLessons.length - 1}>
                    Suivant <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Sélectionnez une leçon pour commencer
            </div>
          )}
        </main>
      </div>
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
  learnerEmail,
  renderQuiz,
  renderAssignment,
  renderWorkDeposit,
  legacy,
}: {
  lessonId: string;
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
