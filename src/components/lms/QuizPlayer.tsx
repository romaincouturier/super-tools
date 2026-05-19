import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useQuiz, useQuizQuestions, useSubmitQuizAttempt } from "@/hooks/useLms";
import {
  CheckCircle2, XCircle, Trophy, RotateCcw, ChevronRight,
  HelpCircle, Lightbulb, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  quizId: string;
  learnerEmail: string;
  onComplete: () => void;
}

type Phase = "question" | "feedback" | "results";

interface AnswerState {
  selected: string[];
  isCorrect: boolean;
  pointsEarned: number;
}

function getPassMessage(percentage: number): string {
  if (percentage === 100) return "Score parfait ! Vous maîtrisez ce sujet.";
  if (percentage >= 80) return "Excellent travail ! Continuez comme ça.";
  return "Bonne réussite ! Vous pouvez avancer.";
}

function getFailMessage(percentage: number, passingScore: number): string {
  if (percentage === 0) return "Prenez le temps de relire le cours avant de réessayer.";
  if (percentage >= passingScore - 15)
    return `Vous y êtes presque ! Score minimum : ${passingScore}%. Réessayez.`;
  return `Score minimum requis : ${passingScore}%. Relisez le cours et réessayez.`;
}

export default function QuizPlayer({ quizId, learnerEmail, onComplete }: Props) {
  const { data: quiz } = useQuiz(quizId);
  const { data: questions = [] } = useQuizQuestions(quizId);
  const submitAttempt = useSubmitQuizAttempt();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("question");
  const [selected, setSelected] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [shortAnswer, setShortAnswer] = useState("");

  if (!quiz || questions.length === 0)
    return <p className="text-muted-foreground text-sm">Chargement du quiz…</p>;

  const q = questions[currentIndex];
  const totalQuestions = questions.length;
  const progress = ((currentIndex) / totalQuestions) * 100;
  const isMultiSelect = q.multi_select ?? false;
  const isOpenType = q.question_type === "open" || q.question_type === "fill_blank" || q.question_type === "short_answer";
  const isSituation = q.question_type === "situation";

  // Compute correctness for current question
  const checkAnswer = (): { isCorrect: boolean; pointsEarned: number } => {
    if (isOpenType || isSituation) {
      // Short answer / open: auto-correct only if correct_answer is set
      if (!q.correct_answer) return { isCorrect: true, pointsEarned: q.points };
      const isCorrect = shortAnswer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
      return { isCorrect, pointsEarned: isCorrect ? q.points : 0 };
    }

    const correctLabels = q.options.filter((o) => o.is_correct).map((o) => o.label);
    if (isMultiSelect) {
      const allCorrect = correctLabels.every((l) => selected.includes(l));
      const noWrong = selected.every((l) => correctLabels.includes(l));
      const isCorrect = allCorrect && noWrong && selected.length > 0;
      return { isCorrect, pointsEarned: isCorrect ? q.points : 0 };
    }
    const isCorrect = selected.length === 1 && correctLabels.includes(selected[0]);
    return { isCorrect, pointsEarned: isCorrect ? q.points : 0 };
  };

  const handleConfirm = () => {
    const { isCorrect, pointsEarned } = checkAnswer();
    const answer = isOpenType || isSituation ? [shortAnswer] : selected;
    setAnswers((prev) => ({
      ...prev,
      [q.id]: { selected: answer, isCorrect, pointsEarned },
    }));
    setPhase("feedback");
  };

  const handleNext = async () => {
    const nextIndex = currentIndex + 1;
    setSelected([]);
    setShortAnswer("");

    if (nextIndex < totalQuestions) {
      setCurrentIndex(nextIndex);
      setPhase("question");
    } else {
      // All questions answered — submit
      const allAnswers = { ...answers };
      // Include current question answer (already set in handleConfirm)
      const score = Object.values(allAnswers).reduce((s, a) => s + a.pointsEarned, 0);
      const maxScore = questions.reduce((s, q) => s + q.points, 0);
      const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
      const passed = percentage >= (quiz.passing_score || 70);

      const answerDetails = questions.map((q) => {
        const a = allAnswers[q.id];
        return {
          question_id: q.id,
          answer: a?.selected.join(", ") || "",
          is_correct: a?.isCorrect ?? false,
          points_earned: a?.pointsEarned ?? 0,
        };
      });

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

      if (passed) onComplete();
      setPhase("results");
    }
  };

  const handleRetry = () => {
    setCurrentIndex(0);
    setPhase("question");
    setSelected([]);
    setShortAnswer("");
    setAnswers({});
  };

  const toggleOption = (label: string) => {
    if (isMultiSelect) {
      setSelected((prev) =>
        prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
      );
    } else {
      setSelected([label]);
    }
  };

  // ── Results screen ────────────────────────────────────────────────────────
  if (phase === "results") {
    const score = Object.values(answers).reduce((s, a) => s + a.pointsEarned, 0);
    const maxScore = questions.reduce((s, q) => s + q.points, 0);
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const passed = percentage >= (quiz.passing_score || 70);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-3 py-4">
          {passed ? (
            <Trophy className="w-16 h-16 mx-auto text-amber-500" />
          ) : (
            <AlertCircle className="w-16 h-16 mx-auto text-destructive" />
          )}
          <h3 className="text-2xl font-bold">
            {passed ? "Quiz réussi !" : "Quiz non validé"}
          </h3>
          <p className="text-muted-foreground">
            {passed ? getPassMessage(percentage) : getFailMessage(percentage, quiz.passing_score || 70)}
          </p>
          <div className="inline-flex items-center gap-3">
            <span className="text-3xl font-bold text-foreground">{percentage}%</span>
            <span className="text-sm text-muted-foreground">
              {score} / {maxScore} points
            </span>
          </div>
          {/* Score bar */}
          <div className="relative w-48 mx-auto">
            <Progress value={percentage} className="h-3" />
            {/* Passing score marker */}
            <div
              className="absolute top-0 h-3 w-0.5 bg-foreground/40"
              style={{ left: `${quiz.passing_score || 70}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">Score minimum : {quiz.passing_score || 70}%</p>
        </div>

        {/* Corrections */}
        {quiz.show_correct_answers && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Corrections</h4>
            {questions.map((q, i) => {
              const a = answers[q.id];
              const isCorrect = a?.isCorrect ?? false;
              const correctLabels = q.options.filter((o) => o.is_correct).map((o) => o.label);
              return (
                <div
                  key={q.id}
                  className={cn(
                    "rounded-xl border p-4 space-y-2",
                    isCorrect ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200",
                  )}
                >
                  <div className="flex items-start gap-2">
                    {isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <p className="text-sm font-medium">
                      {i + 1}. {q.question_text}
                    </p>
                  </div>
                  <div className="ml-6 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Votre réponse :{" "}
                      <strong>{a?.selected.join(", ") || "—"}</strong>
                    </p>
                    {!isCorrect && correctLabels.length > 0 && (
                      <p className="text-xs text-emerald-700">
                        Bonne réponse : <strong>{correctLabels.join(", ")}</strong>
                      </p>
                    )}
                    {(q.explanation || q.feedback_incorrect) && !isCorrect && (
                      <p className="text-xs text-muted-foreground italic">
                        💡 {q.feedback_incorrect || q.explanation}
                      </p>
                    )}
                    {q.feedback_correct && isCorrect && (
                      <p className="text-xs text-emerald-700 italic">
                        ✓ {q.feedback_correct}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!passed && (
          <Button onClick={handleRetry} variant="outline" className="w-full gap-2">
            <RotateCcw className="w-4 h-4" /> Réessayer
          </Button>
        )}
      </div>
    );
  }

  // ── Question card ─────────────────────────────────────────────────────────
  const currentAnswer = answers[q.id];
  const feedbackCorrect = currentAnswer?.isCorrect;

  const canConfirm = isOpenType || isSituation
    ? shortAnswer.trim().length > 0
    : selected.length > 0;

  return (
    <div className="space-y-5">
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Question {currentIndex + 1} sur {totalQuestions}</span>
          {q.points > 1 && (
            <Badge variant="outline" className="text-xs">{q.points} points</Badge>
          )}
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Question card */}
      <div className={cn(
        "rounded-2xl border-2 p-6 space-y-5 transition-colors",
        phase === "feedback"
          ? feedbackCorrect
            ? "border-emerald-400 bg-emerald-50/50"
            : "border-red-300 bg-red-50/50"
          : "border-border bg-card",
      )}>
        {/* Notion / difficulty */}
        {(q.notion || q.difficulty_level) && (
          <div className="flex gap-2">
            {q.notion && (
              <Badge variant="secondary" className="text-xs">{q.notion}</Badge>
            )}
            {q.difficulty_level && (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  q.difficulty_level === "easy" && "border-emerald-300 text-emerald-700",
                  q.difficulty_level === "medium" && "border-amber-300 text-amber-700",
                  q.difficulty_level === "hard" && "border-red-300 text-red-700",
                )}
              >
                {q.difficulty_level === "easy" ? "Facile" : q.difficulty_level === "medium" ? "Moyen" : "Difficile"}
              </Badge>
            )}
          </div>
        )}

        {/* Question text */}
        <div>
          {q.title && (
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{q.title}</p>
          )}
          <p className="text-base font-semibold leading-relaxed">{q.question_text}</p>
          {isMultiSelect && phase === "question" && (
            <p className="text-xs text-muted-foreground mt-1">Plusieurs réponses possibles</p>
          )}
        </div>

        {/* Hint */}
        {q.hint && phase === "question" && (
          <div className="flex items-start gap-2 bg-muted/60 rounded-lg px-3 py-2 text-xs text-muted-foreground">
            <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{q.hint}</span>
          </div>
        )}

        {/* Answer options */}
        {!isOpenType && !isSituation && (
          <div className="space-y-2.5">
            {q.options.map((opt, j) => {
              const isSelected = selected.includes(opt.label) || currentAnswer?.selected.includes(opt.label);
              const isCorrectOpt = opt.is_correct;
              let optClass = "border-border bg-background hover:border-primary/50 hover:bg-primary/5 cursor-pointer";

              if (phase === "feedback") {
                if (isCorrectOpt) optClass = "border-emerald-400 bg-emerald-50 text-emerald-800";
                else if (isSelected && !isCorrectOpt) optClass = "border-red-300 bg-red-50 text-red-700";
                else optClass = "border-border bg-muted/30 opacity-60";
              } else if (isSelected) {
                optClass = "border-primary bg-primary/10 text-primary";
              }

              return (
                <button
                  key={j}
                  type="button"
                  disabled={phase === "feedback"}
                  onClick={() => toggleOption(opt.label)}
                  className={cn(
                    "w-full text-left rounded-xl border-2 px-4 py-3 text-sm transition-all flex items-center gap-3",
                    optClass,
                  )}
                >
                  <span className={cn(
                    "w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center text-xs font-bold transition-colors",
                    isSelected && phase !== "feedback" ? "border-primary bg-primary text-primary-foreground" : "border-current",
                    phase === "feedback" && isCorrectOpt && "border-emerald-500 bg-emerald-500 text-white",
                    phase === "feedback" && isSelected && !isCorrectOpt && "border-red-400 bg-red-400 text-white",
                  )}>
                    {String.fromCharCode(65 + j)}
                  </span>
                  <span className="flex-1">{opt.label}</span>
                  {phase === "feedback" && isCorrectOpt && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  {phase === "feedback" && isSelected && !isCorrectOpt && (
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Open / fill_blank / short_answer / situation */}
        {(isOpenType || isSituation) && (
          <Textarea
            value={phase === "feedback" ? (currentAnswer?.selected[0] ?? "") : shortAnswer}
            onChange={(e) => setShortAnswer(e.target.value)}
            disabled={phase === "feedback"}
            placeholder={isSituation ? "Décrivez votre approche…" : "Votre réponse…"}
            rows={3}
            className="resize-none"
          />
        )}

        {/* Feedback banner */}
        {phase === "feedback" && (
          <div className={cn(
            "rounded-xl p-4 space-y-1",
            feedbackCorrect ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800",
          )}>
            <div className="flex items-center gap-2 font-semibold text-sm">
              {feedbackCorrect ? (
                <><CheckCircle2 className="w-4 h-4" /> Bonne réponse !</>
              ) : (
                <><XCircle className="w-4 h-4" /> Mauvaise réponse</>
              )}
            </div>
            {/* Per-question feedback */}
            {feedbackCorrect && currentAnswer && q.feedback_correct && (
              <p className="text-sm">{q.feedback_correct}</p>
            )}
            {!feedbackCorrect && q.feedback_incorrect && (
              <p className="text-sm">{q.feedback_incorrect}</p>
            )}
            {/* Generic explanation */}
            {q.explanation && (
              <p className="text-sm flex items-start gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {q.explanation}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {phase === "question" ? (
        <Button
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="w-full"
          size="lg"
        >
          Valider
        </Button>
      ) : (
        <Button
          onClick={handleNext}
          disabled={submitAttempt.isPending}
          className="w-full gap-2"
          size="lg"
        >
          {currentIndex + 1 < totalQuestions ? (
            <>Question suivante <ChevronRight className="w-4 h-4" /></>
          ) : submitAttempt.isPending ? (
            "Calcul du score…"
          ) : (
            "Voir les résultats"
          )}
        </Button>
      )}
    </div>
  );
}
