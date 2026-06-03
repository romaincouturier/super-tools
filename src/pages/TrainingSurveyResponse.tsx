import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Star, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type Question = {
  id: string;
  type: "text" | "textarea" | "single_choice" | "multiple_choice" | "rating" | "nps" | "date";
  label: string;
  description: string | null;
  required: boolean;
  position: number;
  options: { label: string }[] | null;
};

type SurveyPayload = {
  survey: {
    id: string;
    title: string;
    intro_message: string | null;
    thank_you_message: string;
    closes_at: string | null;
    is_closed: boolean;
  };
  recipient: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
  questions: Question[];
  has_responded: boolean;
  previous_answers: { question_id: string; value: string | null; values: string[] | null }[];
} | { error: string };

export default function TrainingSurveyResponse() {
  const { token = "" } = useParams<{ token: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["training-survey-token", token],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_training_survey_by_token", { p_token: token });
      if (error) throw error;
      return data as SurveyPayload;
    },
    enabled: !!token,
  });

  const submit = useMutation({
    mutationFn: async (answers: { question_id: string; value?: string; values?: string[] }[]) => {
      const { data: res, error } = await (supabase as any).rpc("submit_training_survey", {
        p_token: token,
        p_answers: answers,
      });
      if (error) throw error;
      return res as { success: boolean; error?: string };
    },
  });

  const [step, setStep] = useState<"intro" | number | "done">("intro");
  const [answers, setAnswers] = useState<Record<string, { value: string; values: string[] }>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (data && !("error" in data) && data.previous_answers?.length) {
      const map: Record<string, { value: string; values: string[] }> = {};
      for (const a of data.previous_answers) {
        map[a.question_id] = { value: a.value ?? "", values: a.values ?? [] };
      }
      setAnswers(map);
    }
  }, [data]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" className="text-primary" /></div>;
  }

  if (!data || ("error" in data)) {
    const msg = data && "error" in data
      ? data.error === "inactive" ? "Ce sondage n'est plus actif." : "Lien invalide ou expiré."
      : "Sondage introuvable.";
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-3">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Sondage indisponible</h2>
          <p className="text-muted-foreground">{msg}</p>
        </div>
      </div>
    );
  }

  if (data.survey.is_closed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-3 max-w-md">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Sondage clôturé</h2>
          <p className="text-muted-foreground">
            Ce sondage est clôturé depuis le{" "}
            {data.survey.closes_at && new Date(data.survey.closes_at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}.
          </p>
        </div>
      </div>
    );
  }

  const questions = [...data.questions].sort((a, b) => a.position - b.position);
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

  const handleSubmit = async () => {
    try {
      const res = await submit.mutateAsync(
        questions.map((q) => ({
          question_id: q.id,
          value: q.type !== "multiple_choice" ? getAnswer(q.id).value || undefined : undefined,
          values: q.type === "multiple_choice" ? getAnswer(q.id).values : undefined,
        })),
      );
      if (!res.success) {
        setError(res.error === "closed" ? "Le sondage vient d'être clôturé." : "Une erreur est survenue.");
        return;
      }
      setStep("done");
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    }
  };

  const handleNext = () => {
    if (!canAdvance()) { setError("Cette question est obligatoire."); return; }
    setError("");
    if (currentIndex < questions.length - 1) setStep(currentIndex + 1);
    else handleSubmit();
  };

  const progress = typeof step === "number" ? ((step + 1) / Math.max(questions.length, 1)) * 100 : 0;
  const recipientName = data.recipient.first_name || data.recipient.email.split("@")[0];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {typeof step === "number" && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-muted z-50">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-xl">
          {step === "done" && (
            <div className="text-center space-y-6 animate-in fade-in-0 duration-300">
              <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto" />
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Réponses enregistrées !</h2>
                <p className="text-muted-foreground text-lg whitespace-pre-wrap">{data.survey.thank_you_message}</p>
                {data.survey.closes_at && !data.survey.is_closed && (
                  <p className="text-sm text-muted-foreground mt-4">
                    Vous pouvez revenir modifier vos réponses jusqu'au{" "}
                    {new Date(data.survey.closes_at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}.
                  </p>
                )}
              </div>
            </div>
          )}

          {step === "intro" && (
            <div className="space-y-8 animate-in fade-in-0 duration-300">
              <div className="space-y-3">
                <h1 className="text-3xl font-bold tracking-tight">{data.survey.title}</h1>
                <p className="text-muted-foreground">Bonjour {recipientName},</p>
                {data.survey.intro_message && (
                  <p className="text-muted-foreground text-lg leading-relaxed whitespace-pre-wrap">{data.survey.intro_message}</p>
                )}
                {data.has_responded && (
                  <p className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2">
                    Vous avez déjà répondu à ce sondage. Vos réponses sont pré-remplies — vous pouvez les modifier.
                  </p>
                )}
                {data.survey.closes_at && (
                  <p className="text-sm text-muted-foreground">
                    Clôture le{" "}
                    {new Date(data.survey.closes_at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}.
                  </p>
                )}
              </div>
              <Button size="lg" onClick={() => questions.length > 0 && setStep(0)} className="gap-2">
                {data.has_responded ? "Revoir mes réponses" : "Commencer"} <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
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
                {currentQuestion.description && <p className="text-muted-foreground">{currentQuestion.description}</p>}
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
                <Button onClick={handleNext} disabled={submit.isPending}>
                  {submit.isPending ? <Spinner size="sm" /> : currentIndex === questions.length - 1 ? "Envoyer" : (
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

function QuestionRenderer({
  question, value, multiValue, onChange, onMultiChange,
}: {
  question: Question;
  value: string;
  multiValue: string[];
  onChange: (v: string) => void;
  onMultiChange: (v: string[]) => void;
}) {
  if (question.type === "text") {
    return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Votre réponse..." className="text-base" autoFocus />;
  }
  if (question.type === "textarea") {
    return <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder="Votre réponse..." rows={5} className="text-base resize-none" autoFocus />;
  }
  if (question.type === "date") {
    return <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="text-base w-48" autoFocus />;
  }
  if (question.type === "single_choice") {
    return (
      <div className="space-y-2">
        {(question.options ?? []).map((opt, i) => (
          <button key={i} onClick={() => onChange(opt.label)} className={cn(
            "w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-base",
            value === opt.label ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-primary/50",
          )}>{opt.label}</button>
        ))}
      </div>
    );
  }
  if (question.type === "multiple_choice") {
    const toggle = (label: string) =>
      multiValue.includes(label) ? onMultiChange(multiValue.filter((v) => v !== label)) : onMultiChange([...multiValue, label]);
    return (
      <div className="space-y-2">
        {(question.options ?? []).map((opt, i) => (
          <button key={i} onClick={() => toggle(opt.label)} className={cn(
            "w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-base flex items-center justify-between",
            multiValue.includes(opt.label) ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-primary/50",
          )}>
            {opt.label}
            {multiValue.includes(opt.label) && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
          </button>
        ))}
      </div>
    );
  }
  if (question.type === "rating") {
    const num = Number(value) || 0;
    return (
      <div className="flex gap-2">
        {[1,2,3,4,5].map((s) => (
          <button key={s} onClick={() => onChange(String(s))} className="transition-transform hover:scale-110">
            <Star className={cn("h-10 w-10 transition-colors", s <= num ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
          </button>
        ))}
      </div>
    );
  }
  if (question.type === "nps") {
    return (
      <div className="space-y-3">
        <div className="flex gap-1 flex-wrap">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <button key={n} onClick={() => onChange(String(n))} className={cn(
              "w-10 h-10 rounded-lg border-2 text-sm font-medium transition-all",
              Number(value) === n && value !== "" ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50",
            )}>{n}</button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Pas du tout</span><span>Tout à fait</span>
        </div>
      </div>
    );
  }
  return null;
}
