import { useState } from "react";
import { useParams } from "react-router-dom";
import { Star, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useSurveyByToken, useSubmitSurveyResponse, type SurveyQuestion } from "@/hooks/useMissionSurvey";

// ── Question renderers ─────────────────────────────────────────────────

function QuestionRenderer({
  question,
  value,
  multiValue,
  onChange,
  onMultiChange,
}: {
  question: SurveyQuestion;
  value: string;
  multiValue: string[];
  onChange: (v: string) => void;
  onMultiChange: (v: string[]) => void;
}) {
  if (question.type === "text") {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Votre réponse..."
        className="text-base"
        autoFocus
      />
    );
  }

  if (question.type === "textarea") {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Votre réponse..."
        rows={5}
        className="text-base resize-none"
        autoFocus
      />
    );
  }

  if (question.type === "date") {
    return (
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-base w-48"
        autoFocus
      />
    );
  }

  if (question.type === "single_choice") {
    const options = question.options ?? [];
    return (
      <div className="space-y-2">
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => onChange(opt.label)}
            className={cn(
              "w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-base",
              value === opt.label
                ? "border-primary bg-primary/5 font-medium"
                : "border-border hover:border-primary/50"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === "multiple_choice") {
    const options = question.options ?? [];
    const toggle = (label: string) => {
      if (multiValue.includes(label)) {
        onMultiChange(multiValue.filter((v) => v !== label));
      } else {
        onMultiChange([...multiValue, label]);
      }
    };
    return (
      <div className="space-y-2">
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => toggle(opt.label)}
            className={cn(
              "w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-base flex items-center justify-between",
              multiValue.includes(opt.label)
                ? "border-primary bg-primary/5 font-medium"
                : "border-border hover:border-primary/50"
            )}
          >
            {opt.label}
            {multiValue.includes(opt.label) && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === "rating") {
    const max = 5;
    const num = Number(value) || 0;
    return (
      <div className="flex gap-2">
        {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
          <button
            key={star}
            onClick={() => onChange(String(star))}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={cn("h-10 w-10 transition-colors", star <= num ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")}
            />
          </button>
        ))}
      </div>
    );
  }

  if (question.type === "nps") {
    const num = Number(value);
    return (
      <div className="space-y-3">
        <div className="flex gap-1 flex-wrap">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <button
              key={n}
              onClick={() => onChange(String(n))}
              className={cn(
                "w-10 h-10 rounded-lg border-2 text-sm font-medium transition-all",
                Number(value) === n && value !== ""
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-primary/50"
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Pas du tout</span>
          <span>Tout à fait</span>
        </div>
      </div>
    );
  }

  return null;
}

// ── Intro step ────────────────────────────────────────────────────────

function IntroStep({
  title,
  intro,
  name,
  email,
  requireIdentity,
  onNameChange,
  onEmailChange,
  onStart,
}: {
  title: string;
  intro: string | null;
  name: string;
  email: string;
  requireIdentity: boolean;
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onStart: () => void;
}) {
  const canStart = !requireIdentity || (name.trim() !== "" && email.trim() !== "");
  return (
    <div className="space-y-8 animate-in fade-in-0 duration-300">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {intro && <p className="text-muted-foreground text-lg leading-relaxed">{intro}</p>}
      </div>
      <div className="space-y-4 max-w-sm">
        <div className="space-y-1.5">
          <Label>Votre prénom et nom {requireIdentity ? <span className="text-destructive">*</span> : "(optionnel)"}</Label>
          <Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Jean Dupont" />
        </div>
        <div className="space-y-1.5">
          <Label>Votre email {requireIdentity ? <span className="text-destructive">*</span> : "(optionnel)"}</Label>
          <Input type="email" value={email} onChange={(e) => onEmailChange(e.target.value)} placeholder="jean@example.com" />
        </div>
      </div>
      <Button size="lg" onClick={onStart} disabled={!canStart} className="gap-2">
        Commencer <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}


// ── Thank you step ────────────────────────────────────────────────────

function ThankYouStep({ message }: { message: string }) {
  return (
    <div className="text-center space-y-6 animate-in fade-in-0 duration-300">
      <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto" />
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Réponses envoyées !</h2>
        <p className="text-muted-foreground text-lg whitespace-pre-wrap">{message}</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────

export default function SurveyPublic() {
  const { token = "" } = useParams<{ token: string }>();
  const { data: survey, isLoading } = useSurveyByToken(token);
  const submitResponse = useSubmitSurveyResponse();

  const [step, setStep] = useState<"intro" | number | "done">("intro");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, { value: string; values: string[] }>>({});
  const [error, setError] = useState("");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Sondage introuvable</h2>
          <p className="text-muted-foreground">Ce lien n'est pas valide ou le sondage a été désactivé.</p>
        </div>
      </div>
    );
  }

  const questions = [...(survey.mission_survey_questions ?? [])].sort((a, b) => a.position - b.position);
  const currentIndex = typeof step === "number" ? step : -1;
  const currentQuestion = currentIndex >= 0 ? questions[currentIndex] : null;

  const getAnswer = (qId: string) => answers[qId] ?? { value: "", values: [] };
  const setAnswer = (qId: string, patch: Partial<{ value: string; values: string[] }>) =>
    setAnswers((prev) => ({ ...prev, [qId]: { ...getAnswer(qId), ...patch } }));

  const canAdvance = () => {
    if (!currentQuestion) return true;
    if (!currentQuestion.required) return true;
    const a = getAnswer(currentQuestion.id);
    if (currentQuestion.type === "multiple_choice") return a.values.length > 0;
    return a.value.trim() !== "";
  };

  const handleNext = () => {
    if (!canAdvance()) {
      setError("Cette question est obligatoire.");
      return;
    }
    setError("");
    if (currentIndex < questions.length - 1) {
      setStep(currentIndex + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    try {
      await submitResponse.mutateAsync({
        surveyId: survey.id,
        respondentName: name,
        respondentEmail: email,
        answers: questions.map((q) => {
          const a = getAnswer(q.id);
          return {
            questionId: q.id,
            value: q.type !== "multiple_choice" ? (a.value || undefined) : undefined,
            values: q.type === "multiple_choice" ? a.values : undefined,
          };
        }),
      });
      setStep("done");
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    }
  };

  const progress = typeof step === "number" ? ((step + 1) / questions.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress bar */}
      {typeof step === "number" && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-muted z-50">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-xl">
          {step === "done" && <ThankYouStep message={survey.thank_you_message} />}

          {step === "intro" && (
            <IntroStep
              title={survey.title || "Sondage"}
              intro={survey.intro_message}
              requireIdentity={!!survey.require_identity}
              name={name}
              email={email}
              onNameChange={setName}
              onEmailChange={setEmail}
              onStart={() => {
                if (questions.length === 0) return;
                setStep(0);
              }}
            />
          )}

          {typeof step === "number" && currentQuestion && (
            <div className="space-y-8 animate-in fade-in-0 slide-in-from-right-4 duration-300" key={currentQuestion.id}>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">
                  Question {currentIndex + 1} / {questions.length}
                </p>
                <h2 className="text-2xl font-semibold leading-snug">
                  {currentQuestion.label}
                  {currentQuestion.required && <span className="text-red-500 ml-1">*</span>}
                </h2>
                {currentQuestion.description && (
                  <p className="text-muted-foreground">{currentQuestion.description}</p>
                )}
              </div>

              <QuestionRenderer
                question={currentQuestion}
                value={getAnswer(currentQuestion.id).value}
                multiValue={getAnswer(currentQuestion.id).values}
                onChange={(v) => setAnswer(currentQuestion.id, { value: v })}
                onMultiChange={(v) => setAnswer(currentQuestion.id, { values: v })}
              />

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex items-center gap-3">
                {currentIndex > 0 && (
                  <Button variant="outline" onClick={() => { setError(""); setStep(currentIndex - 1); }}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
                  </Button>
                )}
                <Button onClick={handleNext} disabled={submitResponse.isPending}>
                  {submitResponse.isPending ? (
                    <Spinner size="sm" />
                  ) : currentIndex === questions.length - 1 ? (
                    "Envoyer"
                  ) : (
                    <>Suivant <ChevronRight className="h-4 w-4 ml-1" /></>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
