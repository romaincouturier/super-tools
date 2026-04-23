import { useState, useMemo, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  useCourse, useCourseModules, useCourseLessons, useModuleLessons,
  useLearnerProgress, useMarkLessonComplete,
  useQuiz, useQuizQuestions, useSubmitQuizAttempt,
  useSubmitAssignment, useLearnerSubmissions, uploadAssignmentFile,
  useLearnerBadges, useTrackPageView,
  LmsLesson, LmsModule, LmsQuizQuestion,
} from "@/hooks/useLms";
import LessonComments from "@/components/lms/LessonComments";
import {
  BookOpen, CheckCircle2, Circle, ChevronRight, ChevronLeft,
  Play, FileText, HelpCircle, ClipboardList, Video, Lock,
  Trophy, Clock, ImageIcon, Paperclip, Download,
} from "lucide-react";
import SupertiltLogo from "@/components/SupertiltLogo";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";

export default function LmsCoursePlayer() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const learnerEmail = searchParams.get("email") || "";
  const isPreview = searchParams.get("preview") === "admin";

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

  // Auto-select first lesson
  useEffect(() => {
    if (!selectedLessonId && orderedLessons.length > 0) {
      setSelectedLessonId(orderedLessons[0].id);
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
    <div className="min-h-screen bg-background flex flex-col">
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
              <div className="flex items-center gap-3">
                {lessonTypeIcon(selectedLesson.lesson_type)}
                <h2 className="text-xl font-bold flex-1">{selectedLesson.title}</h2>
                {selectedLesson.estimated_minutes > 0 && (
                  <Badge variant="outline">
                    <Clock className="w-3 h-3 mr-1" /> {selectedLesson.estimated_minutes} min
                  </Badge>
                )}
              </div>

              {/* Lesson content */}
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
              <Separator />
              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={goPrev} disabled={currentIndex <= 0}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Précédent
                </Button>

                {!completedIds.has(selectedLesson.id) && selectedLesson.lesson_type !== "quiz" && (
                  <Button onClick={handleMarkComplete} disabled={markComplete.isPending}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Marquer comme terminé
                  </Button>
                )}

                {completedIds.has(selectedLesson.id) && (
                  <Badge variant="outline" className="bg-primary/10 text-primary">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Terminé
                  </Badge>
                )}

                <Button variant="outline" onClick={goNext} disabled={currentIndex >= orderedLessons.length - 1}>
                  Suivant <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
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

// ---- Quiz Player ----
function QuizPlayer({ quizId, learnerEmail, onComplete }: { quizId: string; learnerEmail: string; onComplete: () => void }) {
  const { data: quiz } = useQuiz(quizId);
  const { data: questions = [] } = useQuizQuestions(quizId);
  const submitAttempt = useSubmitQuizAttempt();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; maxScore: number; passed: boolean } | null>(null);

  if (!quiz) return <p className="text-muted-foreground">Chargement du quiz...</p>;

  const handleSubmit = async () => {
    let score = 0;
    const maxScore = questions.reduce((sum, q) => sum + q.points, 0);
    const answerDetails: { question_id: string; answer: string; is_correct: boolean; points_earned: number }[] = [];

    for (const q of questions) {
      const userAnswer = answers[q.id] || "";
      let isCorrect = false;

      if (q.question_type === "mcq" || q.question_type === "true_false") {
        const correctOpt = q.options.find((o) => o.is_correct);
        isCorrect = correctOpt?.label === userAnswer;
      } else {
        isCorrect = userAnswer.trim().toLowerCase() === (q.correct_answer || "").trim().toLowerCase();
      }

      if (isCorrect) score += q.points;
      answerDetails.push({ question_id: q.id, answer: userAnswer, is_correct: isCorrect, points_earned: isCorrect ? q.points : 0 });
    }

    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const passed = percentage >= (quiz.passing_score || 70);

    await submitAttempt.mutateAsync({
      quiz_id: quizId,
      learner_email: learnerEmail,
      score,
      max_score: maxScore,
      percentage,
      passed,
      answers: answerDetails,
      completed_at: new Date().toISOString(),
    });

    setResult({ score, maxScore, passed });
    setSubmitted(true);
    if (passed) onComplete();
  };

  if (submitted && result) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-4">
          {result.passed ? (
            <>
              <Trophy className="w-16 h-16 mx-auto text-primary" />
              <h3 className="text-xl font-bold">Bravo ! Quiz réussi 🎉</h3>
            </>
          ) : (
            <>
              <HelpCircle className="w-16 h-16 mx-auto text-destructive" />
              <h3 className="text-xl font-bold">Quiz non validé</h3>
            </>
          )}
          <p className="text-lg">
            Score : <strong>{result.score}/{result.maxScore}</strong> ({Math.round((result.score / result.maxScore) * 100)}%)
          </p>
          <p className="text-sm text-muted-foreground">
            Score minimum requis : {quiz.passing_score}%
          </p>

          {/* Show corrections */}
          {quiz.show_correct_answers && (
            <div className="text-left space-y-3 mt-6">
              {questions.map((q, i) => {
                const userAnswer = answers[q.id] || "";
                const correctOpt = q.options.find((o) => o.is_correct);
                const isCorrect = q.question_type === "mcq" || q.question_type === "true_false"
                  ? correctOpt?.label === userAnswer
                  : userAnswer.trim().toLowerCase() === (q.correct_answer || "").trim().toLowerCase();

                return (
                  <div key={q.id} className={`p-3 rounded-lg border ${isCorrect ? "bg-primary/5 border-primary/20" : "bg-destructive/5 border-destructive/20"}`}>
                    <p className="text-sm font-medium">{i + 1}. {q.question_text}</p>
                    <p className="text-xs mt-1">
                      Votre réponse : <strong>{userAnswer || "—"}</strong>
                      {!isCorrect && correctOpt && (
                        <span className="ml-2 text-primary">→ Correct : {correctOpt.label}</span>
                      )}
                    </p>
                    {q.explanation && <p className="text-xs text-muted-foreground mt-1 italic">💡 {q.explanation}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{quiz.title}</h3>
        <Badge variant="outline">Score minimum : {quiz.passing_score}%</Badge>
      </div>

      {questions.map((q, i) => (
        <Card key={q.id}>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="shrink-0">{i + 1}</Badge>
              <p className="text-sm font-medium">{q.question_text}</p>
            </div>

            {(q.question_type === "mcq" || q.question_type === "true_false") && (
              <RadioGroup
                value={answers[q.id] || ""}
                onValueChange={(v) => setAnswers({ ...answers, [q.id]: v })}
              >
                {q.options.map((opt, j) => (
                  <div key={j} className="flex items-center space-x-2">
                    <RadioGroupItem value={opt.label} id={`${q.id}-${j}`} />
                    <Label htmlFor={`${q.id}-${j}`} className="text-sm">{opt.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {(q.question_type === "open" || q.question_type === "fill_blank") && (
              <Input
                value={answers[q.id] || ""}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                placeholder="Votre réponse..."
              />
            )}
          </CardContent>
        </Card>
      ))}

      <Button
        onClick={handleSubmit}
        disabled={submitAttempt.isPending}
        className="w-full"
        size="lg"
      >
        Soumettre le quiz
      </Button>
    </div>
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
