import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  useCreateQuiz, useQuiz, useQuizQuestions, useCreateQuizQuestion,
  useUpdateLesson, LmsLesson,
} from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, HelpCircle } from "lucide-react";

interface Props {
  lesson: LmsLesson;
  courseId: string;
}

const EMPTY_QUESTION = {
  question_type: "mcq",
  question_text: "",
  title: "",
  hint: "",
  explanation: "",
  feedback_correct: "",
  feedback_incorrect: "",
  difficulty_level: "",
  notion: "",
  multi_select: false,
  points: 1,
  options: [
    { label: "", is_correct: true, feedback: "" },
    { label: "", is_correct: false, feedback: "" },
  ],
  correct_answer: "",
};

export default function LmsQuizBuilder({ lesson, courseId }: Props) {
  const { toast } = useToast();
  const { data: quiz } = useQuiz(lesson.quiz_id || undefined);
  const { data: questions = [] } = useQuizQuestions(lesson.quiz_id || undefined);
  const createQuiz = useCreateQuiz();
  const createQuestion = useCreateQuizQuestion();
  const updateLesson = useUpdateLesson();

  const [newQ, setNewQ] = useState(EMPTY_QUESTION);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleCreateQuiz = async () => {
    const q = await createQuiz.mutateAsync({
      course_id: courseId,
      title: `Quiz — ${lesson.title}`,
    });
    await updateLesson.mutateAsync({ id: lesson.id, quiz_id: q.id });
    toast({ title: "Quiz créé" });
  };

  const hasOptions = newQ.question_type === "mcq" || newQ.question_type === "true_false";
  const hasCorrectAnswer = newQ.question_type === "open" || newQ.question_type === "fill_blank";

  const handleAddQuestion = async () => {
    if (!lesson.quiz_id || !newQ.question_text.trim()) return;
    await createQuestion.mutateAsync({
      quiz_id: lesson.quiz_id,
      question_type: newQ.question_type,
      question_text: newQ.question_text,
      title: newQ.title || null,
      hint: newQ.hint || null,
      explanation: newQ.explanation || null,
      feedback_correct: newQ.feedback_correct || null,
      feedback_incorrect: newQ.feedback_incorrect || null,
      difficulty_level: newQ.difficulty_level || null,
      notion: newQ.notion || null,
      multi_select: newQ.multi_select,
      points: newQ.points,
      position: questions.length,
      options: hasOptions ? newQ.options : [],
      correct_answer: hasCorrectAnswer ? newQ.correct_answer : null,
    });
    setNewQ(EMPTY_QUESTION);
    setShowAdvanced(false);
    toast({ title: "Question ajoutée" });
  };

  if (!lesson.quiz_id) {
    return (
      <div className="text-center py-8 space-y-4">
        <HelpCircle className="w-12 h-12 mx-auto text-muted-foreground/50" />
        <p className="text-muted-foreground">Aucun quiz associé à cette leçon</p>
        <Button onClick={handleCreateQuiz} disabled={createQuiz.isPending}>
          <Plus className="w-4 h-4 mr-2" /> Créer un quiz
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Existing questions */}
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-muted-foreground">
          {questions.length} question{questions.length !== 1 ? "s" : ""}
        </h3>
        {questions.map((q, i) => (
          <Card key={q.id}>
            <CardContent className="py-3 space-y-2">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-xs shrink-0">Q{i + 1}</Badge>
                <div className="flex-1">
                  {q.title && <p className="text-xs text-muted-foreground">{q.title}</p>}
                  <p className="text-sm font-medium">{q.question_text}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {q.notion && <Badge variant="secondary" className="text-xs">{q.notion}</Badge>}
                    {q.difficulty_level && (
                      <Badge variant="outline" className="text-xs capitalize">{q.difficulty_level}</Badge>
                    )}
                    {q.multi_select && <Badge variant="outline" className="text-xs">Multi-select</Badge>}
                  </div>
                  {q.options?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {q.options.map((opt, j) => (
                        <div key={j} className={`text-xs px-2 py-1 rounded ${opt.is_correct ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-muted"}`}>
                          {opt.label} {opt.is_correct && "✓"}
                        </div>
                      ))}
                    </div>
                  )}
                  {q.explanation && (
                    <p className="text-xs text-muted-foreground mt-2 italic">💡 {q.explanation}</p>
                  )}
                </div>
                <Badge variant="secondary" className="text-xs">{q.points} pt{q.points > 1 ? "s" : ""}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add question form */}
      <Card className="border-dashed">
        <CardContent className="pt-4 space-y-4">
          <h4 className="font-medium text-sm">Ajouter une question</h4>

          {/* Type + Points */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={newQ.question_type} onValueChange={(v) => setNewQ({ ...newQ, question_type: v, multi_select: false })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">QCM</SelectItem>
                  <SelectItem value="true_false">Vrai / Faux</SelectItem>
                  <SelectItem value="open">Réponse libre</SelectItem>
                  <SelectItem value="fill_blank">Texte à trous</SelectItem>
                  <SelectItem value="situation">Situation</SelectItem>
                  <SelectItem value="short_answer">Réponse courte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Points</Label>
              <Input type="number" min={1} value={newQ.points} onChange={(e) => setNewQ({ ...newQ, points: +e.target.value })} />
            </div>
          </div>

          {/* Multi-select for MCQ */}
          {newQ.question_type === "mcq" && (
            <div className="flex items-center gap-2">
              <Switch
                id="multi-select"
                checked={newQ.multi_select}
                onCheckedChange={(v) => setNewQ({ ...newQ, multi_select: v })}
              />
              <Label htmlFor="multi-select" className="text-sm">Plusieurs réponses correctes (multi-select)</Label>
            </div>
          )}

          {/* Question text */}
          <div>
            <Label>Question</Label>
            <Textarea
              value={newQ.question_text}
              onChange={(e) => setNewQ({ ...newQ, question_text: e.target.value })}
              placeholder="Posez votre question…"
              rows={2}
            />
          </div>

          {/* Options */}
          {hasOptions && (
            <div className="space-y-2">
              <Label>Options</Label>
              {newQ.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Checkbox
                    checked={opt.is_correct}
                    onCheckedChange={(v) => {
                      const opts = [...newQ.options];
                      opts[i] = { ...opts[i], is_correct: !!v };
                      setNewQ({ ...newQ, options: opts });
                    }}
                  />
                  <Input
                    value={opt.label}
                    onChange={(e) => {
                      const opts = [...newQ.options];
                      opts[i] = { ...opts[i], label: e.target.value };
                      setNewQ({ ...newQ, options: opts });
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1"
                  />
                  {newQ.options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setNewQ({ ...newQ, options: newQ.options.filter((_, j) => j !== i) })}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              {newQ.options.length < 6 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewQ({ ...newQ, options: [...newQ.options, { label: "", is_correct: false, feedback: "" }] })}
                >
                  <Plus className="w-3 h-3 mr-1" /> Option
                </Button>
              )}
            </div>
          )}

          {/* Correct answer for open types */}
          {hasCorrectAnswer && (
            <div>
              <Label>Réponse attendue (optionnel)</Label>
              <Input
                value={newQ.correct_answer}
                onChange={(e) => setNewQ({ ...newQ, correct_answer: e.target.value })}
                placeholder="Réponse correcte (pour auto-correction)"
              />
            </div>
          )}

          {/* Basic explanation */}
          <div>
            <Label>Explication générale (optionnel)</Label>
            <Input
              value={newQ.explanation}
              onChange={(e) => setNewQ({ ...newQ, explanation: e.target.value })}
              placeholder="Explication affichée après réponse"
            />
          </div>

          {/* Advanced fields toggle */}
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground underline"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? "Masquer" : "Afficher"} les champs avancés
          </button>

          {showAdvanced && (
            <div className="space-y-3 border-t pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Titre / contexte (optionnel)</Label>
                  <Input
                    value={newQ.title}
                    onChange={(e) => setNewQ({ ...newQ, title: e.target.value })}
                    placeholder="Ex: Analyse de situation"
                  />
                </div>
                <div>
                  <Label className="text-xs">Notion associée</Label>
                  <Input
                    value={newQ.notion}
                    onChange={(e) => setNewQ({ ...newQ, notion: e.target.value })}
                    placeholder="Ex: SWOT, SMART…"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Indice (hint)</Label>
                <Input
                  value={newQ.hint}
                  onChange={(e) => setNewQ({ ...newQ, hint: e.target.value })}
                  placeholder="Indice affiché pendant la question"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Feedback si bonne réponse</Label>
                  <Input
                    value={newQ.feedback_correct}
                    onChange={(e) => setNewQ({ ...newQ, feedback_correct: e.target.value })}
                    placeholder="Bravo ! Parce que…"
                  />
                </div>
                <div>
                  <Label className="text-xs">Feedback si mauvaise réponse</Label>
                  <Input
                    value={newQ.feedback_incorrect}
                    onChange={(e) => setNewQ({ ...newQ, feedback_incorrect: e.target.value })}
                    placeholder="Pensez à… / La bonne réponse est…"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Difficulté</Label>
                <Select
                  value={newQ.difficulty_level || ""}
                  onValueChange={(v) => setNewQ({ ...newQ, difficulty_level: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Non défini" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Facile</SelectItem>
                    <SelectItem value="medium">Moyen</SelectItem>
                    <SelectItem value="hard">Difficile</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Button onClick={handleAddQuestion} disabled={!newQ.question_text.trim() || createQuestion.isPending}>
            <Plus className="w-4 h-4 mr-2" /> Ajouter la question
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
